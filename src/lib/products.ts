import type { ProductQuery } from "@shared/types";

/**
 * A product to search, as typed: "latte", or "burro, 4" for a max price of
 * € 4. A price that isn't a positive number is left out; null when there is
 * no name.
 */
export function parseProduct(raw: string): ProductQuery | null {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf(",");
  if (idx === -1) return { name: trimmed };

  const name = trimmed.slice(0, idx).trim();
  if (!name) return null;

  const maxPrice = Number(
    trimmed
      .slice(idx + 1)
      .trim()
      .replace(",", ".")
  );
  return Number.isFinite(maxPrice) && maxPrice > 0
    ? { name, maxPrice }
    : { name };
}
