import express from "express";
import scraper from "./scraper";
import { type Flyer } from "../src/models";

const app = express();
app.use(express.json());

app.post("/api/scraper", async (req, res) => {
  const { city, flyers, products } = req.body as {
    city: string;
    flyers: Flyer[];
    products: string[];
  };

  const _flyers = await scraper(city, flyers, products);
  res.send({
    flyers: _flyers,
  });
});

app.listen(3000, () => {
  console.log("Server is running on http://localhost:3000");
});
