import { describe, expect, test } from "bun:test";
import { CATEGORIES } from "@shared/categories";
import type { Retailer } from "@shared/types";
import { filterRetailers, type RetailerFilter } from "./retailerFilter";

const [iper, discount] = CATEGORIES;
const retailer = (name: string, slug: string, category = iper): Retailer => ({
  name,
  slug,
  imageUrl: "",
  category,
});
const all = [
  retailer("Conad City", "conad-city"),
  retailer("Eurospin", "eurospin", discount),
  retailer("Coop", "coop"),
  retailer("Caffè Borbone", "caffe-borbone"),
];
const none: RetailerFilter = { query: "", category: null, onlySelected: false };
const names = (rs: Retailer[]) => rs.map((r) => r.name);

describe("filterRetailers", () => {
  test("without filters: every retailer, alphabetical", () => {
    expect(names(filterRetailers(all, none, new Set()))).toEqual([
      "Caffè Borbone",
      "Conad City",
      "Coop",
      "Eurospin",
    ]);
  });

  test("name: any part, ignoring case, accents and surrounding spaces", () => {
    expect(
      names(filterRetailers(all, { ...none, query: "CAFFE" }, new Set()))
    ).toEqual(["Caffè Borbone"]);
    expect(
      names(filterRetailers(all, { ...none, query: " city " }, new Set()))
    ).toEqual(["Conad City"]);
  });

  test("category, by slug", () => {
    expect(
      names(filterRetailers(all, { ...none, category: "discount" }, new Set()))
    ).toEqual(["Eurospin"]);
  });

  test("only the selected ones", () => {
    const selected = new Set(["coop", "eurospin"]);
    expect(
      names(filterRetailers(all, { ...none, onlySelected: true }, selected))
    ).toEqual(["Coop", "Eurospin"]);
  });

  test("filters combine", () => {
    const selected = new Set(["coop", "eurospin"]);
    const filter = {
      query: "co",
      category: "iper-e-super",
      onlySelected: true,
    };
    expect(names(filterRetailers(all, filter, selected))).toEqual(["Coop"]);
  });
});
