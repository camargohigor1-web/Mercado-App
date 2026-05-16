// src/context/AppContext.tsx
// ─── App Context com Firestore + localStorage cache ───────────────────────────
//
// Estratégia de sincronização:
//   1. Na montagem: lê localStorage imediatamente (sem delay para o usuário)
//   2. Conecta ao Firestore com onSnapshot (tempo real)
//   3. Quando chega dado do Firestore: atualiza estado + localStorage cache
//   4. Quando usuário altera dado: atualiza estado local + Firestore + localStorage
//
// Proteção contra loop:
//   - Flag `isRemoteUpdate` evita que atualizações vindas do Firestore
//     sejam re-enviadas de volta ao Firestore.
//
// Proteção contra duplicação:
//   - Debounce de 300ms em cada campo antes de enviar ao Firestore,
//     coletando múltiplas alterações rápidas em uma única escrita.

import {
  createContext,
  useContext,
  useState,
  useCallback,
  useEffect,
  useRef,
  ReactNode,
} from "react";
import { KEYS, load, save, DEFAULT_CATEGORIES } from "../utils";
import type { Item, Market, Purchase, ShoppingListEntry, WarehouseItem } from "../types";
import {
  subscribeToSharedData,
  saveField,
  saveAllData,
  type SharedData,
} from "../services/firestoreService";

// ─── Tipos ───────────────────────────────────────────────────────────────────
interface AppState {
  items: Item[];
  markets: Market[];
  purchases: Purchase[];
  list: ShoppingListEntry[];
  warehouse: WarehouseItem[];
  categories: string[];
  theme: string;
}

interface AppContextType extends AppState {
  setItems: (v: Item[]) => void;
  setMarkets: (v: Market[]) => void;
  setPurchases: (v: Purchase[]) => void;
  setList: (v: ShoppingListEntry[]) => void;
  setWarehouse: (v: WarehouseItem[]) => void;
  setCategories: (v: string[]) => void;
  setTheme: (v: string) => void;
  restoreAll: (data: Partial<AppState>) => void;
  // Status de sincronização (para uso futuro em UI)
  syncStatus: "idle" | "syncing" | "error" | "offline";
}

const AppCtx = createContext<AppContextType | null>(null);

// ─── Debounce helper ──────────────────────────────────────────────────────────
function useDebounce() {
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({});

  return useCallback((key: string, fn: () => void, delay = 300) => {
    if (timers.current[key]) clearTimeout(timers.current[key]);
    timers.current[key] = setTimeout(fn, delay);
  }, []);
}

