import { useEffect, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { cn } from "@/lib/utils";
import type { Preset } from "@/lib/presets";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  initialName?: string;
  submitLabel: string;
  /** When provided, render a source-preset selector. Pass `null` for "current state". */
  sources?: Preset[];
  initialSourceId?: string | null;
  onSubmit: (name: string, sourceId?: string | null) => void;
}

const CURRENT = "__CURRENT__";

const PresetNameDialog = ({
  open,
  onOpenChange,
  title,
  description,
  initialName = "",
  submitLabel,
  sources,
  initialSourceId = null,
  onSubmit,
}: Props) => {
  const [name, setName] = useState(initialName);
  const [sourceId, setSourceId] = useState<string | null>(initialSourceId);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setSourceId(initialSourceId);
    }
  }, [open, initialName, initialSourceId]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, sources ? sourceId : undefined);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="preset-name">Nome</Label>
            <Input
              id="preset-name"
              autoFocus
              value={name}
              onInput={(e) => setName(e.currentTarget.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  submit();
                }
              }}
            />
          </div>
          {sources && (
            <div className="space-y-2">
              <Label htmlFor="preset-source">Parti da</Label>
              <select
                id="preset-source"
                value={sourceId ?? CURRENT}
                onChange={(e) =>
                  setSourceId(e.target.value === CURRENT ? null : e.target.value)
                }
                className={cn(
                  "flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-xs",
                  "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                )}
              >
                <option value={CURRENT}>Configurazione attuale</option>
                {sources.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Annulla
          </Button>
          <Button onClick={submit} disabled={!name.trim()}>
            {submitLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default PresetNameDialog;
