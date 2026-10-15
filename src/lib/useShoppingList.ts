import { useEffect, useState } from "react";
import {
  hasItem,
  loadShoppingList,
  saveShoppingList,
  toBuyCount,
  toggleItem,
  withoutExpired,
  withoutItem,
  withoutPurchased,
  withPurchased,
  type RowData,
  type ShoppingItem,
} from "./shopping";

/** The shopping list, saved in the browser on change. */
export function useShoppingList() {
  const [items, setItems] = useState<ShoppingItem[]>(loadShoppingList);

  useEffect(() => saveShoppingList(items), [items]);

  return {
    items,
    toBuy: toBuyCount(items),
    has: (row: RowData) => hasItem(items, row),
    toggle: (row: RowData) => setItems((prev) => toggleItem(prev, row)),
    setPurchased: (key: string, purchased: boolean) =>
      setItems((prev) => withPurchased(prev, key, purchased)),
    remove: (key: string) => setItems((prev) => withoutItem(prev, key)),
    removePurchased: () => setItems(withoutPurchased),
    removeExpired: () => setItems((prev) => withoutExpired(prev)),
  };
}
