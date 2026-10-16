import { useEffect, useMemo, useState } from "react";
import type { CatalogStatus, Retailer } from "@shared/types";

const fetchJson = <T>(url: string, init?: RequestInit): Promise<T> =>
  fetch(url, init).then((r) =>
    r.ok ? (r.json() as Promise<T>) : Promise.reject(new Error(r.statusText))
  );

export interface CatalogState {
  /** null until the first status arrives. */
  status: CatalogStatus | null;
  /** The national retailer list; empty until the first build ends. */
  retailers: Retailer[];
  bySlug: ReadonlyMap<string, Retailer>;
  /** Starts an update, or retries a failed first build. */
  update: () => void;
  /** Why the list couldn't be read from the server, if it couldn't. */
  error: string | null;
  /** Reads status and list again (not a new build). */
  retry: () => void;
}

const UNREADABLE =
  "Non riesco a leggere l'elenco delle insegne dal server: è acceso?";

/**
 * The local national retailer list and its builds (the first one or an
 * update). Call it once, in App, and pass it down.
 */
export function useCatalog(): CatalogState {
  const [status, setStatus] = useState<CatalogStatus | null>(null);
  const [retailers, setRetailers] = useState<Retailer[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    fetchJson<CatalogStatus>("/api/retailers/status")
      .then((s) => {
        setStatus(s);
        setError(null);
      })
      .catch(() => setError(UNREADABLE));
  }, [attempt]);

  // Follow a running build.
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
      .then(setRetailers)
      .catch(() => setError(UNREADABLE));
  }, [updatedAt, attempt]);

  const bySlug = useMemo(
    () => new Map(retailers.map((r) => [r.slug, r])),
    [retailers]
  );

  const update = () => {
    fetchJson<CatalogStatus>("/api/retailers/update", { method: "POST" })
      .then(setStatus)
      .catch(() => {});
  };

  const retry = () => {
    setError(null);
    setAttempt((a) => a + 1);
  };

  return { status, retailers, bySlug, update, error, retry };
}
