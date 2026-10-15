# Pagina Preset — piano di implementazione

> **Per chi esegue (agenti):** SUB-SKILL OBBLIGATORIA: superpowers:subagent-driven-development (consigliata) oppure superpowers:executing-plans, un task alla volta. I passi usano le caselle (`- [ ]`) per tenere traccia.

**Obiettivo:** i preset (insegne + prodotti, senza località) si gestiscono in una nuova pagina **Preset**: crea, duplica, modifica, elimina. La pagina Risultati diventa: scegli il preset → Cerca → risultati.

**Architettura:**
- Si aggiunge una vista allo switch che esiste già in `App.tsx`, senza router.
- La logica dei preset diventa:
  - funzioni pure in `src/lib/presets.ts`, testate con `bun test`;
  - un hook `usePresets` per lo stato e il salvataggio.
- L'elenco delle insegne arriva da un hook `useCatalog`, chiamato una volta in `App` e passato come prop.
- Il componente riutilizzabile `RetailerSelect` usa `Item` + `Avatar` + `Badge` + `Checkbox` di shadcn.

**Stack:** React 19, TypeScript (typecheck con TS 7), Vite 8, Tailwind 4, shadcn su Base UI (`base-vega`), Bun (test, server).

**Spec:** `docs/superpowers/specs/2026-10-15-preset-page-design.md`. Va letta prima di iniziare.

## Vincoli globali

- **Branch:** `feat/preset-page`, già creato da `main`.
- **Node 24:** nelle shell non interattive, prima di `bun run …` e della CLI shadcn, eseguire `source ~/.nvm/nvm.sh && nvm use`.
- **Testi:** quelli visibili all'utente in italiano. Commenti e nomi nel codice in inglese, con la stessa densità di commenti del codice vicino.
- **Componenti shadcn:**
  - si aggiungono solo con la CLI (`bunx shadcn@latest add <nome>`);
  - non si modificano a mano i file in `src/components/ui/`, che sono esclusi da Biome;
  - importano `cn` da `"cn"`, come quelli esistenti.
- **Chiavi del `localStorage`:** `dove-conviene:presets`, `dove-conviene:active-preset` e la nuova `dove-conviene:place`.
- **Server:** nessuna modifica. `POST /api/scraper` riceve ancora `{ place, flyers: Flyer[], products }`.
- **Fine di ogni task:** devono passare `bun test`, `bun run typecheck`, `bun run lint` e `bun run format:check`. Per formattare si usa `bun run format`.
- **Commit:** in fondo al messaggio `Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>`. **Mai `git push`.**
- **Ambiente di sviluppo:** `bun run dev`, con l'app su http://localhost:5180 e l'API su :3000.

## Punti d'attenzione per la revisione

Sono i casi che la spec implica ma che i test unitari non coprono. Ognuno ha il suo controllo nel task indicato.

1. **Clic sulla casella dentro la riga `<label>`.** Deve selezionare una volta sola: con il doppio evento casella + label la selezione si annullerebbe. → Task 6, scenario 2.
2. **Chiusura dell'editor con modifiche** con Esc, con la X o con un clic fuori: deve chiedere "Scartare le modifiche?" e, se annulli, restare aperto con le modifiche. → Task 6, scenario 6.
3. **Preset salvati prima degli slug**, con `flyers` che hanno solo il nome. È il caso reale dei preset già nel browser dell'utente: devono mostrare e cercare le loro insegne. → Task 3, test `resolveLegacyRetailers`; Task 6, scenario 9.
4. **Località dopo un riavvio:** resta quella scelta. Al primo avvio dopo l'aggiornamento si prende la località del vecchio preset attivo. → Task 3, test `storedPresetPlace`; Task 6, scenario 9.
5. **Elenco insegne vuoto** (prima costruzione in corso): salvare un preset non deve cancellarne le insegne. → Task 3, test `keepKnown` con elenco vuoto.

---

### Task 1: Filtro delle insegne

**File:**
- Crea: `src/lib/retailerFilter.ts`
- Test: `src/lib/retailerFilter.test.ts`

**Interfacce:**
- Usa: `CATEGORIES`, `categorySlug(c: Category): string` da `@shared/categories`; `Retailer` da `@shared/types`.
- Fornisce:

  ```ts
  interface RetailerFilter { query: string; category: string | null; onlySelected: boolean }
  function filterRetailers(retailers: readonly Retailer[], filter: RetailerFilter, selected: ReadonlySet<string>): Retailer[]
  ```

- [ ] **Passo 1: scrivi il test che fallisce**

`src/lib/retailerFilter.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { CATEGORIES } from "@shared/categories";
import type { Retailer } from "@shared/types";
import { filterRetailers, type RetailerFilter } from "./retailerFilter";

const [iper, discount] = CATEGORIES;
const retailer = (name: string, slug: string, category = iper): Retailer => ({
  name,
  slug,
  imageUrl: "",
  category,
});
const all = [
  retailer("Conad City", "conad-city"),
  retailer("Eurospin", "eurospin", discount),
  retailer("Coop", "coop"),
  retailer("Caffè Borbone", "caffe-borbone"),
];
const none: RetailerFilter = { query: "", category: null, onlySelected: false };
const names = (rs: Retailer[]) => rs.map((r) => r.name);

describe("filterRetailers", () => {
  test("without filters: every retailer, alphabetical", () => {
    expect(names(filterRetailers(all, none, new Set()))).toEqual([
      "Caffè Borbone",
      "Conad City",
      "Coop",
      "Eurospin",
    ]);
  });

  test("name: any part, ignoring case, accents and surrounding spaces", () => {
    expect(
      names(filterRetailers(all, { ...none, query: "CAFFE" }, new Set()))
    ).toEqual(["Caffè Borbone"]);
    expect(
      names(filterRetailers(all, { ...none, query: " city " }, new Set()))
    ).toEqual(["Conad City"]);
  });

  test("category, by slug", () => {
    expect(
      names(filterRetailers(all, { ...none, category: "discount" }, new Set()))
    ).toEqual(["Eurospin"]);
  });

  test("only the selected ones", () => {
    const selected = new Set(["coop", "eurospin"]);
    expect(
      names(filterRetailers(all, { ...none, onlySelected: true }, selected))
    ).toEqual(["Coop", "Eurospin"]);
  });

  test("filters combine", () => {
    const selected = new Set(["coop", "eurospin"]);
    const filter = { query: "co", category: "iper-e-super", onlySelected: true };
    expect(names(filterRetailers(all, filter, selected))).toEqual(["Coop"]);
  });
});
```

- [ ] **Passo 2: verifica che fallisca**

Esegui: `bun test src/lib/retailerFilter.test.ts`
Atteso: FAIL con `Cannot find module './retailerFilter'`.

- [ ] **Passo 3: implementa**

`src/lib/retailerFilter.ts`:

```ts
// What RetailerSelect shows: the retailers matching the name, the category
// and, optionally, only the selected ones.
import { categorySlug } from "@shared/categories";
import type { Retailer } from "@shared/types";

export interface RetailerFilter {
  /** Any part of the name; empty for all. */
  query: string;
  /** Category slug; null for all. */
  category: string | null;
  onlySelected: boolean;
}

/** Lowercase without accents, as LocationPicker matches places. */
const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();

/** The retailers matching every filter, by name. */
export function filterRetailers(
  retailers: readonly Retailer[],
  { query, category, onlySelected }: RetailerFilter,
  selected: ReadonlySet<string>
): Retailer[] {
  const q = fold(query);
  return retailers
    .filter(
      (r) =>
        (!q || fold(r.name).includes(q)) &&
        (!category || categorySlug(r.category) === category) &&
        (!onlySelected || selected.has(r.slug))
    )
    .sort((a, b) => a.name.localeCompare(b.name, "it"));
}
```

- [ ] **Passo 4: verifica che passi**

Esegui: `bun test src/lib/retailerFilter.test.ts`
Atteso: PASS, 5 test.

- [ ] **Passo 5: controlli e commit**

```bash
source ~/.nvm/nvm.sh && nvm use
bun run format && bun test && bun run typecheck && bun run lint
git add src/lib/retailerFilter.ts src/lib/retailerFilter.test.ts
git commit -m "feat: filter retailers by name, category and selection

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 2: `useCatalog` e `RetailerSelect`

**File:**
- Crea con la CLI: `src/components/ui/{item,separator,avatar,badge,checkbox,select}.tsx`
- Crea: `src/lib/useCatalog.ts`, `src/components/RetailerSelect.tsx`
- Modifica: `src/lib/retailers.ts`, aggiungendo due helper
- Test: `src/lib/retailers.test.ts`

**Interfacce:**
- Usa: `filterRetailers` (Task 1).
- Fornisce:

  ```ts
  // src/lib/useCatalog.ts
  interface CatalogState {
    status: CatalogStatus | null;
    retailers: Retailer[];
    bySlug: ReadonlyMap<string, Retailer>;
    update: () => void;
  }
  function useCatalog(): CatalogState

  // src/lib/retailers.ts (in aggiunta a isRetailer e toSelection, che restano)
  function retailerInitials(name: string): string
  function knownRetailers(slugs: readonly string[], bySlug: ReadonlyMap<string, Retailer>): Retailer[]

  // src/components/RetailerSelect.tsx (default export)
  RetailerSelect: (props: { value: string[]; onChange: (slugs: string[]) => void; catalog: CatalogState }) => JSX.Element
  ```

- [ ] **Passo 1: aggiungi i componenti shadcn**

```bash
source ~/.nvm/nvm.sh && nvm use
bunx shadcn@latest add item avatar badge checkbox select --yes
git status --short   # attesi: ui/item.tsx, ui/separator.tsx, ui/avatar.tsx, ui/badge.tsx, ui/checkbox.tsx, ui/select.tsx
```

Questo piano si appoggia sulle seguenti esportazioni, verificate su shadcn 4.21.4 in stile base-vega:
- `Item`: `variant` default/outline/muted, `size` default/sm/xs, `render`. Poi `ItemGroup`, `ItemMedia`, `ItemContent`, `ItemTitle`, `ItemDescription` e `ItemActions`.
- `Avatar` con `size` default/sm/lg, `AvatarImage`, `AvatarFallback`, `AvatarGroup` e `AvatarGroupCount`.
- `Badge` con `variant` secondary/outline.
- `Checkbox`: le props sono quelle di Base UI `Checkbox.Root` (`checked` e `onCheckedChange(checked: boolean)`).
- `Select`: Root con `items`, poi `SelectTrigger`, `SelectValue`, `SelectContent`, `SelectGroup` e `SelectItem`.

- [ ] **Passo 2: scrivi il test degli helper**

`src/lib/retailers.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import { CATEGORIES } from "@shared/categories";
import type { Retailer } from "@shared/types";
import { knownRetailers, retailerInitials } from "./retailers";

