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
