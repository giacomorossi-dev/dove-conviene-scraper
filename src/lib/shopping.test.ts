import { describe, expect, test } from "bun:test";
import {
  flyerLabel,
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
    {
      id: "c",
      name: "Altra",
      color: "#00f",
      items: [{ ...row(), addedAt: 9 }],
    },
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

describe("removals with a retailer filter", () => {
  const conad = item({ flyerName: "Conad", purchased: true });
  const coop = item({
    flyerName: "Coop",
    productName: "Pane",
    purchased: true,
  });
  const oldCoop = item({
    flyerName: "Coop",
    productName: "Uova",
    validUntil: "2026-10-01",
  });
  const oldConad = item({
    flyerName: "Conad",
    productName: "Olio",
    validUntil: "2026-10-01",
  });

  test("only the filtered retailer's purchased products go", () => {
    expect(withoutPurchased([conad, coop], "Coop")).toEqual([conad]);
    expect(withoutPurchased([conad, coop], null)).toEqual([]);
  });

  test("only the filtered retailer's expired products go", () => {
    expect(withoutExpired([oldConad, oldCoop], NOW, "Coop")).toEqual([
      oldConad,
    ]);
  });
});

describe("groupByFlyer", () => {
  const conad = (over: Partial<ShoppingItem>) =>
    item({
      flyerName: "Conad",
      flyerUrl: "u-conad",
      validUntil: "2026-10-21",
      ...over,
    });
  const coop = (over: Partial<ShoppingItem>) =>
    item({
      flyerName: "Coop",
      flyerUrl: "u-coop",
      validUntil: "2026-10-18",
      ...over,
    });
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
    expect(urls(groupByFlyer(items, "asc"))).toEqual([
      "u-coop",
      "u-conad",
      "u-lidl",
    ]);
  });

  test("farthest expiry first; undated flyers still last", () => {
    expect(urls(groupByFlyer(items, "desc"))).toEqual([
      "u-conad",
      "u-coop",
      "u-lidl",
    ]);
  });

  test("in a group: to buy first, then purchased, each by when added", () => {
    const [coopGroup, conadGroup] = groupByFlyer(items, "asc");
    expect(conadGroup.items.map((i) => i.productName)).toEqual([
      "Olio",
      "Pasta",
    ]);
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

describe("flyer names", () => {
  test("a flyer reads 'Conad · BIS', or just the retailer without a name", () => {
    expect(flyerLabel("Conad", "BIS")).toBe("Conad · BIS");
    expect(flyerLabel("Conad", undefined)).toBe("Conad");
  });

  test("saved products keep the flyer's name and cover; groups show them", () => {
    const saved = item({
      flyerTitle: "BIS",
      flyerImage: "https://img/cover.webp",
    });
    const [back] = parseShoppingList(JSON.stringify([saved]));
    expect(back).toEqual(saved);
    expect(groupByFlyer([saved], "asc")[0]).toMatchObject({
      flyerTitle: "BIS",
    });
  });
});
