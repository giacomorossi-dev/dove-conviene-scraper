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

const RETRY_DELAYS = [2_000, 6_000, 15_000];
export const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

// Every request to dc, from any part of the app, goes out one at a time with
// a pause in between: bursts make dc refuse connections and could get the
// IP banned.
const DC_HOST = new URL(BASE_URL).host;
const DC_MIN_GAP = 300;
let dcQueue: Promise<void> = Promise.resolve();
let dcLast = 0;

async function politely<T>(url: string, send: () => Promise<T>): Promise<T> {
  if (new URL(url).host !== DC_HOST) return send();
  const previous = dcQueue;
  let release!: () => void;
  dcQueue = new Promise((r) => (release = r));
  await previous;
  try {
    const wait = dcLast + DC_MIN_GAP - Date.now();
    if (wait > 0) await sleep(wait);
    return await send();
  } finally {
    dcLast = Date.now();
    release();
  }
}

/**
 * fetch() that queues dc requests (see politely) and retries, backing off,
 * when dc refuses connections or is overloaded: network errors, 429 and 5xx.
 */
export async function fetchWithRetry(
  url: string,
  init?: RequestInit
): Promise<Response> {
  for (let attempt = 0; ; attempt++) {
    try {
      const res = await politely(url, () => fetch(url, init));
      const retryable = res.status === 429 || res.status >= 500;
      if (!retryable || attempt >= RETRY_DELAYS.length) return res;
    } catch (err) {
      if (attempt >= RETRY_DELAYS.length) throw err;
    }
    await sleep(RETRY_DELAYS[attempt]);
  }
}

export async function fetchHtml(url: string): Promise<string> {
  const res = await fetchWithRetry(url, { headers: BROWSER_HEADERS });
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
