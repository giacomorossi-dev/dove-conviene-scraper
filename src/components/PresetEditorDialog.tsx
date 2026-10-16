// Create, duplicate or edit a preset in three steps: name, retailers,
// products. Creating goes step by step; editing can jump to any step and
// save at any time.
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isNameTaken, type Preset, type PresetDraft } from "@/lib/presets";
import type { CatalogState } from "@/lib/useCatalog";
import { cn } from "@/lib/utils";
import ConfirmDialog from "./ConfirmDialog";
import ProductsChipsInput from "./ProductsChipsInput";
import RetailerSelect from "./RetailerSelect";

export type EditorMode = "create" | "duplicate" | "edit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EditorMode;
  /** The edited preset, which may keep its own name. */
  editingId?: string;
  initial: PresetDraft;
  presets: Preset[];
  catalog: CatalogState;
  onSave: (draft: PresetDraft) => void;
}

const STEPS = ["Nome", "Insegne", "Prodotti"];
const TITLES: Record<EditorMode, string> = {
  create: "Nuovo preset",
  duplicate: "Duplica preset",
  edit: "Modifica preset",
};

const sameDraft = (a: PresetDraft, b: PresetDraft): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const PresetEditorDialog = ({
  open,
  onOpenChange,
  mode,
  editingId,
  initial,
  presets,
  catalog,
  onSave,
}: Props) => {
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(0);
  const [showNameError, setShowNameError] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  /** A product typed in step 3 and not added yet. */
  const [pending, setPending] = useState("");

  // Start over from `initial`, on the first step, each time it opens.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(initial);
      setStep(0);
      setShowNameError(false);
      setPending("");
    }
  }

  const free = mode === "edit";
  const last = step === STEPS.length - 1;
  const nameError = !draft.name.trim()
    ? "Scrivi un nome."
    : isNameTaken(presets, draft.name, editingId)
      ? "Esiste già un preset con questo nome."
      : null;

  const save = () => {
    if (nameError) {
      setStep(0);
      setShowNameError(true);
      return;
    }
    onSave({ ...draft, name: draft.name.trim() });
    onOpenChange(false);
  };

  const next = () => {
    if (step === 0 && nameError) {
      setShowNameError(true);
      return;
    }
    setStep(step + 1);
  };

  // Esc, the X and a click outside all land here: ask before losing changes.
  const requestClose = () => {
    if (sameDraft(draft, initial) && !pending.trim()) onOpenChange(false);
    else setConfirmDiscard(true);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{TITLES[mode]}</DialogTitle>
          </DialogHeader>

          <ol className="flex flex-wrap items-center gap-1 text-sm">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden className="h-px w-4 bg-border" />}
                <button
                  type="button"
                  disabled={!free}
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-1.5 py-1 disabled:cursor-default",
                    i === step
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                    free && i !== step && "hover:bg-accent"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border text-xs",
                      i === step &&
                        "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    {!free && i < step ? <Check className="size-3" /> : i + 1}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {step === 0 && (
              <div className="grid gap-2">
                <Label htmlFor="preset-name">Nome</Label>
                <Input
                  id="preset-name"
                  autoFocus
                  value={draft.name}
                  aria-invalid={showNameError && !!nameError}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (free) save();
                    else next();
                  }}
                />
                {showNameError && nameError && (
                  <p className="text-sm text-destructive">{nameError}</p>
                )}
              </div>
            )}
            {step === 1 && (
              <RetailerSelect
                value={draft.retailers}
                onChange={(retailers) => setDraft({ ...draft, retailers })}
                catalog={catalog}
              />
            )}
            {step === 2 && (
              <div className="grid gap-2">
                <Label>Prodotti</Label>
                <ProductsChipsInput
                  value={draft.products}
                  onChange={(products) => setDraft({ ...draft, products })}
                  onPendingChange={setPending}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            {!free && step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Indietro
              </Button>
            )}
            {free || last ? (
              <Button onClick={save}>Salva</Button>
            ) : (
              <Button onClick={next}>Avanti</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Scartare le modifiche?"
        description="Le modifiche a questo preset andranno perse."
        confirmLabel="Scarta"
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </>
  );
};

export default PresetEditorDialog;
