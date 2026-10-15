# Lista della spesa — piano di implementazione

> **Per chi esegue (agenti):** SUB-SKILL OBBLIGATORIA: superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans, un task alla volta. I passi usano le caselle (`- [ ]`) per tenere traccia.

**Obiettivo:** le liste multiple diventano un'unica lista della spesa, così organizzata:
- il carrello nei risultati aggiunge e toglie;
- la pagina "Lista della spesa" ha la spunta "acquistato" e un gruppo per volantino;
- si ordina per scadenza e si filtra per insegna;
- ci sono i pulsanti "Rimuovi acquistati" e "Rimuovi scaduti".

**Architettura:**
- Funzioni pure in `src/lib/shopping.ts`, testate con `bun test`, e un hook `useShoppingList` che salva nel `localStorage`.
- Una pagina `ShoppingListView` e un `CartButton` nella tabella dei risultati.
- Il vecchio codice delle liste si elimina dopo aver migrato i dati.

**Stack:** React 19, TypeScript (typecheck con TS 7), Vite 8, Tailwind 4, shadcn su Base UI (`base-vega`), Bun.

**Spec:** `docs/superpowers/specs/2026-10-15-shopping-list-design.md`. Va letta prima di iniziare.

## Vincoli globali

- **Branch:** `feat/shopping-list`, già creato da `main`.
- **Node 24:** nelle shell non interattive, prima di `bun run …`, eseguire `source ~/.nvm/nvm.sh && nvm use`.
- **Testi:** quelli visibili all'utente in italiano. Commenti e nomi nel codice in inglese, con la stessa densità di commenti del codice vicino.
- **Componenti shadcn:** si usano solo quelli già presenti in `src/components/ui/` (avatar, badge, button, card, checkbox, empty, item, select). Non si modificano a mano.
- **Chiavi del `localStorage`:**
  - nuova: `dove-conviene:shopping-list`;
  - vecchia: `dove-conviene:lists`, solo letta per la migrazione e mai cancellata.
- **Server:** nessuna modifica.
- **Test dei moduli del client:** stanno in `src/**/*.test.ts` e usano `tsconfig.test.json`, che esiste già.
- **Fine di ogni task:** devono passare `bun test`, `bun run typecheck`, `bun run lint` e `bun run format:check`. Per formattare si usa `bun run format`.
- **Commit:** in fondo al messaggio `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. **Mai `git push`.**
- **Ambiente di sviluppo:** `bun run dev`, con l'app su http://localhost:5180.

## Punti d'attenzione per la revisione

1. **La × dentro la riga `<label>`** toglie il prodotto senza errori e senza spuntare "acquistato". → Task 4, scenario 5.
2. **La migrazione avviene una volta sola.** Dopo il primo salvataggio, se togli prodotti e ricarichi, le vecchie liste non devono ricomparire, anche se la lista è vuota. → Task 1, test "only the first time"; Task 4, scenario 8 con ricaricamento.
3. **Filtro su un'insegna a cui togli l'ultimo prodotto:** il filtro torna su "Tutte le insegne" e la pagina non resta vuota. → Task 4, scenario 6.
4. **Contatore nella barra in alto:** segue spunte e rimozioni e sparisce a 0. → Task 4, scenari 2 e 4.
5. **Scadenza con orario** (`…T23:59:59`) nel giorno stesso: non è scaduta. → Task 1, test "expired".

---

### Task 1: Modello della lista della spesa

**File:**
- Crea: `src/lib/shopping.ts`
- Modifica: `src/lib/format.ts` (aggiunge `formatDate`)
- Test: `src/lib/shopping.test.ts`, `src/lib/format.test.ts`

**Interfacce:**
- Usa: niente dai task successivi. `src/lib/lists.ts` resta com'è fino al Task 3.
- Fornisce (`src/lib/shopping.ts`):

  ```ts
  interface RowData { productName: string; productImage: string | null; price: number | null; flyerName: string; flyerUrl: string; validUntil: string | null; retailerSlug?: string }
  interface ShoppingItem extends RowData { addedAt: number; purchased: boolean }
  type ExpirySort = "asc" | "desc"
  interface FlyerGroup { flyerUrl: string; flyerName: string; validUntil: string | null; retailerSlug?: string; items: ShoppingItem[]; purchased: number }
  function itemKey(i: Pick<RowData, "productName" | "flyerUrl" | "price">): string
  function isExpired(validUntil: string | null, now?: Date): boolean
  function parseShoppingList(raw: string | null, now?: number): ShoppingItem[]
  function itemsFromLists(raw: string | null, now?: number): ShoppingItem[]
  function initialShoppingList(raw: string | null, listsRaw: string | null, now?: number): ShoppingItem[]
  function loadShoppingList(): ShoppingItem[]
  function saveShoppingList(items: ShoppingItem[]): void
  function hasItem(items: readonly ShoppingItem[], row: RowData): boolean
  function toggleItem(items: readonly ShoppingItem[], row: RowData, now?: number): ShoppingItem[]
  function withPurchased(items: readonly ShoppingItem[], key: string, purchased: boolean): ShoppingItem[]
  function withoutItem(items: readonly ShoppingItem[], key: string): ShoppingItem[]
  function withoutPurchased(items: readonly ShoppingItem[]): ShoppingItem[]
  function withoutExpired(items: readonly ShoppingItem[], now?: Date): ShoppingItem[]
  function toBuyCount(items: readonly ShoppingItem[]): number
  function groupByFlyer(items: readonly ShoppingItem[], sort: ExpirySort, retailer?: string | null): FlyerGroup[]
  function retailersIn(items: readonly ShoppingItem[]): string[]
  function groupCountsLabel(total: number, purchased: number): string
  ```

  Inoltre `src/lib/format.ts` fornisce `formatDate(iso: string): string`.

- [ ] **Passo 1: scrivi i test**

`src/lib/shopping.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  groupByFlyer,
  groupCountsLabel,
  hasItem,
  initialShoppingList,
  isExpired,
  itemKey,
  itemsFromLists,
  parseShoppingList,
  retailersIn,
  toBuyCount,
  toggleItem,
  withoutExpired,
  withoutItem,
  withoutPurchased,
  withPurchased,
  type FlyerGroup,
  type RowData,
  type ShoppingItem,
} from "./shopping";

