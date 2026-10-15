import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { byName, countsLabel, type Preset } from "@/lib/presets";
import { knownRetailers } from "@/lib/retailers";
import type { Retailer } from "@shared/types";

interface Props {
  presets: Preset[];
  activeId: string | null;
  bySlug: ReadonlyMap<string, Retailer>;
  onSelect: (id: string) => void;
}

const PresetSelect = ({ presets, activeId, bySlug, onSelect }: Props) => {
  const [open, setOpen] = useState(false);
  const active = presets.find((p) => p.id === activeId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="min-w-0 max-w-64 flex-1 justify-between font-normal sm:min-w-56 sm:flex-none"
          />
        }
      >
        <span className="truncate">{active?.name ?? "Scegli un preset"}</span>
        <ChevronDown className="w-4 h-4 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <div className="max-h-80 overflow-auto">
          {byName(presets).map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                "w-full rounded-sm px-2 py-2 text-left hover:bg-accent",
                p.id === activeId && "bg-accent/60"
              )}
              onClick={() => {
                onSelect(p.id);
                setOpen(false);
              }}
            >
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {countsLabel(
                  knownRetailers(p.retailers, bySlug).length,
                  p.products.length
                )}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PresetSelect;
