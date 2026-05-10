import * as cheerio from "cheerio";
import { BASE_URL, type Category } from "../config";
import {
  absoluteUrl,
  collapseSpaces,
  fetchHtml,
  normalize,
  slugify,
} from "../http";

export interface Product {
  name: string;
  imageUrl: string | null;
  price: number | null;
}

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

interface NormalizedQuery {
  name: string;
  maxPrice?: number;
}

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

function categorySlug(category: Category): string {
  return category.url.replace(`${BASE_URL}/`, "").replace(/\/$/, "");
}

async function getFlyersByCategory(
  citySlug: string,
  category: Category,
  wanted: Flyer[]
): Promise<Flyer[]> {
  const url = `${BASE_URL}/${citySlug}/${categorySlug(category)}`;
  const html = await fetchHtml(url);
  const $ = cheerio.load(html);

  const cards: Flyer[] = $(".flyersGrid__item")
    .toArray()
    .map((el) => {
      const $el = $(el);
      const name = collapseSpaces($el.find(".flyerCard__titleText").text());
      const href = $el.find("a.flyerCard__body").attr("href") ?? "";
      const dataBg = $el
        .find(".flyerCard__blurredBackground")
        .attr("data-bg");
      return {
        name,
        url: href ? absoluteUrl(href) : "",
        imageUrl: dataBg ? absoluteUrl(dataBg) : "",
        category,
      };
    });

  const wantedNames = wanted.map((f) => f.name);
  return cards.filter((f) => wantedNames.some((n) => f.name.includes(n)));
}

interface FlyerData {
  products: Product[];
  validUntil: string | null;
}

async function getFlyerData(
  flyer: Flyer,
  queries: NormalizedQuery[]
): Promise<FlyerData> {
  if (!flyer.url) return { products: [], validUntil: null };
  const html = await fetchHtml(flyer.url);
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

export async function* scrapeFlyersStream(
  location: string,
  flyers: Flyer[],
  products: ProductQuery[]
): AsyncGenerator<Flyer> {
  const citySlug = slugify(location);
  const queries: NormalizedQuery[] = products
    .map((p) => ({ name: normalize(p.name), maxPrice: p.maxPrice }))
    .filter((q) => q.name);

  const categories = flyers.reduce<Category[]>((acc, f) => {
    if (!acc.find((c) => c.url === f.category.url)) acc.push(f.category);
    return acc;
  }, []);

  const matched: Flyer[] = [];
  for (const category of categories) {
    matched.push(
      ...(await getFlyersByCategory(
        citySlug,
        category,
        flyers.filter((f) => f.category.name === category.name)
      ))
    );
  }

  for (const flyer of matched) {
    const { products: ps, validUntil } = await getFlyerData(flyer, queries);
    flyer.products = ps;
    if (validUntil) flyer.validUntil = validUntil;
    yield flyer;
  }
}
