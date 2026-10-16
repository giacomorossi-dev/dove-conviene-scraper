// The results' text filter, flyer choice and grouping by searched product,
// kept out of the components so they can be tested.
import { isExpired, type RowData } from "./shopping";

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

/** Rows of the flyers still chosen: `excluded` holds flyer URLs. */
export const onlyFlyers = (
  rows: readonly RowData[],
  excluded: ReadonlySet<string>
): RowData[] =>
  excluded.size === 0
    ? [...rows]
    : rows.filter((r) => !excluded.has(r.flyerUrl));

export interface ProductGroup {
  /** The searched product, as typed in the preset. */
  query: string;
  /** Cheapest first; offers without a price last. */
  rows: RowData[];
  /** The lowest price in the group; null when no offer has one. */
  best: number | null;
}

/** "Caffè ", " caffe" and "CAFFÈ" are the same searched product. */
const queryKey = (q: string) => fold(q).trim().replace(/\s+/g, " ");

/**
 * One group per searched product, in the preset's order, with or without
 * offers. Offers for a product the preset no longer has follow, in their own
 * groups.
 */
export function groupByQuery(
  rows: readonly RowData[],
  queries: readonly string[]
): ProductGroup[] {
  const groups = new Map<string, { query: string; rows: RowData[] }>();
  const add = (query: string) => {
    const key = queryKey(query);
    let group = groups.get(key);
    if (!group) groups.set(key, (group = { query: query.trim(), rows: [] }));
    return group;
  };
  for (const q of queries) add(q);
  for (const r of rows) add(r.query ?? "").rows.push(r);
  return [...groups.values()].map(({ query, rows }) => {
    const prices = rows.flatMap((r) => (r.price === null ? [] : [r.price]));
    return {
      query,
      rows: rows.toSorted((a, b) =>
        a.price === null || b.price === null
          ? Number(a.price === null) - Number(b.price === null)
          : a.price - b.price
      ),
      best: prices.length ? Math.min(...prices) : null,
    };
  });
}