const retailer = (name: string, slug: string): Retailer => ({
  name,
  slug,
  imageUrl: "",
  category: CATEGORIES[0],
});

describe("retailerInitials", () => {
  test("first letters of the first two words, uppercase", () => {
    expect(retailerInitials("Conad City")).toBe("CC");
    expect(retailerInitials("coop")).toBe("C");
    expect(retailerInitials("  Il   Gigante  Market ")).toBe("IG");
  });
});

describe("knownRetailers", () => {
  test("the slugs in the list, in order; unknown ones are skipped", () => {
    const conad = retailer("Conad", "conad");
    const coop = retailer("Coop", "coop");
    const bySlug = new Map([
      ["conad", conad],
      ["coop", coop],
    ]);
    expect(knownRetailers(["coop", "gone", "conad"], bySlug)).toEqual([
      coop,
      conad,
    ]);
  });
});
```

Esegui: `bun test src/lib/retailers.test.ts`. Atteso: FAIL, perché `retailerInitials` e `knownRetailers` non sono ancora esportati.

- [ ] **Passo 3: implementa gli helper**

In fondo a `src/lib/retailers.ts`:

```ts
/** For a logo that doesn't load: "Conad City" → "CC". */
export const retailerInitials = (name: string): string =>
  name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

/** The retailers of these slugs that are in the local list, in order. */
export const knownRetailers = (
  slugs: readonly string[],
  bySlug: ReadonlyMap<string, Retailer>
): Retailer[] => slugs.flatMap((s) => bySlug.get(s) ?? []);
```

Esegui: `bun test src/lib/retailers.test.ts`. Atteso: PASS.

- [ ] **Passo 4: crea `useCatalog`**

`src/lib/useCatalog.ts`. È la parte "elenco nazionale" di `src/lib/useRetailers.ts`, senza la parte "in zona"; `useRetailers` resta finché il Task 3 non lo elimina.

```ts
import { useEffect, useMemo, useState } from "react";
import type { CatalogStatus, Retailer } from "@shared/types";

const fetchJson = <T>(url: string, init?: RequestInit): Promise<T> =>
  fetch(url, init).then((r) =>
    r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(r.statusText))
  );

export interface CatalogState {
  /** null until the first status arrives. */
  status: CatalogStatus | null;
  /** The national retailer list; empty until the first build ends. */
  retailers: Retailer[];
  bySlug: ReadonlyMap<string, Retailer>;
  /** Starts an update, or retries a failed first build. */
  update: () => void;
}

/**
 * The local national retailer list and its builds (the first one or an
 * update). Call it once, in App, and pass it down.
 */
export function useCatalog(): CatalogState {
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [retailers, setRetailers] = useState<Retailer[]>([]);

  useEffect(() => {
    fetchJson<CatalogStatus>("/api/retailers/status")
      .then(setStatus)
      .catch(() => {});
  }, []);

  // Follow a running build.
  const building = status?.building ?? false;
  useEffect(() => {
    if (!building) return;
    const id = setInterval(() => {
      fetchJson<CatalogStatus>("/api/retailers/status")
        .then(setStatus)
        .catch(() => {});
    }, 3_000);
    return () => clearInterval(id);
  }, [building]);

  // (Re)load the list whenever a build has produced a new one.
  const updatedAt = status?.updatedAt ?? null;
  useEffect(() => {
    if (!updatedAt) return;
    fetchJson<Retailer[]>("/api/retailers")
      .then(setRetailers)
      .catch(() => {});
  }, [updatedAt]);

  const bySlug = useMemo(
    () => new Map(retailers.map((r) => [r.slug, r])),
    [retailers]
  );

  const update = () => {
    fetchJson<CatalogStatus>("/api/retailers/update", { method: "POST" })
      .then(setStatus)
      .catch(() => {});
  };

  return { status, retailers, bySlug, update };
}
```

- [ ] **Passo 5: crea `RetailerSelect`**

`src/components/RetailerSelect.tsx`. `BuildBar`, `PHASES` e `CatalogInfo` si spostano qui da `RetailerPicker.tsx`, che il Task 3 elimina.

```tsx
// Multi-select of retailers from the local national list, filterable by
// name and category. Reusable: it only knows the selected slugs.
import { useMemo, useState } from "react";
import { RefreshCw } from "lucide-react";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { filterRetailers } from "@/lib/retailerFilter";
import { retailerInitials } from "@/lib/retailers";
import type { CatalogState } from "@/lib/useCatalog";
import { CATEGORIES, categorySlug } from "@shared/categories";
import type { BuildProgress, CatalogStatus } from "@shared/types";

interface Props {
  value: string[];
  onChange: (slugs: string[]) => void;
  catalog: CatalogState;
}

/** Base UI's Select shows the label of the item matching the value. */
const CATEGORY_ITEMS = [
  { label: "Tutte le categorie", value: null },
  ...CATEGORIES.map((c) => ({ label: c.name, value: categorySlug(c) })),
];

const PHASES: Record<BuildProgress["phase"], string> = {
  sitemaps: "Elenco insegne",
  pages: "Pagine insegne",
  kinds: "Negozi o marchi",
};

function BuildBar({ progress }: { progress: BuildProgress | null }) {
  const pct = progress?.total ? (100 * progress.done) / progress.total : 0;
  return (
    <div className="grid gap-1.5">
      <div className="h-2 overflow-hidden rounded-full bg-muted">
        <div
          className="h-full bg-primary transition-[width] duration-500"
          style={{ width: `${pct}%` }}
        />
      </div>
      <p className="text-xs text-muted-foreground">
        {progress
          ? `${PHASES[progress.phase]}: ${progress.done} di ${progress.total}`
          : "Avvio…"}
      </p>
    </div>
  );
}

/** "937 insegne, aggiornate il 14/10/2026 · Aggiorna", or the update's progress. */
function CatalogInfo({
  status,
  onUpdate,
}: {
  status: CatalogStatus;
  onUpdate: () => void;
}) {
  if (status.building)
    return (
      <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Spinner /> Aggiornamento insegne
        {status.progress && ` ${status.progress.done}/${status.progress.total}`}
      </span>
    );
  return (
    <span className="flex items-center gap-2 text-xs text-muted-foreground">
      {status.updatedAt &&
        `${status.count} insegne, aggiornate il ${new Date(
          status.updatedAt
        ).toLocaleDateString("it-IT")}`}
      <Button type="button" variant="ghost" size="sm" onClick={onUpdate}>
        <RefreshCw /> Aggiorna
      </Button>
    </span>
  );
}

