import { useEffect, useState } from "react";
import type {
  Flyer as FlyerI,
  Place,
  ProductQuery,
  Retailer,
  ScrapeMessage,
  ScrapeRequest,
} from "@shared/types";
import Wizard from "./components/Wizard";
import ListsView from "./components/ListsView";
import Topbar, { type View } from "./components/Topbar";
import Bottombar from "./components/Bottombar";
import Footer from "./components/Footer";
import PresetNameDialog from "./components/PresetNameDialog";
import PresetDeleteDialog from "./components/PresetDeleteDialog";
import ListEditDialog from "./components/ListEditDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import {
  loadPresets,
  savePresets,
  loadActivePresetId,
  saveActivePresetId,
  createPreset,
  isPresetDirty,
  DEFAULT_PRESET_NAME,
  type Preset,
} from "./lib/presets";
import {
  loadLists,
  saveLists,
  createList,
  makeSavedItem,
  itemKey,
  isExpired,
  type List,
  type RowData,
} from "./lib/lists";
import { DEFAULT_PLACE, resolveCityName } from "./lib/places";
import { isRetailer, toSelection } from "./lib/retailers";

const storedPresets = loadPresets();
// First run: seed the default preset up front instead of in a mount effect.
const initialPresets =
  storedPresets.length > 0
    ? storedPresets
    : [
        createPreset({
          name: DEFAULT_PRESET_NAME,
          place: DEFAULT_PLACE,
          flyers: [],
          products: [],
          default: true,
        }),
      ];
const initialActiveId =
  storedPresets.length > 0 ? loadActivePresetId() : initialPresets[0].id;
const initialActive =
  initialPresets.find((p) => p.id === initialActiveId) ?? null;