const row = (over: Partial<RowData> = {}): RowData => ({
  productName: "Nutella 750 g",
  productImage: null,
  price: 3.99,
  flyerName: "Conad",
  flyerUrl: "https://dc/conad?flyerId=1",
  validUntil: "2026-10-21",
  ...over,
});
const item = (over: Partial<ShoppingItem> = {}): ShoppingItem => ({
  ...row(),
  addedAt: 1,
  purchased: false,
  ...over,
});
/** 15/10/2026 at noon, local time. */
const NOW = new Date(2026, 9, 15, 12);

describe("parseShoppingList", () => {
  test("missing, unreadable or not a list: empty", () => {
    expect(parseShoppingList(null)).toEqual([]);
    expect(parseShoppingList("{oops")).toEqual([]);
    expect(parseShoppingList('{"a":1}')).toEqual([]);
  });

  test("invalid entries are dropped, the rest normalized", () => {
    const raw = JSON.stringify([
      null,
      3,
      { productName: "senza volantino" },
      { ...item(), purchased: "yes", addedAt: "?" },
    ]);
    expect(parseShoppingList(raw, 7)).toEqual([
      item({ addedAt: 7, purchased: false }),
    ]);
  });
});

describe("migration from the old lists", () => {
  const lists = JSON.stringify([
    {
      id: "a",
      name: "Spesa",
      color: "#f00",
      items: [
        { ...row(), addedAt: 5 },
        { ...row({ productName: "Pane" }), addedAt: 6 },
      ],
    },
    { id: "b", name: "Vuota", color: "#0f0", items: [] },
    { id: "c", name: "Altra", color: "#00f", items: [{ ...row(), addedAt: 9 }] },
  ]);

  test("every product once, to buy", () => {
    expect(itemsFromLists(lists)).toEqual([
      item({ addedAt: 5 }),
      item({ productName: "Pane", addedAt: 6 }),
    ]);
  });

  test("only the first time: a saved list, even empty, wins", () => {
    expect(initialShoppingList(null, lists)).toHaveLength(2);
    expect(initialShoppingList("[]", lists)).toEqual([]);
  });

  test("no old lists: empty", () => {
    expect(initialShoppingList(null, null)).toEqual([]);
  });
});

describe("cart", () => {
  test("adds a product, removes it on a second click, adds it again", () => {
    const once = toggleItem([], row(), 10);
    expect(once).toEqual([item({ addedAt: 10 })]);
    expect(hasItem(once, row())).toBe(true);
    const twice = toggleItem(once, row(), 11);
    expect(twice).toEqual([]);
    expect(toggleItem(twice, row(), 12)).toEqual([item({ addedAt: 12 })]);
  });

  test("the same product found by another search is the same item", () => {
    const list = toggleItem([], row({ productImage: "a.jpg" }), 1);
    expect(hasItem(list, row({ productImage: "b.jpg" }))).toBe(true);
  });
});

describe("purchased and removals", () => {
  const a = item();
  const b = item({ productName: "Pane", addedAt: 2 });

  test("mark and unmark purchased; the counter follows", () => {
    const marked = withPurchased([a, b], itemKey(b), true);
    expect(marked[1].purchased).toBe(true);
    expect(toBuyCount(marked)).toBe(1);
    expect(withPurchased(marked, itemKey(b), false)[1].purchased).toBe(false);
  });

  test("remove one, or all the purchased ones", () => {
    expect(withoutItem([a, b], itemKey(a))).toEqual([b]);
    expect(withoutPurchased([a, { ...b, purchased: true }])).toEqual([a]);
  });

  test("expired: yesterday yes; today, later today and no date no", () => {
    expect(isExpired("2026-10-14", NOW)).toBe(true);
    expect(isExpired("2026-10-15", NOW)).toBe(false);
    expect(isExpired("2026-10-15T23:59:59", NOW)).toBe(false);
    expect(isExpired(null, NOW)).toBe(false);
    const old = item({ validUntil: "2026-10-14" });
    const undated = item({ productName: "Pane", validUntil: null });
    expect(withoutExpired([old, a, undated], NOW)).toEqual([a, undated]);
  });
});

