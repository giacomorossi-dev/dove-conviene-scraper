import { describe, expect, test } from "bun:test";
import { parsePlace } from "./places";

describe("parsePlace", () => {
  test("a saved place with name and coordinates", () => {
    const place = { name: "Rimini", zip: "47921", lat: 44.06, lng: 12.57 };
    expect(parsePlace(JSON.stringify(place))).toEqual(place);
  });

  test("missing, unreadable or without coordinates: none", () => {
    expect(parsePlace(null)).toBeNull();
    expect(parsePlace("{oops")).toBeNull();
    expect(parsePlace("{}")).toBeNull();
    expect(
      parsePlace(JSON.stringify({ name: "X", lat: "44", lng: 12 }))
    ).toBeNull();
  });

  test("a missing postal code becomes null", () => {
    expect(parsePlace(JSON.stringify({ name: "X", lat: 1, lng: 2 }))).toEqual({
      name: "X",
      zip: null,
      lat: 1,
      lng: 2,
    });
  });
});
