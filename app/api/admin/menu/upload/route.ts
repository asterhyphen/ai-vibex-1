import crypto from 'crypto'
import { NextRequest, NextResponse } from 'next/server'
import { requireAuthenticatedProfile } from '@/lib/utils/server-auth'

const MAX_IMAGE_BYTES = 5 * 1024 * 1024

export async function POST(request: NextRequest) {
  const auth = await requireAuthenticatedProfile(['admin'])
  if (!auth.ok) return auth.response

  let formData: FormData
  try {
    formData = await request.formData()
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 })
  }

  const file = formData.get('file')
  if (!(file instanceof File)) {
    return NextResponse.json({ error: 'Image file required' }, { status: 400 })
  }

  if (!file.type.startsWith('image/')) {
    return NextResponse.json({ error: 'Only image files allowed' }, { status: 400 })
  }

  if (file.size > MAX_IMAGE_BYTES) {
    return NextResponse.json({ error: 'Image must be <= 5 MB' }, { status: 400 })
  }

  const ext = (file.name.split('.').pop() || 'png').replace(/[^a-zA-Z0-9]/g, '')
  const path = `menu/${crypto.randomUUID()}.${ext}`
  const bytes = new Uint8Array(await file.arrayBuffer())
  const { db } = auth

  const upload = () =>
    db.storage.from('menu-images').upload(path, bytes, {
      contentType: file.type,
      upsert: true,
    })

  let { error } = await upload()
  if (error && /bucket.*not found/i.test(error.message)) {
    await db.storage.createBucket('menu-images', {
      public: true,
      fileSizeLimit: MAX_IMAGE_BYTES,
    })
    const retry = await upload()
    error = retry.error
  }

  if (error) {
    return NextResponse.json(
      { error: error.message || 'Image upload failed' },
      { status: 500 }
    )
  }

  const { data: pub } = db.storage.from('menu-images').getPublicUrl(path)
  return NextResponse.json({ image_url: pub.publicUrl })
}
