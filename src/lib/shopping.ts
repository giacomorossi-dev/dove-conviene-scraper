// The shopping list: products picked from the results, grouped by flyer and
// saved in the browser. It replaced the named, coloured lists.
import { parseDay } from "./format";

/** A product row of the results, as the cart saves it. */
export interface RowData {
  productName: string;
  productImage: string | null;
  price: number | null;
  /** The retailer's name. */
  flyerName: string;
  /** The flyer's page on dc: the shopping list groups by it. */
  flyerUrl: string;
  validUntil: string | null;
  /** For the logo; missing in products saved before it existed. */
  retailerSlug?: string;
}

export interface ShoppingItem extends RowData {
  addedAt: number;
  purchased: boolean;
}

export type ExpirySort = "asc" | "desc";

export interface FlyerGroup {
  flyerUrl: string;
  flyerName: string;
  validUntil: string | null;
  retailerSlug?: string;
  /** To buy first, then purchased; each in the order they were added. */
  items: ShoppingItem[];
  purchased: number;
}

const STORAGE_KEY = "dove-conviene:shopping-list";
/** Where the old named lists were: read once, to migrate them. */
const LISTS_KEY = "dove-conviene:lists";

/** One product: the same name and price in the same flyer. */
export const itemKey = (
  i: Pick<RowData, "productName" | "flyerUrl" | "price">
): string => `${i.flyerUrl}::${i.productName}::${i.price ?? ""}`;

/** Expired from the day after `validUntil`; no date never expires. */
export function isExpired(
  validUntil: string | null,
  now = new Date()
): boolean {
  const day = validUntil ? parseDay(validUntil) : null;
  if (!day) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return day.getTime() < today.getTime();
}

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null && !Array.isArray(v);

/** A saved product in the current shape, or null when it isn't one. */
function toItem(v: unknown, fallbackTime: number): ShoppingItem | null {
  if (
    !isRecord(v) ||
    typeof v.productName !== "string" ||
    typeof v.flyerUrl !== "string"
  )
    return null;
  return {
    productName: v.productName,
    productImage: typeof v.productImage === "string" ? v.productImage : null,
    price: typeof v.price === "number" ? v.price : null,
    flyerName: typeof v.flyerName === "string" ? v.flyerName : "",
    flyerUrl: v.flyerUrl,
    validUntil: typeof v.validUntil === "string" ? v.validUntil : null,
    ...(typeof v.retailerSlug === "string" && {
      retailerSlug: v.retailerSlug,
    }),
    addedAt: typeof v.addedAt === "number" ? v.addedAt : fallbackTime,
    purchased: v.purchased === true,
  };
}

