// The search's state, built from the lines streamed by POST /api/scraper.
import type { Flyer, ScrapeMessage } from "@shared/types";

/** Splits text chunks into NDJSON lines; a line may span chunks. */
export function lineSplitter() {
  let buffer = "";
  return {
    push(chunk: string): string[] {
      buffer += chunk;
      const lines = buffer.split("\n");
      buffer = lines.pop() ?? "";
      return lines.filter((l) => l.trim());
    },
    /** What's left once the stream ends. */
    end(): string[] {
      const rest = buffer.trim();
      buffer = "";
      return rest ? [rest] : [];
    },
  };
}

export type SearchPhase = "idle" | "running" | "done" | "failed" | "cancelled";

export interface SearchState {
  phase: SearchPhase;
  /** Flyers read, with the products they matched (possibly none). */
  results: Flyer[];
  /** Flyers read so far, including the ones dc didn't give. */
  flyersRead: number;
  /** Retailers of the flyers dc didn't give. */
  unread: string[];
  /** Problems not tied to one flyer, or why the search failed. */
  errors: string[];
}

export const IDLE: SearchState = {
  phase: "idle",
  results: [],
  flyersRead: 0,
  unread: [],
  errors: [],
};

export const started = (): SearchState => ({ ...IDLE, phase: "running" });

/** The state after one line of the stream; malformed lines change nothing. */
export function applyLine(state: SearchState, line: string): SearchState {
  let msg: ScrapeMessage;
  try {
    msg = JSON.parse(line) as ScrapeMessage;
  } catch {
    return state;
  }
  if ("flyer" in msg)
    return {
      ...state,
      flyersRead: state.flyersRead + 1,
      results: [...state.results, msg.flyer],
    };
  if ("flyerError" in msg)
    return {
      ...state,
      flyersRead: state.flyersRead + 1,
      unread: [...state.unread, msg.flyerError.name],
    };
  if ("error" in msg) return { ...state, errors: [...state.errors, msg.error] };
  return state;
}
