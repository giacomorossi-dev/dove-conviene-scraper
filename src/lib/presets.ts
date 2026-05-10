import type { Flyer } from "@/components/Flyer";
import type { ProductQuery } from "@/components/ProductsChipsInput";

export interface Preset {
  id: string;
  name: string;
  city: string;
  citySlug: string;
  flyers: Flyer[];
  products: ProductQuery[];
  createdAt: number;
  updatedAt: number;
  default?: boolean;
}

const STORAGE_KEY = "dove-conviene:presets";
const ACTIVE_KEY = "dove-conviene:active-preset";

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function loadPresets(): Preset[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    const list = parsed as Preset[];
    if (list.length > 0 && !list.some((p) => p.default)) {
      const oldest = list.reduce((a, b) =>
        a.createdAt <= b.createdAt ? a : b
      );
      oldest.default = true;
    }
    return list;
  } catch {
    return [];
  }
}

export function savePresets(presets: Preset[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export function loadActivePresetId(): string | null {
  if (typeof localStorage === "undefined") return null;
  return localStorage.getItem(ACTIVE_KEY);
}

export function saveActivePresetId(id: string | null): void {
  if (typeof localStorage === "undefined") return;
  if (id) localStorage.setItem(ACTIVE_KEY, id);
  else localStorage.removeItem(ACTIVE_KEY);
}

export function createPreset(input: Omit<Preset, "id" | "createdAt" | "updatedAt">): Preset {
  const now = Date.now();
  return {
    ...input,
    id: newId(),
    createdAt: now,
    updatedAt: now,
  };
}

const flyerKey = (f: Flyer): string => f.name;

const productKey = (p: ProductQuery): string =>
  `${p.name}|${p.maxPrice ?? ""}`;

const setEq = <T>(a: T[], b: T[], keyOf: (x: T) => string): boolean => {
  if (a.length !== b.length) return false;
  const sa = new Set(a.map(keyOf));
  return b.every((x) => sa.has(keyOf(x)));
};

export function isPresetDirty(
  preset: Preset,
  current: Pick<Preset, "city" | "citySlug" | "flyers" | "products">
): boolean {
  return (
    preset.city !== current.city ||
    preset.citySlug !== current.citySlug ||
    !setEq(preset.flyers, current.flyers, flyerKey) ||
    !setEq(preset.products, current.products, productKey)
  );
}

export const DEFAULT_PRESET_NAME = "il mio preset";
