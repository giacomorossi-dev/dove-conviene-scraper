import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { formatPrice } from "@/lib/format";
import { parseProduct } from "@/lib/products";
import { cn } from "@/lib/utils";
import type { ProductQuery } from "@shared/types";

interface Props {
  value: ProductQuery[];
  onChange: (next: ProductQuery[]) => void;
  /** The text typed and not added yet: it counts as a change. */
  onPendingChange?: (text: string) => void;
  placeholder?: string;
  className?: string;
}

const ProductsChipsInput = ({
  value,
  onChange,
  onPendingChange,
  placeholder,
  className,
}: Props) => {
  const [input, setInput] = useState("");

  const type = (text: string) => {
    setInput(text);
    onPendingChange?.(text);
  };

  /** Adds what's typed: on Enter, and when leaving the field (e.g. Salva). */
  const commit = () => {
    const parsed = parseProduct(input);
    if (!parsed) return;
    onChange([...value, parsed]);
    type("");
  };

  const remove = (i: number) => {
    onChange(value.filter((_, idx) => idx !== i));
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      e.stopPropagation();
      commit();
    }
  };

  return (
    <div className={cn("space-y-2", className)}>
      {value.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {value.map((p, i) => (
            <span
              key={i}
              className="inline-flex items-center gap-1.5 pl-3 pr-1 py-1 rounded-full bg-secondary text-secondary-foreground text-sm"
            >
              <span className="font-medium">{p.name}</span>
              {p.maxPrice !== undefined && (
                <span className="text-xs text-muted-foreground">
                  ≤ {formatPrice(p.maxPrice)}
                </span>
              )}
              <button
                type="button"
                onClick={() => remove(i)}
                aria-label={`rimuovi ${p.name}`}
                className="ml-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full hover:bg-background/60"
              >
                <X className="w-3 h-3" />
              </button>
            </span>
          ))}
        </div>
      )}
      <Input
        value={input}
        onChange={(e) => type(e.target.value)}
        onBlur={commit}
        onKeyDown={onKeyDown}
        placeholder={
          placeholder ?? "es. latte (Invio) — burro,4 per max € 4 (Invio)"
        }
      />
    </div>
  );
};

export default ProductsChipsInput;
