// Multi-select of retailers from the local national list, filterable by
// name and category. Reusable: it only knows the selected slugs.
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { RefreshCw } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { filterRetailers } from "@/lib/retailerFilter";
import { retailerInitials } from "@/lib/retailers";
import type { CatalogState } from "@/lib/useCatalog";
import { CATEGORIES, categorySlug } from "@shared/categories";
import type { BuildProgress, CatalogStatus } from "@shared/types";

interface Props {
  value: string[];
  onChange: (slugs: string[]) => void;
  catalog: CatalogState;
}

/** Base UI's Select shows the label of the item matching the value. */
const CATEGORY_ITEMS = [
  { label: "Tutte le categorie", value: null },
  ...CATEGORIES.map((c) => ({ label: c.name, value: categorySlug(c) })),
];

/**
 * Rows drawn at a time: all 937 at once froze phone-class CPUs and
 * requested every logo. More are drawn as the list scrolls.
 */
const PAGE = 50;

const PHASES: Record<BuildProgress["phase"], string> = {
  sitemaps: "Elenco insegne",
  pages: "Pagine insegne",
  kinds: "Negozi o marchi",
};

function BuildBar({ progress }: { progress: BuildProgress | null }) {
  const pct = progress?.total ? (100 * progress.done) / progress.total : 0;
  return (
    <div className="grid gap-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {progress
          ? `${PHASES[progress.phase]}: ${progress.done} di ${progress.total}`
          : "Avvio…"}
      </p>
    </div>
  );
}

/** "937 insegne, aggiornate il 14/10/2026 · Aggiorna", or the update's progress. */
function CatalogInfo({
  status,
  onUpdate,
}: {
  status: CatalogStatus;
  onUpdate: () => void;
}) {
  if (status.building)
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Spinner /> Aggiornamento insegne
        {status.progress && ` ${status.progress.done}/${status.progress.total}`}
      </span>
    );
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      {status.updatedAt &&
        `${status.count} insegne, aggiornate il ${new Date(
          status.updatedAt
        ).toLocaleDateString("it-IT")}`}
      <Button type="button" variant="ghost" size="sm" onClick={onUpdate}>
        <RefreshCw /> Aggiorna
      </Button>
    </span>
  );
}

const RetailerSelect = ({ value, onChange, catalog }: Props) => {
  const { status, retailers, bySlug, update } = catalog;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [onlySelected, setOnlySelected] = useState(false);

  // Typing stays responsive: the list follows a moment later.
  const deferredQuery = useDeferredValue(query);

  const selected = useMemo(() => new Set(value), [value]);
  // Slugs no longer in the list stay in `value` but are not counted or shown.
  const selectedCount = value.filter((s) => bySlug.has(s)).length;
  const showOnlySelected = onlySelected && selectedCount > 0;
  const visible = useMemo(
    () =>
      filterRetailers(
        retailers,
        { query: deferredQuery, category, onlySelected: showOnlySelected },
        selected
      ),
    [retailers, deferredQuery, category, showOnlySelected, selected]
  );

  // Back to the first rows whenever the filters change.
  const [limit, setLimit] = useState(PAGE);
  const filterKey = `${deferredQuery}|${category}|${showOnlySelected}`;
  const [prevFilterKey, setPrevFilterKey] = useState(filterKey);
  if (filterKey !== prevFilterKey) {
    setPrevFilterKey(filterKey);
    setLimit(PAGE);
  }
  const shown = visible.slice(0, limit);
  const hasMore = shown.length < visible.length;

  // Draw more rows when the end of the list scrolls into view.
  const listRef = useRef<HTMLDivElement>(null);
  const endRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const end = endRef.current;
    if (!hasMore || !end) return;
    const observer = new IntersectionObserver(
      ([entry]) => entry.isIntersecting && setLimit((l) => l + PAGE),
      { root: listRef.current, rootMargin: "200px" }
    );
    observer.observe(end);
    return () => observer.disconnect();
  }, [hasMore, limit]);

  const toggle = (slug: string, checked: boolean) =>
    onChange(checked ? [...value, slug] : value.filter((s) => s !== slug));

  if (!status)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Caricamento insegne…
      </p>
    );

  if (status.count === 0)
    return (
      <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
        {status.building ? (
          <>
            <p>
              <strong>Prima configurazione.</strong> Sto scaricando da dc
              l'elenco completo delle insegne. Va piano apposta per non
              sovraccaricare dc: circa 45 minuti. Se chiudi l'app riprende da
              dove era arrivata.
            </p>
            <BuildBar progress={status.progress} />
          </>
        ) : (
          <p className="flex flex-wrap items-center gap-2">
            Non sono riuscito a scaricare l'elenco delle insegne
            {status.error && `: ${status.error}`}.
            <Button size="sm" variant="outline" onClick={update}>
              <RefreshCw /> Riprova
            </Button>
          </p>
        )}
      </div>
    );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-40 flex-1"
          placeholder="Cerca un'insegna"
          aria-label="Cerca per nome"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          items={CATEGORY_ITEMS}
          value={category}
          onValueChange={(v) => setCategory(v)}
        >
          <SelectTrigger className="w-48" aria-label="Categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CATEGORY_ITEMS.map((c) => (
                <SelectItem key={c.value ?? "all"} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={showOnlySelected ? "secondary" : "outline"}
          disabled={selectedCount === 0}
          aria-pressed={showOnlySelected}
          onClick={() => setOnlySelected(!showOnlySelected)}
        >
          {selectedCount} selezionat{selectedCount === 1 ? "a" : "e"}
        </Button>
      </div>

      <ItemGroup
        ref={listRef}
        className="max-h-96 overflow-y-auto rounded-lg border"
      >
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nessuna insegna trovata.
          </p>
        ) : (
          shown.map((r) => (
            <Item
              key={r.slug}
              size="sm"
              render={<label />}
              className="cursor-pointer has-data-checked:bg-muted/60"
            >
              <ItemMedia>
                <Avatar>
                  <AvatarImage src={r.imageUrl} alt="" />
                  <AvatarFallback>{retailerInitials(r.name)}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{r.name}</ItemTitle>
                <Badge variant="secondary">{r.category.name}</Badge>
              </ItemContent>
              <ItemActions>
                <Checkbox
                  checked={selected.has(r.slug)}
                  onCheckedChange={(checked) => toggle(r.slug, checked)}
                />
              </ItemActions>
            </Item>
          ))
        )}
        {hasMore && <div ref={endRef} aria-hidden className="h-px shrink-0" />}
      </ItemGroup>

      <CatalogInfo status={status} onUpdate={update} />
    </div>
  );
};

export default RetailerSelect;
