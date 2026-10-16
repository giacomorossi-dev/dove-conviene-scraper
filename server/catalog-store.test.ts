// The local list in a temp folder, with a fake build: when a new list
// replaces the current one, and when a partial build is resumed.
import { afterEach, describe, expect, test } from "bun:test";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { createCatalogStore } from "./catalog-store";
import type { BuildState, CatalogEntry } from "./scrapers/catalog";

const entries = (n: number): CatalogEntry[] =>
  Array.from({ length: n }, (_, i) => ({
    name: `R${i}`,
    slug: `r${i}`,
    imageUrl: "",
    categorySlug: "iper-e-super",
    kind: "store",
  }));

const dirs: string[] = [];
const tempDir = async () => {
  const dir = await mkdtemp(join(tmpdir(), "dvc-catalog-"));
  dirs.push(dir);
  return dir;
};
afterEach(async () => {
  for (const d of dirs.splice(0)) await rm(d, { recursive: true, force: true });
});

const saveList = (dir: string, n: number) =>
  writeFile(
    join(dir, "retailers.json"),
    JSON.stringify({
      version: 1,
      updatedAt: new Date().toISOString(),
      retailers: entries(n),
    })
  );

async function idle(store: ReturnType<typeof createCatalogStore>) {
  for (let i = 0; i < 100 && store.getStatus().building; i++)
    await new Promise((r) => setTimeout(r, 5));
}

describe("catalog store", () => {
  test("a much smaller new list doesn't replace the current one", async () => {
    const dir = await tempDir();
    await saveList(dir, 10);
    const store = createCatalogStore(dir, async () => entries(3));
    await store.init();
    store.update();
    await idle(store);
    expect(store.getCatalog()).toHaveLength(10);
    expect(store.getStatus().error).toContain("tengo");
    const file = JSON.parse(
      await readFile(join(dir, "retailers.json"), "utf8")
    );
    expect(file.retailers).toHaveLength(10);
  });

  test("retailers in categories the app doesn't know count as missing", async () => {
    const dir = await tempDir();
    await saveList(dir, 10);
    const renamed = entries(10).map((e, i) =>
      i < 5 ? { ...e, categorySlug: "categoria-rinominata" } : e
    );
    const store = createCatalogStore(dir, async () => renamed);
    await store.init();
    store.update();
    await idle(store);
    expect(store.getCatalog()).toHaveLength(10);
    expect(store.getStatus().error).toContain("tengo");
  });

  test("a similar new list replaces it", async () => {
    const dir = await tempDir();
    await saveList(dir, 10);
    const store = createCatalogStore(dir, async () => entries(9));
    await store.init();
    store.update();
    await idle(store);
    expect(store.getCatalog()).toHaveLength(9);
    expect(store.getStatus().error).toBeNull();
  });

  test("a first build that finds nothing is an error, not an empty list", async () => {
    const dir = await tempDir();
    const store = createCatalogStore(dir, async () => []);
    await store.init(); // no list: starts building
    await idle(store);
    expect(store.getStatus().error).not.toBeNull();
  });

  test("a recent partial build is resumed, an old one starts over", async () => {
    const dir = await tempDir();
    const resumed: (BuildState | null | undefined)[] = [];
    const store = createCatalogStore(dir, async ({ resume } = {}) => {
      resumed.push(resume);
      return entries(5);
    });
    const partial = (startedAt: string) =>
      writeFile(
        join(dir, "retailers.partial.json"),
        JSON.stringify({
          startedAt,
          pages: {},
          read: [],
          found: {},
          kinds: {},
          unreachable: 0,
        })
      );
    await partial(new Date().toISOString());
    store.update();
    await idle(store);
    await partial(new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString());
    store.update();
    await idle(store);
    expect(resumed[0]).not.toBeNull();
    expect(resumed[1]).toBeNull();
  });
});
