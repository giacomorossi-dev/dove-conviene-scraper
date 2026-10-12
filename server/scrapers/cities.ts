import * as cheerio from "cheerio";
import { BASE_URL } from "../../shared/categories";
import type { City } from "../../shared/types";
import { collapseSpaces, fetchHtml } from "../http";

let cache: City[] | null = null;

export async function getCities(): Promise<City[]> {
  if (cache) return cache;
  cache = parseCities(await fetchHtml(`${BASE_URL}/citta`));
  return cache;
}

/** Parses the /citta page: region headings followed by their city links. */
export function parseCities(html: string): City[] {
  const $ = cheerio.load(html);

  const cities: City[] = [];
  let region = "";

  $("h2.subtitle, .gridList a.listItem").each((_, el) => {
    const $el = $(el);
    if (el.tagName === "h2") {
      region = collapseSpaces($el.text());
      return;
    }
    const slug = ($el.attr("href") ?? "").replace(/^\/+|\/+$/g, "");
    if (!slug) return;
    const name = collapseSpaces($el.text());
    if (!name) return;
    cities.push({ name, slug, region });
  });

  return cities;
}
