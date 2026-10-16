// A flyer page is read from dc once per hour, however many searches use it.
import { afterEach, expect, test } from "bun:test";
import { BASE_URL, CATEGORIES } from "../../shared/categories";
import { dcPacing } from "../http";
import { getFlyerData, normalizeQueries } from "./flyers";

const realFetch = globalThis.fetch;
afterEach(() => {
  globalThis.fetch = realFetch;
});

test("searching the same flyer again doesn't download it again", async () => {
  dcPacing.minGap = 0;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    return new Response(
      `<script type="application/ld+json">${JSON.stringify([
        { "@type": "Product", name: "Latte intero", offers: { price: 1.2 } },
        { "@type": "Product", name: "Burro", offers: { price: 2.5 } },
      ])}</script>`
    );
  }) as unknown as typeof fetch;
  const flyer = {
    name: "Conad",
    imageUrl: "",
    category: CATEGORIES[0],
    url: `${BASE_URL}/x/conad?flyerId=cache-test`,
  };
  const latte = await getFlyerData(
    flyer,
    normalizeQueries([{ name: "latte" }])
  );
  const burro = await getFlyerData(
    flyer,
    normalizeQueries([{ name: "burro" }])
  );
  expect(latte.products.map((p) => p.name)).toEqual(["Latte intero"]);
  expect(burro.products.map((p) => p.name)).toEqual(["Burro"]);
  expect(calls).toBe(1);
  dcPacing.minGap = 300;
});

test("a search that's cancelled doesn't make another search of the same flyer fail", async () => {
  dcPacing.minGap = 0;
  let calls = 0;
  globalThis.fetch = (async () => {
    calls++;
    await new Promise((r) => setTimeout(r, 80));
    return new Response(
      `<script type="application/ld+json">${JSON.stringify([
        { "@type": "Product", name: "Latte", offers: { price: 1 } },
      ])}</script>`
    );
  }) as unknown as typeof fetch;
  const flyer = {
    name: "Conad",
    imageUrl: "",
    category: CATEGORIES[0],
    url: `${BASE_URL}/x/conad?flyerId=shared-test`,
  };
  const queries = normalizeQueries([{ name: "latte" }]);
  const cancelled = new AbortController();
  const first = getFlyerData(flyer, queries, cancelled.signal);
  const second = getFlyerData(flyer, queries);
  setTimeout(() => cancelled.abort(), 20);
  await expect(first).rejects.toThrow();
  expect((await second).products).toHaveLength(1);
  expect(calls).toBe(1);
  dcPacing.minGap = 300;
});
