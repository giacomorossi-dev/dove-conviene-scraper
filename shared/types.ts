// Domain and API types shared by the API server and the client.
import type { Category } from "./categories";

export interface City {
  name: string;
  slug: string;
  region: string;
}

export interface Product {
  name: string;
  imageUrl: string | null;
  price: number | null;
}

/**
 * A retailer (from /api/retailers) or, once scraped, one of its flyers in a
 * city with the matching products.
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
  city: string;
  flyers: Flyer[];
  products: ProductQuery[];
}

/** One NDJSON line streamed back by POST /api/scraper. */
export type ScrapeMessage = { flyer: Flyer } | { error: string };
