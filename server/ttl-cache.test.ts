import { expect, test } from "bun:test";
import { ttlCache } from "./ttl-cache";

const tick = (ms: number) => new Promise((r) => setTimeout(r, ms));

test("loads once while fresh, again once expired", async () => {
  const cache = ttlCache<number>(40);
  let loads = 0;
  const load = async () => ++loads;
  expect(await cache.get("a", load)).toBe(1);
  expect(await cache.get("a", load)).toBe(1);
  await tick(50);
  expect(await cache.get("a", load)).toBe(2);
});

test("a failed load is not kept", async () => {
  const cache = ttlCache<number>(1_000);
  await cache
    .get("a", async () => Promise.reject(new Error("dc")))
    .catch(() => {});
  await tick(0);
  expect(await cache.get("a", async () => 7)).toBe(7);
});

test("expired entries are swept when something new is stored", async () => {
  const cache = ttlCache<number>(20);
  await cache.get("a", async () => 1);
  await cache.get("b", async () => 2);
  await tick(30);
  await cache.get("c", async () => 3);
  expect(cache.size).toBe(1);
});
