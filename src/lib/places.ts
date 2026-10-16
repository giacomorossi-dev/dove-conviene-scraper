import type { Place } from "@shared/types";

export const DEFAULT_PLACE: Place = {
  name: "Rimini",
  zip: null,
  lat: 44.0594,
  lng: 12.5684,
};

/** "Rimini - 47921", or just "Rimini" when no postal code was picked (dc style). */
export const placeLabel = (place: Place): string =>
  place.zip ? `${place.name} - ${place.zip}` : place.name;

const PLACE_KEY = "dove-conviene:place";

/** A saved place, or null when it's missing or has no usable coordinates. */
export function parsePlace(raw: string | null): Place | null {
  if (!raw) return null;
  try {
    const p: unknown = JSON.parse(raw);
    if (typeof p !== "object" || p === null) return null;
    const { name, zip, lat, lng } = p as Record<string, unknown>;
    return typeof name === "string" &&
      typeof lat === "number" &&
      Number.isFinite(lat) &&
      typeof lng === "number" &&
      Number.isFinite(lng)
      ? { name, zip: typeof zip === "string" ? zip : null, lat, lng }
      : null;
  } catch {
    return null;
  }
}

/** The place chosen in the topbar, saved on its own since presets lost it. */
export const loadPlace = (): Place | null =>
  typeof localStorage === "undefined"
    ? null
    : parsePlace(localStorage.getItem(PLACE_KEY));

export function savePlace(place: Place): void {
  if (typeof localStorage !== "undefined")
    localStorage.setItem(PLACE_KEY, JSON.stringify(place));
}
