import express from "express";
import { CATEGORIES } from "./config";
import { getCities } from "./scrapers/cities";
import { getRetailersByCategory } from "./scrapers/retailers";
import {
  scrapeFlyersStream,
  type Flyer,
  type ProductQuery,
} from "./scrapers/flyers";

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
  const category = CATEGORIES.find((c) => c.url.endsWith(`/${req.params.slug}`));
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
  const { city, flyers, products } = req.body as {
    city: string;
    flyers: Flyer[];
    products: ProductQuery[];
  };
  res.setHeader("content-type", "application/x-ndjson");
  res.setHeader("cache-control", "no-cache");
  res.setHeader("x-accel-buffering", "no");
  try {
    for await (const flyer of scrapeFlyersStream(city, flyers, products)) {
      res.write(JSON.stringify({ flyer }) + "\n");
      // flush ASAP so the client sees rows progressively
      // @ts-expect-error: flush is added by some middleware/proxies
      res.flush?.();
    }
  } catch (err) {
    console.error(err);
    res.write(JSON.stringify({ error: String(err) }) + "\n");
  }
  res.end();
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
