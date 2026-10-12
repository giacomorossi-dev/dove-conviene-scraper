import express from "express";
import { CATEGORIES } from "../shared/categories";
import type { ScrapeMessage, ScrapeRequest } from "../shared/types";
import { getCities } from "./scrapers/cities";
import { scrapeFlyersStream } from "./scrapers/flyers";
import { getRetailersByCategory } from "./scrapers/retailers";

const ndjson = (msg: ScrapeMessage) => JSON.stringify(msg) + "\n";

const app = express();
app.use(express.json());

app.get("/api/cities", async (_req, res) => {
  try {
    res.send(await getCities());
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: String(err) });
  }
});

app.get("/api/retailers/:slug", async (req, res) => {
  const category = CATEGORIES.find((c) =>
    c.url.endsWith(`/${req.params.slug}`)
  );
  if (!category) {
    res.status(404).send({ error: `unknown category: ${req.params.slug}` });
    return;
  }
  try {
    res.send(await getRetailersByCategory(category));
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: String(err) });
  }
});

app.post("/api/scraper", async (req, res) => {
  const { city, flyers, products } = req.body as ScrapeRequest;
  res.setHeader("content-type", "application/x-ndjson");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("x-accel-buffering", "no");
  try {
    for await (const flyer of scrapeFlyersStream(city, flyers, products)) {
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

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
