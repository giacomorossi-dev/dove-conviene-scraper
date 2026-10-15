// The results page: the active preset, then what the search found.
import { useMemo } from "react";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { List, RowData } from "@/lib/lists";
import type { Preset } from "@/lib/presets";
import type { Flyer, Retailer } from "@shared/types";
import PresetSummary from "./PresetSummary";
import ResultsTable from "./ResultsTable";

interface Props {
  preset: Preset | null;
  bySlug: ReadonlyMap<string, Retailer>;
  results: Flyer[];
  lists: List[];
  onAddToList: (listId: string, row: RowData) => void;
  onRequestNewList: (row: RowData) => void;
  onRequestRemoveItem: (row: RowData, list: List) => void;
}

const ResultsView = ({
  preset,
  bySlug,
  results,
  lists,
  onAddToList,
  onRequestNewList,
  onRequestRemoveItem,
}: Props) => {
  const rows = useMemo<RowData[]>(
    () =>
      results.flatMap((flyer) =>
        (flyer.products ?? []).map((p) => ({
          productName: p.name,
          productImage: p.imageUrl,
          price: p.price,
          flyerName: flyer.name,
          flyerUrl: flyer.url ?? "",
          validUntil: flyer.validUntil ?? null,
        }))
      ),
    [results]
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
      </Empty>
    );

  return (
    <div className="space-y-4">
      <PresetSummary preset={preset} bySlug={bySlug} />
      <Card>
        <CardHeader>
          <CardTitle>Risultati</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultsTable
            rows={rows}
            lists={lists}
            onAddToList={onAddToList}
            onRequestNewList={onRequestNewList}
            onRequestRemove={onRequestRemoveItem}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ResultsView;
