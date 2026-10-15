// Retailer logos, overlapping, with "+N" past `max`.
import {
  Avatar,
  AvatarFallback,
  AvatarGroup,
  AvatarGroupCount,
  AvatarImage,
} from "@/components/ui/avatar";
import { retailerInitials } from "@/lib/retailers";
import type { Retailer } from "@shared/types";

interface Props {
  retailers: Retailer[];
  max: number;
}

const RetailerLogos = ({ retailers, max }: Props) => {
  const shown = retailers.slice(0, max);
  const more = retailers.length - shown.length;
  return (
    <AvatarGroup>
      {shown.map((r) => (
        <Avatar key={r.slug} title={r.name}>
          <AvatarImage src={r.imageUrl} alt={r.name} />
          <AvatarFallback>{retailerInitials(r.name)}</AvatarFallback>
        </Avatar>
      ))}
      {more > 0 && <AvatarGroupCount>+{more}</AvatarGroupCount>}
    </AvatarGroup>
  );
};

export default RetailerLogos;
