// What dc shows "nelle vicinanze" of a place, one category at a time: the
// retailers with flyers near it and those flyers. Read on demand (the
// categories the user opens or searches) and cached with the dc session, so
// a search after browsing costs no extra category pages.
import { BASE_URL, categorySlug, type Category } from "../../shared/categories";
import type { Flyer, Place, Retailer } from "../../shared/types";
import { getCatalog } from "../catalog-store";
import { openPlaceSession, type PlaceSession } from "../session";
import { parseFlyerCards } from "./flyers";
import { parseRetailers } from "./retailers";

export interface Nearby {
  retailers: Retailer[];
  flyers: Flyer[];
}

const TTL = 60 * 60 * 1000;
const sessions = new Map<
  string,
  { at: number; session: Promise<PlaceSession> }
>();
const pages = new Map<string, { at: number; data: Promise<Nearby> }>();

/** ~100 m: nearby places share sessions and pages. */
const placeKey = (p: Place) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;

function cached<T>(
  map: Map<string, { at: number } & Record<string, unknown>>,
  key: string,
  field: string,
  load: () => Promise<T>
): Promise<T> {
  const hit = map.get(key);
  if (hit && Date.now() - hit.at < TTL) return hit[field] as Promise<T>;
  const value = load();
  map.set(key, { at: Date.now(), [field]: value });
  value.catch(() => map.delete(key)); // don't keep failures
  return value;
}

const getSession = (place: Place) =>
  cached(sessions, placeKey(place), "session", () => openPlaceSession(place));

/** The retailers and flyers of one category near a place. */
export function getNearby(place: Place, category: Category): Promise<Nearby> {
  const slug = categorySlug(category);
  return cached(pages, `${placeKey(place)}/${slug}`, "data", async () => {
    const session = await getSession(place);
    const html = await session.fetchHtml(`${BASE_URL}/${slug}`);
    // The national list knows the kind and has the canonical logo.
    const known = new Map(getCatalog().map((r) => [r.slug, r]));
    return {
      retailers: parseRetailers(html, category).map(
        (r) => known.get(r.slug) ?? r
      ),
      flyers: parseFlyerCards(html, category).filter((f) => f.url),
    };
  });
}