const RetailerSelect = ({ value, onChange, catalog }: Props) => {
  const { status, retailers, bySlug, update } = catalog;
  const [query, setQuery] = useState("");
  const [category, setCategory] = useState<string | null>(null);
  const [onlySelected, setOnlySelected] = useState(false);

  const selected = useMemo(() => new Set(value), [value]);
  // Slugs no longer in the list stay in `value` but are not counted or shown.
  const selectedCount = value.filter((s) => bySlug.has(s)).length;
  const showOnlySelected = onlySelected && selectedCount > 0;
  const visible = useMemo(
    () =>
      filterRetailers(
        retailers,
        { query, category, onlySelected: showOnlySelected },
        selected
      ),
    [retailers, query, category, showOnlySelected, selected]
  );

  const toggle = (slug: string, checked: boolean) =>
    onChange(checked ? [...value, slug] : value.filter((s) => s !== slug));

  if (!status)
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Spinner /> Caricamento insegne…
      </p>
    );

  if (status.count === 0)
    return (
      <div className="grid gap-3 rounded-lg border bg-muted/40 p-4 text-sm">
        {status.building ? (
          <>
            <p>
              <strong>Prima configurazione.</strong> Sto scaricando da dc
              l'elenco completo delle insegne. Va piano apposta per non
              sovraccaricare dc: circa 45 minuti. Se chiudi l'app riprende da
              dove era arrivata.
            </p>
            <BuildBar progress={status.progress} />
          </>
        ) : (
          <p className="flex flex-wrap items-center gap-2">
            Non sono riuscito a scaricare l'elenco delle insegne
            {status.error && `: ${status.error}`}.
            <Button size="sm" variant="outline" onClick={update}>
              <RefreshCw /> Riprova
            </Button>
          </p>
        )}
      </div>
    );

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap gap-2">
        <Input
          className="min-w-40 flex-1"
          placeholder="Cerca un'insegna"
          aria-label="Cerca per nome"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <Select
          items={CATEGORY_ITEMS}
          value={category}
          onValueChange={(v) => setCategory(v)}
        >
          <SelectTrigger className="w-48" aria-label="Categoria">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {CATEGORY_ITEMS.map((c) => (
                <SelectItem key={c.value ?? "all"} value={c.value}>
                  {c.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <Button
          type="button"
          variant={showOnlySelected ? "secondary" : "outline"}
          disabled={selectedCount === 0}
          aria-pressed={showOnlySelected}
          onClick={() => setOnlySelected(!showOnlySelected)}
        >
          {selectedCount} selezionat{selectedCount === 1 ? "a" : "e"}
        </Button>
      </div>

      <ItemGroup className="max-h-96 overflow-y-auto rounded-lg border">
        {visible.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">
            Nessuna insegna trovata.
          </p>
        ) : (
          visible.map((r) => (
            <Item
              key={r.slug}
              size="sm"
              render={<label />}
              className="cursor-pointer has-data-checked:bg-muted/60"
            >
              <ItemMedia>
                <Avatar>
                  <AvatarImage src={r.imageUrl} alt="" />
                  <AvatarFallback>{retailerInitials(r.name)}</AvatarFallback>
                </Avatar>
              </ItemMedia>
              <ItemContent>
                <ItemTitle>{r.name}</ItemTitle>
                <Badge variant="secondary">{r.category.name}</Badge>
              </ItemContent>
              <ItemActions>
                <Checkbox
                  checked={selected.has(r.slug)}
                  onCheckedChange={(checked) => toggle(r.slug, checked)}
                />
              </ItemActions>
            </Item>
          ))
        )}
      </ItemGroup>

      <CatalogInfo status={status} onUpdate={update} />
    </div>
  );
};

export default RetailerSelect;
```

Se il typecheck segnala un tipo diverso da quello atteso:
- per `onValueChange` (`v` vale `string | null`), usa `(v) => setCategory(v as string | null)`;
- per `onCheckedChange`, il primo argomento è comunque `boolean`.

Non cambiare i file in `ui/`.

- [ ] **Passo 6: controlli e commit**

Il componente non è ancora montato: lo prova il Task 6.

```bash
bun run format && bun test && bun run typecheck && bun run lint && bun run format:check
git add src/components/ui src/lib/useCatalog.ts src/lib/retailers.ts src/lib/retailers.test.ts src/components/RetailerSelect.tsx
git commit -m "feat: reusable retailer multi-select with name and category filters

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 3: Nuovo modello dei preset e pagina Risultati semplificata

Questo task cambia il modello e tutti i suoi utilizzatori insieme, così l'app compila a ogni commit. Alla fine si possono scegliere i preset esistenti e cercare. Crearli e modificarli arriva nei Task 4 e 5.

**File:**
- Riscrivi: `src/lib/presets.ts`
- Test: `src/lib/presets.test.ts`
- Modifica: `src/lib/places.ts`. Aggiungi `loadPlace` e `savePlace`; togli `samePlace` e `resolveCityName`, che restano inutilizzati.
- Crea: `src/lib/usePresets.ts`, `src/lib/format.ts`, `src/components/RetailerLogos.tsx`, `src/components/PresetSummary.tsx`, `src/components/ResultsView.tsx`
- Modifica: `src/components/PresetSelect.tsx`, `src/components/Bottombar.tsx`, `src/components/ProductsChipsInput.tsx` (usa `formatPrice` da `format.ts`), `src/lib/retailers.ts` (togli `isRetailer`), `src/App.tsx`
- Crea con la CLI: `src/components/ui/empty.tsx`
- Elimina: `src/components/Wizard.tsx`, `src/components/RetailerPicker.tsx`, `src/components/Flyer.tsx`, `src/components/PresetNameDialog.tsx`, `src/components/PresetDeleteDialog.tsx`, `src/lib/useRetailers.ts`

**Interfacce:**
- Usa: `CatalogState`, `useCatalog` e `knownRetailers` (Task 2).
- Fornisce (`src/lib/presets.ts`):

  ```ts
  interface Preset { id: string; name: string; retailers: string[]; products: ProductQuery[]; legacyRetailerNames?: string[]; createdAt: number; updatedAt: number }
  type PresetDraft = Pick<Preset, "name" | "retailers" | "products">
  const EMPTY_DRAFT: PresetDraft
  function migratePreset(p: StoredPreset): Preset
  function parsePresets(raw: string | null): Preset[]
  function storedPresetPlace(raw: string | null, id: string | null): Place | null
  function loadPresets(): Preset[]
  function savePresets(presets: Preset[]): void
  function loadActivePresetId(): string | null
  function saveActivePresetId(id: string | null): void
  function loadLegacyActivePlace(): Place | null
  function resolveLegacyRetailers(p: Preset, catalog: readonly Pick<Retailer, "name" | "slug">[]): Preset
  function keepKnown(slugs: string[], known: ReadonlySet<string>): string[]
  function createPreset(draft: PresetDraft, now?: number): Preset
  function applyDraft(p: Preset, draft: PresetDraft, known: ReadonlySet<string>, now?: number): Preset
  function isNameTaken(presets: readonly Preset[], name: string, exceptId?: string): boolean
  function copyName(presets: readonly Preset[], source: string): string
  function mostRecent(presets: readonly Preset[]): Preset | null
  function byName(presets: readonly Preset[]): Preset[]
  function countsLabel(retailers: number, products: number): string
  ```

- Fornisce anche:

  ```ts
  // src/lib/usePresets.ts
  function usePresets(catalog: readonly Retailer[]): {
    presets: Preset[]; active: Preset | null; activeId: string | null;
    setActiveId: (id: string | null) => void;
    create: (draft: PresetDraft) => Preset;
    update: (id: string, draft: PresetDraft) => void;
    remove: (id: string) => void;
  }

  // src/lib/places.ts
  function loadPlace(): Place | null
  function savePlace(place: Place): void

  // src/lib/format.ts
  function formatPrice(n: number): string

  // RetailerLogos (default export): { retailers: Retailer[]; max: number }
  // PresetSummary (default export): { preset: Preset; bySlug: ReadonlyMap<string, Retailer> }
  // ResultsView (default export): { preset: Preset | null; bySlug; results: Flyer[]; lists; onAddToList; onRequestNewList; onRequestRemoveItem }
  ```

- [ ] **Passo 1: scrivi i test del modello**

`src/lib/presets.test.ts`:

```ts
import { describe, expect, test } from "bun:test";
import {
  applyDraft,
  byName,
  copyName,
  countsLabel,
  createPreset,
  isNameTaken,
  keepKnown,
  migratePreset,
  mostRecent,
  parsePresets,
  resolveLegacyRetailers,
  storedPresetPlace,
  type Preset,
} from "./presets";

const preset = (over: Partial<Preset> = {}): Preset => ({
  id: "p1",
  name: "Spesa",
  retailers: [],
  products: [],
  createdAt: 1,
  updatedAt: 1,
  ...over,
});

const reggiolo = { name: "Reggiolo", zip: "42046", lat: 44.92, lng: 10.8 };

describe("migratePreset", () => {
  test("old shape: slugs kept, name-only retailers set aside, place and default dropped", () => {
    const old = {
      id: "p1",
      name: "Vecchio",
      place: reggiolo,
      city: "Reggiolo",
      default: true,
      flyers: [
        { name: "Conad City", slug: "conad-city" },
        { name: "Coop" },
        { name: "Conad City", slug: "conad-city" },
      ],
      products: [{ name: "latte", maxPrice: 1.5 }],
      createdAt: 1,
      updatedAt: 2,
    };
    expect(migratePreset(old)).toEqual({
      id: "p1",
      name: "Vecchio",
      retailers: ["conad-city"],
      legacyRetailerNames: ["Coop"],
      products: [{ name: "latte", maxPrice: 1.5 }],
      createdAt: 1,
      updatedAt: 2,
    });
  });

  test("current shape: unchanged", () => {
    const p = preset({ retailers: ["coop"], products: [{ name: "pane" }] });
    expect(migratePreset(p)).toEqual(p);
  });
});

describe("parsePresets", () => {
  test("missing, unreadable or not a list: no presets", () => {
    expect(parsePresets(null)).toEqual([]);
    expect(parsePresets("{oops")).toEqual([]);
    expect(parsePresets('{"id":"p1"}')).toEqual([]);
  });

  test("a saved list is migrated", () => {
    const raw = JSON.stringify([{ ...preset(), place: reggiolo }]);
    expect(parsePresets(raw)).toEqual([preset()]);
  });
});

describe("storedPresetPlace", () => {
  const raw = JSON.stringify([
    { ...preset({ id: "a" }), place: reggiolo },
    { ...preset({ id: "b" }), place: null },
    { ...preset({ id: "c" }), place: { name: "Rotto" } },
  ]);

  test("the place the given saved preset had", () => {
    expect(storedPresetPlace(raw, "a")).toEqual(reggiolo);
  });

  test("none for a missing preset, no place or a place without coordinates", () => {
    expect(storedPresetPlace(raw, "zzz")).toBeNull();
    expect(storedPresetPlace(raw, null)).toBeNull();
    expect(storedPresetPlace(raw, "b")).toBeNull();
    expect(storedPresetPlace(raw, "c")).toBeNull();
    expect(storedPresetPlace(null, "a")).toBeNull();
  });
});

describe("resolveLegacyRetailers", () => {
  const catalog = [
    { name: "Coop", slug: "coop" },
    { name: "Conad City", slug: "conad-city" },
  ];

  test("names found in the list become slugs, without duplicates; others are dropped", () => {
    const p = preset({
      retailers: ["conad-city"],
      legacyRetailerNames: ["Coop", "Conad City", "Sparito"],
    });
    expect(resolveLegacyRetailers(p, catalog)).toEqual(
      preset({ retailers: ["conad-city", "coop"] })
    );
  });

  test("a preset without legacy names is returned as is", () => {
    const p = preset({ retailers: ["coop"] });
    expect(resolveLegacyRetailers(p, catalog)).toBe(p);
  });
});

describe("keepKnown", () => {
  test("drops retailers no longer in the list", () => {
    expect(keepKnown(["coop", "gone"], new Set(["coop"]))).toEqual(["coop"]);
  });

  test("keeps everything while the list is empty (first build running)", () => {
    expect(keepKnown(["coop", "gone"], new Set())).toEqual(["coop", "gone"]);
  });
});

describe("createPreset / applyDraft", () => {
  test("a new preset has a trimmed name and both timestamps", () => {
    const p = createPreset(
      { name: "  Spesa  ", retailers: ["coop"], products: [] },
      42
    );
    expect(p).toMatchObject({
      name: "Spesa",
      retailers: ["coop"],
      createdAt: 42,
      updatedAt: 42,
    });
    expect(p.id).toBeString();
  });

  test("an edit keeps id and creation, drops unknown retailers and legacy names", () => {
    const p = preset({ legacyRetailerNames: ["Coop"] });
    const next = applyDraft(
      p,
      { name: " Nuovo ", retailers: ["coop", "gone"], products: [{ name: "pane" }] },
      new Set(["coop"]),
      99
    );
    expect(next).toEqual({
      id: "p1",
      name: "Nuovo",
      retailers: ["coop"],
      products: [{ name: "pane" }],
      createdAt: 1,
      updatedAt: 99,
    });
  });
});

describe("names", () => {
  const presets = [preset({ id: "a", name: "Spesa" }), preset({ id: "b", name: "Copia di Spesa" })];

  test("a name is taken ignoring case and surrounding spaces, except by the preset itself", () => {
    expect(isNameTaken(presets, "  spesa ")).toBe(true);
    expect(isNameTaken(presets, "Spesa", "a")).toBe(false);
    expect(isNameTaken(presets, "Altro")).toBe(false);
  });

  test("copies are numbered when the name is taken", () => {
    expect(copyName([preset({ name: "Casa" })], "Casa")).toBe("Copia di Casa");
    expect(copyName(presets, "Spesa")).toBe("Copia di Spesa (2)");
    expect(
      copyName([...presets, preset({ id: "c", name: "Copia di Spesa (2)" })], "Spesa")
    ).toBe("Copia di Spesa (3)");
  });

  test("presets by name, Italian order", () => {
    const list = [
      preset({ id: "1", name: "spesa" }),
      preset({ id: "2", name: "Èlite" }),
      preset({ id: "3", name: "alfa" }),
    ];
    expect(byName(list).map((p) => p.name)).toEqual(["alfa", "Èlite", "spesa"]);
  });
});

describe("mostRecent", () => {
  test("the most recently updated preset, or none", () => {
    const list = [
      preset({ id: "a", updatedAt: 5 }),
      preset({ id: "b", updatedAt: 9 }),
      preset({ id: "c", updatedAt: 7 }),
    ];
    expect(mostRecent(list)?.id).toBe("b");
    expect(mostRecent([])).toBeNull();
  });
});

describe("countsLabel", () => {
  test("singular and plural", () => {
    expect(countsLabel(1, 1)).toBe("1 insegna · 1 prodotto");
    expect(countsLabel(0, 3)).toBe("0 insegne · 3 prodotti");
  });
});
```

Esegui: `bun test src/lib/presets.test.ts`. Atteso: FAIL, perché le nuove funzioni non sono esportate.

- [ ] **Passo 2: riscrivi `src/lib/presets.ts`**

```ts
// Presets: a reusable set of retailers and products to search for, saved in
// the browser. The place is not part of a preset: it lives in the topbar.
import type { Place, ProductQuery, Retailer } from "@shared/types";

export interface Preset {
  id: string;
  name: string;
  /** Retailer slugs ("conad-city"): names and logos come from the list. */
  retailers: string[];
  products: ProductQuery[];
  /**
   * Retailers of presets saved before slugs, by name: matched against the
   * list once it loads (resolveLegacyRetailers), dropped on the next save.
   */
  legacyRetailerNames?: string[];
  createdAt: number;
  updatedAt: number;
}

/** What the preset editor edits. */
export type PresetDraft = Pick<Preset, "name" | "retailers" | "products">;

export const EMPTY_DRAFT: PresetDraft = {
  name: "",
  retailers: [],
  products: [],
};

const STORAGE_KEY = "dove-conviene:presets";
const ACTIVE_KEY = "dove-conviene:active-preset";

/** A preset as any version of the app may have saved it. */
interface StoredPreset {
  id: string;
  name: string;
  retailers?: string[];
  /** Before slugs: the selected retailers, with a slug once it existed. */
  flyers?: { name: string; slug?: string }[];
  products?: ProductQuery[];
  legacyRetailerNames?: string[];
  /** Before the place moved to the topbar. */
  place?: Place | null;
  createdAt: number;
  updatedAt: number;
}

/**
 * A saved preset in the current shape. Fields of older versions (place,
 * city, citySlug, legacyCity, default) are dropped.
 */
export function migratePreset(p: StoredPreset): Preset {
  const flyers = p.flyers ?? [];
  const retailers = [
    ...new Set([
      ...(p.retailers ?? []),
      ...flyers.flatMap((f) => (f.slug ? [f.slug] : [])),
    ]),
  ];
  const legacy = [
    ...(p.legacyRetailerNames ?? []),
    ...flyers.filter((f) => !f.slug).map((f) => f.name),
  ];
  return {
    id: p.id,
    name: p.name,
    retailers,
    products: p.products ?? [],
    ...(legacy.length > 0 && { legacyRetailerNames: legacy }),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

const parseStored = (raw: string | null): StoredPreset[] => {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as StoredPreset[]) : [];
  } catch {
    return [];
  }
};

/** The presets in a saved JSON string: none when missing or unreadable. */
export const parsePresets = (raw: string | null): Preset[] =>
  parseStored(raw).map(migratePreset);

/** The place a saved preset had, from versions that kept it in the preset. */
export function storedPresetPlace(
  raw: string | null,
  id: string | null
): Place | null {
  const place = parseStored(raw).find((p) => p.id === id)?.place;
  return place && typeof place.lat === "number" && typeof place.lng === "number"
    ? place
    : null;
}

const storage = (): Storage | null =>
  typeof localStorage === "undefined" ? null : localStorage;

export const loadPresets = (): Preset[] =>
  parsePresets(storage()?.getItem(STORAGE_KEY) ?? null);

export function savePresets(presets: Preset[]): void {
  storage()?.setItem(STORAGE_KEY, JSON.stringify(presets));
}

export const loadActivePresetId = (): string | null =>
  storage()?.getItem(ACTIVE_KEY) ?? null;

export function saveActivePresetId(id: string | null): void {
  const s = storage();
  if (!s) return;
  if (id) s.setItem(ACTIVE_KEY, id);
  else s.removeItem(ACTIVE_KEY);
}

/** The active preset's place, saved by versions that kept it in the preset. */
export const loadLegacyActivePlace = (): Place | null =>
  storedPresetPlace(storage()?.getItem(STORAGE_KEY) ?? null, loadActivePresetId());

/** Matches the names of presets saved before slugs; unmatched ones are dropped. */
export function resolveLegacyRetailers(
  p: Preset,
  catalog: readonly Pick<Retailer, "name" | "slug">[]
): Preset {
  if (!p.legacyRetailerNames) return p;
  const slugOf = new Map(catalog.map((r) => [r.name, r.slug]));
  const found = p.legacyRetailerNames.flatMap((n) => slugOf.get(n) ?? []);
  // eslint-disable-next-line @typescript-eslint/no-unused-vars -- resolved
  const { legacyRetailerNames, ...rest } = p;
  return { ...rest, retailers: [...new Set([...p.retailers, ...found])] };
}

/**
 * The retailers still in the list. While the list is empty (first build
 * running) nothing is known, so everything is kept.
 */
export const keepKnown = (
  slugs: string[],
  known: ReadonlySet<string>
): string[] => (known.size === 0 ? slugs : slugs.filter((s) => known.has(s)));

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function createPreset(draft: PresetDraft, now = Date.now()): Preset {
  return {
    id: newId(),
    name: draft.name.trim(),
    retailers: draft.retailers,
    products: draft.products,
    createdAt: now,
    updatedAt: now,
  };
}

/** The preset with the editor's changes; legacy names are gone after a save. */
export function applyDraft(
  p: Preset,
  draft: PresetDraft,
  known: ReadonlySet<string>,
  now = Date.now()
): Preset {
  return {
    id: p.id,
    name: draft.name.trim(),
    retailers: keepKnown(draft.retailers, known),
    products: draft.products,
    createdAt: p.createdAt,
    updatedAt: now,
  };
}

const sameName = (a: string, b: string): boolean =>
  a.trim().toLocaleLowerCase("it") === b.trim().toLocaleLowerCase("it");

/** Whether another preset has this name, ignoring case and surrounding spaces. */
export const isNameTaken = (
  presets: readonly Preset[],
  name: string,
  exceptId?: string
): boolean => presets.some((p) => p.id !== exceptId && sameName(p.name, name));

/** "Copia di X", or "Copia di X (2)", "(3)"… when taken. */
export function copyName(presets: readonly Preset[], source: string): string {
  const base = `Copia di ${source.trim()}`;
  if (!isNameTaken(presets, base)) return base;
  for (let n = 2; ; n++) {
    const name = `${base} (${n})`;
    if (!isNameTaken(presets, name)) return name;
  }
}

/** The most recently updated preset: the next active one after a delete. */
export const mostRecent = (presets: readonly Preset[]): Preset | null =>
  presets.reduce<Preset | null>(
    (best, p) => (!best || p.updatedAt > best.updatedAt ? p : best),
    null
  );

/** Presets by name, as the page and the select list them. */
export const byName = (presets: readonly Preset[]): Preset[] =>
  [...presets].sort((a, b) => a.name.localeCompare(b.name, "it"));

/** "2 insegne · 1 prodotto". */
export const countsLabel = (retailers: number, products: number): string =>
  `${retailers} insegn${retailers === 1 ? "a" : "e"} · ${products} prodott${
    products === 1 ? "o" : "i"
  }`;
```

Esegui: `bun test src/lib/presets.test.ts`. Atteso: PASS. Il typecheck dell'app fallisce finché i passi 3–9 non aggiornano chi usa il vecchio modello. È previsto: il commit si fa al passo 10.

- [ ] **Passo 3: località salvata da sola**

In `src/lib/places.ts` rimuovi `samePlace`, `resolveCityName` e l'import di `PlaceSuggestion`, poi aggiungi:

```ts
const PLACE_KEY = "dove-conviene:place";

/** The place chosen in the topbar, saved on its own since presets lost it. */
export function loadPlace(): Place | null {
  if (typeof localStorage === "undefined") return null;
  try {
    const raw = localStorage.getItem(PLACE_KEY);
    return raw ? (JSON.parse(raw) as Place) : null;
  } catch {
    return null;
  }
}

export function savePlace(place: Place): void {
  if (typeof localStorage !== "undefined")
    localStorage.setItem(PLACE_KEY, JSON.stringify(place));
}
```

- [ ] **Passo 4: `usePresets`**

`src/lib/usePresets.ts`:

```ts
import { useEffect, useMemo, useState } from "react";
import type { Retailer } from "@shared/types";
import {
  applyDraft,
  createPreset,
  keepKnown,
  loadActivePresetId,
  loadPresets,
  mostRecent,
  resolveLegacyRetailers,
  saveActivePresetId,
  savePresets,
  type Preset,
  type PresetDraft,
} from "./presets";

// Read once, at startup.
const initialPresets = loadPresets();
const storedActiveId = loadActivePresetId();
const initialActiveId = initialPresets.some((p) => p.id === storedActiveId)
  ? storedActiveId
  : (mostRecent(initialPresets)?.id ?? null);

/**
 * The saved presets and the active one, saved in the browser on change.
 * `catalog` is the retailer list: it resolves presets saved before slugs and
 * drops retailers no longer listed when a preset is saved.
 */
export function usePresets(catalog: readonly Retailer[]) {
  const [stored, setStored] = useState<Preset[]>(initialPresets);
  const [activeId, setActiveId] = useState<string | null>(initialActiveId);

  useEffect(() => savePresets(stored), [stored]);
  useEffect(() => saveActivePresetId(activeId), [activeId]);

  const known = useMemo(
    () => new Set(catalog.map((r) => r.slug)),
    [catalog]
  );
  // Presets saved by name get their slugs here; storage keeps the names
  // until the preset is next saved.
  const presets = useMemo(
    () =>
      catalog.length === 0
        ? stored
        : stored.map((p) => resolveLegacyRetailers(p, catalog)),
    [stored, catalog]
  );

  const create = (draft: PresetDraft): Preset => {
    const preset = createPreset({
      ...draft,
      retailers: keepKnown(draft.retailers, known),
    });
    setStored((prev) => [...prev, preset]);
    setActiveId(preset.id);
    return preset;
  };

  const update = (id: string, draft: PresetDraft) =>
    setStored((prev) =>
      prev.map((p) => (p.id === id ? applyDraft(p, draft, known) : p))
    );

  const remove = (id: string) => {
    const left = stored.filter((p) => p.id !== id);
    setStored(left);
    if (activeId === id) setActiveId(mostRecent(left)?.id ?? null);
  };

  const active = presets.find((p) => p.id === activeId) ?? null;
  return { presets, active, activeId, setActiveId, create, update, remove };
}
```

- [ ] **Passo 5: `formatPrice` condiviso, `RetailerLogos`, `PresetSummary`**

`src/lib/format.ts`:

```ts
/** "€ 3,99". */
export const formatPrice = (n: number): string =>
  `€ ${n.toFixed(2).replace(".", ",")}`;
```

In `src/components/ProductsChipsInput.tsx` elimina la `formatPrice` locale e aggiungi `import { formatPrice } from "@/lib/format";`.

Crea con la CLI il componente vuoto:

```bash
bunx shadcn@latest add empty --yes
```

`src/components/RetailerLogos.tsx`:

```tsx
// Retailer logos, overlapping, with "+N" past `max`.
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { retailerInitials } from "@/lib/retailers";
import type { Retailer } from "@shared/types";

interface Props {
  retailers: Retailer[];
  max: number;
}

const RetailerLogos = ({ retailers, max }: Props) => {
  const shown = retailers.slice(0, max);
  const more = retailers.length - shown.length;
  return (
    <AvatarGroup>
      {shown.map((r) => (
        <Avatar key={r.slug} title={r.name}>
          <AvatarImage src={r.imageUrl} alt={r.name} />
          <AvatarFallback>{retailerInitials(r.name)}</AvatarFallback>
        </Avatar>
      ))}
      {more > 0 && <AvatarGroupCount>+{more}</AvatarGroupCount>}
    </AvatarGroup>
  );
};

export default RetailerLogos;
```

`src/components/PresetSummary.tsx`:

```tsx
// The active preset on the results page, read-only.
import { Badge } from "@/components/ui/badge";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { formatPrice } from "@/lib/format";
import { countsLabel, type Preset } from "@/lib/presets";
import { knownRetailers } from "@/lib/retailers";
import type { Retailer } from "@shared/types";
import RetailerLogos from "./RetailerLogos";

interface Props {
  preset: Preset;
  bySlug: ReadonlyMap<string, Retailer>;
}

const PresetSummary = ({ preset, bySlug }: Props) => {
  const retailers = knownRetailers(preset.retailers, bySlug);
  return (
    <Card>
      <CardHeader>
        <CardTitle>{preset.name}</CardTitle>
        <CardDescription>
          {countsLabel(retailers.length, preset.products.length)}
        </CardDescription>
      </CardHeader>
      <CardContent className="grid gap-3">
        {retailers.length > 0 ? (
          <RetailerLogos retailers={retailers} max={8} />
        ) : (
          <p className="text-sm text-muted-foreground">Nessuna insegna.</p>
        )}
        {preset.products.length > 0 ? (
          <div className="flex flex-wrap gap-1.5">
            {preset.products.map((p, i) => (
              <Badge key={i} variant="secondary">
                {p.name}
                {p.maxPrice !== undefined && ` ≤ ${formatPrice(p.maxPrice)}`}
              </Badge>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Nessun prodotto.</p>
        )}
      </CardContent>
    </Card>
  );
};

export default PresetSummary;
```

- [ ] **Passo 6: `ResultsView` al posto di `Wizard`**

`src/components/ResultsView.tsx`:

```tsx
// The results page: the active preset, then what the search found.
import { useMemo } from "react";
import { ListChecks } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import type { List, RowData } from "@/lib/lists";
import type { Preset } from "@/lib/presets";
import type { Flyer, Retailer } from "@shared/types";
import PresetSummary from "./PresetSummary";
import ResultsTable from "./ResultsTable";

interface Props {
  preset: Preset | null;
  bySlug: ReadonlyMap<string, Retailer>;
  results: Flyer[];
  lists: List[];
  onAddToList: (listId: string, row: RowData) => void;
  onRequestNewList: (row: RowData) => void;
  onRequestRemoveItem: (row: RowData, list: List) => void;
}

const ResultsView = ({
  preset,
  bySlug,
  results,
  lists,
  onAddToList,
  onRequestNewList,
  onRequestRemoveItem,
}: Props) => {
  const rows = useMemo<RowData[]>(
    () =>
      results.flatMap((flyer) =>
        (flyer.products ?? []).map((p) => ({
          productName: p.name,
          productImage: p.imageUrl,
          price: p.price,
          flyerName: flyer.name,
          flyerUrl: flyer.url ?? "",
          validUntil: flyer.validUntil ?? null,
        }))
      ),
    [results]
  );

  if (!preset)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>Nessun preset</EmptyTitle>
          <EmptyDescription>
            Crea un preset con le insegne e i prodotti da cercare.
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );

  return (
    <div className="space-y-4">
      <PresetSummary preset={preset} bySlug={bySlug} />
      <Card>
        <CardHeader>
          <CardTitle>Risultati</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultsTable
            rows={rows}
            lists={lists}
            onAddToList={onAddToList}
            onRequestNewList={onRequestNewList}
            onRequestRemove={onRequestRemoveItem}
          />
        </CardContent>
      </Card>
    </div>
  );
};

export default ResultsView;
```

- [ ] **Passo 7: `PresetSelect` serve solo a scegliere, `Bottombar` ha Cerca**

`src/components/PresetSelect.tsx`, sostituzione completa:

```tsx
import { useState } from "react";
import { ChevronDown } from "lucide-react";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { byName, countsLabel, type Preset } from "@/lib/presets";
import { knownRetailers } from "@/lib/retailers";
import type { Retailer } from "@shared/types";

interface Props {
  presets: Preset[];
  activeId: string | null;
  bySlug: ReadonlyMap<string, Retailer>;
  onSelect: (id: string) => void;
}

const PresetSelect = ({ presets, activeId, bySlug, onSelect }: Props) => {
  const [open, setOpen] = useState(false);
  const active = presets.find((p) => p.id === activeId);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger
        render={
          <Button
            variant="outline"
            className="min-w-0 max-w-64 flex-1 justify-between font-normal sm:min-w-56 sm:flex-none"
          />
        }
      >
        <span className="truncate">{active?.name ?? "Scegli un preset"}</span>
        <ChevronDown className="w-4 h-4 opacity-60" />
      </PopoverTrigger>
      <PopoverContent align="start" className="w-72 p-1">
        <div className="max-h-80 overflow-auto">
          {byName(presets).map((p) => (
            <button
              key={p.id}
              type="button"
              className={cn(
                "w-full rounded-sm px-2 py-2 text-left hover:bg-accent",
                p.id === activeId && "bg-accent/60"
              )}
              onClick={() => {
                onSelect(p.id);
                setOpen(false);
              }}
            >
              <div className="truncate text-sm font-medium">{p.name}</div>
              <div className="truncate text-xs text-muted-foreground">
                {countsLabel(
                  knownRetailers(p.retailers, bySlug).length,
                  p.products.length
                )}
              </div>
            </button>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
};

export default PresetSelect;
```

`src/components/Bottombar.tsx`, sostituzione completa. Ora compare solo nella pagina Risultati:

```tsx
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { Preset } from "@/lib/presets";
import type { Retailer } from "@shared/types";
import PresetSelect from "./PresetSelect";

interface Props {
  presets: Preset[];
  activeId: string | null;
  bySlug: ReadonlyMap<string, Retailer>;
  onSelectPreset: (id: string) => void;
  loading: boolean;
  canSearch: boolean;
  onSearch: () => void;
}

const Bottombar = ({
  presets,
  activeId,
  bySlug,
  onSelectPreset,
  loading,
  canSearch,
  onSearch,
}: Props) => (
  <div
    className="fixed bottom-0 inset-x-0 z-40 bg-background border-t"
    style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
  >
    <div className="container flex items-center gap-2 py-3">
      {presets.length > 0 && (
        <PresetSelect
          presets={presets}
          activeId={activeId}
          bySlug={bySlug}
          onSelect={onSelectPreset}
        />
      )}
      <div className="flex-1" />
      <Button onClick={onSearch} disabled={!canSearch || loading}>
        <span>Cerca</span>
        {loading && <Spinner />}
      </Button>
    </div>
  </div>
);

export default Bottombar;
```

- [ ] **Passo 8: aggiorna `App.tsx`**

- **Togli:**
  - gli import e gli stati di `Wizard`, `PresetNameDialog` e `PresetDeleteDialog`;
  - `createOpen`, `createInitialName`, `createInitialSource`, `renameTarget`, `deleteTarget`;
  - `flyers` e `products` come stato;
  - l'effetto dei `legacyCity`;
  - `onToggleRetailer`, `applyPreset`, `onCreatePreset`, `onRequestCreate`, `onRequestDuplicate`, `onRenamePreset`, `onDeletePreset`, `onUpdateActive`, `onResetToActive` e `dirty`;
  - la costante `initialPresets` e i suoi dintorni a livello di modulo.
- **Tieni:** tutto ciò che riguarda le liste, così com'è.

La parte iniziale e quella dei preset diventano:

```tsx
import { useEffect, useState } from "react";
import type {
  Flyer as FlyerI,
  Place,
  ScrapeMessage,
  ScrapeRequest,
} from "@shared/types";
import ResultsView from "./components/ResultsView";
import ListsView from "./components/ListsView";
import Topbar, { type View } from "./components/Topbar";
import Bottombar from "./components/Bottombar";
import Footer from "./components/Footer";
import ListEditDialog from "./components/ListEditDialog";
import ConfirmDialog from "./components/ConfirmDialog";
import { loadLegacyActivePlace } from "./lib/presets";
import { usePresets } from "./lib/usePresets";
import { useCatalog } from "./lib/useCatalog";
import {
  loadLists,
  saveLists,
  createList,
  makeSavedItem,
  itemKey,
  isExpired,
  type List,
  type RowData,
} from "./lib/lists";
import { DEFAULT_PLACE, loadPlace, savePlace } from "./lib/places";
import { knownRetailers, toSelection } from "./lib/retailers";

const App = () => {
  const catalog = useCatalog();
  const { presets, active, activeId, setActiveId } = usePresets(
    catalog.retailers
  );
  const [place, setPlace] = useState<Place>(
    () => loadPlace() ?? loadLegacyActivePlace() ?? DEFAULT_PLACE
  );
  const [results, setResults] = useState<FlyerI[]>([]);
  const [loading, setLoading] = useState(false);
  const [view, setView] = useState<View>("main");

  // …stati delle liste invariati…

  useEffect(() => savePlace(place), [place]);
  useEffect(() => {
    saveLists(lists);
  }, [lists]);

  const searchRetailers = active
    ? knownRetailers(active.retailers, catalog.bySlug)
    : [];
  const canSearch =
    !!active && searchRetailers.length > 0 && active.products.length > 0;

  const onSearch = async () => {
    if (!active || !canSearch) return;
    setLoading(true);
    setResults([]);
    try {
      const request: ScrapeRequest = {
        place,
        flyers: searchRetailers.map(toSelection),
        products: active.products,
      };
      // …same fetch + NDJSON reading loop as today's onRun, unchanged…
    } finally {
      setLoading(false);
    }
  };

  const onSelectPreset = (id: string) => {
    setActiveId(id);
    setResults([]);
  };
```

Nel JSX:
- `<Topbar … place={place} onPlaceChange={setPlace} />` resta com'è.
- Il ramo che non è `lists` diventa:

  ```tsx
  <ResultsView
    preset={active}
    bySlug={catalog.bySlug}
    results={results}
    lists={lists}
    onAddToList={onAddToList}
    onRequestNewList={onRequestNewList}
    onRequestRemoveItem={(row, list) => setRemoveItemTarget({ row, list })}
  />
  ```

- La barra in basso si mostra solo nella pagina Risultati:

  ```tsx
  {view === "main" && (
    <Bottombar
      presets={presets}
      activeId={activeId}
      bySlug={catalog.bySlug}
      onSelectPreset={onSelectPreset}
      loading={loading}
      canSearch={canSearch}
      onSearch={onSearch}
    />
  )}
  ```

- Togli i due `<PresetNameDialog>` e il `<PresetDeleteDialog>`.

- [ ] **Passo 9: elimina il codice rimasto inutilizzato**

```bash
git rm src/components/Wizard.tsx src/components/RetailerPicker.tsx src/components/Flyer.tsx \
  src/components/PresetNameDialog.tsx src/components/PresetDeleteDialog.tsx src/lib/useRetailers.ts
```

In `src/lib/retailers.ts` togli `isRetailer` e tieni `toSelection`, `retailerInitials` e `knownRetailers`. Poi verifica che non resti nessun riferimento:

```bash
grep -rn 'isRetailer\|useRetailers\|RetailerPicker\|PresetNameDialog\|PresetDeleteDialog\|isPresetDirty\|samePlace\|resolveCityName\|DEFAULT_PRESET_NAME\|Wizard' src
```

Atteso: nessun risultato.

- [ ] **Passo 10: controlli, prova veloce e commit**

```bash
bun run format && bun test && bun run typecheck && bun run lint && bun run format:check
```

Atteso: tutto verde.

Poi lancia `bun run dev` e apri http://localhost:5180:
- con i preset già nel browser, la pagina Risultati mostra il riepilogo del preset attivo e Cerca;
- con il `localStorage` vuoto, mostra "Nessun preset".

```bash
git add -A src
git commit -m "feat: presets hold retailers and products only; results page searches the active one

The place moves out of presets into its own storage key. Old presets are
migrated: slugs kept, name-only retailers matched once the list loads.

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 4: Finestra a passi `PresetEditorDialog`

**File:**
- Crea: `src/components/PresetEditorDialog.tsx`

**Interfacce:**
- Usa: `RetailerSelect`, `CatalogState` (Task 2); `isNameTaken`, `Preset`, `PresetDraft` (Task 3); `ConfirmDialog` e `ProductsChipsInput`, che esistono già.
- Fornisce:

  ```ts
  type EditorMode = "create" | "duplicate" | "edit"   // export
  // default export PresetEditorDialog, props:
  {
    open: boolean; onOpenChange: (open: boolean) => void;
    mode: EditorMode; editingId?: string; initial: PresetDraft;
    presets: Preset[]; catalog: CatalogState;
    onSave: (draft: PresetDraft) => void;
  }
  ```

- [ ] **Passo 1: crea il componente**

`src/components/PresetEditorDialog.tsx`:

```tsx
// Create, duplicate or edit a preset in three steps: name, retailers,
// products. Creating goes step by step; editing can jump to any step and
// save at any time.
import { useState } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { isNameTaken, type Preset, type PresetDraft } from "@/lib/presets";
import type { CatalogState } from "@/lib/useCatalog";
import { cn } from "@/lib/utils";
import ConfirmDialog from "./ConfirmDialog";
import ProductsChipsInput from "./ProductsChipsInput";
import RetailerSelect from "./RetailerSelect";

export type EditorMode = "create" | "duplicate" | "edit";

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  mode: EditorMode;
  /** The edited preset, which may keep its own name. */
  editingId?: string;
  initial: PresetDraft;
  presets: Preset[];
  catalog: CatalogState;
  onSave: (draft: PresetDraft) => void;
}

