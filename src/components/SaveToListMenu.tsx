import { Heart, Plus } from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { List, RowData } from "@/lib/lists";

interface Props {
  row: RowData;
  currentList: List | null;
  lists: List[];
  onAddToList: (listId: string, row: RowData) => void;
  onRequestNewList: (row: RowData) => void;
  onRequestRemove: (row: RowData, list: List) => void;
}

const SaveToListMenu = ({
  row,
  currentList,
  lists,
  onAddToList,
  onRequestNewList,
  onRequestRemove,
}: Props) => {
  if (currentList) {
    return (
      <button
        type="button"
        onClick={() => onRequestRemove(row, currentList)}
        className="inline-flex items-center gap-2 hover:opacity-80 transition-opacity"
        aria-label={`Rimuovi da ${currentList.name}`}
      >
        <Heart
          className="w-5 h-5"
          fill={currentList.color}
          color={currentList.color}
        />
        <span className="text-sm">{currentList.name}</span>
      </button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="inline-flex items-center text-gray-400 hover:text-pink-500 transition-colors"
          aria-label="Aggiungi a una lista"
        >
          <Heart className="w-5 h-5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="min-w-44">
        <DropdownMenuLabel>Aggiungi alla lista</DropdownMenuLabel>
        {lists.length > 0 && <DropdownMenuSeparator />}
        {lists.map((l) => (
          <DropdownMenuItem
            key={l.id}
            onSelect={() => onAddToList(l.id, row)}
          >
            <span
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: l.color }}
            />
            <span className="truncate">{l.name}</span>
          </DropdownMenuItem>
        ))}
        <DropdownMenuSeparator />
        <DropdownMenuItem onSelect={() => onRequestNewList(row)}>
          <Plus className="w-4 h-4" />
          Nuova lista
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
};

export default SaveToListMenu;
