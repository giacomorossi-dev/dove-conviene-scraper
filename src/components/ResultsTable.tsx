import { useMemo, useState } from "react";
import {
  ChevronDown,
  ChevronUp,
  ChevronsUpDown,
  ExternalLink,
} from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Input } from "@/components/ui/input";
import SaveToListMenu from "./SaveToListMenu";
import {
  findItemList,
  isExpired,
  itemKey,
  type List,
  type RowData,
} from "@/lib/lists";
import { cn } from "@/lib/utils";

interface Props {
  rows: RowData[];
  lists: List[];
  onAddToList: (listId: string, row: RowData) => void;
  onRequestNewList: (row: RowData) => void;
  onRequestRemove: (row: RowData, list: List) => void;
  emptyMessage?: string;
}

type SortKey = "productName" | "flyerName" | "validUntil" | "price";
type SortDir = "asc" | "desc";

const formatPrice = (n: number | null): string =>
  n === null ? "—" : `€ ${n.toFixed(2).replace(".", ",")}`;

const formatDate = (iso: string | null): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("it-IT", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
};

const dateValue = (iso: string | null): number =>
  iso
    ? new Date(iso).getTime() || Number.MAX_SAFE_INTEGER
    : Number.MAX_SAFE_INTEGER;

const ResultsTable = ({
  rows,
  lists,
  onAddToList,
  onRequestNewList,
  onRequestRemove,
  emptyMessage = "Nessun prodotto da visualizzare",
}: Props) => {
  const [sort, setSort] = useState<{ key: SortKey; dir: SortDir }>({
    key: "validUntil",
    dir: "asc",
  });
  const [search, setSearch] = useState("");
  const [hideExpired, setHideExpired] = useState(false);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return rows.filter((r) => {
      if (hideExpired && isExpired(r.validUntil)) return false;
      if (!q) return true;
      return (
        r.productName.toLowerCase().includes(q) ||
        r.flyerName.toLowerCase().includes(q)
      );
    });
  }, [rows, search, hideExpired]);

  const sorted = useMemo(() => {
    const arr = [...filtered];
    arr.sort((a, b) => {
      const sign = sort.dir === "asc" ? 1 : -1;
      switch (sort.key) {
        case "productName":
          return sign * a.productName.localeCompare(b.productName, "it");
        case "flyerName":
          return sign * a.flyerName.localeCompare(b.flyerName, "it");
        case "validUntil":
          return sign * (dateValue(a.validUntil) - dateValue(b.validUntil));
        case "price": {
          const av = a.price ?? Number.MAX_SAFE_INTEGER;
          const bv = b.price ?? Number.MAX_SAFE_INTEGER;
          return sign * (av - bv);
        }
      }
    });
    return arr;
  }, [filtered, sort]);

  const toggleSort = (key: SortKey) => {
    setSort((prev) =>
      prev.key === key
        ? { key, dir: prev.dir === "asc" ? "desc" : "asc" }
        : { key, dir: "asc" }
    );
  };

  const SortHeader = ({
    sortKey,
    label,
    className,
  }: {
    sortKey: SortKey;
    label: string;
    className?: string;
  }) => (
    <button
      type="button"
      onClick={() => toggleSort(sortKey)}
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

  const filterBar =
    rows.length > 0 ? (
      <div className="flex flex-wrap items-center gap-3 mb-3">
        <Input
          placeholder="Cerca prodotto o volantino..."
          value={search}
          onInput={(e) => setSearch(e.currentTarget.value)}
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
        <span className="text-xs text-muted-foreground ml-auto">
          {sorted.length}
          {sorted.length !== rows.length && ` di ${rows.length}`}
        </span>
      </div>
    ) : null;

  if (rows.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <div>
      {filterBar}
      {sorted.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nessun risultato per i filtri attivi
        </div>
      ) : (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-20"></TableHead>
              <TableHead>
                <SortHeader sortKey="productName" label="Prodotto" />
              </TableHead>
              <TableHead>
                <SortHeader sortKey="flyerName" label="Volantino" />
              </TableHead>
              <TableHead className="w-32">
                <SortHeader sortKey="validUntil" label="Scadenza" />
              </TableHead>
              <TableHead className="w-28 text-right">
                <SortHeader
                  sortKey="price"
                  label="Prezzo"
                  className="ml-auto"
                />
              </TableHead>
              <TableHead className="w-48">Lista</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sorted.map((r, i) => {
              const expired = isExpired(r.validUntil);
              const currentList = findItemList(lists, itemKey(r));
              return (
                <TableRow key={i} className={cn(expired && "opacity-50")}>
                  <TableCell>
                    {r.productImage ? (
                      <img
                        src={r.productImage}
                        alt={r.productName}
                        className="w-16 h-16 object-contain"
                        loading="lazy"
                      />
                    ) : (
                      <div className="w-16 h-16 rounded bg-muted" />
                    )}
                  </TableCell>
                  <TableCell className="font-medium">{r.productName}</TableCell>
                  <TableCell>
                    {r.flyerUrl ? (
                      <a
                        href={r.flyerUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1 hover:underline"
                      >
                        {r.flyerName}
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    ) : (
                      <span>{r.flyerName}</span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm text-muted-foreground">
                    {formatDate(r.validUntil)}
                  </TableCell>
                  <TableCell className="text-right font-medium">
                    {formatPrice(r.price)}
                  </TableCell>
                  <TableCell>
                    <SaveToListMenu
                      row={r}
                      currentList={currentList}
                      lists={lists}
                      onAddToList={onAddToList}
                      onRequestNewList={onRequestNewList}
                      onRequestRemove={onRequestRemove}
                    />
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      )}
    </div>
  );
};

export default ResultsTable;
