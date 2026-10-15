import { describe, expect, test } from "bun:test";
import { CATEGORIES } from "@shared/categories";
import type { Retailer } from "@shared/types";
import { knownRetailers, retailerInitials } from "./retailers";

const retailer = (name: string, slug: string): Retailer => ({
  name,
  slug,
  imageUrl: "",
  category: CATEGORIES[0],
});

describe("retailerInitials", () => {
  test("first letters of the first two words, uppercase", () => {
    expect(retailerInitials("Conad City")).toBe("CC");
    expect(retailerInitials("coop")).toBe("C");
    expect(retailerInitials("  Il   Gigante  Market ")).toBe("IG");
  });
});

describe("knownRetailers", () => {
  test("the slugs in the list, in order; unknown ones are skipped", () => {
    const conad = retailer("Conad", "conad");
    const coop = retailer("Coop", "coop");
    const bySlug = new Map([
      ["conad", conad],
      ["coop", coop],
    ]);
    expect(knownRetailers(["coop", "gone", "conad"], bySlug)).toEqual([
      coop,
      conad,
    ]);
  });
});
