import { MapPin } from "lucide-react";
import Logo from "./Logo";
import CityAutocomplete from "./CityAutocomplete";
import { cn } from "@/lib/utils";

export type View = "main" | "lists";

interface Props {
  view: View;
  onChangeView: (v: View) => void;
  city: string;
  onCitySelect: (city: { name: string; slug: string }) => void;
  onCityChange: (raw: string) => void;
}

const Topbar = ({
  view,
  onChangeView,
  city,
  onCitySelect,
  onCityChange,
}: Props) => (
  <header className="fixed top-0 inset-x-0 z-40 bg-background border-b shadow-sm">
    <div className="container flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
      <Logo className="h-8 w-auto shrink-0" />
      <nav className="flex gap-1">
        <button
          type="button"
          onClick={() => onChangeView("main")}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm transition-colors",
            view === "main"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          Risultati
        </button>
        <button
          type="button"
          onClick={() => onChangeView("lists")}
          className={cn(
            "px-3 py-1.5 rounded-md text-sm transition-colors",
            view === "lists"
              ? "bg-accent text-accent-foreground font-medium"
              : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
          )}
        >
          Le mie liste
        </button>
      </nav>
      {/* Own row on mobile, top right from `sm` up. */}
      <div className="relative w-full sm:ml-auto sm:w-64">
        <MapPin className="pointer-events-none absolute left-2.5 top-1/2 z-10 size-4 -translate-y-1/2 text-muted-foreground" />
        <CityAutocomplete
          value={city}
          onSelect={onCitySelect}
          onChange={onCityChange}
          placeholder="Cerca una città…"
          aria-label="Località"
          inputClassName="pl-8"
        />
      </div>
    </div>
  </header>
);

export default Topbar;
