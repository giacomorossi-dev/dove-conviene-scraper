import { useEffect, useState } from "react";
import type {
  Flyer as FlyerI,
  Place,
  ScrapeMessage,
  ScrapeRequest,
} from "@shared/types";
import ResultsView from "./components/ResultsView";
import ListsView from "./components/ListsView";
import Topbar, { type View } from "./components/Topbar";
import Bottombar from "./components/Bottombar";
import Footer from "./components/Footer";
import ListEditDialog from "./components/ListEditDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import { loadLegacyActivePlace } from "./lib/presets";
import { usePresets } from "./lib/usePresets";
import { useCatalog } from "./lib/useCatalog";
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
import { DEFAULT_PLACE, loadPlace, savePlace } from "./lib/places";
import { knownRetailers, toSelection } from "./lib/retailers";

const App = () => {
  const catalog = useCatalog();
  const { presets, active, activeId, setActiveId } = usePresets(
    catalog.retailers
  );
  const [place, setPlace] = useState<Place>(
    () => loadPlace() ?? loadLegacyActivePlace() ?? DEFAULT_PLACE
  );
  const [results, setResults] = useState<FlyerI[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("main");

  const [lists, setLists] = useState<List[]>(() => loadLists());
  const [pendingItem, setPendingItem] = useState<RowData | null>(null);
  const [newListOpen, setNewListOpen] = useState(false);
  const [editListId, setEditListId] = useState<string | null>(null);
  const [deleteListId, setDeleteListId] = useState<string | null>(null);
  const [removeItemTarget, setRemoveItemTarget] = useState<{
    row: RowData;
    list: List;
  } | null>(null);

  const editListTarget = lists.find((l) => l.id === editListId) ?? null;
  const deleteListTarget = lists.find((l) => l.id === deleteListId) ?? null;

  useEffect(() => savePlace(place), [place]);
  useEffect(() => {
    saveLists(lists);
  }, [lists]);

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
            <ResultsView
              preset={active}
              bySlug={catalog.bySlug}
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
