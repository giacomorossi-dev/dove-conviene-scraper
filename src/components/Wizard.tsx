import { useMemo } from "react";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import type {
  Flyer as FlyerI,
  Place,
  ProductQuery,
  Retailer,
} from "@shared/types";
import ProductsChipsInput from "./ProductsChipsInput";
import RetailerPicker from "./RetailerPicker";
import ResultsTable from "./ResultsTable";
import type { List, RowData } from "@/lib/lists";

interface Props {
  flyers: FlyerI[];
  onToggleRetailer: (retailer: Retailer) => void;
  place: Place | null;
  products: ProductQuery[];
  onProductsChange: (next: ProductQuery[]) => void;
  results: FlyerI[];
  lists: List[];
  onAddToList: (listId: string, row: RowData) => void;
  onRequestNewList: (row: RowData) => void;
  onRequestRemoveItem: (row: RowData, list: List) => void;
}

const Wizard = ({
  flyers,
  onToggleRetailer,
  place,
  products,
  onProductsChange,
  results,
  lists,
  onAddToList,
  onRequestNewList,
  onRequestRemoveItem,
}: Props) => {
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
      <RetailerPicker
        place={place}
        flyers={flyers}
        onToggleRetailer={onToggleRetailer}
      />

      <Card>
        <CardHeader>
          <CardTitle>2 - Inserisci i prodotti</CardTitle>
        </CardHeader>
        <CardContent className="gap-2">
          <Label>Prodotti</Label>
          <ProductsChipsInput value={products} onChange={onProductsChange} />
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>3 - Risultati</CardTitle>
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
