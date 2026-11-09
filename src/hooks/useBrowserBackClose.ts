import { useCallback, useEffect, useRef } from "react";

interface BackCloseEntry {
  id: string;
  onClose: () => void;
}

const activeEntries: BackCloseEntry[] = [];
const retiredIds = new Set<string>();
let popstateListening = false;
let skipNextPopstate = false;

function handlePopState() {
  if (skipNextPopstate) {
    skipNextPopstate = false;
    if (activeEntries.length === 0) {
      window.removeEventListener("popstate", handlePopState);
      popstateListening = false;
    }
    return;
  }
  const entry = activeEntries.pop();
  if (!entry) return;
  entry.onClose();
  if (activeEntries.length === 0) {
    window.removeEventListener("popstate", handlePopState);
    popstateListening = false;
  }
}

export function hasActiveBrowserBackClose() {
  return activeEntries.length > 0;
}

export function consumeRetiredBrowserBackClose(id: string) {
  return retiredIds.delete(id);
}

function registerEntry(id: string, onClose: () => void) {
  activeEntries.push({ id, onClose });
  if (!popstateListening) {
    window.addEventListener("popstate", handlePopState);
    popstateListening = true;
  }
}

function unregisterEntry(id: string) {
  const index = activeEntries.findIndex(entry => entry.id === id);
  if (index >= 0) activeEntries.splice(index, 1);
  if (activeEntries.length === 0 && popstateListening && !skipNextPopstate) {
    window.removeEventListener("popstate", handlePopState);
    popstateListening = false;
  }
}

export function useBrowserBackClose(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  const stateIdRef = useRef<string | null>(null);
  const activeRef = useRef(active);
  activeRef.current = active;

  const armBackClose = useRef<() => void>(() => undefined);
  armBackClose.current = () => {
    if (!activeRef.current || stateIdRef.current || typeof window === "undefined") return;
    const stateId = `mercado-${Date.now()}-${Math.random().toString(36).slice(2)}`;
    window.history.pushState({ mercadoBackCloseId: stateId }, "");
    stateIdRef.current = stateId;
    registerEntry(stateId, () => {
      stateIdRef.current = null;
      onCloseRef.current();
      requestAnimationFrame(() => armBackClose.current());
    });
  };

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;
    const frame = requestAnimationFrame(() => armBackClose.current());

    return () => {
      cancelAnimationFrame(frame);
      const stateId = stateIdRef.current;
      if (!stateId) return;
      const closesCurrentHistoryEntry = window.history.state?.mercadoBackCloseId === stateId;
      if (closesCurrentHistoryEntry) skipNextPopstate = true;
      unregisterEntry(stateId);
      stateIdRef.current = null;
      if (closesCurrentHistoryEntry) {
        window.history.back();
      } else {
        retiredIds.add(stateId);
      }
    };
  }, [active]);

  return useCallback(() => {
    const stateId = stateIdRef.current;
    if (active && stateId && typeof window !== "undefined" && window.history.state?.mercadoBackCloseId === stateId) {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, [active]);
}
