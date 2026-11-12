import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { PDFArray, PDFDict, PDFDocument, PDFName } from 'pdf-lib'
import { requireAuthenticatedProfile } from '@/lib/utils/server-auth'

const MAX_FILE_BYTES = 20 * 1024 * 1024 // 20 MB
const MAX_PAGES = 100
const ACTIVE_KEYS = [
  'OpenAction',
  'AA',
  'Launch',
  'URI',
  'EmbeddedFile',
  'EmbeddedFiles',
  'XFA',
  'JS',
  'JavaScript',
] as const

function sanitiseFilename(rawName: string): string {
  const base = rawName
    .split(/[\\/]/)
    .pop() || 'document.pdf'
  const stripped = base
    .replace(/\.\.+/g, '.')
    .replace(/[\x00-\x1f\x7f<>:"|?*]/g, '')
    .trim()
  const safe = stripped || 'document.pdf'
  if (safe.length <= 80) return safe
  const hasPdf = safe.toLowerCase().endsWith('.pdf')
  return hasPdf ? `${safe.slice(0, 76)}.pdf` : safe.slice(0, 80)
}

function hasPdfMagicBytes(bytes: Uint8Array): boolean {
  if (bytes.length < 5) return false
  // %PDF-
  return (
    bytes[0] === 0x25 &&
    bytes[1] === 0x50 &&
    bytes[2] === 0x44 &&
    bytes[3] === 0x46 &&
    bytes[4] === 0x2d
  )
}

function detectActiveContent(doc: PDFDocument): string[] {
  const findings = new Set<string>()

  const inspectDict = (dict: PDFDict | undefined, context: string) => {
    if (!dict) return
    for (const key of ACTIVE_KEYS) {
      if (dict.has(PDFName.of(key))) {
        findings.add(`${context}:/${key}`)
      }
    }
    const names = dict.lookupMaybe(PDFName.of('Names'), PDFDict)
    if (names) {
      for (const key of ['EmbeddedFiles', 'JavaScript']) {
        if (names.has(PDFName.of(key))) {
          findings.add(`${context}:/Names/${key}`)
        }
      }
    }
    const acroForm = dict.lookupMaybe(PDFName.of('AcroForm'), PDFDict)
    if (acroForm && acroForm.has(PDFName.of('XFA'))) {
      findings.add(`${context}:/XFA`)
    }
  }

  inspectDict(doc.catalog, 'catalog')

  for (const [idx, page] of doc.getPages().entries()) {
    const pageDict = page.node
    inspectDict(pageDict, `page-${idx + 1}`)

    const annots = pageDict.lookupMaybe(PDFName.of('Annots'), PDFArray)
    if (annots) {
      for (let i = 0; i < annots.size(); i++) {
        const annotDict = annots.lookupMaybe(i, PDFDict)
        if (!annotDict) continue
        inspectDict(annotDict, `page-${idx + 1}-annot`)
        const actionDict = annotDict.lookupMaybe(PDFName.of('A'), PDFDict)
        if (actionDict) {
          inspectDict(actionDict, `page-${idx + 1}-action`)
        }
      }
    }
  }

  return Array.from(findings)
}

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedProfile()
  if (!auth.ok) return auth.response

  if (
    (auth.profile.role === 'student' || auth.profile.role === 'faculty') &&
    !auth.profile.phone_verified
  ) {
    return NextResponse.json(
      {
        error: 'Phone verification required before submitting print jobs',
        reason: 'PHONE_NOT_VERIFIED',
      },
      { status: 403 }
    )
  }

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json(
      { error: 'Expected multipart/form-data upload', reason: 'INVALID_FORM' },
      { status: 400 }
    )
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json(
      { error: 'No PDF file provided', reason: 'MISSING_FILE' },
      { status: 400 }
    )
  }

  if (file.size === 0) {
    return NextResponse.json(
      { error: 'Uploaded file is empty', reason: 'EMPTY_FILE' },
      { status: 400 }
    )
  }

  if (file.size > MAX_FILE_BYTES) {
    return NextResponse.json(
      { error: 'File exceeds the 20 MB maximum limit', reason: 'FILE_TOO_LARGE' },
      { status: 400 }
    )
  }

  const mimeOk =
    file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf')
  if (!mimeOk) {
    return NextResponse.json(
      { error: 'Only PDF files (.pdf) are accepted', reason: 'INVALID_TYPE' },
      { status: 400 }
    )
  }

  const rawBuffer = new Uint8Array(await file.arrayBuffer())
  if (!hasPdfMagicBytes(rawBuffer)) {
    return NextResponse.json(
      {
        error: 'File failed PDF header check (%PDF- magic bytes missing)',
        reason: 'INVALID_MAGIC_BYTES',
      },
      { status: 400 }
    )
  }

  let srcDoc: PDFDocument
  try {
    srcDoc = await PDFDocument.load(rawBuffer, {
      ignoreEncryption: false,
      throwOnInvalidObject: false,
    })
  } catch (err) {
    const msg = err instanceof Error ? err.message : ''
    const encrypted = /encrypt/i.test(msg)
    return NextResponse.json(
      {
        error: encrypted
          ? 'Encrypted or password-protected PDFs cannot be printed. Please remove the password and retry.'
          : 'PDF appears corrupt or unreadable',
        reason: encrypted ? 'ENCRYPTED_PDF' : 'CORRUPT_PDF',
      },
      { status: 400 }
    )
  }

  const pageCount = srcDoc.getPageCount()
  if (pageCount < 1 || pageCount > MAX_PAGES) {
    return NextResponse.json(
      {
        error: `PDF has ${pageCount} pages. Allowed range is 1–${MAX_PAGES} pages.`,
        reason: 'PAGE_LIMIT_EXCEEDED',
      },
      { status: 400 }
    )
  }

  const detectedActive = detectActiveContent(srcDoc)

  // Rebuild clean PDF by copying only visual pages into a fresh PDFDocument
  let cleanBytes: Uint8Array
  try {
    const cleanDoc = await PDFDocument.create()
    const copiedPages = await cleanDoc.copyPages(srcDoc, srcDoc.getPageIndices())
    copiedPages.forEach((page) => {
      // Strip page-level additional actions or interactive link/launch annotations
      page.node.delete(PDFName.of('AA'))
      const annots = page.node.lookupMaybe(PDFName.of('Annots'), PDFArray)
      if (annots) {
        page.node.delete(PDFName.of('Annots'))
      }
      cleanDoc.addPage(page)
    })
    cleanBytes = await cleanDoc.save()
  } catch {
    return NextResponse.json(
      {
        error: 'Failed to sanitise PDF document pages',
        reason: 'SANITISATION_FAILED',
      },
      { status: 400 }
    )
  }

  const { db, user } = auth
  const cleanDisplayName = sanitiseFilename(file.name)
  const storagePath = `${user.id}/${crypto.randomUUID()}.pdf`

  const uploadOnce = () =>
    db.storage.from('print-jobs').upload(storagePath, cleanBytes, {
      contentType: 'application/pdf',
      upsert: false,
    })

  let { error: uploadError } = await uploadOnce()

  // Auto-create private bucket if missing and service role allows it
  if (uploadError && /bucket.*not found/i.test(uploadError.message)) {
    await db.storage.createBucket('print-jobs', {
      public: false,
      fileSizeLimit: MAX_FILE_BYTES,
      allowedMimeTypes: ['application/pdf'],
    })
    const retry = await uploadOnce()
    uploadError = retry.error
  }

  if (uploadError) {
    return NextResponse.json(
      {
        error: uploadError.message || 'Failed to store sanitised PDF',
        reason: 'STORAGE_ERROR',
      },
      { status: 500 }
    )
  }

  return NextResponse.json({
    file_path: storagePath,
    original_name: cleanDisplayName,
    pages: pageCount,
    sanitised: true,
    stripped_elements: detectedActive,
  })
}
