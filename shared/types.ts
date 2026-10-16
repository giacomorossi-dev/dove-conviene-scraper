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
 * A dc retailer ("insegna"): one per chain nationwide, e.g. "Conad City";
 * its stores and flyers vary by area.
 */
export interface Retailer {
  name: string;
  /** dc's id for the retailer, as in /volantino/conad-city. */
  slug: string;
  imageUrl: string;
  category: Category;
  /**
   * "store": a chain with its own points of sale; "brand": sold by other
   * chains (Barilla, Garnier…). Unknown for local retailers not in the list.
   */
  kind?: "store" | "brand";
}

/** How far a build of the retailer list got. */
export interface BuildProgress {
  /** Reading dc's sitemaps, then every retailer page, then re-checking kinds. */
  phase: "sitemaps" | "pages" | "kinds";
  done: number;
  total: number;
}

/** GET /api/retailers/status: the local retailer list and its builds. */
export interface CatalogStatus {
  /** When the local list was last built; null until the first build ends. */
  updatedAt: string | null;
  count: number;
  /** A build is running: the first one, or an update (the old list stays). */
  building: boolean;
  progress: BuildProgress | null;
  /** Why the last build failed, if it did. */
  error: string | null;
}

/**
 * A selected retailer or, once scraped, one of its flyers near the chosen
 * place with the matching products.
 */
export interface Flyer {
  name: string;
  imageUrl: string;
  category: Category;
  /** Retailer slug; missing in presets saved before it existed. */
  slug?: string;
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
  /** Lets the page cancel the search (POST /api/scraper/cancel). */
  searchId?: string;
}

/** One NDJSON line streamed back by POST /api/scraper. */
export type ScrapeMessage =
  /** How many flyers will be read: sent once, before the first one. */
  | { total: number }
  | { flyer: Flyer }
  /** A flyer that couldn't be read: the search goes on with the others. */
  | { flyerError: { name: string; url: string; error: string } }
  /** A problem not tied to one flyer, e.g. a category page dc didn't give. */
  | { error: string };
