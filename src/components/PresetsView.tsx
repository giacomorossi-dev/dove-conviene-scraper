// The Preset page: every preset, with create, edit, duplicate and delete.
import { Copy, ListChecks, Pencil, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
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
import { byName, countsLabel, type Preset } from "@/lib/presets";
import { knownRetailers } from "@/lib/retailers";
import type { Retailer } from "@shared/types";
import RetailerLogos from "./RetailerLogos";

interface Props {
  presets: Preset[];
  bySlug: ReadonlyMap<string, Retailer>;
  onRequestCreate: () => void;
  onRequestEdit: (id: string) => void;
  onRequestDuplicate: (id: string) => void;
  onRequestDelete: (id: string) => void;
}

const PresetsView = ({
  presets,
  bySlug,
  onRequestCreate,
  onRequestEdit,
  onRequestDuplicate,
  onRequestDelete,
}: Props) => {
  if (presets.length === 0)
    return (
      <Empty className="border">
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <ListChecks />
          </EmptyMedia>
          <EmptyTitle>Nessun preset</EmptyTitle>
          <EmptyDescription>
            Crea un preset con le insegne e i prodotti da cercare.
          </EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <Button onClick={onRequestCreate}>
            <Plus /> Crea preset
          </Button>
        </EmptyContent>
      </Empty>
    );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-2">
        <h1 className="text-lg font-semibold">Preset</h1>
        <Button onClick={onRequestCreate}>
          <Plus /> Nuovo preset
        </Button>
      </div>
      <ItemGroup className="gap-2">
        {byName(presets).map((p) => {
          const retailers = knownRetailers(p.retailers, bySlug);
          return (
            <Item key={p.id} variant="outline">
              {retailers.length > 0 && (
                <ItemMedia>
                  <RetailerLogos retailers={retailers} max={3} />
                </ItemMedia>
              )}
              <ItemContent>
                <ItemTitle>{p.name}</ItemTitle>
                <ItemDescription>
                  {countsLabel(retailers.length, p.products.length)}
                </ItemDescription>
              </ItemContent>
              <ItemActions>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Modifica ${p.name}`}
                  onClick={() => onRequestEdit(p.id)}
                >
                  <Pencil />
                  <span className="hidden sm:inline">Modifica</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  aria-label={`Duplica ${p.name}`}
                  onClick={() => onRequestDuplicate(p.id)}
                >
                  <Copy />
                  <span className="hidden sm:inline">Duplica</span>
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-destructive"
                  aria-label={`Elimina ${p.name}`}
                  onClick={() => onRequestDelete(p.id)}
                >
                  <Trash2 />
                  <span className="hidden sm:inline">Elimina</span>
                </Button>
              </ItemActions>
            </Item>
          );
        })}
      </ItemGroup>
    </div>
  );
};

export default PresetsView;
