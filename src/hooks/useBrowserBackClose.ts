import { useCallback, useEffect, useRef } from "react";

export function useBrowserBackClose(active: boolean, onClose: () => void) {
  const onCloseRef = useRef(onClose);
  const pushedRef = useRef(false);

  useEffect(() => {
    onCloseRef.current = onClose;
  }, [onClose]);

  useEffect(() => {
    if (!active || typeof window === "undefined") return;

    let raf1: number;
    let raf2: number;

    raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(() => {
        const stateId = `mercado-${Date.now()}-${Math.random().toString(36).slice(2)}`;
        window.history.pushState({ mercadoBackCloseId: stateId }, "");
        pushedRef.current = true;

        function handlePopState(e: PopStateEvent) {
          if (pushedRef.current) {
            pushedRef.current = false;
            onCloseRef.current();
          }
        }

        window.addEventListener("popstate", handlePopState);

        return () => {
          window.removeEventListener("popstate", handlePopState);
        };
      });
    });

    return () => {
      cancelAnimationFrame(raf1);
      cancelAnimationFrame(raf2);
    };
  }, [active]);

  return useCallback(() => {
    if (active && pushedRef.current && typeof window !== "undefined") {
      window.history.back();
      return;
    }
    onCloseRef.current();
  }, [active]);
}
