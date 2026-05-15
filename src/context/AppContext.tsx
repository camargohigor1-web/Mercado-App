import { createContext, useContext, useState, useCallback, ReactNode } from "react";
import { KEYS, load, save, DEFAULT_CATEGORIES } from "../utils";
import type { Item, Market, Purchase, ShoppingListEntry, WarehouseItem } from "../types";

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
}

const AppCtx = createContext<AppContextType | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
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

  const setItems     = useCallback((v: Item[])              => { setItemsRaw(v);     save(KEYS.items,        v); }, []);
  const setMarkets   = useCallback((v: Market[])            => { setMarketsRaw(v);   save(KEYS.markets,      v); }, []);
  const setPurchases = useCallback((v: Purchase[])          => { setPurchasesRaw(v); save(KEYS.purchases,    v); }, []);
  const setList      = useCallback((v: ShoppingListEntry[]) => { setListRaw(v);      save(KEYS.shoppingList, v); }, []);
  const setWarehouse = useCallback((v: WarehouseItem[])     => { setWarehouseRaw(v); save(KEYS.warehouse,    v); }, []);
  const setCategories = useCallback((v: string[])           => { setCategoriesRaw(v); save(KEYS.categories,  v); }, []);
  const setTheme     = useCallback((v: string)              => { setThemeRaw(v);     save(KEYS.theme,        v); }, []);

  const restoreAll = useCallback((data: Partial<AppState>) => {
    if (data.items)      setItems(data.items);
    if (data.markets)    setMarkets(data.markets);
    if (data.purchases)  setPurchases(data.purchases);
    if (data.list)       setList(data.list);
    if (data.warehouse)  setWarehouse(data.warehouse);
    if (data.categories) setCategories(data.categories);
  }, [setItems, setMarkets, setPurchases, setList, setWarehouse, setCategories]);

  return (
    <AppCtx.Provider value={{
      items, markets, purchases, list, warehouse, categories, theme,
      setItems, setMarkets, setPurchases, setList, setWarehouse, setCategories, setTheme,
      restoreAll,
    }}>
      {children}
    </AppCtx.Provider>
  );
}

export function useAppContext() {
  const ctx = useContext(AppCtx);
  if (!ctx) throw new Error("useAppContext must be used within AppProvider");
  return ctx;
}
