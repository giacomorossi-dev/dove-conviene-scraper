import Logo from "./Logo";
import { cn } from "@/lib/utils";

export type View = "main" | "lists";

interface Props {
  view: View;
  onChangeView: (v: View) => void;
}

const Topbar = ({ view, onChangeView }: Props) => (
  <header className="fixed top-0 inset-x-0 z-40 bg-background border-b shadow-sm">
    <div className="container flex items-center gap-6 py-3">
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
    </div>
  </header>
);

export default Topbar;
