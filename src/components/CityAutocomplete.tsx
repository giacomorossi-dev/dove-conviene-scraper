import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from "react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";

interface City {
  name: string;
  slug: string;
  region: string;
}

interface Props {
  value: string;
  onSelect: (city: { name: string; slug: string }) => void;
  onChange?: (raw: string) => void;
  placeholder?: string;
  className?: string;
}

const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .trim();

const MAX_RESULTS = 10;

let citiesCache: City[] | null = null;

const CityAutocomplete = ({
  value,
  onSelect,
  onChange,
  placeholder,
  className,
}: Props) => {
  const [cities, setCities] = useState<City[]>(citiesCache ?? []);
  const [query, setQuery] = useState(value);
  const [open, setOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setQuery(value);
  }, [value]);

  useEffect(() => {
    if (citiesCache) return;
    fetch("/api/cities")
      .then((r) => (r.ok ? r.json() : Promise.reject(r.statusText)))
      .then((data: City[]) => {
        citiesCache = data;
        setCities(data);
      })
      .catch(() => {});
  }, []);

  const filtered = useMemo(() => {
    const q = normalize(query);
    if (!q) return [];
    return cities
      .filter((c) => normalize(c.name).includes(q))
      .slice(0, MAX_RESULTS);
  }, [cities, query]);

  useEffect(() => {
    const onClickOutside = (e: MouseEvent) => {
      if (!containerRef.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onClickOutside);
    return () => document.removeEventListener("mousedown", onClickOutside);
  }, []);

  const handleSelect = (city: City) => {
    onSelect({ name: city.name, slug: city.slug });
    setQuery(city.name);
    setOpen(false);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "ArrowDown") {
      if (!open) {
        setOpen(true);
        return;
      }
      e.preventDefault();
      if (filtered.length === 0) return;
      setHighlightedIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      if (filtered.length === 0) return;
      e.preventDefault();
      setHighlightedIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter") {
      if (!open || filtered.length === 0) return;
      e.preventDefault();
      const c = filtered[highlightedIndex];
      if (c) handleSelect(c);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  };

  return (
    <div ref={containerRef} className={cn("relative", className)}>
      <Input
        value={query}
        onInput={(e) => {
          const v = e.currentTarget.value;
          setQuery(v);
          setHighlightedIndex(0);
          setOpen(true);
          onChange?.(v);
        }}
        onFocus={() => setOpen(true)}
        onKeyDown={handleKeyDown}
        placeholder={placeholder}
        autoComplete="off"
      />
      {open && filtered.length > 0 && (
        <div className="absolute left-0 right-0 z-50 mt-1 max-h-72 overflow-auto rounded-md border bg-popover text-popover-foreground shadow-md">
          {filtered.map((c, i) => (
            <button
              key={`${c.slug}-${i}`}
              type="button"
              className={cn(
                "flex w-full items-center justify-between px-3 py-2 text-left text-sm",
                i === highlightedIndex && "bg-accent text-accent-foreground"
              )}
              onMouseDown={(e) => {
                e.preventDefault();
                handleSelect(c);
              }}
              onMouseEnter={() => setHighlightedIndex(i)}
            >
              <span>{c.name}</span>
              <span className="text-xs text-muted-foreground">{c.region}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default CityAutocomplete;
