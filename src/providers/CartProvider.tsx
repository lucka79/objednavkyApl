import { createContext, PropsWithChildren, useContext, useState } from "react";
import { CartItem, Tables } from "types";
// import { randomUUID } from "crypto";
import { useInsertOrder } from "@/api/orders";
import { useRouter } from "@tanstack/react-router";
import { useInsertOrderItems } from "@/hooks/useOrders";
import { useAuthStore } from "@/lib/supabase";

type Product = Tables<"products">;

type CartType = {
  items: CartItem[];
  addItem: (product: Product) => void;
  // addItem: (product: Product, size: CartItem["size"]) => void;
  updateQuantity: (itemId: number, amount: -1 | 1) => void;
  total: number;
  checkout: () => void;
};

const CartContext = createContext<CartType>({
  items: [],
  addItem: () => {},
  updateQuantity: () => {},
  total: 0,
  checkout: () => {},
});

const CartProvider = ({ children }: PropsWithChildren) => {
  const [items, setItems] = useState<CartItem[]>([]);

  const { mutate: insertOrder } = useInsertOrder();
  const { mutate: insertOrderItems } = useInsertOrderItems();
  const router = useRouter();
  const { user } = useAuthStore();

  const addItem = (product: Product) => {
    // if already in cart, increment quantity
    const existingItem = items.find((item) => item.product_id === product.id);
    if (existingItem) {
      updateQuantity(existingItem.id, 1);
      return;
    }

    const newCartItem: CartItem = {
      id: Date.now(),
      product,
      product_id: product.id,
      quantity: 1,
    };

    setItems([newCartItem, ...items]);
  };
  // update quantity
  console.log(items);

  const updateQuantity = (itemId: number, amount: -1 | 1) => {
    console.log(itemId, amount);

    setItems(
      items
        .map(
          (item) =>
            item.id !== itemId
              ? item // pokud se item.id NEROVNÁ  itemId => vrati zpet jen item
              : { ...item, quantity: item.quantity + amount } // pokud se item.id = itemId ROVNA => zmeni se hodnota quantity o amount
        )
        .filter((item) => item.quantity > 0)
    );
  };

  const total = items.reduce(
    (sum, item) => (sum += item.product.price * item.quantity),
    0
  );

  const clearCart = () => {
    setItems([]);
  };

  const checkout = () => {
    console.warn("Checkout");
    insertOrder(
      {
        total,
        user_id: user?.id ?? "",
        date: new Date().toISOString(),
        status: "New",
      },
      {
        onSuccess: saveOrderItems,
      }
    );
  };

  const saveOrderItems = (order: Tables<"orders">) => {
    //const item1 = items[0];

    // projde((zmapuje) každou položku v košíku
    const orderItems = items.map((cartItem) => ({
      order_id: order.id,
      product_id: cartItem.product_id,
      quantity: cartItem.quantity,
    }));

    insertOrderItems(
      orderItems,
      // {
      // order_id: order.id,
      // product_id: item1.product_id,
      // quantity: item1.quantity,
      // size: item1.size,
      // },
      {
        onSuccess() {
          clearCart();
          router.navigate({ to: "/user/orders" });
          // router.push(`/(user)/orders/${order.id}`);
        },
      }
    );
  };

  return (
    <CartContext.Provider
      value={{ items, addItem, updateQuantity, total, checkout }}
    >
      {children}
    </CartContext.Provider>
  );
};

export default CartProvider;

export const useCart = () => useContext(CartContext);