const STEPS = ["Nome", "Insegne", "Prodotti"];
const TITLES: Record<EditorMode, string> = {
  create: "Nuovo preset",
  duplicate: "Duplica preset",
  edit: "Modifica preset",
};

const sameDraft = (a: PresetDraft, b: PresetDraft): boolean =>
  JSON.stringify(a) === JSON.stringify(b);

const PresetEditorDialog = ({
  open,
  onOpenChange,
  mode,
  editingId,
  initial,
  presets,
  catalog,
  onSave,
}: Props) => {
  const [draft, setDraft] = useState(initial);
  const [step, setStep] = useState(0);
  const [showNameError, setShowNameError] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);

  // Start over from `initial`, on the first step, each time it opens.
  const [prevOpen, setPrevOpen] = useState(open);
  if (open !== prevOpen) {
    setPrevOpen(open);
    if (open) {
      setDraft(initial);
      setStep(0);
      setShowNameError(false);
    }
  }

  const free = mode === "edit";
  const last = step === STEPS.length - 1;
  const nameError = !draft.name.trim()
    ? "Scrivi un nome."
    : isNameTaken(presets, draft.name, editingId)
      ? "Esiste già un preset con questo nome."
      : null;

  const save = () => {
    if (nameError) {
      setStep(0);
      setShowNameError(true);
      return;
    }
    onSave({ ...draft, name: draft.name.trim() });
    onOpenChange(false);
  };

  const next = () => {
    if (step === 0 && nameError) {
      setShowNameError(true);
      return;
    }
    setStep(step + 1);
  };

  // Esc, the X and a click outside all land here: ask before losing changes.
  const requestClose = () => {
    if (sameDraft(draft, initial)) onOpenChange(false);
    else setConfirmDiscard(true);
  };

  return (
    <>
      <Dialog
        open={open}
        onOpenChange={(o) => (o ? onOpenChange(true) : requestClose())}
      >
        <DialogContent className="flex max-h-[calc(100dvh-2rem)] flex-col sm:max-w-2xl">
          <DialogHeader>
            <DialogTitle>{TITLES[mode]}</DialogTitle>
          </DialogHeader>

          <ol className="flex flex-wrap items-center gap-1 text-sm">
            {STEPS.map((label, i) => (
              <li key={label} className="flex items-center gap-1">
                {i > 0 && <span aria-hidden className="h-px w-4 bg-border" />}
                <button
                  type="button"
                  disabled={!free}
                  aria-current={i === step ? "step" : undefined}
                  onClick={() => setStep(i)}
                  className={cn(
                    "flex items-center gap-1.5 rounded-md px-1.5 py-1 disabled:cursor-default",
                    i === step
                      ? "font-medium text-foreground"
                      : "text-muted-foreground",
                    free && i !== step && "hover:bg-accent"
                  )}
                >
                  <span
                    className={cn(
                      "flex size-5 items-center justify-center rounded-full border text-xs",
                      i === step && "border-primary bg-primary text-primary-foreground"
                    )}
                  >
                    {!free && i < step ? <Check className="size-3" /> : i + 1}
                  </span>
                  {label}
                </button>
              </li>
            ))}
          </ol>

          <div className="min-h-0 flex-1 overflow-y-auto">
            {step === 0 && (
              <div className="grid gap-2">
                <Label htmlFor="preset-name">Nome</Label>
                <Input
                  id="preset-name"
                  autoFocus
                  value={draft.name}
                  aria-invalid={showNameError && !!nameError}
                  onChange={(e) => setDraft({ ...draft, name: e.target.value })}
                  onKeyDown={(e) => {
                    if (e.key !== "Enter") return;
                    e.preventDefault();
                    if (free) save();
                    else next();
                  }}
                />
                {showNameError && nameError && (
                  <p className="text-sm text-destructive">{nameError}</p>
                )}
              </div>
            )}
            {step === 1 && (
              <RetailerSelect
                value={draft.retailers}
                onChange={(retailers) => setDraft({ ...draft, retailers })}
                catalog={catalog}
              />
            )}
            {step === 2 && (
              <div className="grid gap-2">
                <Label>Prodotti</Label>
                <ProductsChipsInput
                  value={draft.products}
                  onChange={(products) => setDraft({ ...draft, products })}
                />
              </div>
            )}
          </div>

          <DialogFooter>
            {!free && step > 0 && (
              <Button variant="outline" onClick={() => setStep(step - 1)}>
                Indietro
              </Button>
            )}
            {free || last ? (
              <Button onClick={save}>Salva</Button>
            ) : (
              <Button onClick={next}>Avanti</Button>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        open={confirmDiscard}
        onOpenChange={setConfirmDiscard}
        title="Scartare le modifiche?"
        description="Le modifiche a questo preset andranno perse."
        confirmLabel="Scarta"
        destructive
        onConfirm={() => onOpenChange(false)}
      />
    </>
  );
};

export default PresetEditorDialog;
```

- [ ] **Passo 2: controlli e commit**

Il componente viene montato nel Task 5 e provato nel Task 6.

```bash
bun run format && bun test && bun run typecheck && bun run lint && bun run format:check
git add src/components/PresetEditorDialog.tsx
git commit -m "feat: step-by-step dialog to create, duplicate and edit presets

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 5: Pagina Preset e collegamenti

**File:**
- Crea: `src/components/PresetsView.tsx`
- Modifica: `src/components/Topbar.tsx` (tab "Preset"), `src/components/ResultsView.tsx` (pulsante "Crea preset" nello stato vuoto, "Modifica" nel riepilogo), `src/components/PresetSummary.tsx` (prop `onEdit`), `src/App.tsx` (editor, conferma di eliminazione)

**Interfacce:**
- Usa: `PresetEditorDialog`, `EditorMode` (Task 4); `usePresets` (`create`, `update`, `remove`), `copyName`, `EMPTY_DRAFT`, `byName`, `countsLabel` (Task 3); `RetailerLogos` (Task 3); `knownRetailers` (Task 2).
- Fornisce:
  - `View = "main" | "presets" | "lists"`;
  - `PresetsView` (default export) con le props `{ presets: Preset[]; bySlug: ReadonlyMap<string, Retailer>; onRequestCreate: () => void; onRequestEdit: (id: string) => void; onRequestDuplicate: (id: string) => void; onRequestDelete: (id: string) => void }`.

- [ ] **Passo 1: `PresetsView`**

`src/components/PresetsView.tsx`:

```tsx
// The Preset page: every preset, with create, edit, duplicate and delete.
import { Copy, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { byName, countsLabel, type Preset } from "@/lib/presets";
import { knownRetailers } from "@/lib/retailers";
import type { Retailer } from "@shared/types";
import RetailerLogos from "./RetailerLogos";

interface Props {
  presets: Preset[];
  bySlug: ReadonlyMap<string, Retailer>;
  onRequestCreate: () => void;
  onRequestEdit: (id: string) => void;
  onRequestDuplicate: (id: string) => void;
  onRequestDelete: (id: string) => void;
}

const PresetsView = ({
  presets,
  bySlug,
  onRequestCreate,
  onRequestEdit,
  onRequestDuplicate,
  onRequestDelete,
}: Props) => {
  if (presets.length === 0)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>Nessun preset</EmptyTitle>
          <EmptyDescription>
            Crea un preset con le insegne e i prodotti da cercare.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onRequestCreate}>
            <Plus /> Crea preset
          </Button>
        </EmptyContent>
      </Empty>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Preset</h1>
        <Button onClick={onRequestCreate}>
          <Plus /> Nuovo preset
        </Button>
      </div>
      <ItemGroup className="gap-2">
        {byName(presets).map((p) => {
          const retailers = knownRetailers(p.retailers, bySlug);
          return (
            <Item key={p.id} variant="outline">
              {retailers.length > 0 && (
                <ItemMedia>
                  <RetailerLogos retailers={retailers} max={3} />
                </ItemMedia>
              )}
              <ItemContent>
                <ItemTitle>{p.name}</ItemTitle>
                <ItemDescription>
                  {countsLabel(retailers.length, p.products.length)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Modifica ${p.name}`}
                  onClick={() => onRequestEdit(p.id)}
                >
                  <Pencil />
                  <span className="hidden sm:inline">Modifica</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Duplica ${p.name}`}
                  onClick={() => onRequestDuplicate(p.id)}
                >
                  <Copy />
                  <span className="hidden sm:inline">Duplica</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  aria-label={`Elimina ${p.name}`}
                  onClick={() => onRequestDelete(p.id)}
                >
                  <Trash2 />
                  <span className="hidden sm:inline">Elimina</span>
                </Button>
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </div>
  );
};

export default PresetsView;
```

