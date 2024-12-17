import { create } from 'zustand';
import { ProductionItem } from '../../types';

interface ProductionItemsStore {
  productionItems: ProductionItem[]
  selectedProductionItemId: number
  selectedProductionId: string | null;
  setProductionItems: (productionItems: ProductionItem[]) => void
  updateProductionItem: (updatedItem: ProductionItem) => void
  addProductionItem: (product: ProductionItem['product']) => void
  setSelectedProductionItemId: (id: number) => void
  setSelectedProductionId: (id: string | null) => void
}

export const useProductionItemsStore = create<ProductionItemsStore>((set) => ({
  productionItems: [],
  selectedProductionItemId: 0,
  selectedProductionId: null,
  setSelectedProductionItemId: (id) => set({ selectedProductionItemId: id }),
  setSelectedProductionId: (id) => set({ selectedProductionId: id }),
  setProductionItems: (productionItems) => set({ productionItems }),
  updateProductionItem: (updatedItem) =>
    set((state) => ({
      productionItems: state.productionItems.map((item) =>
        item.id === updatedItem.id ? updatedItem : item
      ),
    })),
  addProductionItem: (product) => 
    set((state) => ({
      productionItems: [...state.productionItems, {
        id: Date.now(),
        product_id: product.id,
        product: product,
        quantity: 0,
        price: product.price,
        production_id: 0,
      }],
    })),
}));