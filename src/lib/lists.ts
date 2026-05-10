export interface RowData {
  productName: string;
  productImage: string | null;
  price: number | null;
  flyerName: string;
  flyerUrl: string;
  validUntil: string | null;
}

export interface SavedItem extends RowData {
  addedAt: number;
}

export interface List {
  id: string;
  name: string;
  color: string;
  items: SavedItem[];
  createdAt: number;
  updatedAt: number;
}

export const LIST_COLORS = [
  "#ef4444",
  "#f97316",
  "#f59e0b",
  "#eab308",
  "#84cc16",
  "#22c55e",
  "#10b981",
  "#14b8a6",
  "#06b6d4",
  "#0ea5e9",
  "#3b82f6",
  "#6366f1",
  "#8b5cf6",
  "#a855f7",
  "#d946ef",
  "#ec4899",
  "#f43f5e",
  "#64748b",
  "#6b7280",
  "#78716c",
];

export const DEFAULT_LIST_COLOR = "#ec4899";

const STORAGE_KEY = "dove-conviene:lists";

const newId = (): string =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

export function loadLists(): List[] {
  if (typeof localStorage === "undefined") return [];
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveLists(lists: List[]): void {
  if (typeof localStorage === "undefined") return;
  localStorage.setItem(STORAGE_KEY, JSON.stringify(lists));
}

export function itemKey(i: {
  productName: string;
  flyerUrl: string;
  price: number | null;
}): string {
  return `${i.flyerUrl}::${i.productName}::${i.price ?? ""}`;
}

export function findItemList(lists: List[], key: string): List | null {
  for (const list of lists) {
    if (list.items.some((item) => itemKey(item) === key)) {
      return list;
    }
  }
  return null;
}

export function isExpired(validUntil: string | null): boolean {
  if (!validUntil) return false;
  const d = new Date(validUntil);
  if (isNaN(d.getTime())) return false;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  return d.getTime() < today.getTime();
}

export function createList(name: string, color: string): List {
  const now = Date.now();
  return {
    id: newId(),
    name,
    color,
    items: [],
    createdAt: now,
    updatedAt: now,
  };
}

export function makeSavedItem(row: RowData): SavedItem {
  return { ...row, addedAt: Date.now() };
}
