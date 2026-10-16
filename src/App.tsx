import { useEffect, useState } from "react";
import type { Place } from "@shared/types";
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
import { useSearch } from "./lib/useSearch";
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
  const search = useSearch();
  const [view, setView] = useState<View>("main");

  // The editor keeps its last content while it closes (no title flicker).
  const [editor, setEditor] = useState<{
    mode: EditorMode;
    editingId?: string;
    initial: PresetDraft;
  }>({ mode: "create", initial: EMPTY_DRAFT });
  const [editorOpen, setEditorOpen] = useState(false);
  const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
  // Kept after the delete, so the closing dialog doesn't read «».
  const [deleteName, setDeleteName] = useState("");
  const requestDelete = (id: string) => {
    setDeleteName(presets.find((p) => p.id === id)?.name ?? "");
    setDeletePresetId(id);
  };

  useEffect(() => savePlace(place), [place]);

  // ---- search ----

  const searchRetailers = active
    ? knownRetailers(active.retailers, catalog.bySlug)
    : [];
  const catalogReady = catalog.retailers.length > 0;
  /** Why the active preset can't be searched yet; null when it can. */
  const searchBlocker = !active
    ? "Scegli un preset"
    : catalog.error
      ? "Elenco delle insegne non disponibile"
      : !catalogReady
        ? catalog.status?.building
          ? "Elenco delle insegne in preparazione"
          : "Elenco delle insegne non ancora caricato"
        : searchRetailers.length === 0
          ? "Il preset non ha insegne"
          : active.products.length === 0
            ? "Il preset non ha prodotti"
            : null;

  const onSearch = () => {
    if (!active || searchBlocker) return;
    search.start({
      place,
      flyers: searchRetailers.map(toSelection),
      products: active.products,
    });
  };

  // Results belong to a place: another place means another search.
  const onPlaceChange = (next: Place) => {
    setPlace(next);
    search.reset();
  };

  // ---- preset handlers ----

  const onSelectPreset = (id: string) => {
    setActiveId(id);
    search.reset();
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
    if (editor.mode === "edit" && editor.editingId) {
      update(editor.editingId, draft);
      // The results no longer match the edited preset.
      if (editor.editingId === activeId) search.reset();
    } else {
      create(draft);
      search.reset();
    }
  };

  const onConfirmDeletePreset = () => {
    if (!deletePresetId) return;
    if (deletePresetId === activeId) search.reset();
    remove(deletePresetId);
    setDeletePresetId(null);
  };

  return (
    <>
      <Topbar
        view={view}
        onChangeView={setView}
        place={place}
        onPlaceChange={onPlaceChange}
        shoppingCount={shopping.toBuy}
      />
      <main className="pt-6 pb-24">
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
              onRequestDelete={requestDelete}
            />
          ) : (
            <ResultsView
              preset={active}
              bySlug={catalog.bySlug}
              catalogReady={catalogReady}
              search={search}
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
          running={search.phase === "running"}
          blocker={searchBlocker}
          onSearch={onSearch}
          onCancel={search.cancel}
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
        title={`Eliminare il preset «${deleteName}»?`}
        description="L'azione non può essere annullata."
        confirmLabel="Elimina"
        destructive
        onConfirm={onConfirmDeletePreset}
      />
    </>
  );
};

export default App;
