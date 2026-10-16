// dc-style location picker: "Sei qui: Rimini - 47921" in the topbar opens a
// panel under it with town / postal code suggestions and "Trovami".
import {
  useEffect,
  useId,
  useState,
  type KeyboardEvent,
  type RefObject,
} from "react";
import { ChevronDown, LocateFixed, MapPin, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { placeLabel } from "@/lib/places";
import { cn } from "@/lib/utils";
import type { Place, PlaceSuggestion } from "@shared/types";

interface Props {
  place: Place;
  onChange: (place: Place) => void;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** The "Sei qui" button: focus goes back to it when the panel closes. */
  triggerRef: RefObject<HTMLButtonElement | null>;
}

const MIN_QUERY = 2;

const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** The label with the typed text in bold and the rest muted, like dc. */
function Highlighted({ text, query }: { text: string; query: string }) {
  // Fold char by char, remembering where each folded char came from, so
  // "forli" highlights "Forlì".
  let folded = "";
  const from: number[] = [];
  for (let i = 0; i < text.length; i++)
    for (const c of fold(text[i])) {
      folded += c;
      from.push(i);
    }
  const q = fold(query);
  const at = q ? folded.indexOf(q) : -1;
  if (at < 0) return <span className="text-muted-foreground">{text}</span>;
  const start = from[at];
  const end = from[at + q.length - 1] + 1;
  return (
    <span className="text-muted-foreground">
      {text.slice(0, start)}
      <strong className="font-semibold text-foreground">
        {text.slice(start, end)}
      </strong>
      {text.slice(end)}
    </span>
  );
}

const LocationPicker = ({
  place,
  onChange,
  open,
  onOpenChange,
  triggerRef,
}: Props) => {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PlaceSuggestion[]>([]);
  /** The query `results` answer: older ones aren't shown while typing on. */
  const [resultsFor, setResultsFor] = useState("");
  const [highlighted, setHighlighted] = useState(0);
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState<string | null>(null);
  const panelId = useId();
  const listId = useId();

  const q = query.trim();
  const suggestions = q.length >= MIN_QUERY && resultsFor === q ? results : [];

  useEffect(() => {
    if (q.length < MIN_QUERY) return;
    const ctrl = new AbortController();
    const timer = setTimeout(() => {
      fetch(`/api/places?q=${encodeURIComponent(q)}`, { signal: ctrl.signal })
        .then((r) => (r.ok ? r.json() : []))
        .then((items: PlaceSuggestion[]) => {
          setResults(items);
          setResultsFor(q);
          setHighlighted(0);
        })
        .catch(() => {});
    }, 200);
    return () => {
      clearTimeout(timer);
      ctrl.abort();
    };
  }, [q]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: globalThis.KeyboardEvent) => {
      if (e.key !== "Escape") return;
      onOpenChange(false);
      triggerRef.current?.focus();
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onOpenChange, triggerRef]);

  const toggle = () => {
    if (!open) {
      setQuery("");
      setGeoError(null);
    }
    onOpenChange(!open);
  };

  const choose = ({ name, zip, lat, lng }: PlaceSuggestion | Place) => {
    onChange({ name, zip, lat, lng });
    onOpenChange(false);
    triggerRef.current?.focus();
  };

  const locate = () => {
    if (!navigator.geolocation) {
      setGeoError("Il browser non supporta la geolocalizzazione.");
      return;
    }
    setLocating(true);
    setGeoError(null);
    navigator.geolocation.getCurrentPosition(
      async ({ coords }) => {
        try {
          const res = await fetch(
            `/api/places/reverse?lat=${coords.latitude}&lng=${coords.longitude}`
          );
          if (!res.ok) throw new Error(res.statusText);
          choose((await res.json()) as Place);
        } catch {
          setGeoError("Non riesco a capire dove ti trovi.");
        } finally {
          setLocating(false);
        }
      },
      () => {
        setLocating(false);
        setGeoError("Posizione non disponibile: controlla i permessi.");
      },
      { timeout: 10_000, maximumAge: 300_000 }
    );
  };

  const onKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (suggestions.length === 0) return;
    if (e.key === "ArrowDown" || e.key === "ArrowUp") {
      e.preventDefault();
      const step = e.key === "ArrowDown" ? 1 : -1;
      setHighlighted(
        (i) => (i + step + suggestions.length) % suggestions.length
      );
    } else if (e.key === "Enter") {
      e.preventDefault();
      choose(suggestions[highlighted] ?? suggestions[0]);
    }
  };

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={toggle}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex min-w-0 items-center gap-1.5 rounded-md text-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
      >
        <span className="shrink-0 text-muted-foreground">Sei qui:</span>
        {/* Keeps "Sei qui: Rimini" readable as one phrase for screen readers. */}{" "}
        <span className="truncate font-semibold">{placeLabel(place)}</span>
        <ChevronDown
          className={cn(
            "size-4 shrink-0 text-primary transition-transform",
            open && "rotate-180"
          )}
        />
      </button>

      {open && (
        // Positioned against the fixed header, right under it.
        <div
          id={panelId}
          role="dialog"
          aria-label="Modifica la tua posizione"
          className="absolute inset-x-0 top-full border-b bg-background shadow-md"
        >
          <div className="container flex flex-col items-center gap-3 py-6">
            <h2 className="font-semibold">Modifica la tua posizione!</h2>
            <div className="relative w-full max-w-md">
              <Input
                autoFocus
                role="combobox"
                aria-label="Città o CAP"
                aria-autocomplete="list"
                aria-expanded={suggestions.length > 0}
                aria-controls={listId}
                aria-activedescendant={
                  suggestions.length > 0
                    ? `${listId}-${highlighted}`
                    : undefined
                }
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setHighlighted(0);
                }}
                onKeyDown={onKeyDown}
                placeholder={placeLabel(place)}
                autoComplete="off"
                className="pr-9"
              />
              {query && (
                <button
                  type="button"
                  aria-label="Cancella"
                  onClick={() => setQuery("")}
                  className="absolute right-2.5 top-1/2 grid size-5 -translate-y-1/2 place-items-center rounded-full bg-muted-foreground/60 text-background hover:bg-muted-foreground"
                >
                  <X className="size-3" strokeWidth={3} />
                </button>
              )}
              {suggestions.length > 0 && (
                <ul
                  id={listId}
                  role="listbox"
                  className="absolute inset-x-0 top-full z-10 mt-1 overflow-hidden rounded-md border bg-popover py-1 text-popover-foreground shadow-md"
                >
                  {suggestions.map((s, i) => (
                    <li
                      key={s.label}
                      id={`${listId}-${i}`}
                      role="option"
                      aria-selected={i === highlighted}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        choose(s);
                      }}
                      onMouseEnter={() => setHighlighted(i)}
                      className={cn(
                        "flex cursor-pointer items-start gap-2 px-3 py-2 text-sm",
                        i === highlighted && "bg-accent"
                      )}
                    >
                      <MapPin className="mt-0.5 size-4 shrink-0 text-muted-foreground" />
                      <Highlighted text={s.label} query={q} />
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <p className="flex items-center gap-1.5 text-sm text-muted-foreground">
              oppure
              <Button
                variant="link"
                size="sm"
                onClick={locate}
                disabled={locating}
                className="h-auto gap-1 p-0"
              >
                {locating ? <Spinner /> : <LocateFixed />}
                Trovami
              </Button>
            </p>
            {geoError && (
              <p role="alert" className="text-sm text-destructive">
                {geoError}
              </p>
            )}
          </div>
        </div>
      )}
    </>
  );
};

export default LocationPicker;