const App = () => {
  const [place, setPlace] = useState<Place | null>(
    initialActive ? initialActive.place : DEFAULT_PLACE
  );
  const [flyers, setFlyers] = useState<FlyerI[]>(initialActive?.flyers ?? []);
  const [products, setProducts] = useState<ProductQuery[]>(
    initialActive?.products ?? []
  );
  const [results, setResults] = useState<FlyerI[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("main");

  const [presets, setPresets] = useState<Preset[]>(initialPresets);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);
  const [createOpen, setCreateOpen] = useState(false);
  const [createInitialName, setCreateInitialName] = useState("");
  const [createInitialSource, setCreateInitialSource] = useState<string | null>(
    null
  );
  const [renameTarget, setRenameTarget] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<string | null>(null);

  const [lists, setLists] = useState<List[]>(() => loadLists());
  const [pendingItem, setPendingItem] = useState<RowData | null>(null);
  const [newListOpen, setNewListOpen] = useState(false);
  const [editListId, setEditListId] = useState<string | null>(null);
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [removeItemTarget, setRemoveItemTarget] = useState<{
    row: RowData;
    list: List;
  } | null>(null);

  const active = presets.find((p) => p.id === activeId) ?? null;
  const renameTargetPreset = presets.find((p) => p.id === renameTarget) ?? null;
  const deleteTargetPreset = presets.find((p) => p.id === deleteTarget) ?? null;
  const editListTarget = lists.find((l) => l.id === editListId) ?? null;
  const deleteListTarget = lists.find((l) => l.id === deleteListId) ?? null;
  const dirty = active
    ? isPresetDirty(active, { place, flyers, products })
    : false;

  useEffect(() => {
    savePresets(presets);
  }, [presets]);
  useEffect(() => {
    saveActivePresetId(activeId);
  }, [activeId]);
  useEffect(() => {
    saveLists(lists);
  }, [lists]);

  // Presets saved before places had coordinates only know a city name: look
  // it up once and store the place.
  useEffect(() => {
    const legacy = initialPresets.filter((p) => !p.place && p.legacyCity);
    if (legacy.length === 0) return;
    Promise.all(
      legacy.map(
        async (p) => [p.id, await resolveCityName(p.legacyCity!)] as const
      )
    ).then((entries) => {
      const resolved = new Map(
        entries.filter((e): e is [string, Place] => e[1] !== null)
      );
      setPresets((prev) =>
        prev.map((p) => {
          const found = resolved.get(p.id);
          return found ? { ...p, place: found, legacyCity: undefined } : p;
        })
      );
      const activePlace = initialActiveId && resolved.get(initialActiveId);
      if (activePlace) setPlace((cur) => cur ?? activePlace);
    });
  }, []);

  // ---- main wizard handlers ----

  const onRun = async () => {
    if (!place) return;
    setLoading(true);
    setResults([]);
    try {
      const request: ScrapeRequest = { place, flyers, products };
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

  const onToggleRetailer = (retailer: Retailer) => {
    setFlyers((prev) =>
      prev.some((f) => isRetailer(f, retailer))
        ? prev.filter((f) => !isRetailer(f, retailer))
        : prev.concat(toSelection(retailer))
    );
  };

  // ---- preset handlers ----

  const applyPreset = (preset: Preset) => {
    setPlace(preset.place);
    setFlyers(preset.flyers);
    setProducts(preset.products);
    setActiveId(preset.id);
  };

  const onSelectPreset = (id: string) => {
    const p = presets.find((p) => p.id === id);
    if (p) applyPreset(p);
  };

  const onCreatePreset = (name: string, sourceId?: string | null) => {
    const source = sourceId ? presets.find((p) => p.id === sourceId) : null;
    const data = source
      ? {
          place: source.place,
          flyers: source.flyers,
          products: source.products,
        }
      : { place, flyers, products };
    const next = createPreset({ name, ...data });
    setPresets([...presets, next]);
    applyPreset(next);
  };

  const onRequestCreate = () => {
    setCreateInitialName("");
    setCreateInitialSource(null);
    setCreateOpen(true);
  };

  const onRequestDuplicate = (id: string) => {
    const src = presets.find((p) => p.id === id);
    if (!src) return;
    setCreateInitialName(`Copia di ${src.name}`);
    setCreateInitialSource(id);
    setCreateOpen(true);
  };

  const onRenamePreset = (id: string, name: string) => {
    setPresets(
      presets.map((p) =>
        p.id === id ? { ...p, name, updatedAt: Date.now() } : p
      )
    );
  };

  const onDeletePreset = (id: string) => {
    const target = presets.find((p) => p.id === id);
    if (target?.default) return;
    const next = presets.filter((p) => p.id !== id);
    setPresets(next);
    if (activeId === id) {
      const newActive = next.find((p) => p.default) ?? next[0] ?? null;
      setActiveId(newActive?.id ?? null);
      if (newActive) applyPreset(newActive);
    }
  };

  const onUpdateActive = () => {
    if (!active) return;
    setPresets(
      presets.map((p) =>
        p.id === active.id
          ? { ...p, place, flyers, products, updatedAt: Date.now() }
          : p
      )
    );
  };

  const onResetToActive = () => {
    if (active) applyPreset(active);
  };

  // ---- list handlers ----

  const onAddToList = (listId: string, row: RowData) => {
    setLists(
      lists.map((l) =>
        l.id === listId
          ? {
              ...l,
              items: [...l.items, makeSavedItem(row)],
              updatedAt: Date.now(),
            }
          : l
      )
    );
  };

  const onRequestNewList = (row: RowData) => {
    setPendingItem(row);
    setNewListOpen(true);
  };

  const onSubmitNewList = (name: string, color: string) => {
    const list = createList(name, color);
    if (pendingItem) list.items.push(makeSavedItem(pendingItem));
    setLists([...lists, list]);
    setPendingItem(null);
  };

  const onSubmitListEdit = (name: string, color: string) => {
    if (!editListId) return;
    setLists(
      lists.map((l) =>
        l.id === editListId ? { ...l, name, color, updatedAt: Date.now() } : l
      )
    );
    setEditListId(null);
  };

  const onConfirmDeleteList = () => {
    if (!deleteListId) return;
    setLists(lists.filter((l) => l.id !== deleteListId));
    setDeleteListId(null);
  };

  const onRemoveExpired = (id: string) => {
    setLists(
      lists.map((l) =>
        l.id === id
          ? {
              ...l,
              items: l.items.filter((i) => !isExpired(i.validUntil)),
              updatedAt: Date.now(),
            }
          : l
      )
    );
  };

  const onConfirmRemoveItem = () => {
    if (!removeItemTarget) return;
    const { row, list } = removeItemTarget;
    const key = itemKey(row);
    setLists(
      lists.map((l) =>
        l.id === list.id
          ? {
              ...l,
              items: l.items.filter((i) => itemKey(i) !== key),
              updatedAt: Date.now(),
            }
          : l
      )
    );
    setRemoveItemTarget(null);
  };

  return (
    <>
      <Topbar
        view={view}
        onChangeView={setView}
        place={place}
        onPlaceChange={setPlace}
      />
      {/* The topbar wraps the location onto a second row below `sm`. */}
      <main className="pt-32 pb-24 sm:pt-20">
        <div className="container">
          {view === "lists" ? (
            <ListsView
              lists={lists}
              onAddToList={onAddToList}
              onRequestNewList={onRequestNewList}
              onRequestRemove={(row, list) =>
                setRemoveItemTarget({ row, list })
              }
              onRequestRename={(id) => setEditListId(id)}
              onRequestRecolor={(id) => setEditListId(id)}
              onRequestDelete={(id) => setDeleteListId(id)}
              onRemoveExpired={onRemoveExpired}
            />
          ) : (
            <Wizard
              flyers={flyers}
              onToggleRetailer={onToggleRetailer}
              place={place}
              products={products}
              onProductsChange={setProducts}
              results={results}
              lists={lists}
              onAddToList={onAddToList}
              onRequestNewList={onRequestNewList}
              onRequestRemoveItem={(row, list) =>
                setRemoveItemTarget({ row, list })
              }
            />
          )}
        </div>
      </main>

      <Footer />

      <Bottombar
        view={view}
        presets={presets}
        activeId={activeId}
        onSelectPreset={onSelectPreset}
        onRequestRename={(id) => setRenameTarget(id)}
        onRequestDuplicate={onRequestDuplicate}
        onRequestDelete={(id) => setDeleteTarget(id)}
        onRequestCreate={onRequestCreate}
        loading={loading}
        onRun={onRun}
        dirty={!!active && dirty}
        onUpdatePreset={onUpdateActive}
        onResetPreset={onResetToActive}
      />

      <PresetNameDialog
        open={createOpen}
        onOpenChange={setCreateOpen}
        title="Nuovo preset"
        description="Scegli un nome e da quale configurazione partire."
        submitLabel="Crea"
        initialName={createInitialName}
        initialSourceId={createInitialSource}
        sources={presets}
        onSubmit={onCreatePreset}
      />

      <PresetNameDialog
        open={renameTarget !== null}
        onOpenChange={(o) => !o && setRenameTarget(null)}
        title="Rinomina preset"
        initialName={renameTargetPreset?.name ?? ""}
        submitLabel="Salva"
        onSubmit={(name) => {
          if (renameTarget) onRenamePreset(renameTarget, name);
        }}
      />

      <PresetDeleteDialog
        open={deleteTarget !== null}
        onOpenChange={(o) => !o && setDeleteTarget(null)}
        presetName={deleteTargetPreset?.name ?? ""}
        onConfirm={() => {
          if (deleteTarget) onDeletePreset(deleteTarget);
        }}
      />

      <ListEditDialog
        open={newListOpen}
        onOpenChange={(o) => {
          setNewListOpen(o);
          if (!o) setPendingItem(null);
        }}
        title="Nuova lista"
        submitLabel="Crea"
        onSubmit={onSubmitNewList}
      />

      <ListEditDialog
        open={editListId !== null}
        onOpenChange={(o) => !o && setEditListId(null)}
        title="Modifica lista"
        submitLabel="Salva"
        initialName={editListTarget?.name ?? ""}
        initialColor={editListTarget?.color}
        onSubmit={onSubmitListEdit}
      />

      <ConfirmDialog
        open={deleteListId !== null}
        onOpenChange={(o) => !o && setDeleteListId(null)}
        title="Eliminare la lista?"
        description={
          deleteListTarget && (
            <>
              Stai per eliminare <strong>«{deleteListTarget.name}»</strong> con{" "}
              {deleteListTarget.items.length} prodott
              {deleteListTarget.items.length === 1 ? "o" : "i"}. L'azione non
              può essere annullata.
            </>
          )
        }
        confirmLabel="Elimina"
        destructive
        onConfirm={onConfirmDeleteList}
      />

      <ConfirmDialog
        open={removeItemTarget !== null}
        onOpenChange={(o) => !o && setRemoveItemTarget(null)}
        title="Rimuovere il prodotto?"
        description={
          removeItemTarget && (
            <>
              Rimuovere <strong>«{removeItemTarget.row.productName}»</strong> da{" "}
              <strong>«{removeItemTarget.list.name}»</strong>?
            </>
          )
        }
        confirmLabel="Rimuovi"
        destructive
        onConfirm={onConfirmRemoveItem}
      />
    </>
  );
};

export default App;