describe("groupByFlyer", () => {
  const conad = (over: Partial<ShoppingItem>) =>
    item({ flyerName: "Conad", flyerUrl: "u-conad", validUntil: "2026-10-21", ...over });
  const coop = (over: Partial<ShoppingItem>) =>
    item({ flyerName: "Coop", flyerUrl: "u-coop", validUntil: "2026-10-18", ...over });
  const lidl = (over: Partial<ShoppingItem>) =>
    item({ flyerName: "Lidl", flyerUrl: "u-lidl", validUntil: null, ...over });
  const items = [
    conad({ productName: "Pasta", addedAt: 1, purchased: true }),
    lidl({ productName: "Latte", addedAt: 2 }),
    coop({ productName: "Pane", addedAt: 3, retailerSlug: "coop" }),
    conad({ productName: "Olio", addedAt: 4 }),
  ];
  const urls = (gs: FlyerGroup[]) => gs.map((g) => g.flyerUrl);

  test("nearest expiry first; undated flyers last", () => {
    expect(urls(groupByFlyer(items, "asc"))).toEqual(["u-coop", "u-conad", "u-lidl"]);
  });

  test("farthest expiry first; undated flyers still last", () => {
    expect(urls(groupByFlyer(items, "desc"))).toEqual(["u-conad", "u-coop", "u-lidl"]);
  });

  test("in a group: to buy first, then purchased, each by when added", () => {
    const [coopGroup, conadGroup] = groupByFlyer(items, "asc");
    expect(conadGroup.items.map((i) => i.productName)).toEqual(["Olio", "Pasta"]);
    expect(conadGroup.purchased).toBe(1);
    expect(coopGroup.retailerSlug).toBe("coop");
  });

  test("one retailer only", () => {
    expect(urls(groupByFlyer(items, "asc", "Coop"))).toEqual(["u-coop"]);
  });

  test("same expiry: by retailer name", () => {
    const same = [conad({ validUntil: "2026-10-18" }), coop({})];
    expect(urls(groupByFlyer(same, "asc"))).toEqual(["u-conad", "u-coop"]);
  });
});

describe("retailersIn / groupCountsLabel", () => {
  test("retailers in the list, alphabetical, once each", () => {
    expect(
      retailersIn([
        item({ flyerName: "Coop" }),
        item({ flyerName: "Conad" }),
        item({ flyerName: "Coop" }),
      ])
    ).toEqual(["Conad", "Coop"]);
  });

  test("counts, singular and plural", () => {
    expect(groupCountsLabel(3, 1)).toBe("3 prodotti · 1 acquistato");
    expect(groupCountsLabel(1, 0)).toBe("1 prodotto");
    expect(groupCountsLabel(2, 2)).toBe("2 prodotti · 2 acquistati");
  });
});
```

`src/lib/format.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { formatDate, formatPrice } from "./format";

describe("format", () => {
  test("dates as dd/mm/yyyy; unreadable ones as they are", () => {
    expect(formatDate("2026-10-21")).toBe("21/10/2026");
    expect(formatDate("boh")).toBe("boh");
  });

  test("prices in euro with a comma", () => {
    expect(formatPrice(3.9)).toBe("€ 3,90");
  });
});
```

- [ ] **Passo 2: verifica che falliscano**

Esegui: `bun test src/lib/shopping.test.ts src/lib/format.test.ts`
Atteso: FAIL. `./shopping` non esiste e `formatDate` non è esportata.

- [ ] **Passo 3: implementa**

`src/lib/shopping.ts`:

```ts
// The shopping list: products picked from the results, grouped by flyer and
// saved in the browser. It replaced the named, coloured lists.

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
export function isExpired(validUntil: string | null, now = new Date()): boolean {
  if (!validUntil) return false;
  const d = new Date(validUntil);
  if (isNaN(d.getTime())) return false;
  const today = new Date(now);
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
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
): ShoppingItem[] => dedupe(parseArray(raw).flatMap((v) => toItem(v, now) ?? []));

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

export const withoutPurchased = (
  items: readonly ShoppingItem[]
): ShoppingItem[] => items.filter((i) => !i.purchased);

export const withoutExpired = (
  items: readonly ShoppingItem[],
  now = new Date()
): ShoppingItem[] => items.filter((i) => !isExpired(i.validUntil, now));

/** The products still to buy: the topbar's counter. */
export const toBuyCount = (items: readonly ShoppingItem[]): number =>
  items.filter((i) => !i.purchased).length;

const timeOf = (iso: string | null): number | null => {
  if (!iso) return null;
  const t = new Date(iso).getTime();
  return isNaN(t) ? null : t;
};

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
```

In fondo a `src/lib/format.ts`:

```ts
/** "21/10/2026"; an unreadable date is shown as it is. */
export function formatDate(iso: string): string {
  const d = new Date(iso);
  return isNaN(d.getTime())
    ? iso
    : d.toLocaleDateString("it-IT", {
        day: "2-digit",
        month: "2-digit",
        year: "numeric",
      });
}
```

- [ ] **Passo 4: verifica che passino**

Esegui: `bun test src/lib/shopping.test.ts src/lib/format.test.ts`
Atteso: PASS.

- [ ] **Passo 5: controlli e commit**

```bash
source ~/.nvm/nvm.sh && nvm use
bun run format && bun test && bun run typecheck && bun run lint && bun run format:check
git add src/lib/shopping.ts src/lib/shopping.test.ts src/lib/format.ts src/lib/format.test.ts
git commit -m "feat: shopping list model, with migration from the named lists

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: Pagina `ShoppingListView`

**File:**
- Crea: `src/components/ShoppingListView.tsx`

**Interfacce:**
- Usa: dal Task 1 `groupByFlyer`, `groupCountsLabel`, `isExpired`, `itemKey`, `retailersIn`, `ExpirySort`, `ShoppingItem` e `formatDate`; già esistenti `formatPrice` e `retailerInitials`.
- Fornisce: `ShoppingListView` (default export) con le props
  `{ items: ShoppingItem[]; bySlug: ReadonlyMap<string, Retailer>; onTogglePurchased: (key: string, purchased: boolean) => void; onRemove: (key: string) => void; onRemovePurchased: () => void; onRemoveExpired: () => void; onGoToResults: () => void }`.

- [ ] **Passo 1: crea il componente**

`src/components/ShoppingListView.tsx`:

