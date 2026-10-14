import { useState } from "react";
import { Check } from "lucide-react";
import { cn } from "@/lib/utils";
import type { Flyer as FlyerData } from "@shared/types";

interface Props extends FlyerData {
  onClick: () => void;
  className?: string;
  selected?: boolean;
  /** Faded: no flyer near the chosen place. */
  muted?: boolean;
}

const Flyer = ({
  name,
  imageUrl,
  url,
  onClick,
  className,
  selected = false,
  muted = false,
}: Props) => {
  const [logoFailed, setLogoFailed] = useState(false);
  const handleClick = () => {
    if (url) window.open(url, "_blank");
    else onClick();
  };

  return (
    <div
      onClick={handleClick}
      title={muted ? `${name} — nessun volantino vicino a te` : name}
      className={cn(
        "w-16 h-16 relative flex flex-col justify-center cursor-pointer p-2 rounded-md border-2 transition-[border-color,opacity]",
        selected ? "border-green-600" : "border-gray-300",
        muted && !selected && "opacity-40 hover:opacity-100",
        className
      )}
    >
      {logoFailed || !imageUrl ? (
        <span className="line-clamp-3 text-center text-[10px] leading-tight">
          {name}
        </span>
      ) : (
        <img
          className="w-full h-full object-contain"
          src={imageUrl}
          alt={name}
          loading="lazy"
          onError={() => setLogoFailed(true)}
        />
      )}
      {selected && (
        <span className="absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-green-600 text-white shadow">
          <Check className="w-3 h-3" strokeWidth={3} />
        </span>
      )}
    </div>
  );
};

export default Flyer;
