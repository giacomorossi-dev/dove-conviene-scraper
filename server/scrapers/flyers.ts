import * as cheerio from "cheerio";
import type { Category } from "../../shared/categories";
import type { Flyer, Product, ProductQuery } from "../../shared/types";
import { absoluteUrl, collapseSpaces, fetchHtml, normalize } from "../http";

export interface NormalizedQuery {
  name: string;
  maxPrice?: number;
}

export const normalizeQueries = (products: ProductQuery[]): NormalizedQuery[] =>
  products
    .map((p) => ({ name: normalize(p.name), maxPrice: p.maxPrice }))
    .filter((q) => q.name);

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

export async function getFlyerData(
  flyer: Flyer,
  queries: NormalizedQuery[]
): Promise<FlyerData> {
  if (!flyer.url) return { products: [], validUntil: null };
  return parseFlyerData(await fetchHtml(flyer.url), queries);
}

/**
 * Extracts the products matching `queries` (and the expiry date) from the
 * JSON-LD blocks of a flyer page.
 */
export function parseFlyerData(
  html: string,
  queries: NormalizedQuery[]
): FlyerData {
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

      const n = normalize(name);
      const match = queries.find((q) => n.includes(q.name));
      if (!match) continue;

      const images = getStringArray(item["image"]);
      const imageUrl = images[0] ?? null;

      let price: number | null = null;
      const offers = item["offers"];
      if (isRecord(offers)) {
        const p = offers["price"];
        if (typeof p === "string") price = Number(p);
        else if (typeof p === "number") price = p;
      }

      if (match.maxPrice !== undefined) {
        if (price === null || price > match.maxPrice) continue;
      }

      products.push({ name, imageUrl, price });
    }
  });

  return { products, validUntil };
}