```tsx
// The shopping list page: products picked from the results, one card per
// flyer, ordered by expiry and filterable by retailer.
import { useState } from "react";
import { ExternalLink, ShoppingCart, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatPrice } from "@/lib/format";
import { retailerInitials } from "@/lib/retailers";
import {
  groupByFlyer,
  groupCountsLabel,
  isExpired,
  itemKey,
  retailersIn,
  type ExpirySort,
  type ShoppingItem,
} from "@/lib/shopping";
import { cn } from "@/lib/utils";
import type { Retailer } from "@shared/types";

interface Props {
  items: ShoppingItem[];
  bySlug: ReadonlyMap<string, Retailer>;
  onTogglePurchased: (key: string, purchased: boolean) => void;
  onRemove: (key: string) => void;
  onRemovePurchased: () => void;
  onRemoveExpired: () => void;
  onGoToResults: () => void;
}

const SORT_ITEMS: { label: string; value: ExpirySort }[] = [
  { label: "Scadenza più vicina", value: "asc" },
  { label: "Scadenza più lontana", value: "desc" },
];

const ShoppingListView = ({
  items,
  bySlug,
  onTogglePurchased,
  onRemove,
  onRemovePurchased,
  onRemoveExpired,
  onGoToResults,
}: Props) => {
  const [sort, setSort] = useState<ExpirySort>("asc");
  const [retailer, setRetailer] = useState<string | null>(null);

  if (items.length === 0)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingCart />
          </EmptyMedia>
          <EmptyTitle>La lista della spesa è vuota</EmptyTitle>
          <EmptyDescription>
            Aggiungi i prodotti dai risultati con il carrello.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onGoToResults}>Vai ai risultati</Button>
        </EmptyContent>
      </Empty>
    );

  const retailers = retailersIn(items);
  // A retailer no longer in the list falls back to all of them.
  const shownRetailer =
    retailer && retailers.includes(retailer) ? retailer : null;
  const retailerItems = [
    { label: "Tutte le insegne", value: null as string | null },
    ...retailers.map((r) => ({ label: r, value: r as string | null })),
  ];
  const groups = groupByFlyer(items, sort, shownRetailer);
  const purchasedCount = items.filter((i) => i.purchased).length;
  const expiredCount = items.filter((i) => isExpired(i.validUntil)).length;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Lista della spesa</h1>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={SORT_ITEMS}
          value={sort}
          onValueChange={(v) => v && setSort(v)}
        >
          <SelectTrigger className="w-52" aria-label="Ordina">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SORT_ITEMS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Select
          items={retailerItems}
          value={shownRetailer}
          onValueChange={(v) => setRetailer(v)}
        >
          <SelectTrigger className="w-52" aria-label="Insegna">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {retailerItems.map((r) => (
                <SelectItem key={r.value ?? "all"} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          variant="outline"
          disabled={purchasedCount === 0}
          onClick={onRemovePurchased}
        >
          Rimuovi acquistati ({purchasedCount})
        </Button>
        <Button
          variant="outline"
          disabled={expiredCount === 0}
          onClick={onRemoveExpired}
        >
          Rimuovi scaduti ({expiredCount})
        </Button>
      </div>

      {groups.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">
          Nessun prodotto per questa insegna.
        </p>
      )}

      {groups.map((g) => {
        const logo = g.retailerSlug
          ? bySlug.get(g.retailerSlug)?.imageUrl
          : undefined;
        return (
          <Card key={g.flyerUrl}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  {logo && <AvatarImage src={logo} alt="" />}
                  <AvatarFallback>{retailerInitials(g.flyerName)}</AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 gap-1">
                  <CardTitle>{g.flyerName}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    {g.validUntil &&
                      (isExpired(g.validUntil) ? (
                        <Badge variant="destructive">Scaduto</Badge>
                      ) : (
                        <span>Scade il {formatDate(g.validUntil)}</span>
                      ))}
                    <span>{groupCountsLabel(g.items.length, g.purchased)}</span>
                  </CardDescription>
                </div>
              </div>
              {g.flyerUrl && (
                <CardAction>
                  <a
                    href={g.flyerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Apri volantino <ExternalLink />
                  </a>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <ItemGroup>
                {g.items.map((it) => {
                  const key = itemKey(it);
                  return (
                    <Item
                      key={key}
                      size="sm"
                      render={<label />}
                      className={cn("cursor-pointer", it.purchased && "opacity-60")}
                    >
                      <ItemMedia>
                        <Checkbox
                          checked={it.purchased}
                          aria-label={`Acquistato: ${it.productName}`}
                          onCheckedChange={(checked) =>
                            onTogglePurchased(key, checked)
                          }
                        />
                      </ItemMedia>
                      {it.productImage && (
                        <ItemMedia variant="image">
                          <img src={it.productImage} alt="" loading="lazy" />
                        </ItemMedia>
                      )}
                      <ItemContent>
                        <ItemTitle className={cn(it.purchased && "line-through")}>
                          {it.productName}
                        </ItemTitle>
                        {it.price !== null && (
                          <ItemDescription>{formatPrice(it.price)}</ItemDescription>
                        )}
                      </ItemContent>
                      <ItemActions>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Togli ${it.productName}`}
                          onClick={(e) => {
                            // Inside the row's <label>: don't tick the box.
                            e.preventDefault();
                            onRemove(key);
                          }}
                        >
                          <X />
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ShoppingListView;
```

Se il typecheck segnala i tipi di `onValueChange`:
- per l'ordinamento usa `(v) => v && setSort(v as ExpirySort)`;
- per l'insegna usa `(v) => setRetailer(v as string | null)`.

Non cambiare i file in `ui/`.

- [ ] **Passo 2: controlli e commit**

Il componente viene montato nel Task 3 e provato nel Task 4.

```bash
bun run format && bun test && bun run typecheck && bun run lint && bun run format:check
git add src/components/ShoppingListView.tsx
git commit -m "feat: shopping list page grouped by flyer, with expiry sort and retailer filter

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Carrello nei risultati, collegamenti, eliminazione delle liste

