import { useMemo } from "react";
import { ExternalLink } from "lucide-react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
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

const expirationKey = (iso: string | null): number =>
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
  const sorted = useMemo(
    () =>
      [...rows].sort(
        (a, b) => expirationKey(a.validUntil) - expirationKey(b.validUntil)
      ),
    [rows]
  );

  if (sorted.length === 0) {
    return (
      <div className="py-10 text-center text-sm text-muted-foreground">
        {emptyMessage}
      </div>
    );
  }

  return (
    <Table>
      <TableHeader>
        <TableRow>
          <TableHead className="w-20"></TableHead>
          <TableHead>Prodotto</TableHead>
          <TableHead>Volantino</TableHead>
          <TableHead className="text-right w-28">Prezzo</TableHead>
          <TableHead className="w-48">Lista</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {sorted.map((r, i) => {
          const expired = isExpired(r.validUntil);
          const currentList = findItemList(lists, itemKey(r));
          return (
            <TableRow
              key={i}
              className={cn(expired && "opacity-50")}
            >
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
                <div className="flex flex-col gap-0.5">
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
                  {r.validUntil && (
                    <span className="text-xs text-muted-foreground">
                      scade il {formatDate(r.validUntil)}
                    </span>
                  )}
                </div>
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
  );
};

export default ResultsTable;
