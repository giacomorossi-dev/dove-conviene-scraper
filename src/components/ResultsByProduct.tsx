// The results, one group per searched product: where it costs least first.
import { useId, useMemo, useState } from "react";
import { ExternalLink } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemMedia,
  ItemTitle,
} from "@/components/ui/item";
import { formatDate, formatPrice } from "@/lib/format";
import { filterRows, groupByQuery, type ProductGroup } from "@/lib/results";
import { flyerLabel, isExpired, itemKey, type RowData } from "@/lib/shopping";
import { cn } from "@/lib/utils";
import CartButton from "./CartButton";

interface Props {
  rows: RowData[];
  /** The preset's products, as typed: one group each, in this order. */
  queries: string[];
  /** While the search runs, a product without offers may still get some. */
  running: boolean;
  isInCart: (row: RowData) => boolean;
  onToggleCart: (row: RowData) => void;
}

/** Offers shown in a group before "Mostra tutte". */
const SHOWN = 5;

const offers = (n: number) => `${n} offert${n === 1 ? "a" : "e"}`;

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

interface GroupProps
  extends Pick<Props, "running" | "isInCart" | "onToggleCart"> {
  group: ProductGroup;
  keys: ReadonlyMap<RowData, string>;
}

function Group({ group, keys, running, isInCart, onToggleCart }: GroupProps) {
  const id = useId();
  const [all, setAll] = useState(false);
  const { rows, best } = group;
  const shown = all ? rows : rows.slice(0, SHOWN);
  // One priced offer has nothing to be cheaper than.
  const compared = rows.filter((r) => r.price !== null).length > 1;
  return (
    <section aria-labelledby={id} className="grid gap-2">
      <h3 id={id} className="font-semibold">
        {group.query || "Altri prodotti"}{" "}
        <span className="font-normal text-muted-foreground">
          ·{" "}
          {rows.length > 0
            ? offers(rows.length)
            : running
              ? "nessuna offerta per ora"
              : "nessuna offerta"}
        </span>
      </h3>
      {rows.length > 0 && (
        <ul className="grid gap-2">
          {shown.map((r) => (
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
                  <ItemDescription className="flex flex-wrap items-center gap-x-2 gap-y-1">
                    {compared && r.price === best && (
                      <Badge className="bg-emerald-600 text-white">
                        Più conveniente
                      </Badge>
                    )}
                    <FlyerLink r={r} />
                    <span>
                      scade {r.validUntil ? formatDate(r.validUntil) : "—"}
                    </span>
                  </ItemDescription>
                </ItemContent>
                <ItemActions>
                  <span className="font-medium whitespace-nowrap">
                    {r.price === null ? "—" : formatPrice(r.price)}
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
      )}
      {rows.length > SHOWN && (
        <Button
          variant="ghost"
          size="sm"
          className="justify-self-start"
          onClick={() => setAll(!all)}
        >
          {all ? "Mostra meno" : `Mostra tutte (${rows.length})`}
        </Button>
      )}
    </section>
  );
}

const ResultsByProduct = ({ rows, queries, ...groupProps }: Props) => {
  const [search, setSearch] = useState("");
  const [hideExpired, setHideExpired] = useState(false);

  // Stable keys, so filtering moves rows instead of reloading their images.
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

  const filtered = useMemo(
    () => filterRows(rows, search, hideExpired),
    [rows, search, hideExpired]
  );
  const filtering = search.trim() !== "" || hideExpired;
  // While filtering, a product with nothing matching is left out.
  const groups = useMemo(
    () =>
      groupByQuery(filtered, queries).filter(
        (g) => !filtering || g.rows.length > 0
      ),
    [filtered, queries, filtering]
  );

  if (rows.length === 0) return null;

  const count = `${filtered.length} prodott${filtered.length === 1 ? "o" : "i"}${
    filtered.length !== rows.length ? ` di ${rows.length}` : ""
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
        <span
          className="text-xs text-muted-foreground ml-auto"
          aria-live="polite"
        >
          {count}
        </span>
      </div>

      {groups.length === 0 ? (
        <div className="py-10 text-center text-sm text-muted-foreground">
          Nessun risultato per i filtri attivi
        </div>
      ) : (
        <div className="grid gap-5">
          {groups.map((g) => (
            <Group key={g.query} group={g} keys={keys} {...groupProps} />
          ))}
        </div>
      )}
    </div>
  );
};

export default ResultsByProduct;
