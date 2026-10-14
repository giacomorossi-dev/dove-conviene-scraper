// Step 1: pick retailers among dc's national list (kept locally, built on
// first start) plus the local chains with flyers near the chosen place.
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { isRetailer } from "@/lib/retailers";
import { useRetailers } from "@/lib/useRetailers";
import { CATEGORIES, categorySlug } from "@shared/categories";
import type {
  BuildProgress,
  CatalogStatus,
  Flyer as FlyerI,
  Place,
  Retailer,
} from "@shared/types";
import Flyer from "./Flyer";

interface Props {
  place: Place | null;
  flyers: FlyerI[];
  onToggleRetailer: (retailer: Retailer) => void;
}

/** Groceries are open by default; the other categories on demand. */
const OPEN_BY_DEFAULT = CATEGORIES.slice(0, 3).map(categorySlug);

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

/** "Aggiornate il 14/10/2026 · Aggiorna", or the progress of an update. */
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
      <Button variant="ghost" size="sm" onClick={onUpdate}>
        <RefreshCw /> Aggiorna
      </Button>
    </span>
  );
}

const RetailerPicker = ({ place, flyers, onToggleRetailer }: Props) => {
  const [open, setOpen] = useState<string[]>(OPEN_BY_DEFAULT);
  const { status, catalog, nearbyIn, update } = useRetailers(place, open);

  const nationalByCategory = useMemo(
    () => Map.groupBy(catalog, (r) => categorySlug(r.category)),
    [catalog]
  );
  const national = useMemo(
    () => new Set(catalog.map((r) => r.slug)),
    [catalog]
  );

  const firstBuild = !!status && status.count === 0;

  return (
    <Card>
      <CardHeader>
        <CardTitle>1 - Seleziona i volantini</CardTitle>
        <CardDescription>
          In grigio le insegne senza volantini vicino alla località scelta.
        </CardDescription>
        {status && !firstBuild && (
          <CardAction>
            <CatalogInfo status={status} onUpdate={update} />
          </CardAction>
        )}
      </CardHeader>
      <CardContent className="gap-4">
        {firstBuild && (
          <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
            {status.building ? (
              <>
                <p>
                  <strong>Prima configurazione.</strong> Sto scaricando da dc
                  l'elenco completo delle insegne. Va piano apposta per non
                  sovraccaricare dc: circa 45 minuti. Se chiudi l'app riprende
                  da dove era arrivata. Intanto qui sotto trovi le insegne con
                  volantini vicino a te.
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
        )}

        <Accordion
          className="space-y-2"
          onValueChange={setOpen}
          value={open}
          multiple
        >
          {CATEGORIES.map((category) => {
            const slug = categorySlug(category);
            const near = nearbyIn(slug);
            const nearSlugs = new Set(
              Array.isArray(near) ? near.map((r) => r.slug) : []
            );
            // National list plus the local chains near the place, those
            // with flyers nearby first.
            const items = [
              ...(nationalByCategory.get(slug) ?? []),
              ...(Array.isArray(near) ? near : []).filter(
                (r) => !national.has(r.slug)
              ),
            ].sort(
              (a, b) =>
                Number(nearSlugs.has(b.slug)) - Number(nearSlugs.has(a.slug)) ||
                a.name.localeCompare(b.name, "it")
            );
            const selected = flyers.filter(
              (f) => categorySlug(f.category) === slug
            ).length;
            const isOpen = open.includes(slug);
            return (
              <AccordionItem key={slug} value={slug}>
                <AccordionTrigger>
                  <span className="flex items-baseline gap-2">
                    <span>{category.name}</span>
                    <span className="text-xs text-muted-foreground">
                      {items.length > 0 && items.length}
                      {Array.isArray(near)
                        ? ` · ${near.length} in zona`
                        : isOpen && place && near !== "failed"
                          ? " · in zona …"
                          : ""}
                      {selected > 0 &&
                        ` · ${selected} selezionat${selected === 1 ? "o" : "i"}`}
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  {items.length === 0 ? (
                    <div className="flex items-center gap-2 text-sm text-muted-foreground">
                      {near === undefined || status?.building ? (
                        <>
                          <Spinner /> Caricamento insegne…
                        </>
                      ) : (
                        "Nessuna insegna con volantini in zona."
                      )}
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-4">
                      {items.map((retailer) => (
                        <Flyer
                          key={retailer.slug}
                          name={retailer.name}
                          imageUrl={retailer.imageUrl}
                          category={retailer.category}
                          selected={flyers.some((f) => isRetailer(f, retailer))}
                          // No flyers near the place: still selectable,
                          // but faded.
                          muted={
                            Array.isArray(near) && !nearSlugs.has(retailer.slug)
                          }
                          onClick={() => onToggleRetailer(retailer)}
                        />
                      ))}
                    </div>
                  )}
                </AccordionContent>
              </AccordionItem>
            );
          })}
        </Accordion>
      </CardContent>
    </Card>
  );
};

export default RetailerPicker;
