import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

export interface ProductQuery {
  name: string;
  maxPrice?: number;
}

interface Props {
  value: ProductQuery[];
  onChange: (next: ProductQuery[]) => void;
  placeholder?: string;
  className?: string;
}

const formatPrice = (n: number): string =>
  `€ ${n.toFixed(2).replace(".", ",")}`;

const parseChip = (raw: string): ProductQuery | null => {
  const trimmed = raw.trim();
  if (!trimmed) return null;
  const idx = trimmed.indexOf(",");
  if (idx === -1) return { name: trimmed };

  const name = trimmed.slice(0, idx).trim();
  if (!name) return null;

  const priceRaw = trimmed
    .slice(idx + 1)
    .trim()
    .replace(",", ".");
  const maxPrice = Number(priceRaw);
  return Number.isFinite(maxPrice) && maxPrice > 0
    ? { name, maxPrice }
    : { name };
};

const ProductsChipsInput = ({
  value,
  onChange,
  placeholder,
  className,
}: Props) => {
  const [input, setInput] = useState("");

  const commit = () => {
    const parsed = parseChip(input);
    if (!parsed) return;
    onChange([...value, parsed]);
    setInput("");
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
        onInput={(e) => setInput(e.currentTarget.value)}
        onKeyDown={onKeyDown}
        placeholder={
          placeholder ?? "es. latte (Invio) — burro,4 per max € 4 (Invio)"
        }
      />
    </div>
  );
};

export default ProductsChipsInput;
