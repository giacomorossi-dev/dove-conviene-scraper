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
