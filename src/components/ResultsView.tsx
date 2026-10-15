// The results page: the active preset, then what the search found.
import { useMemo } from "react";
import { ListChecks, Plus } from "lucide-react";
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
import type { RowData } from "@/lib/shopping";
import type { Preset } from "@/lib/presets";
import type { Flyer, Retailer } from "@shared/types";
import PresetSummary from "./PresetSummary";
import ResultsTable from "./ResultsTable";

interface Props {
  preset: Preset | null;
  bySlug: ReadonlyMap<string, Retailer>;
  results: Flyer[];
  isInCart: (row: RowData) => boolean;
  onToggleCart: (row: RowData) => void;
  onRequestCreate: () => void;
  onRequestEdit: () => void;
}

const ResultsView = ({
  preset,
  bySlug,
  results,
  isInCart,
  onToggleCart,
  onRequestCreate,
  onRequestEdit,
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
          ...(flyer.slug && { retailerSlug: flyer.slug }),
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
        <EmptyContent>
          <Button onClick={onRequestCreate}>
            <Plus /> Crea preset
          </Button>
        </EmptyContent>
      </Empty>
    );

  return (
    <div className="space-y-4">
      <PresetSummary preset={preset} bySlug={bySlug} onEdit={onRequestEdit} />
      <Card>
        <CardHeader>
          <CardTitle>Risultati</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultsTable
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
