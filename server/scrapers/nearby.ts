// The flyers dc shows "nelle vicinanze" of a place, one category at a time.
// Cached with the dc session for an hour, so searching again (other products,
// same place) costs no extra category pages.
import { BASE_URL, categorySlug, type Category } from "../../shared/categories";
import type { Flyer, Place } from "../../shared/types";
import { openPlaceSession, type PlaceSession } from "../session";
import { ttlCache } from "../ttl-cache";
import { parseFlyerCards } from "./flyers";

const TTL = 60 * 60 * 1000;
const sessions = ttlCache<PlaceSession>(TTL);
const pages = ttlCache<Flyer[]>(TTL);

/** ~100 m: nearby places share sessions and pages. */
const placeKey = (p: Place) => `${p.lat.toFixed(3)},${p.lng.toFixed(3)}`;

/** The flyers of one category near a place. */
export function getNearbyFlyers(
  place: Place,
  category: Category
): Promise<Flyer[]> {
  const slug = categorySlug(category);
  return pages.get(`${placeKey(place)}/${slug}`, async () => {
    const session = await sessions.get(placeKey(place), () =>
      openPlaceSession(place)
    );
    const html = await session.fetchHtml(`${BASE_URL}/${slug}`);
    return parseFlyerCards(html, category).filter((f) => f.url);
  });
}
