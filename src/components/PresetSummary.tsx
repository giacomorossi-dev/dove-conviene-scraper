// The active preset on the results page, read-only.
import { Badge } from "@/components/ui/badge";
import {
  Card,
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
}

const PresetSummary = ({ preset, bySlug }: Props) => {
  const retailers = knownRetailers(preset.retailers, bySlug);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{preset.name}</CardTitle>
        <CardDescription>
          {countsLabel(retailers.length, preset.products.length)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {retailers.length > 0 ? (
          <RetailerLogos retailers={retailers} max={8} />
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna insegna.</p>
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
