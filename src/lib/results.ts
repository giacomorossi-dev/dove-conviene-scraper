// The results table's text filter and sorting, kept out of the component so
// they can be tested.
import { parseDay } from "./format";
import { isExpired, type RowData } from "./shopping";

export type ResultSortKey =
  | "productName"
  | "flyerName"
  | "validUntil"
  | "price";
export interface ResultSort {
  key: ResultSortKey;
  dir: "asc" | "desc";
}

const fold = (s: string): string =>
  s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();

/** Rows whose product or retailer contains `text`, optionally not expired. */
export function filterRows(
  rows: readonly RowData[],
  text: string,
  hideExpired: boolean,
  now = new Date()
): RowData[] {
  const q = fold(text.trim());
  return rows.filter(
    (r) =>
      !(hideExpired && isExpired(r.validUntil, now)) &&
      (!q || fold(r.productName).includes(q) || fold(r.flyerName).includes(q))
  );
}

/** A sorted copy; rows without the value (no price, no date) last either way. */
export function sortRows(rows: readonly RowData[], { key, dir }: ResultSort) {
  const sign = dir === "asc" ? 1 : -1;
  const value = (r: RowData): string | number | null =>
    key === "price"
      ? r.price
      : key === "validUntil"
        ? r.validUntil
          ? (parseDay(r.validUntil)?.getTime() ?? null)
          : null
        : r[key];
  return [...rows].sort((a, b) => {
    const va = value(a);
    const vb = value(b);
    if (va === null || vb === null) return va === vb ? 0 : va === null ? 1 : -1;
    return (
      sign *
      (typeof va === "string" && typeof vb === "string"
        ? va.localeCompare(vb, "it")
        : (va as number) - (vb as number))
    );
  });
}

/** Rows of the flyers still chosen: `excluded` holds flyer URLs. */
export const onlyFlyers = (
  rows: readonly RowData[],
  excluded: ReadonlySet<string>
): RowData[] =>
  excluded.size === 0
    ? [...rows]
    : rows.filter((r) => !excluded.has(r.flyerUrl));
