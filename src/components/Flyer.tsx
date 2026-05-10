import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Category } from "@/categories";

export interface Product {
  name: string;
  imageUrl: string | null;
  price: number | null;
}

export interface Flyer {
  name: string;
  imageUrl: string;
  category: Category;
  url?: string;
  validUntil?: string;
  products?: Product[];
}

interface Props extends Flyer {
  onClick: () => void;
  className?: string;
  selected?: boolean;
}

const Flyer = ({
  name,
  imageUrl,
  url,
  onClick,
  className,
  selected = false,
}: Props) => {
  const handleClick = () => {
    if (url) window.open(url, "_blank");
    else onClick();
  };

  return (
    <div
      onClick={handleClick}
      title={name}
      className={cn(
        "w-16 h-16 relative flex flex-col justify-center cursor-pointer p-2 rounded-md border-2 transition-colors",
        selected ? "border-green-600" : "border-gray-300",
        className
      )}
    >
      <img
        className="w-full h-full object-contain"
        src={imageUrl}
        alt={name}
      />
      {selected && (
        <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-green-600 text-white shadow">
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
    </div>
  );
};

export default Flyer;
