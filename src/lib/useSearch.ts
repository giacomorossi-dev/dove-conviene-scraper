import { useEffect, useRef, useState } from "react";
import type { ScrapeRequest } from "@shared/types";
import {
  applyLine,
  IDLE,
  lineSplitter,
  started,
  type SearchState,
} from "./search";

/**
 * One search at a time, streamed from POST /api/scraper. A new search, a
 * reset or leaving the page aborts the previous one: its late lines are
 * ignored and the server stops reading flyers from dc.
 */
export function useSearch() {
  const [state, setState] = useState<SearchState>(IDLE);
  /** Changes with every new search or reset: views key their filters on it. */
  const [id, setId] = useState(0);
  const current = useRef<AbortController | null>(null);

  useEffect(() => () => current.current?.abort(), []);

  const stop = () => {
    current.current?.abort();
    current.current = null;
  };

  const start = async (request: ScrapeRequest) => {
    stop();
    const mine = new AbortController();
    current.current = mine;
    // Only the latest search may change the state.
    const update = (next: (s: SearchState) => SearchState) => {
      if (current.current === mine) setState(next);
    };
    setState(started());
    setId((n) => n + 1);
    try {
      const res = await fetch("/api/scraper", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(request),
        signal: mine.signal,
      });
      if (!res.ok || !res.body) {
        update((s) => ({
          ...s,
          phase: "failed",
          errors: [...s.errors, `il server ha risposto ${res.status}`],
        }));
        return;
      }
      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      const lines = lineSplitter();
      for (;;) {
        const { value, done } = await reader.read();
        if (done) break;
        const read = lines.push(decoder.decode(value, { stream: true }));
        if (read.length) update((s) => read.reduce(applyLine, s));
      }
      const rest = lines.end();
      update((s) => ({ ...rest.reduce(applyLine, s), phase: "done" }));
    } catch {
      if (mine.signal.aborted) return;
      update((s) => ({
        ...s,
        phase: "failed",
        errors: [
          ...s.errors,
          "la connessione con il server si è interrotta: è ancora acceso?",
        ],
      }));
    } finally {
      if (current.current === mine) current.current = null;
    }
  };

  /** Stops the running search, keeping what it found so far. */
  const cancel = () => {
    stop();
    setState((s) => (s.phase === "running" ? { ...s, phase: "cancelled" } : s));
  };

  /** Forgets the search, e.g. when the preset or the place changes. */
  const reset = () => {
    stop();
    setState(IDLE);
    setId((n) => n + 1);
  };

  return { ...state, id, start, cancel, reset };
}
