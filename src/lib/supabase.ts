import { createClient } from '@supabase/supabase-js'
import { create } from 'zustand'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabase = createClient(supabaseUrl, supabaseAnonKey)

type UserRole = 'admin' | 'expedition' | 'driver' | 'user'


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

// Cart
interface CartItem {
  id: number;
  productId: number;
  name: string;
  quantity: number;
  price: number;
}

interface CartStore {
  items: CartItem[];
  addItem: (item: CartItem) => void;
  removeItem: (id: number) => void;
  clearCart: () => void;
  checkout: () => Promise<void>;
}

export const useCartStore = create<CartStore>((set, get) => ({
  items: [],
  addItem: (item) => set((state) => ({ items: [...state.items, item] })),
  removeItem: (id) =>
    set((state) => ({ items: state.items.filter((item) => item.id !== id) })),
  clearCart: () => set({ items: [] }),
  checkout: async () => {
    const { items } = get();
    const { data: order, error: orderError } = await supabase
      .from("orders")
      .insert({ status: "pending" })
      .select()
      .single();

    if (orderError) throw orderError;

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      name: item.name,
      quantity: item.quantity,
      price: item.price,
    }));

    const { error: itemsError } = await supabase
      .from("order_items")
      .insert(orderItems);

    if (itemsError) throw itemsError;

    get().clearCart();
  },
}));


interface OrderStore {
  selectedOrderId: number | null
  setSelectedOrderId: (id: number | null) => void
}

export const useOrderStore = create<OrderStore>((set) => ({
  selectedOrderId: null,
  setSelectedOrderId: (id) => set({ selectedOrderId: id }),
}))