**File:**
- Crea: `src/lib/useShoppingList.ts`, `src/components/CartButton.tsx`
- Modifica: `src/components/ResultsTable.tsx`, `src/components/ResultsView.tsx`, `src/components/Topbar.tsx`, `src/App.tsx`
- Elimina: `src/lib/lists.ts`, `src/components/ListsView.tsx`, `src/components/ListEditDialog.tsx`, `src/components/SaveToListMenu.tsx`

**Interfacce:**
- Usa: il Task 1 (funzioni di `shopping.ts`) e il Task 2 (`ShoppingListView`).
- Fornisce:
  - `useShoppingList(): { items; toBuy: number; has(row): boolean; toggle(row): void; setPurchased(key, purchased): void; remove(key): void; removePurchased(): void; removeExpired(): void }`;
  - `CartButton` con props `{ inList: boolean; onToggle: () => void }`;
  - `ResultsTable` con props `{ rows: RowData[]; isInCart: (row: RowData) => boolean; onToggleCart: (row: RowData) => void }`;
  - `View = "main" | "presets" | "shopping"`;
  - `Topbar` con la nuova prop `shoppingCount: number`.

- [ ] **Passo 1: `useShoppingList` e `CartButton`**

`src/lib/useShoppingList.ts`:

```ts
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
```

`src/components/CartButton.tsx`:

```tsx
// Adds a result to the shopping list, or takes it out.
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  inList: boolean;
  onToggle: () => void;
}

const CartButton = ({ inList, onToggle }: Props) => (
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    aria-pressed={inList}
    aria-label={
      inList ? "Togli dalla lista della spesa" : "Aggiungi alla lista della spesa"
    }
    onClick={onToggle}
    className={cn(inList ? "text-primary" : "text-muted-foreground")}
  >
    <ShoppingCart fill={inList ? "currentColor" : "none"} />
  </Button>
);

export default CartButton;
```

- [ ] **Passo 2: `ResultsTable` usa il carrello**

In `src/components/ResultsTable.tsx`:

- Gli import di `SaveToListMenu` e da `@/lib/lists` diventano:

  ```tsx
  import CartButton from "./CartButton";
  import { isExpired, type RowData } from "@/lib/shopping";
  ```

- `Props` diventa:

  ```tsx
  interface Props {
    rows: RowData[];
    isInCart: (row: RowData) => boolean;
    onToggleCart: (row: RowData) => void;
  }
  ```

- La firma diventa `const ResultsTable = ({ rows, isInCart, onToggleCart }: Props) => {`. Nel ramo `rows.length === 0`, `{emptyMessage}` diventa il testo fisso `Nessun prodotto da visualizzare`.
- L'intestazione `<TableHead className="w-48">Lista</TableHead>` diventa:

  ```tsx
  <TableHead className="w-12">
    <span className="sr-only">Lista della spesa</span>
  </TableHead>
  ```

- Nel corpo togli `const currentList = findItemList(lists, itemKey(r));`. La cella con `<SaveToListMenu … />` diventa:

  ```tsx
  <TableCell>
    <CartButton inList={isInCart(r)} onToggle={() => onToggleCart(r)} />
  </TableCell>
  ```

- [ ] **Passo 3: `ResultsView`**

In `src/components/ResultsView.tsx`:
- `import type { List, RowData } from "@/lib/lists";` diventa `import type { RowData } from "@/lib/shopping";`;
- nelle props, `lists`, `onAddToList`, `onRequestNewList` e `onRequestRemoveItem`, sia nell'interfaccia che nella destrutturazione, diventano:

  ```tsx
  isInCart: (row: RowData) => boolean;
  onToggleCart: (row: RowData) => void;
  ```

- ogni riga porta con sé lo slug, aggiungendo dopo `validUntil: flyer.validUntil ?? null,`:

  ```tsx
  ...(flyer.slug && { retailerSlug: flyer.slug }),
  ```

- `<ResultsTable …>` diventa:

  ```tsx
  <ResultsTable rows={rows} isInCart={isInCart} onToggleCart={onToggleCart} />
  ```

- [ ] **Passo 4: barra in alto**

In `src/components/Topbar.tsx`:
- `export type View = "main" | "presets" | "shopping";`
- in `TABS`, la voce `{ view: "lists", label: "Le mie liste" }` diventa `{ view: "shopping", label: "Lista della spesa" }`;
- `Props` riceve `shoppingCount: number;`, da aggiungere anche alla destrutturazione;
- aggiungi `import { Badge } from "@/components/ui/badge";`;
- nel `<button>` della tab, dopo `{t.label}`:

  ```tsx
  {t.view === "shopping" && shoppingCount > 0 && (
    <Badge variant="secondary" className="ml-1.5">
      {shoppingCount}
    </Badge>
  )}
  ```

- [ ] **Passo 5: `App.tsx`**

Sostituisci il file con questo contenuto. È quello attuale senza le liste e con la lista della spesa; la ricerca e i preset restano identici.

