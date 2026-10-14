import { describe, expect, test } from "bun:test";
import { countStoreLinks, parseRetailerPage, retailerPages } from "./catalog";

const fixture = (name: string) =>
  Bun.file(new URL(`./__fixtures__/${name}`, import.meta.url)).text();

describe("retailerPages", () => {
  const loc = (path: string) =>
    `<url><loc>https://www.doveconviene.it/${path}</loc></url>`;

  test("collects retailers listed directly, per city and through flyers", () => {
    const pages = retailerPages([
      loc("volantino/conad") + loc("offerte/decathlon"),
      loc("milano/volantino/esselunga") + loc("milano/catalogo/ikea"),
      loc("iper-e-super/bennet/volantino/ultime-offerte-bennet"),
    ]);
    expect(Object.fromEntries(pages)).toEqual({
      conad: "volantino/conad",
      decathlon: "offerte/decathlon",
      esselunga: "volantino/esselunga",
      ikea: "catalogo/ikea",
      bennet: "volantino/bennet",
    });
  });

  test("keeps one page per retailer", () => {
    const pages = retailerPages([
      loc("volantino/conad"),
      loc("roma/volantino/conad") +
        loc("iper-e-super/conad/volantino/ultime-offerte-conad"),
    ]);
    expect([...pages]).toEqual([["conad", "volantino/conad"]]);
  });
});

describe("parseRetailerPage", async () => {
  test("reads name and category from the breadcrumb", async () => {
    expect(parseRetailerPage(await fixture("retailer.html"))).toEqual({
      name: "Conad",
      categorySlug: "iper-e-super",
    });
  });

  test("returns null without a category breadcrumb", () => {
    expect(parseRetailerPage("<html><body>nope</body></html>")).toBeNull();
  });
});

describe("countStoreLinks", () => {
  const link = (slug: string, id: number) =>
    `<a href="/negozi/${slug}/${id}/via-roma-1">`;

  test("a chain's page links its own points of sale", () => {
    expect(
      countStoreLinks(link("conad", 1) + link("conad", 2), "conad")
    ).toEqual({ own: 2, others: 0 });
  });

  test("a brand's page links other chains' stores", () => {
    expect(
      countStoreLinks(link("tigota", 1) + link("acqua-sapone", 2), "garnier")
    ).toEqual({ own: 0, others: 2 });
  });
});
