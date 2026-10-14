// Domain and API types shared by the API server and the client.
import type { Category } from "./categories";

/** Where to look for flyers: a town or one of its postal codes. */
export interface Place {
  name: string;
  /** Set when a postal code was picked (or found via geolocation). */
  zip: string | null;
  lat: number;
  lng: number;
}

/** A location suggestion from GET /api/places. */
export interface PlaceSuggestion extends Place {
  /** dc-style text: "Reggiolo, Reggio nell'Emilia, Italia", "47921, Rimini, Italia". */
  label: string;
}

export interface Product {
  name: string;
  imageUrl: string | null;
  price: number | null;
}

/**
 * A retailer (from /api/retailers) or, once scraped, one of its flyers near
 * the chosen place with the matching products.
 */
export interface Flyer {
  name: string;
  imageUrl: string;
  category: Category;
  url?: string;
  validUntil?: string;
  products?: Product[];
}

export interface ProductQuery {
  name: string;
  maxPrice?: number;
}

/** Body of POST /api/scraper. */
export interface ScrapeRequest {
  place: Place;
  flyers: Flyer[];
  products: ProductQuery[];
}

/** One NDJSON line streamed back by POST /api/scraper. */
export type ScrapeMessage = { flyer: Flyer } | { error: string };
