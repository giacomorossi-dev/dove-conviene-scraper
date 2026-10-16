// The active preset on the results page, with what you do with it: pick
// another, edit it, search it.
import { Pencil } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Spinner } from "@/components/ui/spinner";
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
import PresetSelect from "./PresetSelect";
import RetailerLogos from "./RetailerLogos";

interface Props {
  preset: Preset;
  presets: Preset[];
  bySlug: ReadonlyMap<string, Retailer>;
  /** False while the retailer list isn't loaded: names and logos unknown. */
  catalogReady: boolean;
  onSelect: (id: string) => void;
  onEdit: () => void;
  running: boolean;
  /** Why Cerca is disabled; null when the preset can be searched. */
  blocker: string | null;
  onSearch: () => void;
  onCancel: () => void;
}

const PresetSummary = ({
  preset,
  presets,
  bySlug,
  catalogReady,
  onSelect,
  onEdit,
  running,
  blocker,
  onSearch,
  onCancel,
}: Props) => {
  const retailers = knownRetailers(preset.retailers, bySlug);
  const retailerCount = catalogReady
    ? retailers.length
    : preset.retailers.length;
  return (
    <Card>
      <CardHeader>
        <CardTitle className="min-w-0">
          <PresetSelect
            presets={presets}
            activeId={preset.id}
            bySlug={bySlug}
            onSelect={onSelect}
          />
        </CardTitle>
        <CardDescription>
          {countsLabel(retailerCount, preset.products.length)}
        </CardDescription>
        <CardAction className="flex items-center gap-2">
          <Button
            variant="ghost"
            size="sm"
            onClick={onEdit}
            aria-label="Modifica il preset"
          >
            <Pencil />
            <span className="hidden sm:inline">Modifica</span>
          </Button>
          {running ? (
            <>
              {/* Beside the button: inside it, its "Loading" label would
                  become part of the button's name. */}
              <Spinner />
              <Button variant="outline" onClick={onCancel}>
                Annulla
              </Button>
            </>
          ) : (
            <Button onClick={onSearch} disabled={blocker !== null}>
              Cerca
            </Button>
          )}
        </CardAction>
      </CardHeader>
      <CardContent className="grid gap-3">
        {blocker && !running && (
          <p className="text-sm text-muted-foreground">{blocker}</p>
        )}
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
