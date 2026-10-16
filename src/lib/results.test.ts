import { describe, expect, test } from "bun:test";
import { filterRows, groupByQuery, onlyFlyers } from "./results";
import type { RowData } from "./shopping";

const row = (productName: string, over: Partial<RowData> = {}): RowData => ({
  productName,
  productImage: null,
  price: 1,
  flyerName: "Conad",
  flyerUrl: "u",
  validUntil: "2026-10-20",
  ...over,
});
const names = (rows: RowData[]) => rows.map((r) => r.productName);

describe("filterRows", () => {
  const rows = [
    row("Caffè Borbone", { flyerName: "Coop" }),
    row("Latte", { validUntil: "2000-01-01" }),
  ];
  const today = new Date(2026, 9, 15, 12);

  test("text matches product or retailer, ignoring case and accents", () => {
    expect(names(filterRows(rows, "caffe", false, today))).toEqual([
      "Caffè Borbone",
    ]);
    expect(names(filterRows(rows, "COOP", false, today))).toEqual([
      "Caffè Borbone",
    ]);
  });

  test("expired rows can be hidden", () => {
    expect(names(filterRows(rows, "", true, today))).toEqual(["Caffè Borbone"]);
  });
});

describe("onlyFlyers", () => {
  test("drops the rows of excluded flyers; nothing excluded keeps them all", () => {
    const rows = [row("A", { flyerUrl: "u1" }), row("B", { flyerUrl: "u2" })];
    expect(names(onlyFlyers(rows, new Set(["u1"])))).toEqual(["B"]);
    expect(onlyFlyers(rows, new Set())).toEqual(rows);
  });
});

describe("groupByQuery", () => {
  const groups = (rows: RowData[], queries: string[]) =>
    groupByQuery(rows, queries).map((g) => ({
      query: g.query,
      rows: names(g.rows),
      best: g.best,
    }));

  test("one group per searched product, in the preset's order, even with no offers", () => {
    const rows = [
      row("Latte intero", { query: "latte" }),
      row("Pane", { query: "pane" }),
    ];
    expect(groups(rows, ["pane", "nutella", "latte"])).toEqual([
      { query: "pane", rows: ["Pane"], best: 1 },
      { query: "nutella", rows: [], best: null },
      { query: "latte", rows: ["Latte intero"], best: 1 },
    ]);
  });

  test("cheapest first, offers without a price last", () => {
    const rows = [
      row("A", { query: "latte", price: 2 }),
      row("B", { query: "latte", price: null }),
      row("C", { query: "latte", price: 0.99 }),
      row("D", { query: "latte", price: 1.5 }),
    ];
    expect(groups(rows, ["latte"])).toEqual([
      { query: "latte", rows: ["C", "D", "A", "B"], best: 0.99 },
    ]);
  });

  test("the best price is the lowest one, shared by every tied offer", () => {
    const rows = [
      row("A", { query: "latte", price: 1.2 }),
      row("B", { query: "latte", price: 1.2 }),
      row("C", { query: "latte", price: 3 }),
    ];
    const [group] = groupByQuery(rows, ["latte"]);
    expect(group?.best).toBe(1.2);
    expect(group?.rows.filter((r) => r.price === group.best)).toHaveLength(2);
  });

  test("no group has a best price when none of its offers has a price", () => {
    const rows = [row("A", { query: "latte", price: null })];
    expect(groupByQuery(rows, ["latte"])[0]?.best).toBeNull();
  });

  test("the same product typed twice is one group, under its first spelling", () => {
    const rows = [row("A", { query: "Caffè " })];
    expect(groups(rows, ["Caffè", " caffe", "CAFFÈ"])).toEqual([
      { query: "Caffè", rows: ["A"], best: 1 },
    ]);
  });

  test("offers for products no longer in the preset come last, in their own groups", () => {
    const rows = [
      row("A", { query: "burro" }),
      row("B"),
      row("C", { query: "latte" }),
      row("D", { query: "burro" }),
    ];
    expect(groups(rows, ["latte"])).toEqual([
      { query: "latte", rows: ["C"], best: 1 },
      { query: "burro", rows: ["A", "D"], best: 1 },
      { query: "", rows: ["B"], best: 1 },
    ]);
  });
});
