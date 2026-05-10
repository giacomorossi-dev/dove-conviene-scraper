import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import PresetSelect from "./PresetSelect";
import type { Preset } from "@/lib/presets";
import type { View } from "./Topbar";

interface Props {
  view: View;
  presets: Preset[];
  activeId: string | null;
  onSelectPreset: (id: string) => void;
  onRequestRename: (id: string) => void;
  onRequestDuplicate: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onRequestCreate: () => void;
  loading: boolean;
  onRun: () => void;
  dirty: boolean;
  onUpdatePreset: () => void;
  onResetPreset: () => void;
}

const Bottombar = ({
  view,
  presets,
  activeId,
  onSelectPreset,
  onRequestRename,
  onRequestDuplicate,
  onRequestDelete,
  onRequestCreate,
  loading,
  onRun,
  dirty,
  onUpdatePreset,
  onResetPreset,
}: Props) => (
  <div
    className="fixed bottom-0 inset-x-0 z-40 bg-background border-t"
    style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
  >
    <div className="container flex items-center gap-2 py-3">
      <PresetSelect
        presets={presets}
        activeId={activeId}
        onSelect={onSelectPreset}
        onRequestRename={onRequestRename}
        onRequestDuplicate={onRequestDuplicate}
        onRequestDelete={onRequestDelete}
      />
      <Button
        type="button"
        variant="ghost"
        size="sm"
        onClick={onRequestCreate}
        className="text-xs text-muted-foreground"
      >
        <Plus className="w-3 h-3" />
        Nuovo
      </Button>

      {view === "main" && (
        <>
          <div className="flex-1" />
          {dirty && (
            <>
              <Button variant="outline" size="sm" onClick={onUpdatePreset}>
                Aggiorna preset
              </Button>
              <Button variant="ghost" size="sm" onClick={onResetPreset}>
                Reimposta
              </Button>
            </>
          )}
          <Button
            onClick={onRun}
            disabled={loading}
            className="flex items-center gap-2"
          >
            <span>Run</span>
            {loading && <Spinner />}
          </Button>
        </>
      )}
    </div>
  </div>
);

export default Bottombar;
