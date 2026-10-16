// POST /api/scraper: the selected retailers' flyers near a place, each with
// the products matching the queries, streamed as they are read.
import {
  categoryBySlug,
  categorySlug,
  type Category,
} from "../../shared/categories";
import type {
  Flyer,
  Place,
  ProductQuery,
  ScrapeMessage,
} from "../../shared/types";
import { normalize } from "../http";
import {
  getFlyerData,
  normalizeQueries,
  type FlyerData,
  type NormalizedQuery,
} from "./flyers";
import { getNearbyFlyers } from "./nearby";

/** Where the search reads from dc; tests pass fakes. */
export interface ScrapeDeps {
  nearbyFlyers: (place: Place, category: Category) => Promise<Flyer[]>;
  flyerData: (
    flyer: Flyer,
    queries: NormalizedQuery[],
    signal?: AbortSignal
  ) => Promise<FlyerData>;
}

const dc: ScrapeDeps = {
  nearbyFlyers: getNearbyFlyers,
  flyerData: getFlyerData,
};

/**
 * One message per flyer read (or not read: one failure doesn't stop the
 * search). Stops as soon as `signal` aborts, e.g. when the page goes away.
 */
export async function* scrapeFlyersStream(
  place: Place,
  retailers: Flyer[],
  products: ProductQuery[],
  signal?: AbortSignal,
  deps: ScrapeDeps = dc
): AsyncGenerator<ScrapeMessage> {
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
    if (signal?.aborted) return;
    try {
      const flyers = await deps.nearbyFlyers(place, category);
      matched.push(
        ...flyers.filter(
          (f) => (f.slug && slugs.has(f.slug)) || names.has(normalize(f.name))
        )
      );
    } catch (err) {
      if (signal?.aborted) return;
      console.warn(`Categoria ${category.name} non letta:`, err);
      yield { error: `Categoria ${category.name} non letta: ${String(err)}` };
    }
  }

  for (const flyer of matched) {
    if (signal?.aborted) return;
    try {
      const { products: found, validUntil } = await deps.flyerData(
        flyer,
        queries,
        signal
      );
      if (signal?.aborted) return;
      yield {
        flyer: { ...flyer, products: found, ...(validUntil && { validUntil }) },
      };
    } catch (err) {
      if (signal?.aborted) return;
      console.warn(`Volantino non letto: ${flyer.url}`, err);
      yield {
        flyerError: {
          name: flyer.name,
          url: flyer.url ?? "",
          error: String(err),
        },
      };
    }
  }
}
