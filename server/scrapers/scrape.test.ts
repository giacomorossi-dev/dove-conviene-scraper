// The search stream: which flyers are read, and what happens when one fails.
import { describe, expect, test } from "bun:test";
import { CATEGORIES } from "../../shared/categories";
import type { Flyer, ScrapeMessage } from "../../shared/types";
import { scrapeFlyersStream, type ScrapeDeps } from "./scrape";

const [iper, discount] = CATEGORIES;
const flyer = (name: string, slug: string, category = iper): Flyer => ({
  name,
  slug,
  imageUrl: "",
  category,
  url: `https://www.doveconviene.it/x/${slug}?flyerId=1`,
});
const nearby: Record<string, Flyer[]> = {
  "iper-e-super": [
    flyer("Conad", "conad"),
    flyer("Conad City", "conad-city"),
    flyer("Coop", "coop"),
  ],
  discount: [flyer("Eurospin", "eurospin", discount)],
};
const place = { name: "Rimini", zip: null, lat: 44, lng: 12 };

function deps(failing: string[] = []): ScrapeDeps & { read: string[] } {
  const read: string[] = [];
  return {
    read,
    nearbyFlyers: async (_place, category) =>
      nearby[category.url.split("/").pop()!] ?? [],
    flyerData: async (f) => {
      read.push(f.slug!);
      if (failing.includes(f.slug!)) throw new Error("GET … → 404");
      return {
        products: [{ name: "Latte", imageUrl: null, price: 1 }],
        validUntil: "2099-01-01",
      };
    },
  };
}

const collect = async (gen: AsyncGenerator<ScrapeMessage>) => {
  const out: ScrapeMessage[] = [];
  for await (const m of gen) out.push(m);
  return out;
};

describe("scrapeFlyersStream", () => {
  test("only the chosen retailers, by slug: Conad doesn't pull in Conad City", async () => {
    const d = deps();
    const out = await collect(
      scrapeFlyersStream(
        place,
        [flyer("Conad", "conad"), flyer("Eurospin", "eurospin", discount)],
        [{ name: "latte" }],
        undefined,
        d
      )
    );
    expect(d.read).toEqual(["conad", "eurospin"]);
    expect(out.every((m) => "flyer" in m)).toBe(true);
  });

  test("retailers saved by name only still match by exact name", async () => {
    const d = deps();
    const legacy = { name: "Coop", imageUrl: "", category: iper };
    await collect(
      scrapeFlyersStream(place, [legacy], [{ name: "latte" }], undefined, d)
    );
    expect(d.read).toEqual(["coop"]);
  });

  test("a flyer that fails is reported and the others are still read", async () => {
    const d = deps(["conad"]);
    const out = await collect(
      scrapeFlyersStream(
        place,
        [flyer("Conad", "conad"), flyer("Coop", "coop")],
        [{ name: "latte" }],
        undefined,
        d
      )
    );
    expect(d.read).toEqual(["conad", "coop"]);
    expect(out[0]).toMatchObject({ flyerError: { name: "Conad" } });
    expect(out[1]).toMatchObject({ flyer: { name: "Coop" } });
  });

  test("stops reading when the search is cancelled", async () => {
    const d = deps();
    const controller = new AbortController();
    const out: ScrapeMessage[] = [];
    for await (const m of scrapeFlyersStream(
      place,
      [
        flyer("Conad", "conad"),
        flyer("Coop", "coop"),
        flyer("Conad City", "conad-city"),
      ],
      [{ name: "latte" }],
      controller.signal,
      d
    )) {
      out.push(m);
      controller.abort();
    }
    expect(out).toHaveLength(1);
    expect(d.read).toHaveLength(1);
  });
});
