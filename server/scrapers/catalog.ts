// Builds the national list of dc retailers ("insegne") from dc's sitemaps:
// the retailer sitemap, the per-city ones (Milan, Rome, Bologna) and the
// flyer sitemap. Each retailer page carries its category in the breadcrumb.
// It's stored locally by ../catalog-store.
import * as cheerio from "cheerio";
import { BASE_URL } from "../../shared/categories";
import type { BuildProgress, Place } from "../../shared/types";
import { BROWSER_HEADERS, fetchWithRetry, HttpError, sleep } from "../http";
import { openPlaceSession, type PlaceSession } from "../session";

export const SITEMAPS = [
  "sitemap_retailers",
  "sitemap_retailers_milano",
  "sitemap_retailers_roma",
  "sitemap_retailers_bologna",
  "sitemap_flyers",
].map((name) => `https://www.doveconviene.it/${name}.xml.gz`);

/** A retailer as stored in the local list. */
export interface CatalogEntry {
  name: string;
  slug: string;
  imageUrl: string;
  categorySlug: string;
  kind: "store" | "brand";
}

/** dc's logo for a retailer; it exists even when the page doesn't show it. */
export const logoUrl = (slug: string): string =>
  `https://it-it-media.shopfully.cloud/images/catene/segnalino_${slug}@2x_webp.webp`;

const PAGE_KIND = "(volantino|offerte|catalogo)";

/**
 * Retailer pages (slug → "volantino/conad") found in dc's sitemaps, whether
 * listed directly (/volantino/conad), per city (/milano/volantino/conad) or
 * through a flyer (/iper-e-super/conad/volantino/ultime-offerte-conad).
 */
export function retailerPages(sitemaps: string[]): Map<string, string> {
  const pages = new Map<string, string>();
  const direct = new RegExp(
    `\\.it(?:/[a-z0-9-]+)?/${PAGE_KIND}/([a-z0-9-]+)/?</loc>`,
    "g"
  );
  const viaFlyer = new RegExp(
    `\\.it/[a-z0-9-]+/([a-z0-9-]+)/${PAGE_KIND}/[^<]+</loc>`,
    "g"
  );
  for (const xml of sitemaps) {
    for (const [, kind, slug] of xml.matchAll(direct))
      if (!pages.has(slug)) pages.set(slug, `${kind}/${slug}`);
    for (const [, slug, kind] of xml.matchAll(viaFlyer))
      if (!pages.has(slug)) pages.set(slug, `${kind}/${slug}`);
  }
  return pages;
}

interface BreadcrumbItem {
  position: number;
  name?: string;
  item?: { "@id"?: string; name?: string };
}

/** Name and category slug of a retailer page, from its breadcrumb. */
export function parseRetailerPage(
  html: string
): { name: string; categorySlug: string } | null {
  const $ = cheerio.load(html);
  let crumbs: BreadcrumbItem[] = [];
  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const data = JSON.parse($(el).text());
      if (
        data?.["@type"] === "BreadcrumbList" &&
        Array.isArray(data.itemListElement)
      )
        crumbs = data.itemListElement;
    } catch {
      /* not JSON */
    }
  });
  // DoveConviene › "Offerte Iper e super nelle vicinanze" › "Negozi Conad nelle vicinanze"
  const categorySlug = crumbs
    .find((c) => c.position === 2)
    ?.item?.["@id"]?.replace(/^\/+|\/+$/g, "");
  const name = crumbs
    .find((c) => c.position === 3)
    ?.name?.replace(/^Negozi\s+/, "")
    .replace(/\s+nelle vicinanze$/, "");
  return categorySlug && name ? { name, categorySlug } : null;
}

/**
 * Store links on a retailer page seen from a positioned session: a chain's
 * page lists its own points of sale (/negozi/<slug>/<id>/…), a brand's page
 * the stores of the chains selling it.
 */
