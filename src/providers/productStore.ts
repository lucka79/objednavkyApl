import {create} from 'zustand'
import { Product } from '../../types'

interface ProductStore {
  selectedProductId: number | null
  products: Product[]
  setSelectedProductId: (productId: number | null) => void

  setProducts: (products: Product[]) => void
  addProduct: (product: Product) => void
  
  clearProductsForNewForm: () => void
  clearProductForm: () => void
}

export const useProductStore = create<ProductStore>((set) => ({
  products: [],
  selectedProductId: null,
  setSelectedProductId: (productId) => set({ selectedProductId: productId }),

  setProducts: (products) => set({ products }),
  addProduct: (product) => set((state) => ({ products: [...state.products, product] })),

  clearProductsForNewForm: () => set({ products: [] }),
  clearProductForm: () => set({
    selectedProductId: null,
    // Reset any other form-related state here
  }),
}))
