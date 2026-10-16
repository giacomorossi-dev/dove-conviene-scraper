// The active preset on the results page, read-only.
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { countsLabel, type Preset } from "@/lib/presets";
import { knownRetailers } from "@/lib/retailers";
import type { Retailer } from "@shared/types";
import RetailerLogos from "./RetailerLogos";

interface Props {
  preset: Preset;
  bySlug: ReadonlyMap<string, Retailer>;
  /** False while the retailer list isn't loaded: names and logos unknown. */
  catalogReady: boolean;
  onEdit: () => void;
}

const PresetSummary = ({ preset, bySlug, catalogReady, onEdit }: Props) => {
  const retailers = knownRetailers(preset.retailers, bySlug);
  const retailerCount = catalogReady
    ? retailers.length
    : preset.retailers.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle>{preset.name}</CardTitle>
        <CardDescription>
          {countsLabel(retailerCount, preset.products.length)}
        </CardDescription>
        <CardAction>
          <Button variant="ghost" size="sm" onClick={onEdit}>
            <Pencil /> Modifica
          </Button>
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {retailers.length > 0 ? (
          <RetailerLogos retailers={retailers} max={8} />
        ) : (
          <p className="text-sm text-muted-foreground">
            {catalogReady
              ? "Nessuna insegna."
              : "Elenco delle insegne non ancora disponibile."}
          </p>
        )}
        {preset.products.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {preset.products.map((p, i) => (
              <Badge key={i} variant="secondary">
                {p.name}
                {p.maxPrice !== undefined && ` ≤ ${formatPrice(p.maxPrice)}`}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nessun prodotto.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default PresetSummary;
