// The flyers a search read, as a row of covers: untick one to hide its
// products from the results (for this search only).
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { flyerLabel } from "@/lib/shopping";
import { cn } from "@/lib/utils";
import type { Flyer } from "@shared/types";

interface Props {
  flyers: Flyer[];
  /** URLs of the flyers left out. */
  excluded: ReadonlySet<string>;
  onToggle: (url: string, included: boolean) => void;
  onAll: () => void;
}

const FlyerStrip = ({ flyers, excluded, onToggle, onAll }: Props) => {
  const chosen = flyers.filter((f) => !excluded.has(f.url ?? "")).length;
  const label = `Volantini (${chosen} di ${flyers.length})`;
  return (
    <div role="group" aria-label={label} className="grid min-w-0 gap-2">
      <div className="flex items-center justify-between gap-2">
        <p className="text-sm font-medium">{label}</p>
        <Button
          variant="ghost"
          size="sm"
          onClick={onAll}
          disabled={excluded.size === 0}
        >
          Tutti
        </Button>
      </div>
      <ul className="flex gap-2 overflow-x-auto pb-1">
        {flyers.map((f) => {
          const url = f.url ?? "";
          const included = !excluded.has(url);
          const found = f.products?.length ?? 0;
          return (
            <li key={url} className="shrink-0">
              <label
                className={cn(
                  "flex w-32 cursor-pointer flex-col gap-1 rounded-lg border p-2 text-xs transition-opacity",
                  !included && "opacity-50"
                )}
              >
                {f.imageUrl ? (
                  <img
                    src={f.imageUrl}
                    alt=""
                    loading="lazy"
                    className="h-28 w-full rounded bg-muted object-cover object-top"
                  />
                ) : (
                  <div className="h-28 w-full rounded bg-muted" />
                )}
                <span className="flex items-center gap-1.5">
                  <Checkbox
                    checked={included}
                    aria-label={`Includi ${flyerLabel(f.name, f.title)}`}
                    onCheckedChange={(checked) => onToggle(url, checked)}
                  />
                  <span className="truncate font-medium">{f.name}</span>
                </span>
                {f.title && <span className="truncate">{f.title}</span>}
                {f.validity && (
                  <span className="truncate text-muted-foreground">
                    {f.validity}
                  </span>
                )}
                {f.distance && (
                  <span className="text-muted-foreground">{f.distance}</span>
                )}
                <span className="text-muted-foreground">
                  {found} prodott{found === 1 ? "o" : "i"}
                </span>
              </label>
            </li>
          );
        })}
      </ul>
    </div>
  );
};

export default FlyerStrip;
