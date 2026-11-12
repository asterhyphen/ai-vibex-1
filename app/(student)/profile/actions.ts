'use server'

import { z } from 'zod'
import { revalidatePath } from 'next/cache'
import { createClient } from '@/lib/supabase/server'
import { isSupabaseConfigured } from '@/lib/supabase/config'

const UpdateProfileSchema = z.object({
  full_name: z
    .string()
    .trim()
    .min(2, 'Name must be at least 2 characters')
    .max(80, 'Name must be 80 characters or fewer'),
  department: z
    .string()
    .trim()
    .max(80, 'Department must be 80 characters or fewer')
    .optional(),
})

export async function updateProfileAction(input: {
  full_name: string
  department?: string
}): Promise<{
  success: boolean
  full_name?: string | null
  department?: string | null
  error?: string
}> {
  const parsed = UpdateProfileSchema.safeParse(input)
  if (!parsed.success) {
    return {
      success: false,
      error: parsed.error.issues[0]?.message || 'Invalid profile details',
    }
  }

  if (!isSupabaseConfigured()) {
    return {
      success: false,
      error: 'Supabase is not configured yet.',
    }
  }

  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    return {
      success: false,
      error: 'Session expired. Please sign in again.',
    }
  }

  const departmentValue = parsed.data.department?.trim() || null

  const { data, error } = await supabase
    .from('profiles')
    .update({
      full_name: parsed.data.full_name,
      department: departmentValue,
    })
    .eq('user_id', user.id)
    .select('full_name, department')
    .single()

  if (error) {
    return {
      success: false,
      error: error.message || 'Could not update profile',
    }
  }

  revalidatePath('/profile')
  revalidatePath('/home')

  return {
    success: true,
    full_name: data.full_name,
    department: data.department,
  }
}
