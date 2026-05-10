import { CalendarX, MoreVertical, Palette, Pencil, Trash2 } from "lucide-react";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import ResultsTable from "./ResultsTable";
import { isExpired, type List, type RowData } from "@/lib/lists";

interface Props {
  lists: List[];
  onAddToList: (listId: string, row: RowData) => void;
  onRequestNewList: (row: RowData) => void;
  onRequestRemove: (row: RowData, list: List) => void;
  onRequestRename: (id: string) => void;
  onRequestRecolor: (id: string) => void;
  onRequestDelete: (id: string) => void;
  onRemoveExpired: (id: string) => void;
}

const ListsView = ({
  lists,
  onAddToList,
  onRequestNewList,
  onRequestRemove,
  onRequestRename,
  onRequestRecolor,
  onRequestDelete,
  onRemoveExpired,
}: Props) => {
  if (lists.length === 0) {
    return (
      <Card>
        <CardContent className="py-10 text-center text-sm text-muted-foreground">
          Non hai ancora salvato prodotti. Aggiungi un cuore alla riga di un
          risultato per creare la prima lista.
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-4">
      {lists.map((list) => {
        const expiredCount = list.items.filter((i) =>
          isExpired(i.validUntil)
        ).length;
        return (
          <Card key={list.id}>
            <CardHeader>
              <div className="flex items-center gap-3">
                <span
                  className="w-3 h-3 rounded-sm shrink-0"
                  style={{ backgroundColor: list.color }}
                />
                <h3 className="font-semibold flex-1 truncate">
                  {list.name}
                  <span className="ml-2 text-xs text-muted-foreground font-normal">
                    {list.items.length} prodott
                    {list.items.length === 1 ? "o" : "i"}
                  </span>
                </h3>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={expiredCount === 0}
                  onClick={() => onRemoveExpired(list.id)}
                >
                  <CalendarX className="w-4 h-4" />
                  Rimuovi scaduti{expiredCount > 0 && ` (${expiredCount})`}
                </Button>
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      aria-label="Azioni lista"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem
                      onSelect={() => onRequestRename(list.id)}
                    >
                      <Pencil className="w-4 h-4" />
                      Rinomina
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      onSelect={() => onRequestRecolor(list.id)}
                    >
                      <Palette className="w-4 h-4" />
                      Cambia colore
                    </DropdownMenuItem>
                    <DropdownMenuItem
                      variant="destructive"
                      onSelect={() => onRequestDelete(list.id)}
                    >
                      <Trash2 className="w-4 h-4" />
                      Elimina lista
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </CardHeader>
            <CardContent>
              <ResultsTable
                rows={list.items}
                lists={lists}
                onAddToList={onAddToList}
                onRequestNewList={onRequestNewList}
                onRequestRemove={onRequestRemove}
                emptyMessage="Lista vuota"
              />
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
};

export default ListsView;
