// buildCatalog with a fake dc: which pages count as gone, which as
// unreachable, and how a build resumes. No request reaches dc.
import { describe, expect, test } from "bun:test";
import type { BuildProgress } from "../../shared/types";
import { HttpError } from "../http";
import type { PlaceSession } from "../session";
import { buildCatalog, type BuildState } from "./catalog";

/** A retailer page: breadcrumb with its category, `stores` own points of sale. */
const page = (slug: string, stores = 1) =>
  `<html><script type="application/ld+json">${JSON.stringify({
    "@type": "BreadcrumbList",
    itemListElement: [
      { position: 1, name: "DoveConviene" },
      { position: 2, name: "Offerte", item: { "@id": "/iper-e-super/" } },
      { position: 3, name: `Negozi ${slug} nelle vicinanze` },
    ],
  })}</script>${`<a href="/negozi/${slug}/1/x">s</a>`.repeat(stores)}</html>`;

const state = (
  slugs: string[],
  over: Partial<BuildState> = {}
): BuildState => ({
  startedAt: new Date().toISOString(),
  pages: Object.fromEntries(slugs.map((s) => [s, `volantino/${s}`])),
  read: [],
  found: {},
  kinds: {},
  unreachable: 0,
  ...over,
});
const slugs = (n: number) => Array.from({ length: n }, (_, i) => `s${i}`);

/** dc where `errors[slug]` is thrown for that retailer; counts requests. */
function fakeDc(
  errors: Record<string, () => Error> = {},
  stores: (slug: string) => number = () => 1
) {
  const requests: string[] = [];
  const session: PlaceSession = {
    async fetchHtml(url) {
      requests.push(url);
      const slug = url.split("/").pop()!;
      const err = errors[slug];
      if (err) throw err();
      return page(slug, stores(slug));
    },
  };
  return { requests, openSession: async () => session };
}

const run = (dc: ReturnType<typeof fakeDc>, resume: BuildState, extra = {}) => {
  const checkpoints: BuildState[] = [];
  const progress: BuildProgress[] = [];
  const result = buildCatalog({
    resume,
    openSession: dc.openSession,
    pause: async () => {},
    onCheckpoint: async (s) => void checkpoints.push(structuredClone(s)),
    onProgress: (p) => progress.push(p),
    ...extra,
  });
  return { result, checkpoints, progress };
};

describe("buildCatalog", () => {
  test("a page dc refuses (429 after the retries) counts as unreachable, not gone", async () => {
    const dc = fakeDc({ s3: () => new HttpError("u", 429) });
    const { result, checkpoints } = run(dc, state(slugs(40)));
    const list = await result;
    expect(list.map((r) => r.slug)).not.toContain("s3");
    const last = checkpoints.at(-1)!;
    expect(last.unreachable).toBe(1);
    expect(last.read).not.toContain("s3");
  });

  test("a page missing under every kind (404) is gone: skipped, not unreachable", async () => {
    const dc = fakeDc({ s4: () => new HttpError("u", 404) });
    const { result, checkpoints } = run(dc, state(slugs(40)));
    expect((await result).map((r) => r.slug)).not.toContain("s4");
    expect(checkpoints.at(-1)!.unreachable).toBe(0);
    expect(checkpoints.at(-1)!.read).toContain("s4");
  });

  test("resuming after a failed build retries the pages it couldn't reach", async () => {
    const network = () => new Error("connection refused");
    const first = run(fakeDc({ s5: network, s6: network }), state(slugs(20)));
    await expect(first.result).rejects.toThrow("dc non risponde");
    const saved = first.checkpoints.at(-1)!;

    const healthy = fakeDc();
    const list = await run(healthy, saved).result;
    expect(list.map((r) => r.slug)).toContain("s5");
    expect(list.map((r) => r.slug)).toContain("s6");
  });

  test("checking kinds from other cities saves progress after each city and moves forward", async () => {
    // No stores anywhere: every city is tried for the 3 retailers.
    const dc = fakeDc({}, () => 0);
    const { result, checkpoints, progress } = run(dc, state(slugs(3)));
    await result;
    const cities = checkpoints.map((c) => c.kindsCity ?? 0);
    expect(Math.max(...cities)).toBe(6);
    const kinds = progress
      .filter((p) => p.phase === "kinds")
      .map((p) => p.done);
    expect(kinds).toEqual([...kinds].sort((a, b) => a - b));

    // Resumed after the last city: no more requests to dc.
    const again = fakeDc({}, () => 0);
    await run(again, checkpoints.at(-1)!).result;
    expect(again.requests).toHaveLength(0);
  });
});
