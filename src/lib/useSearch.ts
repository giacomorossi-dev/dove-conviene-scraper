import { useEffect, useRef, useState } from "react";
import type { ScrapeRequest } from "@shared/types";
import {
  applyLine,
  IDLE,
  lineSplitter,
  started,
  type SearchState,
} from "./search";

const newId = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * Tells the server to stop a search. The server can't notice a page that
 * went away (Bun gives no signal), so the page says so; a beacon still
 * leaves while the page is closing.
 */
function sendCancel(searchId: string) {
  const body = JSON.stringify({ searchId });
  const sent = navigator.sendBeacon?.(
    "/api/scraper/cancel",
    new Blob([body], { type: "application/json" })
  );
  if (!sent)
    fetch("/api/scraper/cancel", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body,
      keepalive: true,
    }).catch(() => {});
}

/**
 * One search at a time, streamed from POST /api/scraper. A new search, a
 * reset or leaving the page cancels the previous one: its late lines are
 * ignored and the server stops reading flyers from dc.
 */
export function useSearch() {
  const [state, setState] = useState<SearchState>(IDLE);
  /** Changes with every new search or reset: views key their filters on it. */
  const [id, setId] = useState(0);
  const current = useRef<{ controller: AbortController; id: string } | null>(
    null
  );

  const stop = () => {
    if (!current.current) return;
    current.current.controller.abort();
    sendCancel(current.current.id);
    current.current = null;
  };

  useEffect(() => {
    window.addEventListener("pagehide", stop);
    return () => {
      window.removeEventListener("pagehide", stop);
      stop();
    };
    // stop only reads the ref: one listener for the hook's lifetime.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const start = async (request: ScrapeRequest) => {
    stop();
    const mine = { controller: new AbortController(), id: newId() };
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
        body: JSON.stringify({ ...request, searchId: mine.id }),
        signal: mine.controller.signal,
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
      if (mine.controller.signal.aborted) return;
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
