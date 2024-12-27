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
  signInWithEmail: (email: string, password: string) => Promise<UserRole>
  signInWithPhone: (phone: string, password: string) => Promise<UserRole>
  signOut: () => Promise<void>
  fetchProfile: () => Promise<void>
  createUser: (userData: UserData) => Promise<{ user: any, session: any }>
  createUserEmail: (userData: UserData) => Promise<{ user: any, session: any }>
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
  signInWithEmail: async (email: string, password: string) => {
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        console.error('Auth error details:', error);
        if (error.message === 'Invalid login credentials') {
          throw new Error('Nesprávné přihlašovací údaje');
        }
        throw error;
      }

      if (!data.user) {
        throw new Error('Přihlášení se nezdařilo');
      }

      // Fetch user profile
      const { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('id', data.user.id)
        .single();

      if (profileError || !profile) {
        throw new Error('Profil nenalezen');
      }

      set({ user: profile });
      return profile.role;
    } catch (error) {
      console.error('Email login error:', error);
      throw error;
    }
  },
  signInWithPhone: async (phone: string, password: string) => {
    try {
      console.log('🔍 Looking up user by phone:', phone);

      // First try without the country code
      let { data: profile, error: profileError } = await supabase
        .from('profiles')
        .select('*')
        .eq('phone', phone.replace('+420', ''))
        .single();

      // If not found, try with the country code
      if (!profile) {
        console.log('🔄 Retrying with full phone number:', phone);
        ({ data: profile, error: profileError } = await supabase
          .from('profiles')
          .select('*')
          .eq('phone', phone)
          .single());
      }

      if (profileError) {
        console.error('❌ Profile lookup error:', profileError);
        throw new Error('Chyba při hledání uživatele');
      }

      if (!profile) {
        console.error('❌ No profile found for phone:', phone);
        throw new Error('Uživatel s tímto telefonem nenalezen');
      }

      console.log('✅ Found profile:', {
        id: profile.id,
        phone: profile.phone,
        email: profile.email,
        role: profile.role
      });

      // Use the profile's email to authenticate
      const { data, error } = await supabase.auth.signInWithPassword({
        phone: profile.phone,
        password: password
      });

      if (error) {
        console.error('❌ Auth error:', error);
        switch (error.message) {
          case 'Invalid login credentials':
            throw new Error('Nesprávné heslo');
          default:
            throw new Error(`Chyba přihlášení: ${error.message}`);
        }
      }

      if (!data.user) {
        throw new Error('Přihlášení se nezdařilo');
      }

      console.log('🎉 Login successful');
      set({ user: profile });
      return profile.role;

    } catch (error) {
      console.error('❌ Phone login error:', error);
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Neočekávaná chyba při přihlášení');
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
          role: userData.role,
          paid_by: 'Hotově', // Add this default value
          address: userData.address, // Add this line
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
  createUserEmail: async (userData: UserData) => {
    try {
      console.log('Creating user with data:', userData);
      
      // Create user with admin API
      const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
        email: userData.email,
        password: userData.password,
        email_confirm: true,
        user_metadata: {
          full_name: userData.full_name,
          email: userData.email,
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
          email: userData.email,
          avatar_url: '',
          role: userData.role,
          paid_by: 'Hotově', // Add this default value
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



