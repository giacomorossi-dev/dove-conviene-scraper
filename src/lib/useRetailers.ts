import { useEffect, useRef, useState } from "react";
import type { CatalogStatus, Place, Retailer } from "@shared/types";

const fetchJson = <T>(url: string, init?: RequestInit): Promise<T> =>
  fetch(url, init).then((r) =>
    r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(r.statusText))
  );

/**
 * The local national retailer list (and its builds) plus, per category the
 * user opens, the retailers with flyers near `place`, local chains included.
 * dc is only asked for the categories actually opened.
 */
export function useRetailers(place: Place | null, openCategories: string[]) {
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [catalog, setCatalog] = useState<Retailer[]>([]);
  const [nearby, setNearby] = useState<Record<string, Retailer[] | "failed">>(
    {}
  );
  const requested = useRef(new Set<string>());

  useEffect(() => {
    fetchJson<CatalogStatus>("/api/retailers/status")
      .then(setStatus)
      .catch(() => {});
  }, []);

  // Follow a running build (the first one or an update).
  const building = status?.building ?? false;
  useEffect(() => {
    if (!building) return;
    const id = setInterval(() => {
      fetchJson<CatalogStatus>("/api/retailers/status")
        .then(setStatus)
        .catch(() => {});
    }, 3_000);
    return () => clearInterval(id);
  }, [building]);

  // (Re)load the list whenever a build has produced a new one.
  const updatedAt = status?.updatedAt ?? null;
  useEffect(() => {
    if (!updatedAt) return;
    fetchJson<Retailer[]>("/api/retailers")
      .then(setCatalog)
      .catch(() => {});
  }, [updatedAt]);

  const placeKey = place ? `${place.lat},${place.lng}` : null;
  useEffect(() => {
    if (!place) return;
    for (const slug of openCategories) {
      const id = `${place.lat},${place.lng}|${slug}`;
      if (requested.current.has(id)) continue;
      requested.current.add(id);
      fetchJson<Retailer[]>(
        `/api/retailers/nearby?lat=${place.lat}&lng=${place.lng}&category=${slug}`
      )
        .then((list) => setNearby((prev) => ({ ...prev, [id]: list })))
        .catch(() => {
          requested.current.delete(id); // retried when reopened
          setNearby((prev) => ({ ...prev, [id]: "failed" }));
        });
    }
  }, [place, openCategories]);

  /** Nearby retailers of a category: undefined while unknown (loading). */
  const nearbyIn = (slug: string): Retailer[] | "failed" | undefined =>
    placeKey ? nearby[`${placeKey}|${slug}`] : undefined;

  const update = () =>
    fetchJson<CatalogStatus>("/api/retailers/update", { method: "POST" })
      .then(setStatus)
      .catch(() => {});

  return { status, catalog, nearbyIn, update };
}
