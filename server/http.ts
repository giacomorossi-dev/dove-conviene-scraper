import { BASE_URL } from "../shared/categories";
import { USER_AGENT } from "./config";

export const BROWSER_HEADERS = {
  "user-agent": USER_AGENT,
  "accept-language": "it-IT,it;q=0.9",
};

/** HTTP error status (e.g. 404), as opposed to a network failure. */
export class HttpError extends Error {
  readonly status: number;
  constructor(url: string, status: number) {
    super(`GET ${url} → ${status}`);
    this.status = status;
  }
}

/** Pacing of dc requests. Mutable so tests can shrink the times. */
export const dcPacing = {
  /** Pause between two dc requests. */
  minGap: 300,
  /**
   * Without a timeout a request can hang forever (e.g. across a system
   * suspend), and a hung dc request would stall the whole dc queue.
   */
  timeout: 30_000,
  /** Waits before each new attempt. */
  retryDelays: [2_000, 6_000, 15_000],
  /** Longest pause a Retry-After header from dc can impose. */
  maxRetryAfter: 120_000,
};

export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Every request to dc, from any part of the app, goes out one at a time with
// a pause in between: bursts make dc refuse connections and could get the
// IP banned.
const DC_HOST = new URL(BASE_URL).host;
let dcQueue: Promise<void> = Promise.resolve();
let dcLast = 0;
/** No dc request leaves before this: set when dc asks us to slow down. */
let dcHoldUntil = 0;

const isDc = (url: string) => new URL(url).host === DC_HOST;

async function politely<T>(url: string, send: () => Promise<T>): Promise<T> {
  if (!isDc(url)) return send();
  const previous = dcQueue;
  let release!: () => void;
  dcQueue = new Promise((r) => (release = r));
  await previous;
  try {
    // Checked again after each pause: a request that just failed may have
    // pushed the hold further while this one was waiting.
    for (;;) {
      const wait = Math.max(dcLast + dcPacing.minGap, dcHoldUntil) - Date.now();
      if (wait <= 0) break;
      await sleep(wait);
    }
    return await send();
  } finally {
    dcLast = Date.now();
    release();
  }
}

/** How long dc asks us to wait (seconds or a date), capped; null if it doesn't say. */
function retryAfter(res: Response): number | null {
  const header = res.headers.get("retry-after");
  if (!header) return null;
  const seconds = Number(header);
  const ms = Number.isFinite(seconds)
    ? seconds * 1000
    : Date.parse(header) - Date.now();
  return Number.isFinite(ms)
    ? Math.min(Math.max(ms, 0), dcPacing.maxRetryAfter)
    : null;
}

/**
 * fetch() that queues dc requests (see politely) and retries, backing off,
 * when dc refuses connections, is overloaded or doesn't answer: network
 * errors and timeouts, 429 and 5xx. While dc struggles the whole queue
 * waits, not only the request that got the error.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    let delay = dcPacing.retryDelays[attempt];
    try {
      // The timer starts when the request leaves the queue, not while it
      // waits behind others.
      const res = await politely(url, () => {
        const timeout = AbortSignal.timeout(dcPacing.timeout);
        const signal = init?.signal
          ? AbortSignal.any([init.signal, timeout])
          : timeout;
        return fetch(url, { ...init, signal });
      });
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= dcPacing.retryDelays.length) return res;
      delay = retryAfter(res) ?? delay;
      await res.body?.cancel();
    } catch (err) {
      // Nothing to retry once the caller gave up.
      if (init?.signal?.aborted || attempt >= dcPacing.retryDelays.length)
        throw err;
    }
    if (isDc(url)) dcHoldUntil = Math.max(dcHoldUntil, Date.now() + delay);
    await sleep(delay);
  }
}

export async function fetchHtml(
  url: string,
  signal?: AbortSignal
): Promise<string> {
  const res = await fetchWithRetry(url, { headers: BROWSER_HEADERS, signal });
  if (!res.ok) throw new HttpError(url, res.status);
  return res.text();
}

export const collapseSpaces = (s: string): string =>
  s.replace(/\s+/g, " ").trim();

export const normalize = (s: string): string => collapseSpaces(s).toLowerCase();

export function absoluteUrl(href: string): string {
  if (href.startsWith("http")) return href;
  if (href.startsWith("//")) return `https:${href}`;
  return new URL(href, `${BASE_URL}/`).toString();
}
