// The national retailer list of this installation, kept in
// $DATA_DIR/retailers.json (default ./data, not in git). Built on the first
// start, refreshed in the background when older than a week or on request.
// A build is slow on purpose (see buildCatalog) and saves its progress in
// retailers.partial.json, so it resumes after a restart; the list itself is
// replaced only when a build completes, so the previous one is never lost.
import { mkdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { categoryBySlug } from "../shared/categories";
import type { CatalogStatus, Retailer } from "../shared/types";
import {
  buildCatalog,
  type BuildState,
  type CatalogEntry,
} from "./scrapers/catalog";

export const DATA_DIR =
  process.env.DATA_DIR ?? fileURLToPath(new URL("../data/", import.meta.url));
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
/** A saved partial build older than this starts over. */
const MAX_RESUME_AGE = 2 * 24 * 60 * 60 * 1000;
/**
 * A new list shorter than this share of the current one is suspicious (dc
 * changed its pages, or refused many of them): the current one stays.
 */
const MIN_KEEP = 0.8;

/** A finished build whose list is not trusted; the next one starts over. */
class RejectedList extends Error {}

interface StoredCatalog {
  version: 1;
  updatedAt: string;
  retailers: CatalogEntry[];
}

const toRetailers = (entries: CatalogEntry[]): Retailer[] =>
  entries.flatMap(({ name, slug, imageUrl, categorySlug, kind }) => {
    const category = categoryBySlug(categorySlug);
    return category ? [{ name, slug, imageUrl, category, kind }] : [];
  });

/** The list kept in `dir`; `build` reads it from dc (tests pass a fake). */
export function createCatalogStore(
  dir: string,
  build: typeof buildCatalog = buildCatalog
) {
  const FILE = join(dir, "retailers.json");
  const PARTIAL = join(dir, "retailers.partial.json");

  let retailers: Retailer[] = [];
  let status: CatalogStatus = {
    updatedAt: null,
    count: 0,
    building: false,
    progress: null,
    error: null,
  };

  /** Writes via a temp file, so a crash never leaves half a file. */
  async function writeJson(file: string, data: unknown) {
    await mkdir(dir, { recursive: true });
    await writeFile(`${file}.tmp`, JSON.stringify(data));
    await rename(`${file}.tmp`, file);
  }

  async function save(entries: CatalogEntry[]) {
    const stored: StoredCatalog = {
      version: 1,
      updatedAt: new Date().toISOString(),
      retailers: entries,
    };
    await writeJson(FILE, stored);
    await rm(PARTIAL, { force: true });
    retailers = toRetailers(entries);
    status = {
      ...status,
      updatedAt: stored.updatedAt,
      count: retailers.length,
    };
  }

  function accept(entries: CatalogEntry[]): CatalogEntry[] {
    const current = retailers.length;
    if (entries.length === 0)
      throw new RejectedList(
        "dc non ha dato nessuna insegna: riprova più tardi"
      );
    if (current > 0 && entries.length < current * MIN_KEEP)
      throw new RejectedList(
        `il nuovo elenco ha solo ${entries.length} insegne contro ${current}: forse dc è cambiato, tengo quello attuale`
      );
    return entries;
  }

  async function loadPartial(): Promise<BuildState | null> {
    try {
      const state = JSON.parse(await readFile(PARTIAL, "utf8")) as BuildState;
      return Date.now() - Date.parse(state.startedAt) < MAX_RESUME_AGE
        ? state
        : null;
    } catch {
      return null;
    }
  }

  /** Starts a build in the background unless one is running. */
  function update(): CatalogStatus {
    if (status.building) return status;
    status = { ...status, building: true, progress: null, error: null };
    loadPartial()
      .then((resume) =>
        build({
          resume,
          onProgress: (progress) => (status = { ...status, progress }),
          onCheckpoint: (state) => writeJson(PARTIAL, state),
        })
      )
      .then((entries) => save(accept(entries)))
      .catch(async (err) => {
        console.error("retailer list build failed:", err);
        if (err instanceof RejectedList) await rm(PARTIAL, { force: true });
        status = {
          ...status,
          error: err instanceof Error ? err.message : String(err),
        };
      })
      .finally(() => (status = { ...status, building: false, progress: null }));
    return status;
  }

  const isStale = () =>
    !status.updatedAt || Date.now() - Date.parse(status.updatedAt) > MAX_AGE;

  /** Loads the local list; builds it if missing, refreshes it if old. */
  async function init(): Promise<void> {
    try {
      const stored = JSON.parse(await readFile(FILE, "utf8")) as StoredCatalog;
      retailers = toRetailers(stored.retailers);
      status = {
        ...status,
        updatedAt: stored.updatedAt,
        count: retailers.length,
      };
    } catch (err) {
      if ((err as NodeJS.ErrnoException).code !== "ENOENT") throw err;
      console.log(
        `No retailer list in ${dir}: building it slowly, about an hour`
      );
    }
    if (isStale()) update();
    // Long-running servers refresh too.
    setInterval(() => isStale() && update(), 6 * 60 * 60 * 1000).unref();
  }

  return {
    getCatalog: (): Retailer[] => retailers,
    getStatus: (): CatalogStatus => status,
    update,
    init,
  };
}

const store = createCatalogStore(DATA_DIR);
export const getCatalog = store.getCatalog;
export const getCatalogStatus = store.getStatus;
export const updateCatalog = store.update;
export const initCatalog = store.init;
