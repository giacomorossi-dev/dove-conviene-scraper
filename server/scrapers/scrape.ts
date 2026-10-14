// POST /api/scraper: the selected retailers' flyers near a place, each with
// the products matching the queries, streamed as they are read.
import { categoryBySlug, categorySlug } from "../../shared/categories";
import type { Flyer, Place, ProductQuery } from "../../shared/types";
import { normalize } from "../http";
import { getFlyerData, normalizeQueries } from "./flyers";
import { getNearby } from "./nearby";

export async function* scrapeFlyersStream(
  place: Place,
  retailers: Flyer[],
  products: ProductQuery[]
): AsyncGenerator<Flyer> {
  const queries = normalizeQueries(products);
  // Retailers are matched exactly by slug ("Conad" no longer pulls in Conad
  // City); presets saved before slugs existed fall back to the exact name.
  const slugs = new Set(retailers.flatMap((r) => (r.slug ? [r.slug] : [])));
  const names = new Set(
    retailers.filter((r) => !r.slug).map((r) => normalize(r.name))
  );
  // Only the categories of the selected retailers (presets may hold older
  // category names: go by slug).
  const categories = new Set(
    retailers.flatMap((r) => categoryBySlug(categorySlug(r.category)) ?? [])
  );
  const matched: Flyer[] = [];
  for (const category of categories) {
    const { flyers } = await getNearby(place, category);
    matched.push(
      ...flyers.filter(
        (f) => (f.slug && slugs.has(f.slug)) || names.has(normalize(f.name))
      )
    );
  }

  for (const flyer of matched) {
    const { products: ps, validUntil } = await getFlyerData(flyer, queries);
    yield { ...flyer, products: ps, ...(validUntil && { validUntil }) };
  }
}
