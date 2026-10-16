// The shopping list page: products picked from the results, one card per
// flyer, ordered by expiry and filterable by retailer.
import { useState } from "react";
import { ExternalLink, ShoppingCart, X } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  Card,
  CardAction,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Select,
  SelectContent,
  SelectGroup,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { formatDate, formatPrice } from "@/lib/format";
import { retailerInitials } from "@/lib/retailers";
import {
  groupByFlyer,
  groupCountsLabel,
  isExpired,
  itemKey,
  retailersIn,
  type ExpirySort,
  type ShoppingItem,
} from "@/lib/shopping";
import { cn } from "@/lib/utils";
import type { Retailer } from "@shared/types";

interface Props {
  items: ShoppingItem[];
  bySlug: ReadonlyMap<string, Retailer>;
  onTogglePurchased: (key: string, purchased: boolean) => void;
  onRemove: (key: string) => void;
  /** Only the products of `retailer` (null: all), as the page shows. */
  onRemovePurchased: (retailer: string | null) => void;
  onRemoveExpired: (retailer: string | null) => void;
  onGoToResults: () => void;
}

const SORT_ITEMS: { label: string; value: ExpirySort }[] = [
  { label: "Scadenza più vicina", value: "asc" },
  { label: "Scadenza più lontana", value: "desc" },
];

const ShoppingListView = ({
  items,
  bySlug,
  onTogglePurchased,
  onRemove,
  onRemovePurchased,
  onRemoveExpired,
  onGoToResults,
}: Props) => {
  const [sort, setSort] = useState<ExpirySort>("asc");
  const [retailer, setRetailer] = useState<string | null>(null);

  if (items.length === 0)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ShoppingCart />
          </EmptyMedia>
          <EmptyTitle>La lista della spesa è vuota</EmptyTitle>
          <EmptyDescription>
            Aggiungi i prodotti dai risultati con il carrello.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onGoToResults}>Vai ai risultati</Button>
        </EmptyContent>
      </Empty>
    );

  const retailers = retailersIn(items);
  // A retailer no longer in the list falls back to all of them.
  const shownRetailer =
    retailer && retailers.includes(retailer) ? retailer : null;
  const retailerItems = [
    { label: "Tutte le insegne", value: null as string | null },
    ...retailers.map((r) => ({ label: r, value: r as string | null })),
  ];
  const groups = groupByFlyer(items, sort, shownRetailer);
  // The buttons act on what is shown.
  const shown = items.filter(
    (i) => !shownRetailer || i.flyerName === shownRetailer
  );
  const purchasedCount = shown.filter((i) => i.purchased).length;
  const expiredCount = shown.filter((i) => isExpired(i.validUntil)).length;

  return (
    <div className="space-y-4">
      <h1 className="text-lg font-semibold">Lista della spesa</h1>

      <div className="flex flex-wrap items-center gap-2">
        <Select
          items={SORT_ITEMS}
          value={sort}
          onValueChange={(v) => v && setSort(v)}
        >
          <SelectTrigger className="w-52" aria-label="Ordina">
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
        <Select
          items={retailerItems}
          value={shownRetailer}
          onValueChange={(v) => setRetailer(v)}
        >
          <SelectTrigger className="w-52" aria-label="Insegna">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectGroup>
              {retailerItems.map((r) => (
                <SelectItem key={r.value ?? "all"} value={r.value}>
                  {r.label}
                </SelectItem>
              ))}
            </SelectGroup>
          </SelectContent>
        </Select>
        <div className="flex-1" />
        <Button
          variant="outline"
          disabled={purchasedCount === 0}
          onClick={() => onRemovePurchased(shownRetailer)}
        >
          Rimuovi acquistati ({purchasedCount})
        </Button>
        <Button
          variant="outline"
          disabled={expiredCount === 0}
          onClick={() => onRemoveExpired(shownRetailer)}
        >
          Rimuovi scaduti ({expiredCount})
        </Button>
      </div>

      {groups.map((g) => {
        const logo = g.retailerSlug
          ? bySlug.get(g.retailerSlug)?.imageUrl
          : undefined;
        return (
          <Card key={g.flyerUrl}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <Avatar>
                  {logo && <AvatarImage src={logo} alt="" />}
                  <AvatarFallback>
                    {retailerInitials(g.flyerName)}
                  </AvatarFallback>
                </Avatar>
                <div className="grid min-w-0 gap-1">
                  <CardTitle>{g.flyerName}</CardTitle>
                  <CardDescription className="flex flex-wrap items-center gap-2">
                    {g.validUntil &&
                      (isExpired(g.validUntil) ? (
                        <Badge variant="destructive">Scaduto</Badge>
                      ) : (
                        <span className="whitespace-nowrap">
                          Scade il {formatDate(g.validUntil)}
                        </span>
                      ))}
                    <span>{groupCountsLabel(g.items.length, g.purchased)}</span>
                  </CardDescription>
                </div>
              </div>
              {g.flyerUrl && (
                <CardAction>
                  <a
                    href={g.flyerUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={buttonVariants({ variant: "ghost", size: "sm" })}
                  >
                    Apri volantino <ExternalLink />
                  </a>
                </CardAction>
              )}
            </CardHeader>
            <CardContent>
              <ItemGroup>
                {g.items.map((it) => {
                  const key = itemKey(it);
                  return (
                    <Item
                      key={key}
                      size="sm"
                      className={cn(it.purchased && "opacity-60")}
                    >
                      {/* Ticks "purchased" from anywhere on the product;
                          the × stays outside the label. */}
                      <label className="flex min-w-0 flex-1 cursor-pointer items-center gap-2.5">
                        <ItemMedia>
                          <Checkbox
                            checked={it.purchased}
                            aria-label={`Acquistato: ${it.productName}`}
                            onCheckedChange={(checked) =>
                              onTogglePurchased(key, checked)
                            }
                          />
                        </ItemMedia>
                        {it.productImage && (
                          <ItemMedia variant="image">
                            <img src={it.productImage} alt="" loading="lazy" />
                          </ItemMedia>
                        )}
                        <ItemContent>
                          <ItemTitle
                            className={cn(it.purchased && "line-through")}
                          >
                            {it.productName}
                          </ItemTitle>
                          {it.price !== null && (
                            <ItemDescription>
                              {formatPrice(it.price)}
                            </ItemDescription>
                          )}
                        </ItemContent>
                      </label>
                      <ItemActions>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          aria-label={`Togli ${it.productName}`}
                          onClick={() => onRemove(key)}
                        >
                          <X />
                        </Button>
                      </ItemActions>
                    </Item>
                  );
                })}
              </ItemGroup>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ShoppingListView;
