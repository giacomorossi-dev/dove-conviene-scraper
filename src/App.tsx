import { useEffect, useState } from "react";
import type {
  Flyer as FlyerI,
  Place,
  ScrapeMessage,
  ScrapeRequest,
} from "@shared/types";
import ResultsView from "./components/ResultsView";
import PresetsView from "./components/PresetsView";
import PresetEditorDialog, {
  type EditorMode,
} from "./components/PresetEditorDialog";
import ShoppingListView from "./components/ShoppingListView";
import Topbar, { type View } from "./components/Topbar";
import Bottombar from "./components/Bottombar";
import Footer from "./components/Footer";
import ConfirmDialog from "./components/ConfirmDialog";
import {
  copyName,
  EMPTY_DRAFT,
  loadLegacyActivePlace,
  type PresetDraft,
} from "./lib/presets";
import { usePresets } from "./lib/usePresets";
import { useCatalog } from "./lib/useCatalog";
import { useShoppingList } from "./lib/useShoppingList";
import { DEFAULT_PLACE, loadPlace, savePlace } from "./lib/places";
import { knownRetailers, toSelection } from "./lib/retailers";

const App = () => {
  const catalog = useCatalog();
  const { presets, active, activeId, setActiveId, create, update, remove } =
    usePresets(catalog.retailers);
  const shopping = useShoppingList();
  const [place, setPlace] = useState<Place>(
    () => loadPlace() ?? loadLegacyActivePlace() ?? DEFAULT_PLACE
  );
  const [results, setResults] = useState<FlyerI[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("main");

  // The editor keeps its last content while it closes (no title flicker).
  const [editor, setEditor] = useState<{
    mode: EditorMode;
    editingId?: string;
    initial: PresetDraft;
  }>({ mode: "create", initial: EMPTY_DRAFT });
  const [editorOpen, setEditorOpen] = useState(false);
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  const deletePreset = presets.find((p) => p.id === deletePresetId) ?? null;

  useEffect(() => savePlace(place), [place]);

  // ---- search ----

  const searchRetailers = active
    ? knownRetailers(active.retailers, catalog.bySlug)
    : [];
  const canSearch =
    !!active && searchRetailers.length > 0 && active.products.length > 0;

  const onSearch = async () => {
    if (!active || !canSearch) return;
    setLoading(true);
    setResults([]);
    try {
      const request: ScrapeRequest = {
        place,
        flyers: searchRetailers.map(toSelection),
        products: active.products,
      };
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
      });
      if (!res.ok || !res.body) return;

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.trim()) continue;
          try {
            const msg = JSON.parse(line) as ScrapeMessage;
            if ("flyer" in msg) {
              const { flyer } = msg;
              setResults((prev) => [...prev, flyer]);
            }
          } catch {
            /* skip malformed line */
          }
        }
      }
    } finally {
      setLoading(false);
    }
  };

  // ---- preset handlers ----

  const onSelectPreset = (id: string) => {
    setActiveId(id);
    setResults([]);
  };

  const draftOf = (id: string): PresetDraft | null => {
    const p = presets.find((x) => x.id === id);
    return p
      ? { name: p.name, retailers: p.retailers, products: p.products }
      : null;
  };

  const openCreate = () => {
    setView("presets");
    setEditor({ mode: "create", initial: EMPTY_DRAFT });
    setEditorOpen(true);
  };

  const openEdit = (id: string) => {
    const initial = draftOf(id);
    if (!initial) return;
    setEditor({ mode: "edit", editingId: id, initial });
    setEditorOpen(true);
  };

  const openDuplicate = (id: string) => {
    const source = draftOf(id);
    if (!source) return;
    setEditor({
      mode: "duplicate",
      initial: { ...source, name: copyName(presets, source.name) },
    });
    setEditorOpen(true);
  };

  const onSaveEditor = (draft: PresetDraft) => {
    if (editor.mode === "edit" && editor.editingId)
      update(editor.editingId, draft);
    else {
      create(draft);
      setResults([]);
    }
  };

  const onConfirmDeletePreset = () => {
    if (!deletePresetId) return;
    if (deletePresetId === activeId) setResults([]);
    remove(deletePresetId);
    setDeletePresetId(null);
  };

  return (
    <>
      <Topbar
        view={view}
        onChangeView={setView}
        place={place}
        onPlaceChange={setPlace}
        shoppingCount={shopping.toBuy}
      />
      {/* The topbar wraps the location onto a second row below `sm`. */}
      <main className="pt-32 pb-24 sm:pt-20">
        <div className="container">
          {view === "shopping" ? (
            <ShoppingListView
              items={shopping.items}
              bySlug={catalog.bySlug}
              onTogglePurchased={shopping.setPurchased}
              onRemove={shopping.remove}
              onRemovePurchased={shopping.removePurchased}
              onRemoveExpired={shopping.removeExpired}
              onGoToResults={() => setView("main")}
            />
          ) : view === "presets" ? (
            <PresetsView
              presets={presets}
              bySlug={catalog.bySlug}
              onRequestCreate={openCreate}
              onRequestEdit={openEdit}
              onRequestDuplicate={openDuplicate}
              onRequestDelete={setDeletePresetId}
            />
          ) : (
            <ResultsView
              preset={active}
              bySlug={catalog.bySlug}
              results={results}
              isInCart={shopping.has}
              onToggleCart={shopping.toggle}
              onRequestCreate={openCreate}
              onRequestEdit={() => active && openEdit(active.id)}
            />
          )}
        </div>
      </main>

      <Footer />

      {view === "main" && (
        <Bottombar
          presets={presets}
          activeId={activeId}
          bySlug={catalog.bySlug}
          onSelectPreset={onSelectPreset}
          loading={loading}
          canSearch={canSearch}
          onSearch={onSearch}
        />
      )}

      <PresetEditorDialog
        open={editorOpen}
        onOpenChange={setEditorOpen}
        mode={editor.mode}
        editingId={editor.editingId}
        initial={editor.initial}
        presets={presets}
        catalog={catalog}
        onSave={onSaveEditor}
      />

      <ConfirmDialog
        open={deletePresetId !== null}
        onOpenChange={(o) => !o && setDeletePresetId(null)}
        title={`Eliminare il preset «${deletePreset?.name ?? ""}»?`}
        description="L'azione non può essere annullata."
        confirmLabel="Elimina"
        destructive
        onConfirm={onConfirmDeletePreset}
      />
    </>
  );
};

export default App;
