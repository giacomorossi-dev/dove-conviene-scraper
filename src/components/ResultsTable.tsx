import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ExternalLink,
} from "lucide-react";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
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
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { formatDate, formatPrice } from "@/lib/format";
import {
  filterRows,
  sortRows,
  type ResultSort,
  type ResultSortKey,
} from "@/lib/results";
import { flyerLabel, isExpired, itemKey, type RowData } from "@/lib/shopping";
import { cn } from "@/lib/utils";
import CartButton from "./CartButton";

interface Props {
  rows: RowData[];
  isInCart: (row: RowData) => boolean;
  onToggleCart: (row: RowData) => void;
}

const price = (r: RowData) => (r.price === null ? "—" : formatPrice(r.price));
const date = (r: RowData) => (r.validUntil ? formatDate(r.validUntil) : "—");

/** The phone layout has no column headers: the order is picked here. */
const SORT_ITEMS: { label: string; value: string }[] = [
  { label: "Scadenza più vicina", value: "validUntil:asc" },
  { label: "Scadenza più lontana", value: "validUntil:desc" },
  { label: "Prezzo più basso", value: "price:asc" },
  { label: "Prezzo più alto", value: "price:desc" },
  { label: "Prodotto (A-Z)", value: "productName:asc" },
  { label: "Volantino (A-Z)", value: "flyerName:asc" },
];

interface SortHeaderProps {
  sortKey: ResultSortKey;
  label: string;
  sort: ResultSort;
  onSort: (key: ResultSortKey) => void;
  className?: string;
}

const SortHeader = ({
  sortKey,
  label,
  sort,
  onSort,
  className,
}: SortHeaderProps) => (
  <button
    type="button"
    onClick={() => onSort(sortKey)}
    className={cn(
      "inline-flex items-center gap-1 hover:text-foreground transition-colors",
      sort.key === sortKey ? "text-foreground" : "text-muted-foreground",
      className
    )}
  >
    {label}
    {sort.key === sortKey ? (
      sort.dir === "asc" ? (
        <ChevronUp className="w-3 h-3" />
      ) : (
        <ChevronDown className="w-3 h-3" />
      )
    ) : (
      <ChevronsUpDown className="w-3 h-3 opacity-50" />
    )}
  </button>
);

/** The flyer a product is in: its cover, "Conad · BIS", a link to it. */
const FlyerLink = ({ r }: { r: RowData }) => {
  const name = flyerLabel(r.flyerName, r.flyerTitle);
  const cover = r.flyerImage && (
    <img
      src={r.flyerImage}
      alt=""
      loading="lazy"
      className="h-8 w-6 shrink-0 rounded-sm bg-muted object-cover object-top"
    />
  );
  return r.flyerUrl ? (
    <a
      href={r.flyerUrl}
      target="_blank"
      rel="noopener noreferrer"
      className="inline-flex items-center gap-1.5 hover:underline"
    >
      {cover}
      {name}
      <ExternalLink className="w-3 h-3 shrink-0" />
    </a>
  ) : (
    <span className="inline-flex items-center gap-1.5">
      {cover}
      {name}
    </span>
  );
};

