import { describe, expect, test } from "bun:test";
import { filterRows, sortRows, type ResultSort } from "./results";
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

describe("sortRows", () => {
  const rows = [
    row("B", { price: 3, validUntil: null }),
    row("A", { price: null, validUntil: "2026-10-18" }),
    row("C", { price: 1, validUntil: "boh" }),
    row("D", { price: 2, validUntil: "2099-01-01" }),
  ];
  const by = (key: ResultSort["key"], dir: ResultSort["dir"]) =>
    names(sortRows(rows, { key, dir }));

  test("by expiry: dated first in either direction, undated or unreadable last", () => {
    expect(by("validUntil", "asc")).toEqual(["A", "D", "B", "C"]);
    expect(by("validUntil", "desc")).toEqual(["D", "A", "B", "C"]);
  });

  test("by price: rows without a price last in either direction", () => {
    expect(by("price", "asc")).toEqual(["C", "D", "B", "A"]);
    expect(by("price", "desc")).toEqual(["B", "D", "C", "A"]);
  });

  test("by name, Italian order", () => {
    expect(by("productName", "desc")).toEqual(["D", "C", "B", "A"]);
  });
});

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
