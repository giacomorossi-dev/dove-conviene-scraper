// The dc queue: what keeps us from hammering dc (and getting the IP banned).
// fetch is replaced by a fake that records when each request is sent.
import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { BASE_URL } from "../shared/categories";
import { dcPacing, fetchWithRetry } from "./http";

const realFetch = globalThis.fetch;
const saved = { ...dcPacing, retryDelays: [...dcPacing.retryDelays] };
let sent: { url: string; at: number }[] = [];

/** Each call answers with the next reply after `ms`; replies repeat the last. */
function fakeFetch(
  replies: { status: number; ms?: number; headers?: Record<string, string> }[]
) {
  let call = 0;
  globalThis.fetch = (async (
    input: string | URL | Request,
    init?: RequestInit
  ) => {
    // Like the real fetch: an already aborted signal never reaches the network.
    if (init?.signal?.aborted) throw init.signal.reason;
    const reply = replies[Math.min(call++, replies.length - 1)];
    sent.push({ url: String(input), at: Date.now() });
    await new Promise<void>((resolve, reject) => {
      const t = setTimeout(resolve, reply.ms ?? 5);
      init?.signal?.addEventListener("abort", () => {
        clearTimeout(t);
        reject(
          init.signal?.reason ?? new DOMException("Aborted", "AbortError")
        );
      });
    });
    return new Response("ok", { status: reply.status, headers: reply.headers });
  }) as typeof fetch;
}

const url = (path: string) => `${BASE_URL}/${path}`;

beforeEach(() => {
  sent = [];
  Object.assign(dcPacing, {
    minGap: 40,
    timeout: 1_000,
    retryDelays: [150, 150],
    maxRetryAfter: 5_000,
  });
});

afterEach(() => {
  globalThis.fetch = realFetch;
  Object.assign(dcPacing, saved);
});

describe("dc queue", () => {
  test("requests go out one at a time, with the minimum gap between them", async () => {
    fakeFetch([{ status: 200, ms: 20 }]);
    await Promise.all(["a", "b", "c"].map((p) => fetchWithRetry(url(p))));
    expect(sent.map((s) => s.url)).toEqual([url("a"), url("b"), url("c")]);
    for (let i = 1; i < sent.length; i++)
      expect(sent[i].at - sent[i - 1].at).toBeGreaterThanOrEqual(20 + 40 - 5);
  });

  test("the timeout counts from when a request is sent, not while it waits", async () => {
    dcPacing.timeout = 150;
    fakeFetch([{ status: 200, ms: 120 }]);
    const [a, b] = await Promise.all([
      fetchWithRetry(url("a")),
      fetchWithRetry(url("b")),
    ]);
    expect([a.status, b.status]).toEqual([200, 200]);
    // b waited ~160 ms in the queue: with the timer started early it would
    // have been cut short and sent again.
    expect(sent).toHaveLength(2);
  });

  test("after a 429 every queued request waits, not just the one that got it", async () => {
    fakeFetch([{ status: 429 }, { status: 200 }]);
    await Promise.all([fetchWithRetry(url("a")), fetchWithRetry(url("b"))]);
    const first = sent[0].at;
    const next = sent.find((s) => s.url === url("b"));
    expect(next!.at - first).toBeGreaterThanOrEqual(150 - 5);
  });

  test("Retry-After from dc is honoured", async () => {
    fakeFetch([
      { status: 429, headers: { "retry-after": "1" } },
      { status: 200 },
    ]);
    const res = await fetchWithRetry(url("a"));
    expect(res.status).toBe(200);
    expect(sent[1].at - sent[0].at).toBeGreaterThanOrEqual(1_000 - 5);
  });

  test("gives up after the last retry and returns dc's answer", async () => {
    fakeFetch([{ status: 503 }]);
    const res = await fetchWithRetry(url("a"));
    expect(res.status).toBe(503);
    expect(sent).toHaveLength(3);
  });

  test("a request cancelled while queued is skipped and doesn't hold up the next", async () => {
    fakeFetch([{ status: 200, ms: 100 }]);
    const cancelled = new AbortController();
    const a = fetchWithRetry(url("a"));
    const b = fetchWithRetry(url("b"), { signal: cancelled.signal }).catch(
      () => "aborted"
    );
    const c = fetchWithRetry(url("c"));
    setTimeout(() => cancelled.abort(), 20);
    await Promise.all([a, b, c]);
    expect(sent.map((s) => s.url)).toEqual([url("a"), url("c")]);
    // c follows a by its duration and one gap, not by an extra gap for b.
    expect(sent[1].at - sent[0].at).toBeLessThan(100 + 2 * 40 - 10);
  });

  test("a request the caller aborted is not retried", async () => {
    fakeFetch([{ status: 200, ms: 200 }]);
    const controller = new AbortController();
    setTimeout(() => controller.abort(), 20);
    expect(
      fetchWithRetry(url("a"), { signal: controller.signal })
    ).rejects.toThrow();
    await new Promise((r) => setTimeout(r, 400));
    expect(sent.length).toBeLessThanOrEqual(1);
  });
});
