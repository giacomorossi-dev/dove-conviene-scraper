import type { Flyer, Retailer } from "@shared/types";

/** A retailer as POST /api/scraper expects it. */
export const toSelection = ({
  name,
  slug,
  imageUrl,
  category,
}: Retailer): Flyer => ({ name, slug, imageUrl, category });

/** For a logo that doesn't load: "Conad City" → "CC". */
export const retailerInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** The retailers of these slugs that are in the local list, in order. */
export const knownRetailers = (
  slugs: readonly string[],
  bySlug: ReadonlyMap<string, Retailer>
): Retailer[] => slugs.flatMap((s) => bySlug.get(s) ?? []);
