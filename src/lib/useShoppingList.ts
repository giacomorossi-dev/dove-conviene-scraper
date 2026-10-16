import { useEffect, useMemo, useState } from "react";
import {
  itemKey,
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
  // Asked once per result row on every render: a set, not a scan.
  const keys = useMemo(() => new Set(items.map(itemKey)), [items]);

  return {
    items,
    toBuy: toBuyCount(items),
    has: (row: RowData) => keys.has(itemKey(row)),
    toggle: (row: RowData) => setItems((prev) => toggleItem(prev, row)),
    setPurchased: (key: string, purchased: boolean) =>
      setItems((prev) => withPurchased(prev, key, purchased)),
    remove: (key: string) => setItems((prev) => withoutItem(prev, key)),
    /** Of the retailer shown (null: all). */
    removePurchased: (retailer: string | null) =>
      setItems((prev) => withoutPurchased(prev, retailer)),
    removeExpired: (retailer: string | null) =>
      setItems((prev) => withoutExpired(prev, new Date(), retailer)),
  };
}