- [ ] **Passo 2: tab "Preset" nella barra in alto**

In `src/components/Topbar.tsx`:
- `export type View = "main" | "presets" | "lists";`
- sostituisci i due `<button>` della `<nav>` con un elenco unico:

```tsx
const TABS: { view: View; label: string }[] = [
  { view: "main", label: "Risultati" },
  { view: "presets", label: "Preset" },
  { view: "lists", label: "Le mie liste" },
];
```

```tsx
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
```

- [ ] **Passo 3: azioni da Risultati**

- In `src/components/PresetSummary.tsx`:
  - aggiungi la prop `onEdit: () => void`;
  - nel `CardHeader` aggiungi:

    ```tsx
    <CardAction>
      <Button variant="ghost" size="sm" onClick={onEdit}>
        <Pencil /> Modifica
      </Button>
    </CardAction>
    ```

  - aggiungi gli import `CardAction` da `@/components/ui/card`, `Button` e `Pencil` da `lucide-react`.
- In `src/components/ResultsView.tsx`:
  - aggiungi le props `onRequestCreate: () => void` e `onRequestEdit: () => void`;
  - passa `onEdit={onRequestEdit}` a `PresetSummary`;
  - nello stato vuoto, dopo `</EmptyHeader>`, aggiungi:

    ```tsx
    <EmptyContent>
      <Button onClick={onRequestCreate}>
        <Plus /> Crea preset
      </Button>
    </EmptyContent>
    ```

  - aggiungi gli import `EmptyContent`, `Button` e `Plus`.

