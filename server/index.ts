import express from "express";
import { categoryBySlug } from "../shared/categories";
import type { ScrapeMessage, ScrapeRequest } from "../shared/types";
import {
  getCatalog,
  getCatalogStatus,
  initCatalog,
  updateCatalog,
} from "./catalog-store";
import { reversePlace, searchPlaces } from "./places";
import { getNearby } from "./scrapers/nearby";
import { scrapeFlyersStream } from "./scrapers/scrape";

const ndjson = (msg: ScrapeMessage) => JSON.stringify(msg) + "\n";

const app = express();
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

app.get("/api/retailers/nearby", async (req, res) => {
  const lat = Number(req.query.lat);
  const lng = Number(req.query.lng);
  const category = categoryBySlug(String(req.query.category ?? ""));
  if (!Number.isFinite(lat) || !Number.isFinite(lng) || !category) {
    res.status(400).send({ error: "lat, lng and category are required" });
    return;
  }
  try {
    const place = { name: "", zip: null, lat, lng };
    res.send((await getNearby(place, category)).retailers);
  } catch (err) {
    console.error(err);
    res.status(502).send({ error: String(err) });
  }
});

app.post("/api/scraper", async (req, res) => {
  const { place, flyers, products } = req.body as ScrapeRequest;
  if (!Number.isFinite(place?.lat) || !Number.isFinite(place?.lng)) {
    res.status(400).send({ error: "place with lat/lng is required" });
    return;
  }
  res.setHeader("content-type", "application/x-ndjson");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("x-accel-buffering", "no");
  try {
    for await (const flyer of scrapeFlyersStream(place, flyers, products)) {
      res.write(ndjson({ flyer }));
      // flush ASAP so the client sees rows progressively
      // @ts-expect-error: flush is added by some middleware/proxies
      res.flush?.();
    }
  } catch (err) {
    console.error(err);
    res.write(ndjson({ error: String(err) }));
  }
  res.end();
});

await initCatalog();

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
