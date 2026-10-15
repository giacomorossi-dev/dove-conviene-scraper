import { useState } from "react";
import Logo from "./Logo";
import LocationPicker from "./LocationPicker";
import { cn } from "@/lib/utils";
import type { Place } from "@shared/types";

export type View = "main" | "presets" | "lists";

const TABS: { view: View; label: string }[] = [
  { view: "main", label: "Risultati" },
  { view: "presets", label: "Preset" },
  { view: "lists", label: "Le mie liste" },
];

interface Props {
  view: View;
  onChangeView: (v: View) => void;
  place: Place | null;
  onPlaceChange: (place: Place) => void;
}

const Topbar = ({ view, onChangeView, place, onPlaceChange }: Props) => {
  const [locationOpen, setLocationOpen] = useState(false);

  return (
    <>
      <header className="fixed top-0 inset-x-0 z-50 bg-background border-b shadow-sm">
        <div className="container flex flex-wrap items-center gap-x-6 gap-y-2 py-3">
          <Logo className="h-8 w-auto shrink-0" />
          <nav className="flex gap-1">
            {TABS.map((t) => (
              <button
                key={t.view}
                type="button"
                onClick={() => onChangeView(t.view)}
                aria-current={view === t.view ? "page" : undefined}
                className={cn(
                  "px-3 py-1.5 rounded-md text-sm transition-colors",
                  view === t.view
                    ? "bg-accent text-accent-foreground font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-accent/50"
                )}
              >
                {t.label}
              </button>
            ))}
          </nav>
          {/* Own row on mobile, top right from `sm` up. Not `relative`: the
              location panel is positioned against the header. */}
          <div className="flex h-8 w-full items-center sm:ml-auto sm:w-auto">
            <LocationPicker
              place={place}
              onChange={onPlaceChange}
              open={locationOpen}
              onOpenChange={setLocationOpen}
            />
          </div>
        </div>
      </header>
      {/* Dims the page (bottombar included) but not the header, like dc. */}
      {locationOpen && (
        <div
          aria-hidden
          onClick={() => setLocationOpen(false)}
          className="fixed inset-0 z-[45] bg-black/40"
        />
      )}
    </>
  );
};

export default Topbar;
