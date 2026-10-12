// Refreshes the HTML fixtures used by the scraper tests with live pages.
// Run `bun run fixtures:update`, then `bun test`: failing tests mean
// doveconviene.it changed its markup and the parsers need an update.
import { BASE_URL, CATEGORIES } from "../server/config";
import { fetchHtml } from "../server/http";
import { parseFlyerCards } from "../server/scrapers/flyers";

const DIR = new URL("../server/scrapers/__fixtures__/", import.meta.url);
const CITY = "rimini";
const category = CATEGORIES[0];
const categorySlug = category.url.split("/").pop();

const save = async (name: string, html: string) => {
  await Bun.write(new URL(name, DIR), html);
  console.log(`${name.padEnd(20)} ${(html.length / 1024).toFixed(0)} kB`);
};

await save("cities.html", await fetchHtml(`${BASE_URL}/citta`));
await save("category.html", await fetchHtml(category.url));

const cityPage = await fetchHtml(`${BASE_URL}/${CITY}/${categorySlug}`);
await save("city-category.html", cityPage);

const flyer = parseFlyerCards(cityPage, category).find((f) => f.url);
if (!flyer?.url) throw new Error("No flyer card with a URL on the city page");
await save("flyer.html", await fetchHtml(flyer.url));
