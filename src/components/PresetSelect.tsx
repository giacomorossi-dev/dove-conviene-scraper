import { useState } from "react";
import { ChevronDown, Copy, MoreVertical, Pencil, Trash2 } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { Preset } from "@/lib/presets";

interface Props {
  presets: Preset[];
  activeId: string | null;
  onSelect: (id: string) => void;
  onRequestRename: (id: string) => void;
  onRequestDuplicate: (id: string) => void;
  onRequestDelete: (id: string) => void;
}

const PresetSelect = ({
  presets,
  activeId,
  onSelect,
  onRequestRename,
  onRequestDuplicate,
  onRequestDelete,
}: Props) => {
  const [open, setOpen] = useState(false);
  const active = presets.find((p) => p.id === activeId);
  const label = active?.name ?? "Nessun preset";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button
          variant="outline"
          className="min-w-56 justify-between font-normal"
        >
          <span className="truncate">{label}</span>
          <ChevronDown className="w-4 h-4 opacity-60" />
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-72 p-1">
        {presets.length === 0 ? (
          <div className="px-3 py-4 text-center text-sm text-muted-foreground">
            Nessun preset salvato.
          </div>
        ) : (
          <div className="max-h-80 overflow-auto">
            {presets.map((p) => (
              <div
                key={p.id}
                className={cn(
                  "flex items-start gap-2 rounded-sm px-2 py-2 hover:bg-accent",
                  p.id === activeId && "bg-accent/60"
                )}
              >
                <button
                  type="button"
                  className="flex-1 text-left"
                  onClick={() => {
                    onSelect(p.id);
                    setOpen(false);
                  }}
                >
                  <div className="font-medium text-sm truncate">{p.name}</div>
                  <div className="text-xs text-muted-foreground truncate">
                    {p.city || "—"} · {p.flyers.length} volantin
                    {p.flyers.length === 1 ? "o" : "i"} · {p.products.length} prodott
                    {p.products.length === 1 ? "o" : "i"}
                  </div>
                </button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <button
                      type="button"
                      aria-label="Azioni preset"
                      className="p-1 rounded hover:bg-background/80"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" sideOffset={4}>
                    <DropdownMenuItem
                      onSelect={() => {
                        setOpen(false);
                        onRequestRename(p.id);
                      }}
                    >
                      <Pencil className="w-4 h-4" />
                      Rinomina
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => {
                        setOpen(false);
                        onRequestDuplicate(p.id);
                      }}
                    >
                      <Copy className="w-4 h-4" />
                      Duplica
                    </DropdownMenuItem>
                    {!p.default && (
                      <DropdownMenuItem
                        variant="destructive"
                        onSelect={() => {
                          setOpen(false);
                          onRequestDelete(p.id);
                        }}
                      >
                        <Trash2 className="w-4 h-4" />
                        Elimina
                      </DropdownMenuItem>
                    )}
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            ))}
          </div>
        )}
      </PopoverContent>
    </Popover>
  );
};

export default PresetSelect;