export function countStoreLinks(
  html: string,
  slug: string
): { own: number; others: number } {
  const links = [...html.matchAll(/href="\/negozi\/([a-z0-9-]+)\/\d+/g)];
  const own = links.filter((m) => m[1] === slug).length;
  return { own, others: links.length - own };
}

// Polite pacing for a build that runs in the background (about an hour):
// one retailer page every 1.5–2.5 s, and a one-minute break every 50 pages.
// On top of this every dc request goes through the queue in ../http.
const PAGE_DELAY = () => 1_500 + Math.random() * 1_000;
const CHUNK = 50;
const CHUNK_PAUSE = 60_000;
/** Above this share of unreachable pages the build fails (the old list stays). */
const MAX_FAILURES = 0.05;
// Chains are told apart from brands by their own points of sale near a
// position: Milan first, then other cities for regional chains.
const CITIES: Place[] = [
  { name: "Milano", zip: null, lat: 45.4642, lng: 9.19 },
  { name: "Roma", zip: null, lat: 41.8933, lng: 12.4829 },
  { name: "Napoli", zip: null, lat: 40.8359, lng: 14.2488 },
  { name: "Bologna", zip: null, lat: 44.4938, lng: 11.3387 },
  { name: "Torino", zip: null, lat: 45.0677, lng: 7.6825 },
  { name: "Bari", zip: null, lat: 41.1258, lng: 16.862 },
  { name: "Palermo", zip: null, lat: 38.1112, lng: 13.3524 },
];

/** A build in progress, saved after every chunk so it can resume. */
export interface BuildState {
  startedAt: string;
  /** slug → retailer page path, from the sitemaps. */
  pages: Record<string, string>;
  /** Slugs whose page was read (found or not). */
  read: string[];
  found: Record<string, Omit<CatalogEntry, "kind">>;
  kinds: Record<string, CatalogEntry["kind"]>;
  /** Pages dc didn't give in the current run; they stay unread, to retry. */
  unreachable: number;
  /** Other cities already used to tell stores from brands (phase 2). */
  kindsCity?: number;
}

async function fetchSitemap(url: string): Promise<string> {
  const res = await fetchWithRetry(url, { headers: BROWSER_HEADERS });
  if (!res.ok) throw new HttpError(url, res.status);
  const bytes = new Uint8Array(await res.arrayBuffer());
  // Still gzipped, unless dc served it with Content-Encoding: gzip and fetch
  // already unpacked it.
  const gzipped = bytes[0] === 0x1f && bytes[1] === 0x8b;
  return new TextDecoder().decode(gzipped ? Bun.gunzipSync(bytes) : bytes);
}

/**
 * A retailer page, trying the other page kinds if dc moved it; null if it's
 * gone (404/410 everywhere). Anything else (dc refusing, overloaded, down)
 * is thrown, so it counts as unreachable instead of dropping the retailer.
 */
async function retailerHtml(
  session: PlaceSession,
  path: string
): Promise<string | null> {
  const [kind, slug] = path.split("/");
  for (const k of new Set([kind, "volantino", "offerte", "catalogo"])) {
    try {
      return await session.fetchHtml(`${BASE_URL}/${k}/${slug}`);
    } catch (err) {
      const gone =
        err instanceof HttpError && (err.status === 404 || err.status === 410);
      if (!gone) throw err;
    }
  }
  return null;
}

function classify(state: BuildState, slug: string, html: string) {
  const { own, others } = countStoreLinks(html, slug);
  if (own > 0) state.kinds[slug] = "store";
  else if (others > 0) state.kinds[slug] = "brand";
}

async function startBuild(
  onProgress: (p: BuildProgress) => void
): Promise<BuildState> {
  onProgress({ phase: "sitemaps", done: 0, total: SITEMAPS.length });
  const xmls: string[] = [];
  for (const url of SITEMAPS) xmls.push(await fetchSitemap(url));
  return {
    startedAt: new Date().toISOString(),
    pages: Object.fromEntries(retailerPages(xmls)),
    read: [],
    found: {},
    kinds: {},
    unreachable: 0,
  };
}

interface BuildOptions {
  onProgress?: (p: BuildProgress) => void;
  /** dc sessions and pauses: tests pass fakes. */
  openSession?: (place: Place) => Promise<PlaceSession>;
  pause?: (ms: number) => Promise<unknown>;
  /** A saved build to continue instead of starting over. */
  resume?: BuildState | null;
  /** Called after every chunk with the state to save. */
  onCheckpoint?: (state: BuildState) => Promise<void>;
}

/**
 * Reads every retailer page, slowly (see PAGE_DELAY), and returns the list.
 * Throws if dc couldn't be reached for too many of them.
 */
export async function buildCatalog({
  onProgress = () => {},
  resume,
  onCheckpoint = async () => {},
  openSession = openPlaceSession,
  pause = sleep,
}: BuildOptions = {}): Promise<CatalogEntry[]> {
  const state = resume ?? (await startBuild(onProgress));
  // Failures count per run: a resumed build retries the pages it missed.
  state.unreachable = 0;
  const total = Object.keys(state.pages).length;
  const read = new Set(state.read);

  // 1. Every retailer page, from Milan: name, category and (mostly) kind.
  // The session is opened only if there is something left to read.
  let session: PlaceSession | null = null;
  let sinceBreak = 0;
  for (const [slug, path] of Object.entries(state.pages)) {
    if (read.has(slug)) continue;
    onProgress({ phase: "pages", done: read.size, total });
    session ??= await openSession(CITIES[0]);
    try {
      const html = await retailerHtml(session, path);
      if (html) {
        const page = parseRetailerPage(html);
        if (page)
          state.found[slug] = { ...page, slug, imageUrl: logoUrl(slug) };
        classify(state, slug, html);
      }
      read.add(slug);
      state.read.push(slug);
    } catch {
      state.unreachable++;
      if (state.unreachable > total * MAX_FAILURES) {
        await onCheckpoint(state);
        throw new Error(
          `dc non risponde (${state.unreachable} insegne non raggiunte): riprova più tardi`
        );
      }
    }
    if (++sinceBreak >= CHUNK) {
      await onCheckpoint(state);
      sinceBreak = 0;
      await pause(CHUNK_PAUSE);
      session = null;
    } else await pause(PAGE_DELAY());
  }
  await onCheckpoint(state);

  // 2. Retailers with no stores near Milan: look again from other cities,
  // saving progress after each one.
  const others = CITIES.slice(1);
  for (let c = state.kindsCity ?? 0; c < others.length; c++) {
    const unknown = Object.keys(state.found).filter(
      (slug) => !state.kinds[slug]
    );
    if (unknown.length === 0) break;
    onProgress({ phase: "kinds", done: c, total: others.length });
    const citySession = await openSession(others[c]);
    for (const slug of unknown) {
      try {
        const html = await retailerHtml(citySession, state.pages[slug]);
        if (html) classify(state, slug, html);
      } catch {
        /* stays unknown */
      }
      await pause(PAGE_DELAY());
    }
    state.kindsCity = c + 1;
    await onCheckpoint(state);
  }

  // No stores anywhere: banks, online shops, services.
  return Object.values(state.found)
    .map((r) => ({ ...r, kind: state.kinds[r.slug] ?? ("brand" as const) }))
    .sort(
      (a, b) =>
        a.categorySlug.localeCompare(b.categorySlug) ||
        a.name.localeCompare(b.name, "it")
    );
}
