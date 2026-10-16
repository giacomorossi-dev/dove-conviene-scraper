// The results page: the active preset, then what the search found and how
// the search is going.
import { useMemo } from "react";
import { ListChecks, Plus, TriangleAlert } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { Spinner } from "@/components/ui/spinner";
import type { Preset } from "@/lib/presets";
import { progress, type SearchState } from "@/lib/search";
import type { RowData } from "@/lib/shopping";
import type { Retailer } from "@shared/types";
import PresetSummary from "./PresetSummary";
import ResultsTable from "./ResultsTable";

interface Props {
  preset: Preset | null;
  presets: Preset[];
  bySlug: ReadonlyMap<string, Retailer>;
  catalogReady: boolean;
  search: SearchState & { id: number };
  isInCart: (row: RowData) => boolean;
  onToggleCart: (row: RowData) => void;
  onRequestCreate: () => void;
  onRequestEdit: () => void;
  onSelectPreset: (id: string) => void;
  /** Why the preset can't be searched; null when it can. */
  searchBlocker: string | null;
  onSearch: () => void;
  onCancel: () => void;
}

const flyers = (n: number) => `${n} volantin${n === 1 ? "o" : "i"}`;
const read = (n: number) => `${flyers(n)} lett${n === 1 ? "o" : "i"}`;

/** One line on how the search went: running, empty, cancelled, failed. */
function SearchStatus({ search, rows }: { search: SearchState; rows: number }) {
  const { phase, flyersRead } = search;
  if (phase === "idle")
    return (
      <p className="text-sm text-muted-foreground">
        Premi Cerca per leggere i volantini delle insegne del preset.
      </p>
    );
  if (phase === "running") {
    const { done, total } = progress(search);
    if (total === null)
      return (
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Ricerca in corso: cerco i volantini vicini…
        </p>
      );
    return (
      <div className="grid gap-1.5">
        <p className="flex items-center gap-2 text-sm text-muted-foreground">
          <Spinner /> Ricerca in corso… {done} di {flyers(total)}
        </p>
        <div
          role="progressbar"
          aria-label="Volantini letti"
          aria-valuemin={0}
          aria-valuemax={total}
          aria-valuenow={done}
          className="h-1.5 overflow-hidden rounded-full bg-muted"
        >
          <div
            className="h-full bg-primary transition-[width] duration-300"
            style={{ width: `${total ? (100 * done) / total : 0}%` }}
          />
        </div>
      </div>
    );
  }
  if (phase === "failed")
    return (
      <p className="flex items-center gap-2 text-sm text-destructive">
        <TriangleAlert className="size-4 shrink-0" />
        La ricerca non è riuscita: {search.errors.at(-1)}
      </p>
    );
  if (phase === "cancelled")
    return (
      <p className="text-sm text-muted-foreground">
        Ricerca annullata: {read(flyersRead)}.
      </p>
    );
  return (
    <p className="text-sm text-muted-foreground">
      {rows > 0
        ? `${read(flyersRead)}.`
        : flyersRead > 0
          ? `Nessun prodotto trovato in ${flyers(flyersRead)}.`
          : "Nessun volantino di queste insegne vicino alla località scelta."}
    </p>
  );
}

/** Flyers dc didn't give and other problems: the search went on anyway. */
function SearchWarnings({ search }: { search: SearchState }) {
  const { unread, errors, phase } = search;
  // A failed search already shows its last error.
  const shown = phase === "failed" ? errors.slice(0, -1) : errors;
  if (unread.length === 0 && shown.length === 0) return null;
  const one = unread.length === 1;
  return (
    <div className="grid gap-1 rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
      {unread.length > 0 && (
        <p>
          {unread.length} {one ? "volantino non letto" : "volantini non letti"}{" "}
          (dc non {one ? "l'ha dato" : "li ha dati"}): {unread.join(", ")}.
        </p>
      )}
      {shown.map((e, i) => (
        <p key={i}>{e}</p>
      ))}
    </div>
  );
}

const ResultsView = ({
  preset,
  presets,
  bySlug,
  catalogReady,
  search,
  isInCart,
  onToggleCart,
  onRequestCreate,
  onRequestEdit,
  onSelectPreset,
  searchBlocker,
  onSearch,
  onCancel,
}: Props) => {
  const rows = useMemo<RowData[]>(
    () =>
      search.results.flatMap((flyer) =>
        (flyer.products ?? []).map((p) => ({
          productName: p.name,
          productImage: p.imageUrl,
          price: p.price,
          flyerName: flyer.name,
          flyerUrl: flyer.url ?? "",
          validUntil: flyer.validUntil ?? null,
          ...(flyer.slug && { retailerSlug: flyer.slug }),
        }))
      ),
    [search.results]
  );

  if (!preset)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>Nessun preset</EmptyTitle>
          <EmptyDescription>
            Crea un preset con le insegne e i prodotti da cercare.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onRequestCreate}>
            <Plus /> Crea preset
          </Button>
        </EmptyContent>
      </Empty>
    );

  return (
    <div className="space-y-4">
      <PresetSummary
        preset={preset}
        presets={presets}
        bySlug={bySlug}
        catalogReady={catalogReady}
        onSelect={onSelectPreset}
        onEdit={onRequestEdit}
        running={search.phase === "running"}
        blocker={searchBlocker}
        onSearch={onSearch}
        onCancel={onCancel}
      />
      <Card>
        <CardHeader>
          <CardTitle>Risultati</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3">
          <div aria-live="polite">
            <SearchStatus search={search} rows={rows.length} />
          </div>
          <SearchWarnings search={search} />
          {/* A new search starts from fresh filters. */}
          <ResultsTable
            key={search.id}
            rows={rows}
            isInCart={isInCart}
            onToggleCart={onToggleCart}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ResultsView;
