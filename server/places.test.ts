import { describe, expect, test } from "bun:test";
import {
  isPostcodeQuery,
  toPlace,
  toSuggestions,
  type PhotonFeature,
} from "./places";

const feature = (
  properties: PhotonFeature["properties"],
  [lat, lng] = [44, 12]
): PhotonFeature => ({
  geometry: { coordinates: [lng, lat] },
  properties: { countrycode: "IT", osm_key: "place", ...properties },
});

describe("toSuggestions", () => {
  test("labels towns dc-style, with the province only when it differs", () => {
    const [rimini, reggiolo] = toSuggestions([
      feature(
        { name: "Rimini", osm_value: "city", county: "Rimini" },
        [44.06, 12.57]
      ),
      feature({
        name: "Reggiolo",
        osm_value: "village",
        county: "Reggio nell'Emilia",
      }),
    ]);
    expect(rimini).toEqual({
      name: "Rimini",
      zip: null,
      lat: 44.06,
      lng: 12.57,
      label: "Rimini, Italia",
    });
    expect(reggiolo.label).toBe("Reggiolo, Reggio nell'Emilia, Italia");
  });

  test("turns postal codes into '<cap>, <town>, Italia' with the zip set", () => {
    const [cap] = toSuggestions([
      feature({ name: "47921", osm_value: "postcode", city: "Rimini" }),
    ]);
    expect(cap).toMatchObject({
      name: "Rimini",
      zip: "47921",
      label: "47921, Rimini, Italia",
    });
  });

  test("skips foreign results, non-place objects, other place kinds and duplicates", () => {
    const suggestions = toSuggestions([
      feature({ name: "Nizza", osm_value: "city", countrycode: "FR" }),
      feature({
        name: "Rimini Sud",
        osm_key: "landuse",
        osm_value: "industrial",
      }),
      feature({ name: "Emilia-Romagna", osm_value: "state" }),
      feature({ name: "Reggio", osm_value: "hamlet", county: "Cuneo" }),
      feature({ name: "Reggio", osm_value: "hamlet", county: "Cuneo" }),
    ]);
    expect(suggestions.map((s) => s.label)).toEqual(["Reggio, Cuneo, Italia"]);
  });
});

describe("isPostcodeQuery", () => {
  test.each([
    ["47921", true],
    ["4792", true],
    ["4", false],
    ["479210", false],
    ["rimini", false],
  ])("%s -> %p", (q, expected) => {
    expect(isPostcodeQuery(q)).toBe(expected);
  });
});

describe("toPlace", () => {
  test("uses the town and postal code of the nearest object", () => {
    const place = toPlace(
      [
        feature({
          name: "Piazza Tre Martiri",
          city: "Rimini",
          postcode: "47921",
        }),
      ],
      44.0594,
      12.5684
    );
    expect(place).toEqual({
      name: "Rimini",
      zip: "47921",
      lat: 44.0594,
      lng: 12.5684,
    });
  });

  test("returns null when nothing in Italy is near", () => {
    expect(
      toPlace([feature({ name: "Nice", countrycode: "FR" })], 43.7, 7.26)
    ).toBeNull();
    expect(toPlace([], 0, 0)).toBeNull();
  });
});