// ─── Provider ────────────────────────────────────────────────────────────────
export function AppProvider({ children }: { children: ReactNode }) {
  // ── Estado inicial a partir do localStorage (cache rápido) ────────────────
  const [items, setItemsRaw] = useState<Item[]>(() => load(KEYS.items, []));
  const [markets, setMarketsRaw] = useState<Market[]>(() => load(KEYS.markets, []));
  const [purchases, setPurchasesRaw] = useState<Purchase[]>(() => load(KEYS.purchases, []));
  const [list, setListRaw] = useState<ShoppingListEntry[]>(() => load(KEYS.shoppingList, []));
  const [warehouse, setWarehouseRaw] = useState<WarehouseItem[]>(() => load(KEYS.warehouse, []));
  const [categories, setCategoriesRaw] = useState<string[]>(() => {
    const stored = load(KEYS.categories, null);
    return stored ?? DEFAULT_CATEGORIES;
  });
  const [theme, setThemeRaw] = useState<string>(() => load(KEYS.theme, "dark"));
  const [syncStatus, setSyncStatus] = useState<"idle" | "syncing" | "error" | "offline">("idle");

  // ── Flag para evitar loop de sync ─────────────────────────────────────────
  // Quando o Firestore atualiza o estado local, não queremos reenviar ao Firestore.
  const isRemoteUpdate = useRef(false);
  const debounce = useDebounce();

  // ── Funções de escrita que atualizam estado + localStorage + Firestore ────
  // Cada setter tem duas versões:
  //   - "Raw": apenas atualiza estado React (usado internamente pelo listener)
  //   - pública: atualiza estado + persiste em ambos os destinos

  const setItems = useCallback((v: Item[]) => {
    setItemsRaw(v);
    save(KEYS.items, v);
    if (!isRemoteUpdate.current) {
      debounce("items", () => saveField("items", v));
    }
  }, [debounce]);

  const setMarkets = useCallback((v: Market[]) => {
    setMarketsRaw(v);
    save(KEYS.markets, v);
    if (!isRemoteUpdate.current) {
      debounce("markets", () => saveField("markets", v));
    }
  }, [debounce]);

  const setPurchases = useCallback((v: Purchase[]) => {
    setPurchasesRaw(v);
    save(KEYS.purchases, v);
    if (!isRemoteUpdate.current) {
      debounce("purchases", () => saveField("purchases", v));
    }
  }, [debounce]);

  const setList = useCallback((v: ShoppingListEntry[]) => {
    setListRaw(v);
    save(KEYS.shoppingList, v);
    if (!isRemoteUpdate.current) {
      debounce("shoppingList", () => saveField("shoppingList", v));
    }
  }, [debounce]);

  const setWarehouse = useCallback((v: WarehouseItem[]) => {
    setWarehouseRaw(v);
    save(KEYS.warehouse, v);
    if (!isRemoteUpdate.current) {
      debounce("warehouse", () => saveField("warehouse", v));
    }
  }, [debounce]);

  const setCategories = useCallback((v: string[]) => {
    setCategoriesRaw(v);
    save(KEYS.categories, v);
    if (!isRemoteUpdate.current) {
      debounce("categories", () => saveField("categories", v));
    }
  }, [debounce]);

  const setTheme = useCallback((v: string) => {
    setThemeRaw(v);
    save(KEYS.theme, v);
    if (!isRemoteUpdate.current) {
      debounce("theme", () => saveField("theme", v));
    }
  }, [debounce]);

  // ── Restore completo (importar backup) ────────────────────────────────────
  const restoreAll = useCallback(async (data: Partial<AppState>) => {
    isRemoteUpdate.current = true;

    if (data.items !== undefined)      { setItemsRaw(data.items);       save(KEYS.items, data.items); }
    if (data.markets !== undefined)    { setMarketsRaw(data.markets);   save(KEYS.markets, data.markets); }
    if (data.purchases !== undefined)  { setPurchasesRaw(data.purchases); save(KEYS.purchases, data.purchases); }
    if (data.list !== undefined)       { setListRaw(data.list);         save(KEYS.shoppingList, data.list); }
    if (data.warehouse !== undefined)  { setWarehouseRaw(data.warehouse); save(KEYS.warehouse, data.warehouse); }
    if (data.categories !== undefined) { setCategoriesRaw(data.categories); save(KEYS.categories, data.categories); }

    // Envia tudo ao Firestore de uma vez (não usa debounce aqui)
    const firestorePayload: SharedData = {};
    if (data.items !== undefined)      firestorePayload.items = data.items;
    if (data.markets !== undefined)    firestorePayload.markets = data.markets;
    if (data.purchases !== undefined)  firestorePayload.purchases = data.purchases;
    if (data.list !== undefined)       firestorePayload.shoppingList = data.list;
    if (data.warehouse !== undefined)  firestorePayload.warehouse = data.warehouse;
    if (data.categories !== undefined) firestorePayload.categories = data.categories;

    try {
      await saveAllData(firestorePayload);
    } catch (err) {
      console.error("[AppContext] Erro ao restaurar dados no Firestore:", err);
    } finally {
      isRemoteUpdate.current = false;
    }
  }, []);

  // ── Listener Firestore em tempo real ──────────────────────────────────────
  useEffect(() => {
    setSyncStatus("syncing");

    const unsubscribe = subscribeToSharedData((remoteData) => {
      if (!remoteData) {
        // Primeira vez: envia dados locais ao Firestore para inicializá-lo
        setSyncStatus("idle");
        const localPayload: SharedData = {
          items:        load(KEYS.items, []),
          markets:      load(KEYS.markets, []),
          purchases:    load(KEYS.purchases, []),
          shoppingList: load(KEYS.shoppingList, []),
          warehouse:    load(KEYS.warehouse, []),
          categories:   load(KEYS.categories, null) ?? DEFAULT_CATEGORIES,
          theme:        load(KEYS.theme, "dark"),
        };
        saveAllData(localPayload).catch(console.error);
        return;
      }

      // Dados chegaram do Firestore — atualizar estado sem re-enviar ao Firestore
      isRemoteUpdate.current = true;

      if (remoteData.items !== undefined) {
        setItemsRaw(remoteData.items);
        save(KEYS.items, remoteData.items);
      }
      if (remoteData.markets !== undefined) {
        setMarketsRaw(remoteData.markets);
        save(KEYS.markets, remoteData.markets);
      }
      if (remoteData.purchases !== undefined) {
        setPurchasesRaw(remoteData.purchases);
        save(KEYS.purchases, remoteData.purchases);
      }
      if (remoteData.shoppingList !== undefined) {
        setListRaw(remoteData.shoppingList);
        save(KEYS.shoppingList, remoteData.shoppingList);
      }
      if (remoteData.warehouse !== undefined) {
        setWarehouseRaw(remoteData.warehouse);
        save(KEYS.warehouse, remoteData.warehouse);
      }
      if (remoteData.categories !== undefined) {
        setCategoriesRaw(remoteData.categories);
        save(KEYS.categories, remoteData.categories);
      }
      if (remoteData.theme !== undefined) {
        setThemeRaw(remoteData.theme);
        save(KEYS.theme, remoteData.theme);
      }

      // Libera flag após aplicar todas as atualizações
      // Usa setTimeout(0) para garantir que os setters já terminaram
      setTimeout(() => {
        isRemoteUpdate.current = false;
        setSyncStatus("idle");
      }, 0);
    });

    // Cleanup: remove listener ao desmontar
    return () => {
      unsubscribe();
    };
  }, []); // Roda apenas uma vez ao montar

  return (
    <AppCtx.Provider
      value={{
        items,
        markets,
        purchases,
        list,
        warehouse,
        categories,
        theme,
        setItems,
        setMarkets,
        setPurchases,
        setList,
        setWarehouse,
        setCategories,
        setTheme,
        restoreAll,
        syncStatus,
      }}
    >
      {children}
    </AppCtx.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
