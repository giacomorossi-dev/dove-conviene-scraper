import { Plus } from "lucide-react";
import doveConvieneLogo from "/dove-conviene.png";
import PresetSelect from "./PresetSelect";
import type { Preset } from "@/lib/presets";
import { cn } from "@/lib/utils";

export type View = "main" | "lists";

interface Props {
  presets: Preset[];
  activeId: string | null;
  view: View;
  onChangeView: (v: View) => void;
  onSelectPreset: (id: string) => void;
  onRequestRename: (id: string) => void;
  onRequestDuplicate: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onRequestCreate: () => void;
}

const Topbar = ({
  presets,
  activeId,
  view,
  onChangeView,
  onSelectPreset,
  onRequestRename,
  onRequestDuplicate,
  onRequestDelete,
  onRequestCreate,
}: Props) => (
  <header className="fixed top-0 inset-x-0 z-40 bg-background border-b shadow-sm">
    <div className="container flex items-start justify-between gap-4 py-3">
      <div className="flex items-center gap-6">
        <div className="max-w-50 shrink-0">
          <img src={doveConvieneLogo} alt="logo" />
        </div>
        <nav className="flex gap-1">
          <button
            type="button"
            onClick={() => onChangeView("main")}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              view === "main"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            Risultati
          </button>
          <button
            type="button"
            onClick={() => onChangeView("lists")}
            className={cn(
              "px-3 py-1.5 rounded-md text-sm transition-colors",
              view === "lists"
                ? "bg-accent text-accent-foreground font-medium"
                : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
            )}
          >
            Le mie liste
          </button>
        </nav>
      </div>
      <div className="flex flex-col items-end gap-1">
        <PresetSelect
          presets={presets}
          activeId={activeId}
          onSelect={onSelectPreset}
          onRequestRename={onRequestRename}
          onRequestDuplicate={onRequestDuplicate}
          onRequestDelete={onRequestDelete}
        />
        <button
          type="button"
          onClick={onRequestCreate}
          className="inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground hover:underline"
        >
          <Plus className="w-3 h-3" />
          Aggiungi nuovo
        </button>
      </div>
    </div>
  </header>
);

export default Topbar;
