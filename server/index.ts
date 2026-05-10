import express from "express";
import { CATEGORIES } from "./config";
import { getCities } from "./scrapers/cities";
import { getRetailersByCategory } from "./scrapers/retailers";
import {
  scrapeFlyers,
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
  try {
    const matched = await scrapeFlyers(city, flyers, products);
    res.send({ flyers: matched });
  } catch (err) {
    console.error(err);
    res.status(500).send({ error: String(err) });
  }
});

const PORT = 3000;
app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