- [ ] **Passo 4: collega tutto in `App.tsx`**

```tsx
import PresetsView from "./components/PresetsView";
import PresetEditorDialog, { type EditorMode } from "./components/PresetEditorDialog";
import { copyName, EMPTY_DRAFT, type PresetDraft } from "./lib/presets";
```

```tsx
const { presets, active, activeId, setActiveId, create, update, remove } =
  usePresets(catalog.retailers);

// The editor keeps its last content while it closes (no title flicker).
const [editor, setEditor] = useState<{
  mode: EditorMode;
  editingId?: string;
  initial: PresetDraft;
}>({ mode: "create", initial: EMPTY_DRAFT });
const [editorOpen, setEditorOpen] = useState(false);
const [deletePresetId, setDeletePresetId] = useState<string | null>(null);
const deletePreset = presets.find((p) => p.id === deletePresetId) ?? null;

const draftOf = (id: string): PresetDraft | null => {
  const p = presets.find((x) => x.id === id);
  return p ? { name: p.name, retailers: p.retailers, products: p.products } : null;
};

const openCreate = () => {
  setView("presets");
  setEditor({ mode: "create", initial: EMPTY_DRAFT });
  setEditorOpen(true);
};

const openEdit = (id: string) => {
  const initial = draftOf(id);
  if (!initial) return;
  setEditor({ mode: "edit", editingId: id, initial });
  setEditorOpen(true);
};

const openDuplicate = (id: string) => {
  const source = draftOf(id);
  if (!source) return;
  setEditor({
    mode: "duplicate",
    initial: { ...source, name: copyName(presets, source.name) },
  });
  setEditorOpen(true);
};

const onSaveEditor = (draft: PresetDraft) => {
  if (editor.mode === "edit" && editor.editingId)
    update(editor.editingId, draft);
  else {
    create(draft);
    setResults([]);
  }
};

const onConfirmDeletePreset = () => {
  if (!deletePresetId) return;
  if (deletePresetId === activeId) setResults([]);
  remove(deletePresetId);
  setDeletePresetId(null);
};
```

