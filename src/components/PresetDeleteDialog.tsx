import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  presetName: string;
  onConfirm: () => void;
}

const PresetDeleteDialog = ({ open, onOpenChange, presetName, onConfirm }: Props) => (
  <Dialog open={open} onOpenChange={onOpenChange}>
    <DialogContent className="sm:max-w-md">
      <DialogHeader>
        <DialogTitle>Eliminare il preset?</DialogTitle>
        <DialogDescription>
          Stai per eliminare <strong>«{presetName}»</strong>. L'azione non può
          essere annullata.
        </DialogDescription>
      </DialogHeader>
      <DialogFooter>
        <Button variant="outline" onClick={() => onOpenChange(false)}>
          Annulla
        </Button>
        <Button
          variant="destructive"
          onClick={() => {
            onConfirm();
            onOpenChange(false);
          }}
        >
          Elimina
        </Button>
      </DialogFooter>
    </DialogContent>
  </Dialog>
);

export default PresetDeleteDialog;
