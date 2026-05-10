import { BASE_URL, type Category, type Flyer, type Product } from "@/models";
import { chromium, type Browser, type Page } from "playwright";

const collapseSpaces = (s: string): string => s.replace(/\s+/g, " ").trim();

const normalize = (s: string): string => collapseSpaces(s).toLowerCase();

const acceptCookies = async (page: Page) => {
  await page.waitForTimeout(3000);
  await page.screenshot({
    path: "../screenshots/before-cookies.png",
    fullPage: true,
  });

  const banner = page.locator("#onetrust-banner-sdk");
  const acceptBtn = page.locator("#onetrust-accept-btn-handler");
  if (await banner.count()) {
    await banner.waitFor({ state: "visible", timeout: 3000 });
  }

  if (await acceptBtn.isVisible()) {
    await acceptBtn.click({ force: true });
    await banner.waitFor({ state: "hidden", timeout: 3000 });
  }
  await page.screenshot({
    path: "./screenshots/after-cookies.png",
    fullPage: true,
  });
};

const changeLocation = async (page: Page, location: string) => {
  // Apri geolocator
  const geolocator = page.locator("#bb-geolocatorCTA");
  await geolocator.waitFor();
  await geolocator.click();

  await page.screenshot({
    path: "./screenshots/open-locator.png",
    fullPage: true,
  });

  // Input autocomplete (è un <input> con classe bb-placeAutocompleteInput)
  const input = page.locator("input.bb-placeAutocompleteInput").first();
  await input.waitFor();

  // Meglio focus che click (evita problemi con overlay che intercettano i click)
  await input.focus();

  // Digita location
  await page.keyboard.press("Control+A");
  await page.keyboard.press("Backspace");
  await page.keyboard.type(location, { delay: 80 });

  // Aspetta suggerimenti
  await page.waitForSelector(".suggestion-list .suggestion-item", {
    timeout: 5000,
  });

  await page.screenshot({
    path: "./screenshots/results-locator.png",
    fullPage: true,
  });

  // Prendi testo del primo suggerimento e cliccalo
  const suggestion = page.locator(".suggestion-list .suggestion-item").first();
  const suggestionText = (await suggestion.innerText()).trim();
  const expected = normalize(suggestionText);

  await suggestion.click();

  // Aspetta che la pagina aggiorni "Sei qui:" con il testo selezionato
  await page.waitForFunction(
    (exp: string) => {
      const el = document.querySelector(".geolocator__address");
      if (!el) return false;
      const txt = (el.textContent || "")
        .replace(/\s+/g, " ")
        .trim()
        .toLowerCase();
      return txt.includes(exp);
    },
    expected,
    { timeout: 10000 }
  );

  await page.screenshot({
    path: "./screenshots/setted-locator.png",
    fullPage: true,
  });
};

const getFlyersByCategory = async (
  page: Page,
  category: Category,
  flyers: Array<Flyer>
) => {
  await page.goto(category.url, { waitUntil: "domcontentloaded" });

  const categoryFlyers = await page.evaluate((category) => {
    return Array.from(
      document.querySelectorAll<HTMLDivElement>(".flyersGrid__item")
    ).map((item) => {
      const titleEl = item.querySelector<HTMLElement>(".flyerCard__titleText");
      const imageEl = item.querySelector<HTMLImageElement>(".flyerCard__image");
      const linkEl = item.querySelector<HTMLAnchorElement>("a");

      return {
        name: titleEl?.textContent?.trim() ?? "",
        url: linkEl?.href ?? "",
        imageUrl: imageEl?.src ?? "",
        category,
      };
    });
  }, category);

  const flyerNames = flyers.map((f) => f.name);

  return categoryFlyers.filter((f) =>
    flyerNames.some((name) => f.name.includes(name))
  );
};

/* -----------------------
   Scrape flow
------------------------ */

const isRecord = (v: unknown): v is Record<string, unknown> =>
  typeof v === "object" && v !== null;

function toItems(data: unknown): unknown[] {
  if (Array.isArray(data)) return data;
  return [data];
}

function isJsonLdProduct(v: unknown): v is Record<string, unknown> {
  return isRecord(v) && v["@type"] === "Product";
}

const getStringArray = (v: unknown): string[] => {
  if (typeof v === "string") return [v];
  if (Array.isArray(v) && v.every((x) => typeof x === "string"))
    return v as string[];
  return [];
};

async function getFlyerProducts(
  page: Page,
  flyer: Flyer,
  products: string[]
): Promise<Array<Product>> {
  await page.goto(flyer.url as string, { waitUntil: "domcontentloaded" });
  // Some flyer pages keep loading assets; we don't rely on networkidle.
  // Just wait for JSON-LD scripts or body ready.
  await page.waitForLoadState("domcontentloaded");

  // Grab all JSON-LD scripts
  const scripts = await page
    .locator("script[type='application/ld+json']")
    .allInnerTexts();

  const _products: Product[] = [];

  console.log(scripts);

  for (const raw of scripts) {
    const text = raw.trim();
    if (!text) continue;

    const parsed = JSON.parse(text) as unknown;

    const items = toItems(parsed);

    for (const item of items) {
      if (!isJsonLdProduct(item)) continue;

      const name = item["name"] as string;
      if (!name) continue;

      // Filter by product name if filters provided
      const n = normalize(name);
      const ok = products.some((k) => n.includes(k));
      if (!ok) continue;

      const images = getStringArray(item["image"]);
      const imageUrl = images.length > 0 ? images[0] : null;

      let price: number | null = null;
      const offers = item["offers"];
      if (isRecord(offers)) {
        const p = offers["price"];
        // price can be string or number
        if (typeof p === "string") price = Number(p);
      }

      _products.push({ name, imageUrl, price });
    }
  }

  return _products;
}

const scraper = async (
  location: string,
  flyers: Array<Flyer>,
  products: Array<string>
) => {
  console.log("lillo", products);
  const browser: Browser = await chromium.launch({
    headless: true,
  });

  const page = await browser.newPage();

  await page.goto(BASE_URL, { waitUntil: "domcontentloaded" });

  await acceptCookies(page);

  await changeLocation(page, location);

  const categories: Array<Category> = flyers.reduce(
    (acc: Array<Category>, current: Flyer) => {
      const x = acc.find((item: Category) => item.url === current.category.url);
      if (!x) {
        return acc.concat([current.category]);
      } else {
        return acc;
      }
    },
    []
  );

  const _flyers: Array<Flyer> = [];

  for (const category of categories) {
    _flyers.push(
      ...(await getFlyersByCategory(
        page,
        category,
        flyers.filter((flyer) => flyer.category.name === category.name)
      ))
    );
  }

  for (const flyer of _flyers.filter((flyer) => flyer.url)) {
    flyer.products = await getFlyerProducts(page, flyer, products);
  }

  //await page.screenshot({ path: "change-location.png", fullPage: true });

  await browser.close();

  return _flyers;
};

export default scraper;