const ResultsTable = ({ rows, isInCart, onToggleCart }: Props) => {
  const [sort, setSort] = useState<ResultSort>({
    key: "validUntil",
    dir: "asc",
  });
  const [search, setSearch] = useState("");
  const [hideExpired, setHideExpired] = useState(false);

  // Stable keys, so re-sorting moves rows instead of reloading their images.
  const keys = useMemo(() => {
    const seen = new Map<string, number>();
    return new Map(
      rows.map((r) => {
        const key = itemKey(r);
        const n = seen.get(key) ?? 0;
        seen.set(key, n + 1);
        return [r, `${key}#${n}`] as const;
      })
    );
  }, [rows]);

  const sorted = useMemo(
    () => sortRows(filterRows(rows, search, hideExpired), sort),
    [rows, search, hideExpired, sort]
  );

  const toggleSort = (key: ResultSortKey) =>
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );

  const ariaSort = (key: ResultSortKey) =>
    sort.key === key
      ? sort.dir === "asc"
        ? "ascending"
        : "descending"
      : "none";

  if (rows.length === 0) return null;

  const count = `${sorted.length} prodott${sorted.length === 1 ? "o" : "i"}${
    sorted.length !== rows.length ? ` di ${rows.length}` : ""
  }`;

  return (
    <div className="grid gap-3">
      <div className="flex flex-wrap items-center gap-3">
        <Input
          placeholder="Cerca prodotto o volantino..."
          aria-label="Filtra i risultati"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="max-w-xs"
        />
        <label className="flex items-center gap-2 text-sm cursor-pointer">
          <input
            type="checkbox"
            checked={hideExpired}
            onChange={(e) => setHideExpired(e.target.checked)}
            className="h-4 w-4 accent-foreground"
          />
          Nascondi scaduti
        </label>
        <Select
          items={SORT_ITEMS}
          value={`${sort.key}:${sort.dir}`}
          onValueChange={(v) => {
            if (!v) return;
            const [key, dir] = v.split(":");
            setSort({
              key: key as ResultSortKey,
              dir: dir as ResultSort["dir"],
            });
          }}
        >
          <SelectTrigger className="w-52 sm:hidden" aria-label="Ordina">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {SORT_ITEMS.map((s) => (
                <SelectItem key={s.value} value={s.value}>
                  {s.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <span
          className="text-xs text-muted-foreground ml-auto"
          aria-live="polite"
        >
          {count}
        </span>
      </div>

      {sorted.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nessun risultato per i filtri attivi
        </div>
      ) : (
        <>
          {/* Phones: one card per product, price and cart always in view. */}
          <ul className="grid gap-2 sm:hidden">
            {sorted.map((r) => (
              <li key={keys.get(r)}>
                <Item
                  size="sm"
                  variant="outline"
                  className={cn(isExpired(r.validUntil) && "opacity-50")}
                >
                  {r.productImage && (
                    <ItemMedia variant="image">
                      <img src={r.productImage} alt="" loading="lazy" />
                    </ItemMedia>
                  )}
                  <ItemContent>
                    <ItemTitle>{r.productName}</ItemTitle>
                    <ItemDescription className="flex flex-wrap items-center gap-x-2">
                      <FlyerLink r={r} />
                      <span>scade {date(r)}</span>
                    </ItemDescription>
                  </ItemContent>
                  <ItemActions>
                    <span className="font-medium whitespace-nowrap">
                      {price(r)}
                    </span>
                    <CartButton
                      inList={isInCart(r)}
                      onToggle={() => onToggleCart(r)}
                    />
                  </ItemActions>
                </Item>
              </li>
            ))}
          </ul>

          <div className="hidden sm:block">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="w-20"></TableHead>
                  <TableHead aria-sort={ariaSort("productName")}>
                    <SortHeader
                      sortKey="productName"
                      label="Prodotto"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  </TableHead>
                  <TableHead aria-sort={ariaSort("flyerName")}>
                    <SortHeader
                      sortKey="flyerName"
                      label="Volantino"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  </TableHead>
                  <TableHead
                    className="w-32"
                    aria-sort={ariaSort("validUntil")}
                  >
                    <SortHeader
                      sortKey="validUntil"
                      label="Scadenza"
                      sort={sort}
                      onSort={toggleSort}
                    />
                  </TableHead>
                  <TableHead
                    className="w-28 text-right"
                    aria-sort={ariaSort("price")}
                  >
                    <SortHeader
                      sortKey="price"
                      label="Prezzo"
                      sort={sort}
                      onSort={toggleSort}
                      className="ml-auto"
                    />
                  </TableHead>
                  <TableHead className="w-12">
                    <span className="sr-only">Lista della spesa</span>
                  </TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {sorted.map((r) => (
                  <TableRow
                    key={keys.get(r)}
                    className={cn(isExpired(r.validUntil) && "opacity-50")}
                  >
                    <TableCell>
                      {r.productImage ? (
                        <img
                          src={r.productImage}
                          alt=""
                          className="w-16 h-16 object-contain"
                          loading="lazy"
                        />
                      ) : (
                        <div className="w-16 h-16 rounded bg-muted" />
                      )}
                    </TableCell>
                    <TableCell className="font-medium whitespace-normal">
                      {r.productName}
                    </TableCell>
                    <TableCell>
                      <FlyerLink r={r} />
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {date(r)}
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {price(r)}
                    </TableCell>
                    <TableCell>
                      <CartButton
                        inList={isInCart(r)}
                        onToggle={() => onToggleCart(r)}
                      />
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}
    </div>
  );
};

export default ResultsTable;
