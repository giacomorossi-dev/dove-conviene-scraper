// Parser tests against real doveconviene.it pages saved in __fixtures__.
// Assertions are structural so they keep passing after `fixtures:update`;
// if they fail after a refresh, the site markup changed.
import { describe, expect, test } from "bun:test";
import { BASE_URL, CATEGORIES } from "../config";
import { parseCities } from "./cities";
import { normalizeQueries, parseFlyerCards, parseFlyerData } from "./flyers";
import { parseRetailers } from "./retailers";

const fixture = (name: string) =>
  Bun.file(new URL(`./__fixtures__/${name}`, import.meta.url)).text();

const category = CATEGORIES[0];

describe("parseCities", async () => {
  const cities = parseCities(await fixture("cities.html"));

  test("finds hundreds of cities across all 20 Italian regions", () => {
    expect(cities.length).toBeGreaterThan(100);
    expect(new Set(cities.map((c) => c.region)).size).toBe(20);
  });

  test("every city has a name, a URL slug and a region", () => {
    for (const c of cities) {
      expect(c.name).not.toBe("");
      expect(c.slug).toMatch(/^[a-z0-9-]+$/);
      expect(c.region).not.toBe("");
    }
  });

  test("includes Rimini in Emilia-Romagna", () => {
    expect(cities).toContainEqual({
      name: "Rimini",
      slug: "rimini",
      region: "Emilia-Romagna",
    });
  });

  test("returns nothing for unrelated markup", () => {
    expect(parseCities("<html><body><p>nope</p></body></html>")).toEqual([]);
  });
});

describe("parseRetailers", async () => {
  const retailers = parseRetailers(await fixture("category.html"), category);

  test("finds the category retailers", () => {
    expect(retailers.length).toBeGreaterThanOrEqual(5);
  });

  test("dedupes and sorts by name (Italian collation)", () => {
    const names = retailers.map((r) => r.name);
    expect(new Set(names).size).toBe(names.length);
    expect(names).toEqual([...names].sort((a, b) => a.localeCompare(b, "it")));
  });

  test("returns absolute logo URLs and the requested category", () => {
    for (const r of retailers) {
      expect(r.imageUrl).toMatch(/^https:\/\//);
      expect(r.category).toBe(category);
    }
  });
});

describe("parseFlyerCards", async () => {
  const cards = parseFlyerCards(await fixture("city-category.html"), category);
  const withUrl = cards.filter((c) => c.url);

  test("finds flyer cards linking to the city's flyers", () => {
    expect(withUrl.length).toBeGreaterThan(0);
    for (const c of withUrl) {
      expect(c.name).not.toBe("");
      expect(c.url).toStartWith(`${BASE_URL}/rimini/`);
      expect(c.category).toBe(category);
    }
  });
});

describe("parseFlyerData (fixture)", async () => {
  const html = await fixture("flyer.html");
  // An empty query matches every product: handy to inspect the whole flyer.
  const all = parseFlyerData(html, [{ name: "" }]);

  test("extracts products with prices from JSON-LD", () => {
    expect(all.products.length).toBeGreaterThan(0);
    for (const p of all.products) {
      expect(p.name).not.toBe("");
      if (p.price !== null) expect(Number.isFinite(p.price)).toBe(true);
    }
  });

  test("extracts the expiry date", () => {
    expect(all.validUntil).not.toBeNull();
    expect(Number.isNaN(Date.parse(all.validUntil ?? ""))).toBe(false);
  });

  test("filters by product query and max price", () => {
    const target = all.products.find((p) => p.price !== null);
    if (!target || target.price === null) throw new Error("no priced product");
    const [query] = normalizeQueries([{ name: target.name }]);

    expect(parseFlyerData(html, [query]).products).toContainEqual(target);
    expect(
      parseFlyerData(html, [{ ...query, maxPrice: target.price }]).products
    ).toContainEqual(target);
    expect(
      parseFlyerData(html, [{ ...query, maxPrice: target.price - 0.01 }])
        .products
    ).not.toContainEqual(target);
    expect(
      parseFlyerData(html, [{ name: "prodotto-inesistente-xyz" }]).products
    ).toEqual([]);
  });
});

describe("parseFlyerData (JSON-LD edge cases)", () => {
  const page = (...blocks: string[]) =>
    `<html><head>${blocks
      .map((b) => `<script type="application/ld+json">${b}</script>`)
      .join("")}</head></html>`;

  test("reads arrays, string prices and the Article expiry; skips bad blocks", () => {
    const html = page(
      "{ not json",
      JSON.stringify({ "@type": "Article", expires: "2099-01-31" }),
      JSON.stringify([
        {
          "@type": "Product",
          name: "Latte Intero 1L",
          image: ["https://img/1.png", "https://img/2.png"],
          offers: { price: "1.19" },
        },
        { "@type": "Product", name: "Burro 250g", offers: { price: 2.49 } },
        { "@type": "Product", offers: { price: 9 } },
        { "@type": "Offer", name: "Latte scremato" },
      ])
    );

    expect(parseFlyerData(html, normalizeQueries([{ name: "latte" }]))).toEqual(
      {
        validUntil: "2099-01-31",
        products: [
          {
            name: "Latte Intero 1L",
            imageUrl: "https://img/1.png",
            price: 1.19,
          },
        ],
      }
    );
  });

  test("a max price excludes products without a price", () => {
    const html = page(
      JSON.stringify({ "@type": "Product", name: "Pane", offers: {} })
    );
    expect(parseFlyerData(html, [{ name: "pane" }]).products).toHaveLength(1);
    expect(
      parseFlyerData(html, [{ name: "pane", maxPrice: 5 }]).products
    ).toEqual([]);
  });
});

describe("normalizeQueries", () => {
  test("normalizes names, keeps max price, drops empty queries", () => {
    expect(
      normalizeQueries([
        { name: "  Burro DI montagna ", maxPrice: 4 },
        { name: "   " },
        { name: "Latte" },
      ])
    ).toEqual([
      { name: "burro di montagna", maxPrice: 4 },
      { name: "latte", maxPrice: undefined },
    ]);
  });
});
