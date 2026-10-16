import * as cheerio from "cheerio";
import type { Category } from "../../shared/categories";
import type { Flyer, Product, ProductQuery } from "../../shared/types";
import { absoluteUrl, collapseSpaces, fetchHtml, normalize } from "../http";
import { ttlCache } from "../ttl-cache";

export interface NormalizedQuery {
  /** Folded: lowercase, single spaces, no accents. */
  name: string;
  maxPrice?: number;
}

/** How names are compared: lowercase, single spaces, no accents. */
const fold = (s: string): string =>
  normalize(s)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

export const normalizeQueries = (products: ProductQuery[]): NormalizedQuery[] =>
  products
    .map((p) => ({ name: fold(p.name), maxPrice: p.maxPrice }))
    .filter((q) => q.name);

/** Every word of the query, in any order: "pizza margherita" finds "Pizza Buitoni Margherita". */
const matches = (name: string, query: NormalizedQuery): boolean => {
  const folded = fold(name);
  return query.name.split(" ").every((word) => folded.includes(word));
};

/** "1.19", "1,19" or 1.19; anything else is no price. */
const toPrice = (v: unknown): number | null => {
  const n =
    typeof v === "number"
      ? v
      : typeof v === "string"
        ? Number(v.replace(",", "."))
        : NaN;
  return Number.isFinite(n) ? n : null;
};

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const toItems = (data: unknown): unknown[] =>
  Array.isArray(data) ? data : [data];

const isJsonLdProduct = (v: unknown): v is Record<string, unknown> =>
  isRecord(v) && v["@type"] === "Product";

const getStringArray = (v: unknown): string[] => {
  if (typeof v === "string") return [v];
  if (Array.isArray(v) && v.every((x) => typeof x === "string"))
    return v as string[];
  return [];
};

/** Parses the flyer cards of a category page. */
export function parseFlyerCards(html: string, category: Category): Flyer[] {
  const $ = cheerio.load(html);

  return $(".flyersGrid__item")
    .toArray()
    .map((el) => {
      const $el = $(el);
      const name = collapseSpaces($el.find(".flyerCard__titleText").text());
      const href = $el.find("a.flyerCard__body").attr("href") ?? "";
      const dataBg = $el.find(".flyerCard__blurredBackground").attr("data-bg");
      // /iper-e-super/conad-city/volantino/ultime-offerte-conad-city?flyerId=…
      const slug = href.match(
        /^(?:https?:\/\/[^/]+)?\/[^/]+\/([^/]+)\/(?:volantino|offerte|catalogo)\//
      )?.[1];
      return {
        name,
        slug,
        url: href ? absoluteUrl(href) : "",
        imageUrl: dataBg ? absoluteUrl(dataBg) : "",
        category,
      };
    });
}

export interface FlyerData {
  products: Product[];
  validUntil: string | null;
}

/**
 * Parsed flyer pages, by URL. A flyerId's content doesn't change, so a search
 * repeated with other products costs dc nothing.
 */
const flyerPages = ttlCache<FlyerData>(60 * 60 * 1000);

export async function getFlyerData(
  flyer: Flyer,
  queries: NormalizedQuery[],
  signal?: AbortSignal
): Promise<FlyerData> {
  const url = flyer.url;
  if (!url) return { products: [], validUntil: null };
  // The download is shared with any other search of this flyer, so it isn't
  // tied to this caller's signal: a cancelled search just stops waiting.
  const page = await untilAborted(
    flyerPages.get(url, async () => parseFlyerPage(await fetchHtml(url))),
    signal
  );
  return filterProducts(page, queries);
}

/** `promise`, or a rejection as soon as `signal` aborts. */
function untilAborted<T>(
  promise: Promise<T>,
  signal?: AbortSignal
): Promise<T> {
  if (!signal) return promise;
  if (signal.aborted) return Promise.reject(signal.reason);
  return new Promise<T>((resolve, reject) => {
    const onAbort = () => reject(signal.reason);
    signal.addEventListener("abort", onAbort, { once: true });
    promise.then(
      (value) => {
        signal.removeEventListener("abort", onAbort);
        resolve(value);
      },
      (err) => {
        signal.removeEventListener("abort", onAbort);
        reject(err);
      }
    );
  });
}

/** The products matching `queries` (and the expiry date) of a flyer page. */
export const parseFlyerData = (
  html: string,
  queries: NormalizedQuery[]
): FlyerData => filterProducts(parseFlyerPage(html), queries);

function filterProducts(
  page: FlyerData,
  queries: NormalizedQuery[]
): FlyerData {
  return {
    validUntil: page.validUntil,
    products: page.products.filter((p) => {
      const query = queries.find((q) => matches(p.name, q));
      if (!query) return false;
      return (
        query.maxPrice === undefined ||
        (p.price !== null && p.price <= query.maxPrice)
      );
    }),
  };
}

/** Every product (and the expiry date) in the JSON-LD blocks of a flyer page. */
function parseFlyerPage(html: string): FlyerData {
  const $ = cheerio.load(html);

  const products: Product[] = [];
  let validUntil: string | null = null;

  $('script[type="application/ld+json"]').each((_, el) => {
    const text = $(el).contents().text().trim();
    if (!text) return;

    let parsed: unknown;
    try {
      parsed = JSON.parse(text);
    } catch {
      return;
    }

    for (const item of toItems(parsed)) {
      if (!isRecord(item)) continue;

      if (
        validUntil === null &&
        item["@type"] === "Article" &&
        typeof item["expires"] === "string"
      ) {
        validUntil = item["expires"];
        continue;
      }

      if (!isJsonLdProduct(item)) continue;

      const name = item["name"];
      if (typeof name !== "string" || !name) continue;

      const images = getStringArray(item["image"]);
      const imageUrl = images[0] ?? null;
      const offers = item["offers"];
      const price = isRecord(offers) ? toPrice(offers["price"]) : null;

      products.push({ name, imageUrl, price });
    }
  });

  return { products, validUntil };
}
