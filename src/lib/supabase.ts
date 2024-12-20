import { createClient } from '@supabase/supabase-js'
import { create } from 'zustand'
import { QueryClient } from '@tanstack/react-query'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY
const supabaseServiceKey = import.meta.env.VITE_SUPABASE_SERVICE_KEY  // Add this

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
export const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey)

type UserRole = 'admin' | 'expedition' | 'driver' | 'user' | 'mobil' | 'store' |'buyer'


interface Profile {
  id: string
  full_name: string
  avatar_url: string
  role: UserRole
}

interface UserData {
  full_name: string
  phone: string
  email?: string
  password: string
  role: UserRole
  address?: string  // Optional since it's only used for buyers
}

interface AuthState {
  user: Profile | null
  isLoading: boolean
  signUp: (email: string, password: string, full_name: string) => Promise<void>
  signIn: (email: string, password: string) => Promise<void>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
  createUser: (userData: UserData) => Promise<{ user: any, session: any }>
}

// Create a singleton query client instance
const queryClient = new QueryClient()

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
  createUser: async (userData: UserData) => {
    try {
      console.log('Creating user with data:', userData);
      
      // Create user with admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        phone: userData.phone,
        password: userData.password,
        phone_confirm: true,
        user_metadata: {
          full_name: userData.full_name,
          phone: userData.phone,
          role: userData.role,
        }
      });

      if (authError) throw authError;
      if (!authData.user) throw new Error('No user returned from auth creation');

      // Create profile with the auth user's ID
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          full_name: userData.full_name,
          phone: userData.phone,
          avatar_url: '',
          role: userData.role
        }, {
          onConflict: 'id'
        });

      if (profileError) throw profileError;

      // Add this line before the return
      await queryClient.invalidateQueries({ queryKey: ['profiles'] });

      return { user: authData.user, session: null };
    } catch (error) {
      console.error('Caught error in createUser:', error);
      throw error;
    }
  },
}))