```tsx
import { useEffect, useState } from "react";
import type {
  Flyer as FlyerI,
  Place,
  ScrapeMessage,
  ScrapeRequest,
} from "@shared/types";
import ResultsView from "./components/ResultsView";
import PresetsView from "./components/PresetsView";
import PresetEditorDialog, {
  type EditorMode,
} from "./components/PresetEditorDialog";
import ShoppingListView from "./components/ShoppingListView";
import Topbar, { type View } from "./components/Topbar";
import Bottombar from "./components/Bottombar";
import Footer from "./components/Footer";
import ConfirmDialog from "./components/ConfirmDialog";
import {
  copyName,
  EMPTY_DRAFT,
  loadLegacyActivePlace,
  type PresetDraft,
} from "./lib/presets";
import { usePresets } from "./lib/usePresets";
import { useCatalog } from "./lib/useCatalog";
import { useShoppingList } from "./lib/useShoppingList";
import { DEFAULT_PLACE, loadPlace, savePlace } from "./lib/places";
import { knownRetailers, toSelection } from "./lib/retailers";

const App = () => {
  const catalog = useCatalog();
  const { presets, active, activeId, setActiveId, create, update, remove } =
    usePresets(catalog.retailers);
  const shopping = useShoppingList();
  const [place, setPlace] = useState<Place>(
    () => loadPlace() ?? loadLegacyActivePlace() ?? DEFAULT_PLACE
  );
  const [results, setResults] = useState<FlyerI[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("main");

  // The editor keeps its last content while it closes (no title flicker).
  const [editor, setEditor] = useState<{
    mode: EditorMode;
    editingId?: string;
    initial: PresetDraft;
  }>({ mode: "create", initial: EMPTY_DRAFT });
  const [editorOpen, setEditorOpen] = useState(false);
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  const deletePreset = presets.find((p) => p.id === deletePresetId) ?? null;

  useEffect(() => savePlace(place), [place]);

  // ---- search ----

  const searchRetailers = active
    ? knownRetailers(active.retailers, catalog.bySlug)
    : [];
  const canSearch =
    !!active && searchRetailers.length > 0 && active.products.length > 0;

  const onSearch = async () => {
    if (!active || !canSearch) return;
    setLoading(true);
    setResults([]);
    try {
      const request: ScrapeRequest = {
        place,
        flyers: searchRetailers.map(toSelection),
        products: active.products,
      };
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as ScrapeMessage;
            if ("flyer" in msg) {
              const { flyer } = msg;
              setResults((prev) => [...prev, flyer]);
            }
          } catch {
            /* skip malformed line */
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ---- preset handlers ----

  const onSelectPreset = (id: string) => {
    setActiveId(id);
    setResults([]);
  };

  const draftOf = (id: string): PresetDraft | null => {
    const p = presets.find((x) => x.id === id);
    return p
      ? { name: p.name, retailers: p.retailers, products: p.products }
      : null;
  };

  const openCreate = () => {
    setView("presets");
    setEditor({ mode: "create", initial: EMPTY_DRAFT });
    setEditorOpen(true);
  };

  const openEdit = (id: string) => {
    const initial = draftOf(id);
    if (!initial) return;
    setEditor({ mode: "edit", editingId: id, initial });
    setEditorOpen(true);
  };

  const openDuplicate = (id: string) => {
    const source = draftOf(id);
    if (!source) return;
    setEditor({
      mode: "duplicate",
      initial: { ...source, name: copyName(presets, source.name) },
    });
    setEditorOpen(true);
  };

  const onSaveEditor = (draft: PresetDraft) => {
    if (editor.mode === "edit" && editor.editingId)
      update(editor.editingId, draft);
    else {
      create(draft);
      setResults([]);
    }
  };

  const onConfirmDeletePreset = () => {
    if (!deletePresetId) return;
    if (deletePresetId === activeId) setResults([]);
    remove(deletePresetId);
    setDeletePresetId(null);
  };

  return (
    <>
      <Topbar
        view={view}
        onChangeView={setView}
        place={place}
        onPlaceChange={setPlace}
        shoppingCount={shopping.toBuy}
      />
      {/* The topbar wraps the location onto a second row below `sm`. */}
      <main className="pt-32 pb-24 sm:pt-20">
        <div className="container">
          {view === "shopping" ? (
            <ShoppingListView
              items={shopping.items}
              bySlug={catalog.bySlug}
              onTogglePurchased={shopping.setPurchased}
              onRemove={shopping.remove}
              onRemovePurchased={shopping.removePurchased}
              onRemoveExpired={shopping.removeExpired}
              onGoToResults={() => setView("main")}
            />
          ) : view === "presets" ? (
            <PresetsView
              presets={presets}
              bySlug={catalog.bySlug}
              onRequestCreate={openCreate}
              onRequestEdit={openEdit}
              onRequestDuplicate={openDuplicate}
              onRequestDelete={setDeletePresetId}
            />
          ) : (
            <ResultsView
              preset={active}
              bySlug={catalog.bySlug}
              results={results}
              isInCart={shopping.has}
              onToggleCart={shopping.toggle}
              onRequestCreate={openCreate}
              onRequestEdit={() => active && openEdit(active.id)}
            />
          )}
        </div>
      </main>

      <Footer />

      {view === "main" && (
        <Bottombar
          presets={presets}
          activeId={activeId}
          bySlug={catalog.bySlug}
          onSelectPreset={onSelectPreset}
          loading={loading}
          canSearch={canSearch}
          onSearch={onSearch}
        />
      )}

      <PresetEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mode={editor.mode}
        editingId={editor.editingId}
        initial={editor.initial}
        presets={presets}
        catalog={catalog}
        onSave={onSaveEditor}
      />

      <ConfirmDialog
        open={deletePresetId !== null}
        onOpenChange={(o) => !o && setDeletePresetId(null)}
        title={`Eliminare il preset «${deletePreset?.name ?? ""}»?`}
        description="L'azione non può essere annullata."
        confirmLabel="Elimina"
        destructive
        onConfirm={onConfirmDeletePreset}
      />
    </>
  );
};

export default App;
```

