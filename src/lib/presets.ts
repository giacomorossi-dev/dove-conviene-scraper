// Presets: a reusable set of retailers and products to search for, saved in
// the browser. The place is not part of a preset: it lives in the topbar.
import type { Place, ProductQuery, Retailer } from "@shared/types";

export interface Preset {
  id: string;
  name: string;
  /** Retailer slugs ("conad-city"): names and logos come from the list. */
  retailers: string[];
  products: ProductQuery[];
  /**
   * Retailers of presets saved before slugs, by name: matched against the
   * list once it loads (resolveLegacyRetailers), dropped on the next save.
   */
  legacyRetailerNames?: string[];
  createdAt: number;
  updatedAt: number;
}

/** What the preset editor edits. */
export type PresetDraft = Pick<Preset, "name" | "retailers" | "products">;

export const EMPTY_DRAFT: PresetDraft = {
  name: "",
  retailers: [],
  products: [],
};

const STORAGE_KEY = "dove-conviene:presets";
const ACTIVE_KEY = "dove-conviene:active-preset";

/** A preset as any version of the app may have saved it. */
interface StoredPreset {
  id: string;
  name: string;
  retailers?: string[];
  /** Before slugs: the selected retailers, with a slug once it existed. */
  flyers?: { name: string; slug?: string }[];
  products?: ProductQuery[];
  legacyRetailerNames?: string[];
  /** Before the place moved to the topbar. */
  place?: Place | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * A saved preset in the current shape. Fields of older versions (place,
 * city, citySlug, legacyCity, default) are dropped.
 */
export function migratePreset(p: StoredPreset): Preset {
  const flyers = p.flyers ?? [];
  const retailers = [
    ...new Set([
      ...(p.retailers ?? []),
      ...flyers.flatMap((f) => (f.slug ? [f.slug] : [])),
    ]),
  ];
  const legacy = [
    ...(p.legacyRetailerNames ?? []),
    ...flyers.filter((f) => !f.slug).map((f) => f.name),
  ];
  return {
    id: p.id,
    name: p.name,
    retailers,
    products: p.products ?? [],
    ...(legacy.length > 0 && { legacyRetailerNames: legacy }),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const parseStored = (raw: string | null): StoredPreset[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    // Anything that isn't a preset is dropped rather than breaking the app.
    return parsed.filter(
      (p): p is StoredPreset =>
        typeof p === "object" &&
        p !== null &&
        typeof p.id === "string" &&
        typeof p.name === "string"
    );
  } catch {
    return [];
  }
};

/** The presets in a saved JSON string: none when missing or unreadable. */
export const parsePresets = (raw: string | null): Preset[] =>
  parseStored(raw).map(migratePreset);

/** The place a saved preset had, from versions that kept it in the preset. */
export function storedPresetPlace(
  raw: string | null,
  id: string | null
): Place | null {
  const place = parseStored(raw).find((p) => p.id === id)?.place;
  return place && typeof place.lat === "number" && typeof place.lng === "number"
    ? place
    : null;
}

const storage = (): Storage | null =>
  typeof localStorage === "undefined" ? null : localStorage;

export const loadPresets = (): Preset[] =>
  parsePresets(storage()?.getItem(STORAGE_KEY) ?? null);

export function savePresets(presets: Preset[]): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export const loadActivePresetId = (): string | null =>
  storage()?.getItem(ACTIVE_KEY) ?? null;

export function saveActivePresetId(id: string | null): void {
  const s = storage();
  if (!s) return;
  if (id) s.setItem(ACTIVE_KEY, id);
  else s.removeItem(ACTIVE_KEY);
}

/** The active preset's place, saved by versions that kept it in the preset. */
export const loadLegacyActivePlace = (): Place | null =>
  storedPresetPlace(
    storage()?.getItem(STORAGE_KEY) ?? null,
    loadActivePresetId()
  );

/** Matches the names of presets saved before slugs; unmatched ones are dropped. */
export function resolveLegacyRetailers(
  p: Preset,
  catalog: readonly Pick<Retailer, "name" | "slug">[]
): Preset {
  if (!p.legacyRetailerNames) return p;
  const slugOf = new Map(catalog.map((r) => [r.name, r.slug]));
  const found = p.legacyRetailerNames.flatMap((n) => slugOf.get(n) ?? []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- resolved
  const { legacyRetailerNames, ...rest } = p;
  return { ...rest, retailers: [...new Set([...p.retailers, ...found])] };
}

/**
 * The retailers still in the list. While the list is empty (first build
 * running) nothing is known, so everything is kept.
 */
export const keepKnown = (
  slugs: string[],
  known: ReadonlySet<string>
): string[] => (known.size === 0 ? slugs : slugs.filter((s) => known.has(s)));

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function createPreset(draft: PresetDraft, now = Date.now()): Preset {
  return {
    id: newId(),
    name: draft.name.trim(),
    retailers: draft.retailers,
    products: draft.products,
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * The preset with the editor's changes. Legacy names are gone after a save,
 * unless the list is still empty: then they could not be matched yet.
 */
export function applyDraft(
  p: Preset,
  draft: PresetDraft,
  known: ReadonlySet<string>,
  now = Date.now()
): Preset {
  return {
    id: p.id,
    name: draft.name.trim(),
    retailers: keepKnown(draft.retailers, known),
    products: draft.products,
    ...(known.size === 0 &&
      p.legacyRetailerNames && { legacyRetailerNames: p.legacyRetailerNames }),
    createdAt: p.createdAt,
    updatedAt: now,
  };
}

const sameName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase("it") === b.trim().toLocaleLowerCase("it");

/** Whether another preset has this name, ignoring case and surrounding spaces. */
export const isNameTaken = (
  presets: readonly Preset[],
  name: string,
  exceptId?: string
): boolean => presets.some((p) => p.id !== exceptId && sameName(p.name, name));

/** "Copia di X", or "Copia di X (2)", "(3)"… when taken. */
export function copyName(presets: readonly Preset[], source: string): string {
  const base = `Copia di ${source.trim()}`;
  if (!isNameTaken(presets, base)) return base;
  for (let n = 2; ; n++) {
    const name = `${base} (${n})`;
    if (!isNameTaken(presets, name)) return name;
  }
}

/** The most recently updated preset: the next active one after a delete. */
export const mostRecent = (presets: readonly Preset[]): Preset | null =>
  presets.reduce<Preset | null>(
    (best, p) => (!best || p.updatedAt > best.updatedAt ? p : best),
    null
  );

/** Presets by name, as the page and the select list them. */
export const byName = (presets: readonly Preset[]): Preset[] =>
  [...presets].sort((a, b) => a.name.localeCompare(b.name, "it"));

/** "2 insegne · 1 prodotto". */
export const countsLabel = (retailers: number, products: number): string =>
  `${retailers} insegn${retailers === 1 ? "a" : "e"} · ${products} prodott${
    products === 1 ? "o" : "i"
  }`;
