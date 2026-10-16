import { describe, expect, test } from "bun:test";
import { parseProduct } from "./products";

describe("parseProduct", () => {
  test("a name, or a name and a max price after a comma", () => {
    expect(parseProduct("  latte ")).toEqual({ name: "latte" });
    expect(parseProduct("burro, 4")).toEqual({ name: "burro", maxPrice: 4 });
    expect(parseProduct("burro,4,50")).toEqual({
      name: "burro",
      maxPrice: 4.5,
    });
  });

  test("nothing to add: empty text or a price without a name", () => {
    expect(parseProduct("   ")).toBeNull();
    expect(parseProduct(", 4")).toBeNull();
  });

  test("a price that isn't a positive number is left out", () => {
    expect(parseProduct("latte, abc")).toEqual({ name: "latte" });
    expect(parseProduct("latte, 0")).toEqual({ name: "latte" });
  });
});
