import type { Flyer, Retailer } from "@shared/types";

/** Whether a selected flyer is this retailer (old presets have no slug). */
export const isRetailer = (f: Flyer, r: Retailer): boolean =>
  f.slug ? f.slug === r.slug : f.name === r.name;

/** What a preset stores for a selected retailer. */
export const toSelection = ({
  name,
  slug,
  imageUrl,
  category,
}: Retailer): Flyer => ({ name, slug, imageUrl, category });
