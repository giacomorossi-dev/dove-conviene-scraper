import * as cheerio from "cheerio";
import type { Category } from "../config";
import { absoluteUrl, collapseSpaces, fetchHtml } from "../http";
import type { Flyer } from "./flyers";

const cache = new Map<string, Flyer[]>();

export async function getRetailersByCategory(
  category: Category
): Promise<Flyer[]> {
  const cached = cache.get(category.url);
  if (cached) return cached;

  const html = await fetchHtml(category.url);
  const $ = cheerio.load(html);

  const seen = new Set<string>();
  const retailers: Flyer[] = [];

  $('a.flyerCard__title[data-linkType="retailer"]').each((_, el) => {
    const $el = $(el);
    const slug = ($el.attr("href") ?? "").match(/^\/volantino\/([^/?#]+)/)?.[1];
    if (!slug || seen.has(slug)) return;

    const name = collapseSpaces($el.find("h3.flyerCard__titleText").text());
    if (!name) return;

    const $img = $el.find("img").first();
    const raw = $img.attr("data-src") || $img.attr("src") || "";
    const imageUrl = raw ? absoluteUrl(raw) : "";

    seen.add(slug);
    retailers.push({ name, imageUrl, category });
  });

  retailers.sort((a, b) => a.name.localeCompare(b.name, "it"));
  cache.set(category.url, retailers);
  return retailers;
}
