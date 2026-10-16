// HTTP layer: input checks, errors, and the search stream stopping when the
// page that asked for it goes away (so dc isn't scraped for nobody).
import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import type { Server } from "node:http";
import type { ScrapeMessage } from "../shared/types";
import { createApp } from "./app";

let produced = 0;
let finished = false;
async function* slowSearch(): AsyncGenerator<ScrapeMessage> {
  try {
    for (let i = 0; i < 30; i++) {
      await new Promise((r) => setTimeout(r, 30));
      produced++;
      yield { flyerError: { name: `f${i}`, url: "", error: "x" } };
    }
  } finally {
    finished = true;
  }
}

let server: Server;
let base = "";
beforeAll(async () => {
  server = createApp({ scrape: slowSearch }).listen(0, "127.0.0.1");
  await new Promise((r) => server.once("listening", r));
  const addr = server.address();
  base = `http://127.0.0.1:${typeof addr === "object" && addr ? addr.port : 0}`;
});
afterAll(() => server.close());

const place = { name: "Rimini", zip: null, lat: 44, lng: 12 };
const post = (body: string, headers: Record<string, string> = {}) =>
  fetch(`${base}/api/scraper`, {
    method: "POST",
    headers: { "content-type": "application/json", ...headers },
    body,
  });

describe("POST /api/scraper", () => {
  test("malformed JSON: a short JSON error, no stack trace", async () => {
    const res = await post("{oops");
    expect(res.status).toBe(400);
    const text = await res.text();
    expect(JSON.parse(text)).toHaveProperty("error");
    expect(text).not.toContain(" at ");
  });

  test("retailers and products must be lists; prices numbers", async () => {
    for (const body of [
      { place, flyers: "conad", products: [] },
      { place, flyers: [], products: [{ name: 3 }] },
      { place, flyers: [], products: [{ name: "latte", maxPrice: "abc" }] },
    ]) {
      const res = await post(JSON.stringify(body));
      expect(res.status).toBe(400);
    }
  });

  test("refused when another website sends it", async () => {
    const res = await post(
      JSON.stringify({ place, flyers: [], products: [] }),
      {
        "sec-fetch-site": "cross-site",
      }
    );
    expect(res.status).toBe(403);
  });

  test("a client that stays connected gets the whole search", async () => {
    produced = 0;
    const res = await post(JSON.stringify({ place, flyers: [], products: [] }));
    const lines = (await res.text()).trim().split("\n");
    expect(lines).toHaveLength(30);
  });

  test("a search stops when its page cancels it", async () => {
    produced = 0;
    finished = false;
    const res = await post(
      JSON.stringify({ place, flyers: [], products: [], searchId: "s-1" })
    );
    const reader = res.body!.getReader();
    await reader.read();
    const cancel = await fetch(`${base}/api/scraper/cancel`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ searchId: "s-1" }),
    });
    expect(cancel.status).toBe(204);
    await new Promise((r) => setTimeout(r, 150));
    expect(finished).toBe(true);
    expect(produced).toBeLessThan(6);
  });
});

describe("POST /api/retailers/update", () => {
  test("refused when another website sends it", async () => {
    const res = await fetch(`${base}/api/retailers/update`, {
      method: "POST",
      headers: { "sec-fetch-site": "cross-site" },
    });
    expect(res.status).toBe(403);
  });
});

describe("removed routes", () => {
  test("/api/retailers/nearby is gone", async () => {
    const res = await fetch(
      `${base}/api/retailers/nearby?lat=44&lng=12&category=discount`
    );
    expect(res.status).toBe(404);
  });
});
