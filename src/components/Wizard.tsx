import { useMemo, useState } from "react";
import { Label } from "@/components/ui/label";
import { Spinner } from "@/components/ui/spinner";
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from "@/components/ui/accordion";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CATEGORIES } from "@/categories";
import Flyer, { type Flyer as FlyerI } from "./Flyer";
import ProductsChipsInput, {
  type ProductQuery,
} from "./ProductsChipsInput";
import CityAutocomplete from "./CityAutocomplete";
import ResultsTable from "./ResultsTable";
import type { List, RowData } from "@/lib/lists";

interface Props {
  city: string;
  citySlug: string;
  onCitySelect: (city: { name: string; slug: string }) => void;
  onCityChange: (raw: string) => void;
  flyers: FlyerI[];
  onToggleFlyer: (flyer: FlyerI) => void;
  retailersByCategory: Record<string, FlyerI[]>;
  products: ProductQuery[];
  onProductsChange: (next: ProductQuery[]) => void;
  results: FlyerI[];
  lists: List[];
  onAddToList: (listId: string, row: RowData) => void;
  onRequestNewList: (row: RowData) => void;
  onRequestRemoveItem: (row: RowData, list: List) => void;
}

const Wizard = ({
  city,
  onCitySelect,
  onCityChange,
  flyers,
  onToggleFlyer,
  retailersByCategory,
  products,
  onProductsChange,
  results,
  lists,
  onAddToList,
  onRequestNewList,
  onRequestRemoveItem,
}: Props) => {
  const [openAccordion, setOpenAccordion] = useState<string[]>(
    CATEGORIES.map((c) => c.name)
  );

  const resultRows = useMemo<RowData[]>(
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

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>1 - Seleziona una località</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Località</Label>
          <CityAutocomplete
            value={city}
            onSelect={onCitySelect}
            onChange={onCityChange}
            placeholder="Inizia a digitare una città..."
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>2 - Seleziona i volantini</CardTitle>
        </CardHeader>
        <CardContent>
          <Accordion
            className="space-y-2"
            onValueChange={setOpenAccordion}
            value={openAccordion}
            type="multiple"
          >
            {CATEGORIES.map((category) => {
              const items = retailersByCategory[category.name] ?? [];
              const selected = flyers.filter(
                (f) => f.category.name === category.name
              ).length;
              return (
                <AccordionItem key={category.name} value={category.name}>
                  <AccordionTrigger>
                    <span className="flex items-baseline gap-2">
                      <span>{category.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {items.length || "…"}
                        {selected > 0 &&
                          ` · ${selected} selezionat${
                            selected === 1 ? "o" : "i"
                          }`}
                      </span>
                    </span>
                  </AccordionTrigger>
                  <AccordionContent>
                    {items.length === 0 ? (
                      <div className="flex items-center gap-2 text-sm text-muted-foreground">
                        <Spinner /> Caricamento retailer…
                      </div>
                    ) : (
                      <div className="flex flex-wrap gap-4">
                        {items.map((flyer) => (
                          <Flyer
                            key={flyer.name}
                            selected={
                              !!flyers.find((f) => f.name === flyer.name)
                            }
                            onClick={() => onToggleFlyer(flyer)}
                            {...flyer}
                          />
                        ))}
                      </div>
                    )}
                  </AccordionContent>
                </AccordionItem>
              );
            })}
          </Accordion>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3 - Inserisci i prodotti</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2">
          <Label>Prodotti</Label>
          <ProductsChipsInput
            value={products}
            onChange={onProductsChange}
          />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>4 - Risultati</CardTitle>
        </CardHeader>
        <CardContent>
          <ResultsTable
            rows={resultRows}
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

export default Wizard;
