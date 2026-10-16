// Parser tests against real doveconviene.it pages saved in __fixtures__.
// Assertions are structural so they keep passing after `fixtures:update`;
// if they fail after a refresh, the site markup changed.
import { describe, expect, test } from "bun:test";
import { BASE_URL, CATEGORIES } from "../../shared/categories";
import { normalizeQueries, parseFlyerCards, parseFlyerData } from "./flyers";

const fixture = (name: string) =>
  Bun.file(new URL(`./__fixtures__/${name}`, import.meta.url)).text();

const category = CATEGORIES[0];

describe("parseFlyerCards", async () => {
  const cards = parseFlyerCards(
    await fixture("nearby-category.html"),
    category
  );
  const withUrl = cards.filter((c) => c.url);

  test("finds flyer cards linking to the nearby flyers", () => {
    expect(withUrl.length).toBeGreaterThan(0);
    for (const c of withUrl) {
      expect(c.name).not.toBe("");
      expect(c.url).toStartWith(`${BASE_URL}/`);
      expect(c.url).toMatch(/[?&]flyerId=\d+/);
      expect(c.url).toContain(`/${c.slug}/`);
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

describe("parseFlyerData (matching and prices)", () => {
  const page = (...products: { name: string; price?: unknown }[]) =>
    `<html><head><script type="application/ld+json">${JSON.stringify(
      products.map((p) => ({
        "@type": "Product",
        name: p.name,
        offers: { price: p.price ?? 1 },
      }))
    )}</script></head></html>`;
  const names = (html: string, query: string) =>
    parseFlyerData(html, normalizeQueries([{ name: query }])).products.map(
      (p) => p.name
    );

  test("every word of the query, in any order, ignoring case and accents", () => {
    const html = page(
      { name: "Pizza Buitoni Margherita 2x330 g" },
      { name: "Margherita surgelata" },
      { name: "Caffè Borbone" }
    );
    expect(names(html, "pizza margherita")).toEqual([
      "Pizza Buitoni Margherita 2x330 g",
    ]);
    expect(names(html, "CAFFE")).toEqual(["Caffè Borbone"]);
  });

  test("prices with a decimal comma; unreadable prices become null", () => {
    const html = page(
      { name: "Latte A", price: "1,19" },
      { name: "Latte B", price: "boh" }
    );
    expect(
      parseFlyerData(html, normalizeQueries([{ name: "latte" }])).products.map(
        (p) => p.price
      )
    ).toEqual([1.19, null]);
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