Prima di sostituirlo, confronta questa versione con l'attuale `App.tsx` (`git diff` dopo la sostituzione). Le uniche differenze attese sono:
- le liste tolte;
- la lista della spesa aggiunta;
- `ResultsView` con `isInCart` e `onToggleCart`;
- `shoppingCount` passato alla `Topbar`.

Se trovi altre differenze nella parte dei preset o della ricerca, tieni la versione attuale per quelle parti.

- [ ] **Passo 6: elimina il codice delle liste**

```bash
git rm src/lib/lists.ts src/components/ListsView.tsx src/components/ListEditDialog.tsx src/components/SaveToListMenu.tsx
grep -rn 'lib/lists\|ListsView\|ListEditDialog\|SaveToListMenu\|"lists"\|onAddToList\|findItemList' src
```

Atteso: nessun risultato.

- [ ] **Passo 7: controlli, prova veloce e commit**

```bash
bun run format && bun test && bun run typecheck && bun run lint && bun run format:check
```

Atteso: tutto verde.

Con `bun run dev` attivo, apri http://localhost:5180:
- la tab si chiama "Lista della spesa";
- se nel browser c'erano liste, i loro prodotti compaiono raggruppati per volantino.

```bash
git add -A src
git commit -m "feat: one shopping list instead of named lists, with a cart in the results

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Prova nel browser e README

Come per i preset: playwright-core e il Chromium di sistema, con il driver fuori dal repo in `/tmp/claude-1000/-home-giacomo-Workspace-Giacomo-Rossi-dove-conviene-scraper/4547e2f4-ce0e-439e-8af9-657ad654946f/scratchpad/driver/`. La risposta di `/api/scraper` è simulata.

**File:**
- Crea (fuori dal repo, non va nel commit): `<driver>/shopping-e2e.ts`
- Modifica: `README.md`

- [ ] **Passo 1: l'app deve girare** su http://localhost:5180 (`bun run dev`).

- [ ] **Passo 2: scrivi lo script**

`<driver>/shopping-e2e.ts`:

```ts
// End-to-end check of the shopping list. App on :5180, /api/scraper mocked.
import { chromium, type Page } from "playwright-core";

const BASE = "http://localhost:5180/";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium-browser",
});
let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  if (!ok) failures++;
};

const cat = { name: "Iper e super", url: "https://www.doveconviene.it/iper-e-super" };
const flyer = (name: string, slug: string, id: number, validUntil: string, products: string[]) =>
  JSON.stringify({
    flyer: {
      name,
      imageUrl: "",
      category: cat,
      slug,
      url: `https://www.doveconviene.it/x/${slug}?flyerId=${id}&flyerPage=1`,
      validUntil,
      products: products.map((p, i) => ({ name: p, imageUrl: null, price: 1 + i })),
    },
  });
const MOCK =
  [
    flyer("Conad", "conad", 1, "2099-01-10", ["Nutella", "Pasta"]),
    flyer("Coop", "coop", 2, "2099-01-05", ["Pane"]),
  ].join("\n") + "\n";

const SEARCH_PRESET = {
  "dove-conviene:presets": JSON.stringify([
    {
      id: "p",
      name: "Spesa",
      retailers: ["conad", "coop"],
      products: [{ name: "x" }],
      createdAt: 1,
      updatedAt: 1,
    },
  ]),
  "dove-conviene:active-preset": "p",
};

async function open(
  storage: Record<string, string>,
  viewport = { width: 1280, height: 900 }
): Promise<Page> {
  const page = await browser.newPage({ viewport });
  await page.addInitScript((s) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    sessionStorage.setItem("seeded", "1");
  }, storage);
  await page.route("**/api/scraper", (route) =>
    route.fulfill({ contentType: "application/x-ndjson", body: MOCK })
  );
  await page.goto(BASE);
  await page.waitForTimeout(1500);
  return page;
}

const tab = (page: Page) => page.getByRole("button", { name: /^Lista della spesa/ });
/** The topbar counter ("" when hidden): the badge sits right after the label. */
const toBuy = async (page: Page) => (await tab(page).innerText()).replace(/\D/g, "");
const cart = (page: Page, product: string) =>
  page.getByRole("row", { name: new RegExp(product) }).getByRole("button", { name: /lista della spesa/ });
const row = (page: Page, name: string) =>
  page.locator("label", { has: page.getByText(name, { exact: true }) });
const titles = (page: Page) => page.locator("[data-slot=card-title]").allInnerTexts();

// 1. Empty list → back to the results
let page = await open(SEARCH_PRESET);
await tab(page).click();
check(await page.getByText("La lista della spesa è vuota").isVisible(), "1 stato vuoto");
await page.getByRole("button", { name: "Vai ai risultati" }).click();
check(await page.getByRole("button", { name: "Cerca", exact: true }).isVisible(), "1 Vai ai risultati");

// 2. Cart in the results; counter in the topbar
await page.getByRole("button", { name: "Cerca", exact: true }).click();
await page.waitForTimeout(500);
await cart(page, "Nutella").click();
await cart(page, "Pasta").click();
await cart(page, "Pane").click();
check((await cart(page, "Nutella").getAttribute("aria-pressed")) === "true", "2 carrello pieno");
check((await toBuy(page)) === "3", `2 contatore 3 (${await toBuy(page)})`);
await cart(page, "Pasta").click();
check((await toBuy(page)) === "2", "2 secondo clic toglie");
await cart(page, "Pasta").click();

// 3. Groups by expiry
await tab(page).click();
check(JSON.stringify(await titles(page)) === '["Coop","Conad"]', "3 scadenza più vicina prima");
await page.getByRole("combobox", { name: "Ordina" }).click();
await page.getByRole("option", { name: "Scadenza più lontana" }).click();
check(JSON.stringify(await titles(page)) === '["Conad","Coop"]', "3 scadenza più lontana prima");

