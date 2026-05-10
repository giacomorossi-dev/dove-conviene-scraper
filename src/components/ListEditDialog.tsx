import { useEffect, useState } from "react";
import { Check } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { LIST_COLORS, DEFAULT_LIST_COLOR } from "@/lib/lists";
import { cn } from "@/lib/utils";

interface Props {
  open: boolean;
  onOpenChange: (o: boolean) => void;
  title: string;
  initialName?: string;
  initialColor?: string;
  submitLabel: string;
  onSubmit: (name: string, color: string) => void;
}

const ListEditDialog = ({
  open,
  onOpenChange,
  title,
  initialName = "",
  initialColor = DEFAULT_LIST_COLOR,
  submitLabel,
  onSubmit,
}: Props) => {
  const [name, setName] = useState(initialName);
  const [color, setColor] = useState(initialColor);

  useEffect(() => {
    if (open) {
      setName(initialName);
      setColor(initialColor);
    }
  }, [open, initialName, initialColor]);

  const submit = () => {
    const trimmed = name.trim();
    if (!trimmed) return;
    onSubmit(trimmed, color);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-2">
            <Label htmlFor="list-name">Nome</Label>
            <Input
              id="list-name"
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
          <div className="space-y-2">
            <Label>Colore</Label>
            <div className="grid grid-cols-10 gap-1.5">
              {LIST_COLORS.map((c) => (
                <button
                  key={c}
                  type="button"
                  onClick={() => setColor(c)}
                  aria-label={`Colore ${c}`}
                  className={cn(
                    "w-6 h-6 rounded border-2 flex items-center justify-center transition",
                    c === color ? "border-foreground" : "border-transparent"
                  )}
                  style={{ backgroundColor: c }}
                >
                  {c === color && (
                    <Check className="w-3 h-3 text-white" strokeWidth={3} />
                  )}
                </button>
              ))}
            </div>
          </div>
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

export default ListEditDialog;