Nel JSX, il contenuto di `<main>` sceglie la vista così:

```tsx
{view === "lists" ? (
  <ListsView …invariato… />
) : view === "presets" ? (
  <PresetsView
    presets={presets}
    bySlug={catalog.bySlug}
    onRequestCreate={openCreate}
    onRequestEdit={openEdit}
    onRequestDuplicate={openDuplicate}
    onRequestDelete={setDeletePresetId}
  />
) : (
  <ResultsView
    …come nel Task 3…
    onRequestCreate={openCreate}
    onRequestEdit={() => active && openEdit(active.id)}
  />
)}
```

E, accanto agli altri dialog:

```tsx
<PresetEditorDialog
  open={editorOpen}
  onOpenChange={setEditorOpen}
  mode={editor.mode}
  editingId={editor.editingId}
  initial={editor.initial}
  presets={presets}
  catalog={catalog}
  onSave={onSaveEditor}
/>

<ConfirmDialog
  open={deletePresetId !== null}
  onOpenChange={(o) => !o && setDeletePresetId(null)}
  title={`Eliminare il preset «${deletePreset?.name ?? ""}»?`}
  description="L'azione non può essere annullata."
  confirmLabel="Elimina"
  destructive
  onConfirm={onConfirmDeletePreset}
/>
```

- [ ] **Passo 5: controlli e commit**

```bash
bun run format && bun test && bun run typecheck && bun run lint && bun run format:check
git add -A src
git commit -m "feat: Preset page to create, duplicate, edit and delete presets

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```

---

### Task 6: Prova nel browser e README

Si fa con playwright-core e il Chromium di sistema, usando il driver che c'è già fuori dal repo, in `/tmp/claude-1000/-home-giacomo-Workspace-Giacomo-Rossi-dove-conviene-scraper/4547e2f4-ce0e-439e-8af9-657ad654946f/scratchpad/driver/`, che ha già `playwright-core`. La risposta di `/api/scraper` è simulata.

**File:**
- Crea (fuori dal repo, non va nel commit): `<driver>/presets-e2e.ts`
- Modifica: `README.md`

- [ ] **Passo 1: avvia l'app**

```bash
source ~/.nvm/nvm.sh && nvm use && bun run dev   # in background; attendi "Local: http://localhost:5180/"
```

Se un `bun run dev` è già in esecuzione, riavvialo, perché il server deve vedere il codice nuovo.

- [ ] **Passo 2: scrivi lo script**

`<driver>/presets-e2e.ts`:

