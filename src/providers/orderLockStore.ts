import { create } from 'zustand';

type OrderLockStore = {
  unlockedOrders: Set<number>;
  unlockOrder: (orderId: number) => void;
  lockOrder: (orderId: number) => void;
  isOrderUnlocked: (orderId: number) => boolean;
};

export const useOrderLockStore = create<OrderLockStore>((set, get) => ({
  unlockedOrders: new Set(),
  unlockOrder: (orderId) => 
    set((state) => {
      const newSet = new Set(state.unlockedOrders);
      newSet.add(orderId);
      return { unlockedOrders: newSet };
    }),
  lockOrder: (orderId) =>
    set((state) => {
      const newSet = new Set(state.unlockedOrders);
      newSet.delete(orderId);
      return { unlockedOrders: newSet };
    }),
  isOrderUnlocked: (orderId) => get().unlockedOrders.has(orderId),
}));