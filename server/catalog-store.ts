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
const FILE = join(DATA_DIR, "retailers.json");
const PARTIAL = join(DATA_DIR, "retailers.partial.json");
const MAX_AGE = 7 * 24 * 60 * 60 * 1000;
/** A saved partial build older than this starts over. */
const MAX_RESUME_AGE = 2 * 24 * 60 * 60 * 1000;

interface StoredCatalog {
  version: 1;
  updatedAt: string;
  retailers: CatalogEntry[];
}

let retailers: Retailer[] = [];
let status: CatalogStatus = {
  updatedAt: null,
  count: 0,
  building: false,
  progress: null,
  error: null,
};

const toRetailers = (entries: CatalogEntry[]): Retailer[] =>
  entries.flatMap(({ name, slug, imageUrl, categorySlug, kind }) => {
    const category = categoryBySlug(categorySlug);
    return category ? [{ name, slug, imageUrl, category, kind }] : [];
  });

export const getCatalog = (): Retailer[] => retailers;
export const getCatalogStatus = (): CatalogStatus => status;

/** Writes via a temp file, so a crash never leaves half a file. */
async function writeJson(file: string, data: unknown) {
  await mkdir(DATA_DIR, { recursive: true });
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
  status = { ...status, updatedAt: stored.updatedAt, count: retailers.length };
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
export function updateCatalog(): CatalogStatus {
  if (status.building) return status;
  status = { ...status, building: true, progress: null, error: null };
  loadPartial()
    .then((resume) =>
      buildCatalog({
        resume,
        onProgress: (progress) => (status = { ...status, progress }),
        onCheckpoint: (state) => writeJson(PARTIAL, state),
      })
    )
    .then(save)
    .catch((err) => {
      console.error("retailer list build failed:", err);
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
export async function initCatalog(): Promise<void> {
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
      `No retailer list in ${DATA_DIR}: building it slowly, about 45 minutes`
    );
  }
  if (isStale()) updateCatalog();
  // Long-running servers refresh too.
  setInterval(() => isStale() && updateCatalog(), 6 * 60 * 60 * 1000).unref();
}