// 4. Purchased: row and box toggle once; purchased go last; counter follows
await row(page, "Nutella").getByText("Nutella", { exact: true }).click();
check((await row(page, "Nutella").getByRole("checkbox").getAttribute("aria-checked")) === "true", "4 clic sulla riga spunta");
await row(page, "Pasta").getByRole("checkbox").click();
check((await row(page, "Pasta").getByRole("checkbox").getAttribute("aria-checked")) === "true", "4 clic sulla casella spunta una volta");
check((await toBuy(page)) === "1", "4 contatore segue le spunte");
await row(page, "Pasta").getByRole("checkbox").click();
const conadItems = await page
  .locator("[data-slot=card]", { has: page.getByText("Conad", { exact: true }) })
  .locator("[data-slot=item-title]")
  .allInnerTexts();
check(JSON.stringify(conadItems) === '["Pasta","Nutella"]', `4 acquistati in fondo (${conadItems})`);

// 5. The × removes without ticking
await page.getByRole("button", { name: "Togli Pane" }).click();
check((await row(page, "Pane").count()) === 0, "5 la × toglie il prodotto");
check(JSON.stringify(await titles(page)) === '["Conad"]', "5 gruppo vuoto sparisce");

// 6. Retailer filter falls back to all when its last product goes
await page.getByRole("button", { name: "Risultati", exact: true }).click();
await page.getByRole("button", { name: "Cerca", exact: true }).click();
await page.waitForTimeout(500);
await cart(page, "Pane").click();
await tab(page).click();
await page.getByRole("combobox", { name: "Insegna" }).click();
await page.getByRole("option", { name: "Coop" }).click();
check(JSON.stringify(await titles(page)) === '["Coop"]', "6 filtro per insegna");
await page.getByRole("button", { name: "Togli Pane" }).click();
check(JSON.stringify(await titles(page)) === '["Conad"]', "6 filtro torna su tutte");

// 7. Remove purchased
await page.getByRole("button", { name: /Rimuovi acquistati \(1\)/ }).click();
check((await row(page, "Nutella").count()) === 0, "7 rimuovi acquistati");
check((await page.getByRole("button", { name: /Rimuovi acquistati/ }).isDisabled()), "7 pulsante disattivato a 0");
await page.close();

// 8. Migration from the old lists, expired flyers, only once
const oldLists = JSON.stringify([
  {
    id: "a", name: "Spesa", color: "#f00", createdAt: 1, updatedAt: 1,
    items: [
      { productName: "Yogurt", productImage: null, price: 0.99, flyerName: "Lidl", flyerUrl: "https://dc/lidl?flyerId=9", validUntil: "2020-01-01", addedAt: 1 },
      { productName: "Mele", productImage: null, price: 1.5, flyerName: "Conad", flyerUrl: "https://dc/conad?flyerId=8", validUntil: "2099-01-01", addedAt: 2 },
    ],
  },
  {
    id: "b", name: "Doppia", color: "#0f0", createdAt: 1, updatedAt: 1,
    items: [{ productName: "Mele", productImage: null, price: 1.5, flyerName: "Conad", flyerUrl: "https://dc/conad?flyerId=8", validUntil: "2099-01-01", addedAt: 3 }],
  },
]);
page = await open({ "dove-conviene:lists": oldLists });
check((await toBuy(page)) === "2", "8 migrazione senza doppioni");
await tab(page).click();
check(await page.getByText("Scaduto").isVisible(), "8 volantino scaduto segnato");
await page.getByRole("button", { name: /Rimuovi scaduti \(1\)/ }).click();
check((await row(page, "Yogurt").count()) === 0, "8 rimuovi scaduti");
await page.reload();
await page.waitForTimeout(1000);
check((await toBuy(page)) === "1", "8 dopo il riavvio le vecchie liste non tornano");
await page.close();

// 9. Mobile
page = await open({ "dove-conviene:lists": oldLists }, { width: 390, height: 844 });
await tab(page).click();
check(
  await page.evaluate(() => document.documentElement.scrollWidth <= 390),
  "9 nessuno scorrimento orizzontale a 390 px"
);
await page.screenshot({ path: "shopping-mobile.png", fullPage: true });
await page.close();

await browser.close();
console.log(failures === 0 ? "\nTUTTO OK" : `\n${failures} FALLITI`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Passo 3: esegui lo script e correggi**

```bash
cd <driver> && bun shopping-e2e.ts
```

Atteso: tutte le righe `OK` e poi `TUTTO OK`.

Se una riga fallisce, guarda prima la pagina, per esempio con `page.screenshot` o `page.content()`.
- **Se è sbagliato il selettore dello script:** correggi lo script.
- **Se è sbagliata l'app:** correggila con un test che prima fallisce, nel task che possiede quel codice, poi ripeti lo script.

Guarda `shopping-mobile.png` e uno screenshot desktop della pagina.

- [ ] **Passo 4: README**

In `README.md`:
- "I prodotti si possono salvare in\nliste e le ricerche in preset" diventa "I prodotti si possono mettere\nnella lista della spesa (carrello nei risultati) e le ricerche in preset";
- la riga della struttura `  lib/             preset, liste e località (localStorage), filtri insegne` diventa `  lib/             preset, lista della spesa e località (localStorage), filtri insegne`.

- [ ] **Passo 5: controlli finali e commit**

```bash
bun run format && bun test && bun run typecheck && bun run lint && bun run format:check
git add README.md
git commit -m "docs: the shopping list replaces the named lists

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
