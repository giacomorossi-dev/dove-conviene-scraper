import type { Place, PlaceSuggestion } from "@shared/types";

export const DEFAULT_PLACE: Place = {
  name: "Rimini",
  zip: null,
  lat: 44.0594,
  lng: 12.5684,
};

/** "Rimini - 47921", or just "Rimini" when no postal code was picked (dc style). */
export const placeLabel = (place: Place): string =>
  place.zip ? `${place.name} - ${place.zip}` : place.name;

export const samePlace = (a: Place | null, b: Place | null): boolean =>
  a === b ||
  (!!a &&
    !!b &&
    a.name === b.name &&
    a.zip === b.zip &&
    a.lat === b.lat &&
    a.lng === b.lng);

/** Finds the town for a city name saved before places had coordinates. */
export async function resolveCityName(name: string): Promise<Place | null> {
  const res = await fetch(`/api/places?q=${encodeURIComponent(name)}`);
  if (!res.ok) return null;
  const towns = ((await res.json()) as PlaceSuggestion[]).filter((s) => !s.zip);
  const match =
    towns.find((s) => s.name.toLowerCase() === name.toLowerCase()) ?? towns[0];
  return match
    ? { name: match.name, zip: null, lat: match.lat, lng: match.lng }
    : null;
}
