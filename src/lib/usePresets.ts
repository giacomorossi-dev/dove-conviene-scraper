import { useEffect, useMemo, useState } from "react";
import type { Retailer } from "@shared/types";
import {
  applyDraft,
  createPreset,
  keepKnown,
  loadActivePresetId,
  loadPresets,
  mostRecent,
  resolveLegacyRetailers,
  saveActivePresetId,
  savePresets,
  type Preset,
  type PresetDraft,
} from "./presets";

// Read once, at startup.
const initialPresets = loadPresets();
const storedActiveId = loadActivePresetId();
const initialActiveId = initialPresets.some((p) => p.id === storedActiveId)
  ? storedActiveId
  : (mostRecent(initialPresets)?.id ?? null);

/**
 * The saved presets and the active one, saved in the browser on change.
 * `catalog` is the retailer list: it resolves presets saved before slugs and
 * drops retailers no longer listed when a preset is saved.
 */
export function usePresets(catalog: readonly Retailer[]) {
  const [stored, setStored] = useState<Preset[]>(initialPresets);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);

  useEffect(() => savePresets(stored), [stored]);
  useEffect(() => saveActivePresetId(activeId), [activeId]);

  const known = useMemo(() => new Set(catalog.map((r) => r.slug)), [catalog]);
  // Presets saved by name get their slugs here; storage keeps the names
  // until the preset is next saved.
  const presets = useMemo(
    () =>
      catalog.length === 0
        ? stored
        : stored.map((p) => resolveLegacyRetailers(p, catalog)),
    [stored, catalog]
  );

  const create = (draft: PresetDraft): Preset => {
    const preset = createPreset({
      ...draft,
      retailers: keepKnown(draft.retailers, known),
    });
    setStored((prev) => [...prev, preset]);
    setActiveId(preset.id);
    return preset;
  };

  const update = (id: string, draft: PresetDraft) =>
    setStored((prev) =>
      prev.map((p) => (p.id === id ? applyDraft(p, draft, known) : p))
    );

  const remove = (id: string) => {
    const left = stored.filter((p) => p.id !== id);
    setStored(left);
    if (activeId === id) setActiveId(mostRecent(left)?.id ?? null);
  };

  const active = presets.find((p) => p.id === activeId) ?? null;
  return { presets, active, activeId, setActiveId, create, update, remove };
}
