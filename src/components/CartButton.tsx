// Adds a result to the shopping list, or takes it out.
import { ShoppingCart } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface Props {
  inList: boolean;
  onToggle: () => void;
}

const CartButton = ({ inList, onToggle }: Props) => (
  <Button
    type="button"
    variant="ghost"
    size="icon-sm"
    aria-pressed={inList}
    aria-label={
      inList
        ? "Togli dalla lista della spesa"
        : "Aggiungi alla lista della spesa"
    }
    onClick={onToggle}
    className={cn(inList ? "text-primary" : "text-muted-foreground")}
  >
    <ShoppingCart fill={inList ? "currentColor" : "none"} />
  </Button>
);

export default CartButton;
