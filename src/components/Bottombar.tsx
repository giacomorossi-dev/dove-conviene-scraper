import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Preset } from "@/lib/presets";
import type { Retailer } from "@shared/types";
import PresetSelect from "./PresetSelect";

interface Props {
  presets: Preset[];
  activeId: string | null;
  bySlug: ReadonlyMap<string, Retailer>;
  onSelectPreset: (id: string) => void;
  running: boolean;
  /** Why Cerca is disabled; null when it can search. */
  blocker: string | null;
  onSearch: () => void;
  onCancel: () => void;
}

const Bottombar = ({
  presets,
  activeId,
  bySlug,
  onSelectPreset,
  running,
  blocker,
  onSearch,
  onCancel,
}: Props) => (
  <div
    className="fixed bottom-0 inset-x-0 z-40 bg-background border-t"
    style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
  >
    <div className="container flex items-center gap-2 py-3">
      {presets.length > 0 && (
        <PresetSelect
          presets={presets}
          activeId={activeId}
          bySlug={bySlug}
          onSelect={onSelectPreset}
        />
      )}
      <div className="flex-1" />
      {blocker && !running && (
        <span className="min-w-0 truncate text-xs text-muted-foreground">
          {blocker}
        </span>
      )}
      {running ? (
        <>
          {/* Beside the button: inside it, its "Loading" label would become
              part of the button's name. */}
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
    </div>
  </div>
);

export default Bottombar;
