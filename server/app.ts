// The HTTP API. index.ts starts it; tests build it with fakes.
import express, {
  type ErrorRequestHandler,
  type Request,
  type RequestHandler,
  type Response,
} from "express";
import type {
  Flyer,
  Place,
  ProductQuery,
  ScrapeMessage,
  ScrapeRequest,
} from "../shared/types";
import { getCatalog, getCatalogStatus, updateCatalog } from "./catalog-store";
import { reversePlace, searchPlaces } from "./places";
import { scrapeFlyersStream } from "./scrapers/scrape";

export interface AppDeps {
  scrape: (
    place: Place,
    flyers: Flyer[],
    products: ProductQuery[],
    signal?: AbortSignal
  ) => AsyncGenerator<ScrapeMessage>;
}

const ndjson = (msg: ScrapeMessage) => JSON.stringify(msg) + "\n";

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

const isChoice = (f: unknown) => isRecord(f) && typeof f.name === "string";

const isQuery = (p: unknown) =>
  isRecord(p) &&
  typeof p.name === "string" &&
  (p.maxPrice === undefined ||
    (typeof p.maxPrice === "number" && Number.isFinite(p.maxPrice)));

/**
 * Writes only from this app: a page on another website could otherwise
 * start a 45-minute crawl of dc from this computer's IP.
 */
const sameSiteWrites: RequestHandler = (req, res, next) => {
  if (req.method !== "GET" && req.get("sec-fetch-site") === "cross-site") {
    res.status(403).send({ error: "cross-site request" });
    return;
  }
  next();
};

/**
 * Aborts when the page that asked goes away. Node emits "close" on the
 * response; Bun's node:http emits nothing on a client disconnect, so the
 * socket's state is checked as well.
 */
function abortOnDisconnect(req: Request, res: Response) {
  const stop = new AbortController();
  const check = () => {
    if (!res.writableFinished && (req.destroyed || res.socket?.destroyed))
      stop.abort();
  };
  res.on("close", check);
  const timer = setInterval(check, 250);
  return { signal: stop.signal, done: () => clearInterval(timer) };
}

/** Short JSON errors instead of Express' HTML page with a stack trace. */
// eslint-disable-next-line @typescript-eslint/no-unused-vars -- Express spots error handlers by their 4 parameters
const jsonErrors: ErrorRequestHandler = (err, _req, res, _next) => {
  if (isRecord(err) && err.type === "entity.parse.failed") {
    res.status(400).send({ error: "invalid JSON" });
    return;
  }
  console.error(err);
  res.status(500).send({ error: "internal error" });
};

export function createApp({
  scrape = scrapeFlyersStream,
}: Partial<AppDeps> = {}) {
  const app = express();
  app.use(sameSiteWrites);
  app.use(express.json());

  app.get("/api/places", async (req, res) => {
    try {
      res.send(await searchPlaces(String(req.query.q ?? "")));
    } catch (err) {
      console.error(err);
      res.status(502).send({ error: String(err) });
    }
  });

  app.get("/api/places/reverse", async (req, res) => {
    const lat = Number(req.query.lat);
    const lng = Number(req.query.lng);
    if (!Number.isFinite(lat) || !Number.isFinite(lng)) {
      res.status(400).send({ error: "lat and lng are required" });
      return;
    }
    try {
      const place = await reversePlace(lat, lng);
      if (place) res.send(place);
      else res.status(404).send({ error: "no place found here" });
    } catch (err) {
      console.error(err);
      res.status(502).send({ error: String(err) });
    }
  });

  // The local national list (empty until the first build ends).
  app.get("/api/retailers", (_req, res) => {
    res.send(getCatalog());
  });

  app.get("/api/retailers/status", (_req, res) => {
    res.send(getCatalogStatus());
  });

  app.post("/api/retailers/update", (_req, res) => {
    res.send(updateCatalog());
  });

  app.post("/api/scraper", async (req, res) => {
    const { place, flyers, products } = (req.body ??
      {}) as Partial<ScrapeRequest>;
    if (!place || !Number.isFinite(place.lat) || !Number.isFinite(place.lng)) {
      res.status(400).send({ error: "place with lat/lng is required" });
      return;
    }
    if (
      !Array.isArray(flyers) ||
      !flyers.every(isChoice) ||
      !Array.isArray(products) ||
      !products.every(isQuery)
    ) {
      res.status(400).send({ error: "flyers and products must be lists" });
      return;
    }
    res.setHeader("content-type", "application/x-ndjson");
    res.setHeader("cache-control", "no-cache");
    res.setHeader("x-accel-buffering", "no");
    // The page went away: stop reading flyers from dc for nobody.
    const { signal, done } = abortOnDisconnect(req, res);
    try {
      for await (const msg of scrape(place, flyers, products, signal)) {
        if (signal.aborted) break;
        res.write(ndjson(msg));
      }
    } catch (err) {
      if (!signal.aborted) {
        console.error(err);
        res.write(ndjson({ error: String(err) }));
      }
    } finally {
      done();
    }
    res.end();
  });

  app.use(jsonErrors);
  return app;
}
