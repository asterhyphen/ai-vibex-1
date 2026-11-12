'use client'

import { create } from 'zustand'
import type { User } from '@supabase/supabase-js'
import type { Profile } from '@/lib/types'

export interface SessionStore {
  user: User | null
  profile: Profile | null
  setUser: (user: User | null) => void
  setProfile: (profile: Profile | null) => void
  clearSession: () => void
}

export const useSessionStore = create<SessionStore>((set) => ({
  user: null,
  profile: null,
  setUser: (user) => set({ user }),
  setProfile: (profile) => set({ profile }),
  clearSession: () => set({ user: null, profile: null }),
}))
