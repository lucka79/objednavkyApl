import { createClient } from '@supabase/supabase-js'
import { create } from 'zustand'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

type UserRole = 'admin' | 'expedition' | 'driver' | 'user' | 'mobil' | 'store'


interface Profile {
  id: string
  full_name: string
  avatar_url: string
  role: UserRole
}

interface AuthState {
  user: Profile | null
  isLoading: boolean
  signUp: (email: string, password: string, full_name: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
}

export const useAuthStore = create<AuthState>((set) => ({
  user: null,
  isLoading: true,
  signUp: async (email, password, full_name) => {
    const { data, error } = await supabase.auth.signUp({ email, password })
    if (error) throw error
    if (data.user) {
      await supabase.from('profiles').insert({
        id: data.user.id,
        full_name,
        role: 'user'
      })
      set({ user: { id: data.user.id, full_name, avatar_url: '', role: 'user' } })
    }
  },
  signIn: async (email, password) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) throw error
    if (data.user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single()
      set({ user: profile })
    }
  },
  signOut: async () => {
    await supabase.auth.signOut()
    set({ user: null })
  },
  fetchProfile: async () => {
    const { data: { user } } = await supabase.auth.getUser()
    if (user) {
      const { data: profile } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', user.id)
        .single()
      set({ user: profile })
    }
  },
}))



