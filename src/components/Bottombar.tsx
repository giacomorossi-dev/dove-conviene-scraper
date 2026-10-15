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
  loading: boolean;
  canSearch: boolean;
  onSearch: () => void;
}

const Bottombar = ({
  presets,
  activeId,
  bySlug,
  onSelectPreset,
  loading,
  canSearch,
  onSearch,
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
      <Button onClick={onSearch} disabled={!canSearch || loading}>
        <span>Cerca</span>
        {loading && <Spinner />}
      </Button>
    </div>
  </div>
);

export default Bottombar;
