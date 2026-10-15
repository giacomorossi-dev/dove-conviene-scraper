import { describe, expect, test } from "bun:test";
import {
  applyDraft,
  byName,
  copyName,
  countsLabel,
  createPreset,
  isNameTaken,
  keepKnown,
  migratePreset,
  mostRecent,
  parsePresets,
  resolveLegacyRetailers,
  storedPresetPlace,
  type Preset,
} from "./presets";

const preset = (over: Partial<Preset> = {}): Preset => ({
  id: "p1",
  name: "Spesa",
  retailers: [],
  products: [],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const reggiolo = { name: "Reggiolo", zip: "42046", lat: 44.92, lng: 10.8 };

describe("migratePreset", () => {
  test("old shape: slugs kept, name-only retailers set aside, place and default dropped", () => {
    const old = {
      id: "p1",
      name: "Vecchio",
      place: reggiolo,
      city: "Reggiolo",
      default: true,
      flyers: [
        { name: "Conad City", slug: "conad-city" },
        { name: "Coop" },
        { name: "Conad City", slug: "conad-city" },
      ],
      products: [{ name: "latte", maxPrice: 1.5 }],
      createdAt: 1,
      updatedAt: 2,
    };
    expect(migratePreset(old)).toEqual({
      id: "p1",
      name: "Vecchio",
      retailers: ["conad-city"],
      legacyRetailerNames: ["Coop"],
      products: [{ name: "latte", maxPrice: 1.5 }],
      createdAt: 1,
      updatedAt: 2,
    });
  });

  test("current shape: unchanged", () => {
    const p = preset({ retailers: ["coop"], products: [{ name: "pane" }] });
    expect(migratePreset(p)).toEqual(p);
  });
});

describe("parsePresets", () => {
  test("missing, unreadable or not a list: no presets", () => {
    expect(parsePresets(null)).toEqual([]);
    expect(parsePresets("{oops")).toEqual([]);
    expect(parsePresets('{"id":"p1"}')).toEqual([]);
  });

  test("a saved list is migrated", () => {
    const raw = JSON.stringify([{ ...preset(), place: reggiolo }]);
    expect(parsePresets(raw)).toEqual([preset()]);
  });
});

describe("storedPresetPlace", () => {
  const raw = JSON.stringify([
    { ...preset({ id: "a" }), place: reggiolo },
    { ...preset({ id: "b" }), place: null },
    { ...preset({ id: "c" }), place: { name: "Rotto" } },
  ]);

  test("the place the given saved preset had", () => {
    expect(storedPresetPlace(raw, "a")).toEqual(reggiolo);
  });

  test("none for a missing preset, no place or a place without coordinates", () => {
    expect(storedPresetPlace(raw, "zzz")).toBeNull();
    expect(storedPresetPlace(raw, null)).toBeNull();
    expect(storedPresetPlace(raw, "b")).toBeNull();
    expect(storedPresetPlace(raw, "c")).toBeNull();
    expect(storedPresetPlace(null, "a")).toBeNull();
  });
});

describe("resolveLegacyRetailers", () => {
  const catalog = [
    { name: "Coop", slug: "coop" },
    { name: "Conad City", slug: "conad-city" },
  ];

  test("names found in the list become slugs, without duplicates; others are dropped", () => {
    const p = preset({
      retailers: ["conad-city"],
      legacyRetailerNames: ["Coop", "Conad City", "Sparito"],
    });
    expect(resolveLegacyRetailers(p, catalog)).toEqual(
      preset({ retailers: ["conad-city", "coop"] })
    );
  });

  test("a preset without legacy names is returned as is", () => {
    const p = preset({ retailers: ["coop"] });
    expect(resolveLegacyRetailers(p, catalog)).toBe(p);
  });
});

describe("keepKnown", () => {
  test("drops retailers no longer in the list", () => {
    expect(keepKnown(["coop", "gone"], new Set(["coop"]))).toEqual(["coop"]);
  });

  test("keeps everything while the list is empty (first build running)", () => {
    expect(keepKnown(["coop", "gone"], new Set())).toEqual(["coop", "gone"]);
  });
});

describe("createPreset / applyDraft", () => {
  test("a new preset has a trimmed name and both timestamps", () => {
    const p = createPreset(
      { name: "  Spesa  ", retailers: ["coop"], products: [] },
      42
    );
    expect(p).toMatchObject({
      name: "Spesa",
      retailers: ["coop"],
      createdAt: 42,
      updatedAt: 42,
    });
    expect(p.id).toBeString();
  });

  test("an edit keeps id and creation, drops unknown retailers and legacy names", () => {
    const p = preset({ legacyRetailerNames: ["Coop"] });
    const next = applyDraft(
      p,
      {
        name: " Nuovo ",
        retailers: ["coop", "gone"],
        products: [{ name: "pane" }],
      },
      new Set(["coop"]),
      99
    );
    expect(next).toEqual({
      id: "p1",
      name: "Nuovo",
      retailers: ["coop"],
      products: [{ name: "pane" }],
      createdAt: 1,
      updatedAt: 99,
    });
  });
});

describe("names", () => {
  const presets = [
    preset({ id: "a", name: "Spesa" }),
    preset({ id: "b", name: "Copia di Spesa" }),
  ];

  test("a name is taken ignoring case and surrounding spaces, except by the preset itself", () => {
    expect(isNameTaken(presets, "  spesa ")).toBe(true);
    expect(isNameTaken(presets, "Spesa", "a")).toBe(false);
    expect(isNameTaken(presets, "Altro")).toBe(false);
  });

  test("copies are numbered when the name is taken", () => {
    expect(copyName([preset({ name: "Casa" })], "Casa")).toBe("Copia di Casa");
    expect(copyName(presets, "Spesa")).toBe("Copia di Spesa (2)");
    expect(
      copyName(
        [...presets, preset({ id: "c", name: "Copia di Spesa (2)" })],
        "Spesa"
      )
    ).toBe("Copia di Spesa (3)");
  });

  test("presets by name, Italian order", () => {
    const list = [
      preset({ id: "1", name: "spesa" }),
      preset({ id: "2", name: "Èlite" }),
      preset({ id: "3", name: "alfa" }),
    ];
    expect(byName(list).map((p) => p.name)).toEqual(["alfa", "Èlite", "spesa"]);
  });
});

describe("mostRecent", () => {
  test("the most recently updated preset, or none", () => {
    const list = [
      preset({ id: "a", updatedAt: 5 }),
      preset({ id: "b", updatedAt: 9 }),
      preset({ id: "c", updatedAt: 7 }),
    ];
    expect(mostRecent(list)?.id).toBe("b");
    expect(mostRecent([])).toBeNull();
  });
});

describe("countsLabel", () => {
  test("singular and plural", () => {
    expect(countsLabel(1, 1)).toBe("1 insegna · 1 prodotto");
    expect(countsLabel(0, 3)).toBe("0 insegne · 3 prodotti");
  });
});