const parseArray = (raw: string | null): unknown[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const dedupe = (items: ShoppingItem[]): ShoppingItem[] => {
  const seen = new Set<string>();
  return items.filter((i) => {
    const key = itemKey(i);
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
};

/** The saved list: unreadable data and invalid entries are dropped. */
export const parseShoppingList = (
  raw: string | null,
  now = Date.now()
): ShoppingItem[] =>
  dedupe(parseArray(raw).flatMap((v) => toItem(v, now) ?? []));

/** The products of the old named lists, once each, all to buy. */
export function itemsFromLists(
  raw: string | null,
  now = Date.now()
): ShoppingItem[] {
  const saved = parseArray(raw).flatMap((list) =>
    isRecord(list) && Array.isArray(list.items) ? list.items : []
  );
  return dedupe(
    saved.flatMap((v) => {
      const item = toItem(v, now);
      return item ? [{ ...item, purchased: false }] : [];
    })
  );
}

/** The list at startup: the saved one or, the first time, the old lists'. */
export const initialShoppingList = (
  raw: string | null,
  listsRaw: string | null,
  now = Date.now()
): ShoppingItem[] =>
  raw !== null ? parseShoppingList(raw, now) : itemsFromLists(listsRaw, now);

const storage = (): Storage | null =>
  typeof localStorage === "undefined" ? null : localStorage;

export const loadShoppingList = (): ShoppingItem[] =>
  initialShoppingList(
    storage()?.getItem(STORAGE_KEY) ?? null,
    storage()?.getItem(LISTS_KEY) ?? null
  );

export function saveShoppingList(items: ShoppingItem[]): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(items));
}

export const hasItem = (
  items: readonly ShoppingItem[],
  row: RowData
): boolean => {
  const key = itemKey(row);
  return items.some((i) => itemKey(i) === key);
};

/** Adds the product, or removes it when it is already there. */
export function toggleItem(
  items: readonly ShoppingItem[],
  row: RowData,
  now = Date.now()
): ShoppingItem[] {
  const key = itemKey(row);
  return hasItem(items, row)
    ? items.filter((i) => itemKey(i) !== key)
    : [...items, { ...row, addedAt: now, purchased: false }];
}

export const withPurchased = (
  items: readonly ShoppingItem[],
  key: string,
  purchased: boolean
): ShoppingItem[] =>
  items.map((i) => (itemKey(i) === key ? { ...i, purchased } : i));

export const withoutItem = (
  items: readonly ShoppingItem[],
  key: string
): ShoppingItem[] => items.filter((i) => itemKey(i) !== key);

/** Whether a product is shown with this retailer filter (null: all). */
const shownWith = (i: ShoppingItem, retailer: string | null) =>
  !retailer || i.flyerName === retailer;

/** Removes the purchased products of the retailer shown (null: all). */
export const withoutPurchased = (
  items: readonly ShoppingItem[],
  retailer: string | null = null
): ShoppingItem[] =>
  items.filter((i) => !(i.purchased && shownWith(i, retailer)));

/** Removes the expired products of the retailer shown (null: all). */
export const withoutExpired = (
  items: readonly ShoppingItem[],
  now = new Date(),
  retailer: string | null = null
): ShoppingItem[] =>
  items.filter(
    (i) => !(isExpired(i.validUntil, now) && shownWith(i, retailer))
  );

/** The products still to buy: the topbar's counter. */
export const toBuyCount = (items: readonly ShoppingItem[]): number =>
  items.filter((i) => !i.purchased).length;

const timeOf = (iso: string | null): number | null =>
  iso ? (parseDay(iso)?.getTime() ?? null) : null;

/**
 * One group per flyer, by expiry in the chosen direction; undated flyers
 * last, ties by retailer. `retailer` keeps only that retailer's flyers.
 */
export function groupByFlyer(
  items: readonly ShoppingItem[],
  sort: ExpirySort,
  retailer: string | null = null
): FlyerGroup[] {
  const groups = new Map<string, FlyerGroup>();
  for (const item of items) {
    if (retailer && item.flyerName !== retailer) continue;
    let group = groups.get(item.flyerUrl);
    if (!group) {
      group = {
        flyerUrl: item.flyerUrl,
        flyerName: item.flyerName,
        validUntil: item.validUntil,
        items: [],
        purchased: 0,
      };
      groups.set(item.flyerUrl, group);
    }
    group.items.push(item);
    if (item.purchased) group.purchased++;
    if (!group.retailerSlug && item.retailerSlug)
      group.retailerSlug = item.retailerSlug;
  }
  const sign = sort === "asc" ? 1 : -1;
  const byName = (a: FlyerGroup, b: FlyerGroup) =>
    a.flyerName.localeCompare(b.flyerName, "it");
  return [...groups.values()]
    .map((g) => ({
      ...g,
      items: [...g.items].sort(
        (a, b) =>
          Number(a.purchased) - Number(b.purchased) || a.addedAt - b.addedAt
      ),
    }))
    .sort((a, b) => {
      const ta = timeOf(a.validUntil);
      const tb = timeOf(b.validUntil);
      if (ta === null || tb === null)
        return ta === tb ? byName(a, b) : ta === null ? 1 : -1;
      return sign * (ta - tb) || byName(a, b);
    });
}

/** The retailers in the list, for the filter: alphabetical, once each. */
export const retailersIn = (items: readonly ShoppingItem[]): string[] =>
  [...new Set(items.map((i) => i.flyerName))].sort((a, b) =>
    a.localeCompare(b, "it")
  );

/** "3 prodotti · 1 acquistato", or "3 prodotti" when none is. */
export const groupCountsLabel = (total: number, purchased: number): string =>
  `${total} prodott${total === 1 ? "o" : "i"}${
    purchased > 0
      ? ` · ${purchased} acquistat${purchased === 1 ? "o" : "i"}`
      : ""
  }`;
