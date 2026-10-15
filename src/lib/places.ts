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

/** The place chosen in the topbar, saved on its own since presets lost it. */
export function loadPlace(): Place | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}

export function savePlace(place: Place): void {
  if (typeof localStorage !== "undefined")
    localStorage.setItem(PLACE_KEY, JSON.stringify(place));
}
