// Location suggestions and reverse geocoding via Photon (OpenStreetMap,
// photon.komoot.io): the free counterpart of the Woosmap autocomplete dc uses.
// Names match towns and hamlets, digits match postal codes, like dc.
import type { Place, PlaceSuggestion } from "../shared/types";

const PHOTON = "https://photon.komoot.io";
/** Italy's bounding box (lon/lat), so results stay in the country. */
const ITALY_BBOX = "6.6,35.4,18.6,47.1";
const MAX_SUGGESTIONS = 5;
/** Place kinds we suggest, most important first (dc lists towns first). */
const KIND_RANK: Record<string, number> = {
  city: 0,
  town: 1,
  village: 2,
  suburb: 3,
  hamlet: 4,
};
// Photon's usage policy asks clients to identify themselves.
const HEADERS = { "user-agent": "dove-conviene-scraper (personal project)" };

export interface PhotonFeature {
  geometry: { coordinates: [number, number] };
  properties: {
    name?: string;
    osm_key?: string;
    osm_value?: string;
    countrycode?: string;
    postcode?: string;
    city?: string;
    county?: string;
  };
}

/** Lowercase without accents, to compare "Forlì" with "forli". */
const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** True when the query is (the start of) a postal code. */
export const isPostcodeQuery = (q: string): boolean => /^\d{2,5}$/.test(q);

/** Turns Photon search results into dc-style suggestions. */
export function toSuggestions(features: PhotonFeature[]): PlaceSuggestion[] {
  const seen = new Set<string>();
  const out: PlaceSuggestion[] = [];
  for (const { geometry, properties: p } of features) {
    if (p.countrycode !== "IT" || p.osm_key !== "place" || !p.name) continue;
    const [lng, lat] = geometry.coordinates;
    let suggestion: PlaceSuggestion;
    if (p.osm_value === "postcode") {
      const town = p.city ?? p.county;
      if (!town) continue;
      suggestion = {
        name: town,
        zip: p.name,
        lat,
        lng,
        label: `${p.name}, ${town}, Italia`,
      };
    } else if ((p.osm_value ?? "") in KIND_RANK) {
      // dc shows the province only when it differs: "Rimini, Italia" but
      // "Reggiolo, Reggio nell'Emilia, Italia".
      const parts = [p.name, p.county !== p.name ? p.county : null, "Italia"];
      suggestion = {
        name: p.name,
        zip: null,
        lat,
        lng,
        label: parts.filter(Boolean).join(", "),
      };
    } else continue;
    if (seen.has(suggestion.label)) continue;
    seen.add(suggestion.label);
    out.push(suggestion);
  }
  return out;
}

async function photon(path: string, params: Record<string, string>) {
  const url = `${PHOTON}${path}?${new URLSearchParams(params)}`;
  // Photon is a public service: don't let a hung request hang the search.
  const res = await fetch(url, {
    headers: HEADERS,
    signal: AbortSignal.timeout(10_000),
  });
  if (!res.ok) throw new Error(`GET ${url} → ${res.status}`);
  return ((await res.json()) as { features?: PhotonFeature[] }).features ?? [];
}

const searchPhoton = (q: string, tag: string) =>
  photon("/api", { q, limit: "15", bbox: ITALY_BBOX, osm_tag: tag });

const cache = new Map<string, PlaceSuggestion[]>();

export async function searchPlaces(query: string): Promise<PlaceSuggestion[]> {
  const q = query.trim().toLowerCase();
  if (q.length < 2) return [];
  const cached = cache.get(q);
  if (cached) return cached;

  let suggestions: PlaceSuggestion[];
  if (isPostcodeQuery(q)) {
    const byZip = (a: PlaceSuggestion, b: PlaceSuggestion) =>
      a.zip!.localeCompare(b.zip!);
    const matches = toSuggestions(await searchPhoton(q, "place:postcode"))
      .filter((s) => s.zip!.startsWith(q))
      .sort(byZip);
    // Like dc, a full postal code also lists the other codes of its town
    // (Photon finds them searching the first four digits).
    const town = q.length === 5 ? matches[0]?.name : undefined;
    const siblings = town
      ? toSuggestions(await searchPhoton(q.slice(0, 4), "place:postcode"))
          .filter((s) => s.name === town && s.zip !== q)
          .sort(byZip)
      : [];
    suggestions = [...matches, ...siblings];
  } else {
    // Photon is fuzzy ("reggio" also finds Rueglio): like dc, keep the places
    // that contain what was typed, unless that leaves nothing (a typo).
    const rank = (f: PhotonFeature) => KIND_RANK[f.properties.osm_value!] ?? 9;
    const features = await searchPhoton(q, "place");
    const all = toSuggestions(features.sort((a, b) => rank(a) - rank(b)));
    const contains = all.filter((s) => fold(s.name).includes(fold(q)));
    suggestions = contains.length ? contains : all;
  }
  suggestions = suggestions.slice(0, MAX_SUGGESTIONS);
  if (cache.size > 500) cache.clear();
  cache.set(q, suggestions);
  return suggestions;
}

/** Maps the nearest Photon object to the town (and postal code) around it. */
export function toPlace(
  features: PhotonFeature[],
  lat: number,
  lng: number
): Place | null {
  const p = features.find((f) => f.properties.countrycode === "IT")?.properties;
  const name = p?.city ?? p?.name;
  return name ? { name, zip: p?.postcode ?? null, lat, lng } : null;
}

export async function reversePlace(
  lat: number,
  lng: number
): Promise<Place | null> {
  const features = await photon("/reverse", {
    lat: String(lat),
    lon: String(lng),
    limit: "1",
  });
  return toPlace(features, lat, lng);
}
