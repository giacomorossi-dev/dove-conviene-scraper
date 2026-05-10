import { cn } from "@/lib/utils";
import type { Flyer as FlyerI } from "@/models";
import { useState } from "react";
import { Input } from "./ui/input";
import { Button } from "./ui/button";

type Props = { onChange: () => void; className?: string };

interface Item {
  name: string | undefined;
  price: number | undefined;
}

const ProductsInputList: React.FC<Props> = ({ onChange, className }) => {
  const [items, setItems] = useState<Array<Item>>([]);

  const onRemove = (index: number) => {
    setItems(items.filter((item, i) => index !== i));
  };

  const onAdd = () => {
    if (items.some((item) => !item.name || item.price)) {
      return;
    }

    setItems(
      items.concat({
        name: undefined,
        price: undefined,
      })
    );
  };

  const onName = (value: string, index: number) => {
    items[index].name = value;
  };

  const onPrice = (value: number, index: number) => {
    items[index].price = value;
  };

  return (
    <div>
      {items.map((item, index) => {
        return (
          <div className="flex gap-4 items-center">
            <span>{index + 1}</span>
            <Input
              onInput={(value) => onName(value.currentTarget.value, index)}
              className="max-w-80"
              placeholder="Nome prodotto"
            />
            <Input
              onInput={(value) =>
                onPrice(Number(value.currentTarget.value), index)
              }
              type="number"
              className="max-w-24"
              placeholder="Prezzo"
            />
            <Button onClick={() => onRemove(index)}>X</Button>
          </div>
        );
      })}
      <Button className="mt-4" onClick={() => onAdd()}>
        Aggiungi
      </Button>
    </div>
  );
};

export default ProductsInputList;
