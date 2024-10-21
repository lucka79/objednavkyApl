import {create} from 'zustand'
import { Product } from '../../types'

interface ProductStore {
  products: Product[]
  setProducts: (products: Product[]) => void
  addProduct: (product: Product) => void
}

export const useProductStore = create<ProductStore>((set) => ({
  products: [],
  setProducts: (products) => set({ products }),
  addProduct: (product) => set((state) => ({ products: [...state.products, product] })),
}))