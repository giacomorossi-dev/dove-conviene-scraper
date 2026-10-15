// What RetailerSelect shows: the retailers matching the name, the category
// and, optionally, only the selected ones.
import { categorySlug } from "@shared/categories";
import type { Retailer } from "@shared/types";

export interface RetailerFilter {
  /** Any part of the name; empty for all. */
  query: string;
  /** Category slug; null for all. */
  category: string | null;
  onlySelected: boolean;
}

/** Lowercase without accents, as LocationPicker matches places. */
const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** The retailers matching every filter, by name. */
export function filterRetailers(
  retailers: readonly Retailer[],
  { query, category, onlySelected }: RetailerFilter,
  selected: ReadonlySet<string>
): Retailer[] {
  const q = fold(query);
  return retailers
    .filter(
      (r) =>
        (!q || fold(r.name).includes(q)) &&
        (!category || categorySlug(r.category) === category) &&
        (!onlySelected || selected.has(r.slug))
    )
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
}
