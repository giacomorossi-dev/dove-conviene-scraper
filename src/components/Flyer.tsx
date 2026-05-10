import { cn } from "@/lib/utils";
import type { Flyer as FlyerI } from "@/models";

type Props = FlyerI & { onClick: () => void; className?: string };

const Flyer: React.FC<Props> = ({
  name,
  imageUrl,
  url,
  onClick,
  className,
}) => {
  const _onClick = () => {
    if (url) {
      window.open(url, "_blank");
    } else {
      onClick();
    }
  };

  return (
    <div
      onClick={() => _onClick()}
      className={cn(
        "w-32 h-32 relative flex flex-col justify-center  cursor-pointer p-4 rounded-md border-2 border-gray-400",
        className
      )}
    >
      <img className=" " src={imageUrl} alt={name} />
      <h6 className="hidden text-center absolute bottom-2 left-4 right-4">
        {name}
      </h6>
    </div>
  );
};

export default Flyer;