```ts
// End-to-end check of the Preset page. App on :5180, /api/scraper mocked.
import { chromium, type Page } from "playwright-core";

const BASE = "http://localhost:5180/";
const browser = await chromium.launch({
  executablePath: "/usr/bin/chromium-browser",
});
let failures = 0;
const check = (ok: boolean, label: string) => {
  console.log(`${ok ? "OK  " : "FAIL"} ${label}`);
  if (!ok) failures++;
};

const MOCK_LINE = JSON.stringify({
  flyer: {
    name: "Conad City",
    imageUrl: "",
    category: { name: "Iper e super", url: "" },
    slug: "conad-city",
    url: "https://www.doveconviene.it/x?flyerId=1&flyerPage=1",
    validUntil: "2099-01-01",
    products: [{ name: "Pizza Margherita", imageUrl: null, price: 2.49 }],
  },
});

/** A new page whose localStorage starts as `storage` (kept across reloads). */
async function open(
  storage: Record<string, string> = {},
  viewport = { width: 1280, height: 900 }
): Promise<Page> {
  const page = await browser.newPage({ viewport });
  await page.addInitScript((s) => {
    if (sessionStorage.getItem("seeded")) return;
    localStorage.clear();
    for (const [k, v] of Object.entries(s)) localStorage.setItem(k, v);
    sessionStorage.setItem("seeded", "1");
  }, storage);
  await page.route("**/api/scraper", (route) =>
    route.fulfill({ contentType: "application/x-ndjson", body: `${MOCK_LINE}\n` })
  );
  await page.goto(BASE);
  return page;
}

const dialog = (page: Page) => page.getByRole("dialog").first();
const row = (page: Page, name: string) =>
  page.locator("label", { has: page.getByText(name, { exact: true }) });

// 1. Empty state → create
let page = await open();
check(await page.getByText("Nessun preset").isVisible(), "1 stato vuoto in Risultati");
await page.getByRole("button", { name: "Crea preset" }).click();
check(await dialog(page).getByText("Nuovo preset").isVisible(), "1 Crea preset apre la finestra");
check(
  (await page.getByRole("button", { name: "Preset", exact: true }).getAttribute("aria-current")) === "page",
  "1 e porta alla pagina Preset"
);

// 2. Step by step, with filters; clicking the row and the box toggles once
await dialog(page).getByRole("button", { name: "Avanti" }).click();
check(await page.getByText("Scrivi un nome.").isVisible(), "2 nome obbligatorio");
await page.getByLabel("Nome").fill("Spesa");
const t0 = Date.now();
await dialog(page).getByRole("button", { name: "Avanti" }).click();
// The whole list (937) without filters: rendering must stay quick.
await dialog(page).locator("label").nth(900).waitFor({ timeout: 5_000 });
const ms = Date.now() - t0;
check(ms < 1_500, `2 elenco completo visibile in ${ms} ms`);
await page.getByLabel("Cerca per nome").fill("conad");
await page.getByRole("combobox", { name: "Categoria" }).click();
await page.getByRole("option", { name: "Iper e super" }).click();
await row(page, "Conad City").getByText("Conad City", { exact: true }).click();
await row(page, "Conad").getByRole("checkbox").click();
check(
  (await row(page, "Conad City").getByRole("checkbox").getAttribute("aria-checked")) === "true",
  "2 clic sulla riga seleziona"
);
check(
  (await row(page, "Conad").getByRole("checkbox").getAttribute("aria-checked")) === "true",
  "2 clic sulla casella seleziona una volta sola"
);
await dialog(page).getByRole("button", { name: "2 selezionate" }).click();
check((await dialog(page).locator("label").count()) === 2, "2 solo selezionate");
await dialog(page).getByRole("button", { name: "Avanti" }).click();
await dialog(page).getByRole("textbox").fill("pizza margherita, 3");
await dialog(page).getByRole("textbox").press("Enter");
await dialog(page).getByRole("button", { name: "Salva" }).click();
await page.waitForTimeout(300);
check(await page.getByText("2 insegne · 1 prodotto").isVisible(), "2 preset salvato in elenco");

// 3. Duplicate
await page.getByRole("button", { name: "Duplica Spesa" }).click();
check(
  (await page.getByLabel("Nome").inputValue()) === "Copia di Spesa",
  "3 nome Copia di …"
);
await dialog(page).getByRole("button", { name: "Avanti" }).click();
await dialog(page).getByRole("button", { name: "Avanti" }).click();
await dialog(page).getByRole("button", { name: "Salva" }).click();
await page.waitForTimeout(300);
check(await page.getByText("Copia di Spesa").isVisible(), "3 copia in elenco");

// 4. Name already taken
await page.getByRole("button", { name: "Nuovo preset" }).click();
await page.getByLabel("Nome").fill(" spesa ");
await dialog(page).getByRole("button", { name: "Avanti" }).click();
check(
  await page.getByText("Esiste già un preset con questo nome.").isVisible(),
  "4 nome già usato"
);

// 6 (part one). Esc with changes asks; Scarta closes
await page.keyboard.press("Escape");
check(await page.getByText("Scartare le modifiche?").isVisible(), "6 Esc chiede conferma");
await page.getByRole("button", { name: "Scarta" }).click();
await page.waitForTimeout(300);
check((await page.getByRole("dialog").count()) === 0, "6 Scarta chiude");

// 5. Edit by jumping straight to Prodotti
await page.getByRole("button", { name: "Modifica Spesa" }).click();
await dialog(page).getByRole("button", { name: /Prodotti/ }).click();
await dialog(page).getByRole("textbox").fill("nutella");
await dialog(page).getByRole("textbox").press("Enter");
await dialog(page).getByRole("button", { name: "Salva" }).click();
await page.waitForTimeout(300);
check(await page.getByText("2 insegne · 2 prodotti").isVisible(), "5 modifica saltando al passo 3");

// 6 (part two). X with changes, cancel keeps the changes
await page.getByRole("button", { name: "Modifica Spesa" }).click();
await page.getByLabel("Nome").fill("Spesa grande");
await dialog(page).getByRole("button", { name: "Close" }).click();
check(await page.getByText("Scartare le modifiche?").isVisible(), "6 la X chiede conferma");
await page.getByRole("button", { name: "Annulla" }).click();
check(
  (await page.getByLabel("Nome").inputValue()) === "Spesa grande",
  "6 Annulla tiene le modifiche"
);
await page.keyboard.press("Escape");
await page.getByRole("button", { name: "Scarta" }).click();

// 7. Results: summary, select, search
await page.getByRole("button", { name: "Risultati", exact: true }).click();
check(await page.getByText("Copia di Spesa").first().isVisible(), "7 riepilogo del preset attivo");
await page.getByRole("button", { name: "Copia di Spesa" }).click();
await page.getByRole("button", { name: /^Spesa/ }).click();
await page.getByRole("button", { name: "Cerca", exact: true }).click();
await page.waitForTimeout(500);
check(await page.getByText("Pizza Margherita").isVisible(), "7 ricerca mostra i risultati");

// 8. Deleting the active preset
await page.getByRole("button", { name: "Preset", exact: true }).click();
await page.getByRole("button", { name: "Elimina Spesa" }).click();
await page.getByRole("button", { name: "Elimina", exact: true }).click();
await page.getByRole("button", { name: "Risultati", exact: true }).click();
check(await page.getByText("Copia di Spesa").first().isVisible(), "8 diventa attivo il più recente");
await page.close();

// 9. Old presets: name-only retailers, place from the old active preset
const oldPresets = JSON.stringify([
  {
    id: "old",
    name: "Vecchio",
    place: { name: "Reggiolo", zip: "42046", lat: 44.92, lng: 10.8 },
    flyers: [{ name: "Conad City", imageUrl: "", category: { name: "Iper e super", url: "" } }],
    products: [{ name: "latte" }],
    createdAt: 1,
    updatedAt: 1,
    default: true,
  },
]);
page = await open({
  "dove-conviene:presets": oldPresets,
  "dove-conviene:active-preset": "old",
});
await page.waitForTimeout(1500);
check(await page.getByText("Reggiolo - 42046").isVisible(), "9 località dal vecchio preset");
check(await page.getByText("1 insegna · 1 prodotto").isVisible(), "9 insegna trovata per nome");
await page.reload();
await page.waitForTimeout(1000);
check(await page.getByText("Reggiolo - 42046").isVisible(), "9 località dopo il riavvio");
await page.close();

// 10. Mobile: the editor fits, no sideways scrolling
page = await open({}, { width: 390, height: 844 });
await page.getByRole("button", { name: "Crea preset" }).click();
await page.getByLabel("Nome").fill("Mobile");
await dialog(page).getByRole("button", { name: "Avanti" }).click();
const box = await dialog(page).boundingBox();
check(!!box && box.width <= 390, "10 la finestra sta nello schermo");
check(
  await page.evaluate(() => document.documentElement.scrollWidth <= 390),
  "10 nessuno scorrimento orizzontale"
);
await page.screenshot({ path: "presets-mobile.png" });
await page.close();

await browser.close();
console.log(failures === 0 ? "\nTUTTO OK" : `\n${failures} FALLITI`);
process.exit(failures === 0 ? 0 : 1);
```

- [ ] **Passo 3: esegui lo script e correggi**

```bash
cd <driver> && bun presets-e2e.ts
```

Atteso: tutte le righe `OK` e poi `TUTTO OK`.

Se una riga fallisce, guarda prima la pagina, per esempio con `page.screenshot` o `page.content()` nello scenario.
- **Se è sbagliato il selettore dello script:** correggi lo script.
- **Se è sbagliata l'app:** correggila nel task che possiede quel codice, poi ripeti lo script.

Guarda anche lo screenshot mobile `presets-mobile.png`.

- [ ] **Passo 4: README**

In `README.md`:
- nell'introduzione, sostituisci "e le ricerche in preset (salvati in `localStorage`)" con: "e le ricerche in preset (insegne + prodotti, gestiti nella pagina Preset e salvati in `localStorage`; la località resta nella barra in alto)";
- nella struttura, sostituisci la riga di `lib/` con:

```
  lib/             preset, liste e località (localStorage), filtri insegne
```

- [ ] **Passo 5: controlli finali e commit**

```bash
bun run format && bun test && bun run typecheck && bun run lint && bun run format:check
git add README.md
git commit -m "docs: presets live in their own page

Co-Authored-By: Claude Opus 5.5 (1M context) <noreply@anthropic.com>"
```
