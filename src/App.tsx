import { useState, useCallback } from "react";
import { ThemeCtx } from "./hooks/useTheme";
import { Icon } from "./components/Icon";
import { SplashScreen } from "./components/SplashScreen";
import { HomeSection } from "./components/HomeSection";
import { ItemsSection } from "./components/ItemsSection";
import { MarketsSection } from "./components/MarketsSection";
import { PurchasesSection } from "./components/PurchasesSection";
import { HistorySection } from "./components/HistorySection";
import { WarehouseSection } from "./components/WarehouseSection";
import { ShoppingListSection } from "./components/ShoppingListSection";
import { ReportsSection } from "./components/ReportsSection";
import { BackupSection } from "./components/BackupSection";
import { RightDrawer } from "./components/RightDrawer";
import { KEYS, load, save, DEFAULT_CATEGORIES } from "./utils";
import type { Item, Market, Purchase, ShoppingListEntry, WarehouseItem, PurchaseLine } from "./types";

const EXTRA_TABS = ["purchases", "markets", "backup", "reports", "items"];

const TITLES: Record<string, string> = {
  home:      "Início",
  shopping:  "Lista de Compras",
  purchases: "Nova Compra",
  history:   "Histórico",
  warehouse: "Armazém",
  items:     "Produtos",
  markets:   "Mercados",
  backup:    "Backup",
  reports:   "Relatório",
};


export default function App() {
  const [tab, setTab]           = useState("home");
  const [drawerOpen, setDrawer] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [theme, setThemeRaw]    = useState<string>(() => load(KEYS.theme, "dark"));

  const [items,      setItemsRaw]      = useState<Item[]>            (() => load(KEYS.items,        []));
  const [markets,    setMarketsRaw]    = useState<Market[]>          (() => load(KEYS.markets,      []));
  const [purchases,  setPurchasesRaw]  = useState<Purchase[]>        (() => load(KEYS.purchases,    []));
  const [list,       setListRaw]       = useState<ShoppingListEntry[]>(() => load(KEYS.shoppingList, []));
  const [warehouse,  setWarehouseRaw]  = useState<WarehouseItem[]>   (() => load(KEYS.warehouse,    []));
  const [categories, setCategoriesRaw] = useState<string[]>(() => {
    const stored = load(KEYS.categories, null);
    return stored ?? DEFAULT_CATEGORIES;
  });

  const setTheme     = useCallback((v: string)              => { setThemeRaw(v);    save(KEYS.theme,        v); }, []);
  const setItems     = useCallback((v: Item[])              => { setItemsRaw(v);    save(KEYS.items,        v); }, []);
  const setMarkets   = useCallback((v: Market[])            => { setMarketsRaw(v);  save(KEYS.markets,      v); }, []);
  const setPurchases = useCallback((v: Purchase[])          => { setPurchasesRaw(v); save(KEYS.purchases,   v); }, []);
  const setList      = useCallback((v: ShoppingListEntry[]) => { setListRaw(v);     save(KEYS.shoppingList, v); }, []);
  const setWarehouse = useCallback((v: WarehouseItem[])     => { setWarehouseRaw(v); save(KEYS.warehouse,   v); }, []);
  const setCategories = useCallback((v: string[])           => { setCategoriesRaw(v); save(KEYS.categories, v); }, []);

  const [pendingLines,  setPendingLines]  = useState<PurchaseLine[] | null>(null);
  const [pendingKey,    setPendingKey]    = useState(0);
  const [reportsMonth,  setReportsMonth]  = useState<string | undefined>(undefined);
  const [openPurchaseId, setOpenPurchaseId] = useState<string | undefined>(undefined);
  const [openItemId, setOpenItemId] = useState<string | undefined>(undefined);
  const [highlightedProductId, setHighlightedProductId] = useState<string | undefined>(undefined);
  const [warehouseSelectionCount, setWarehouseSelectionCount] = useState(0);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  function handleConvertToPurchase(lines: PurchaseLine[]) {
    setPendingLines(lines);
    setTab("purchases");
  }

  function handlePurchaseCreatedFromList() {
    setPendingLines(null);
    setList(list.filter(l => l.saved));
  }

  function handleRepeatPurchase(purchase: Purchase) {
    setPendingLines(purchase.lines.map(l => ({ ...l })));
    setPendingKey(Date.now());
    setTab("purchases");
  }

  function handleGoToNewPurchase() {
    setPendingLines(null);
    setPendingKey(Date.now());
    setTab("purchases");
  }

  function handleGoToReports(month: string) {
    setReportsMonth(month);
    setTab("reports");
  }

  function handleGoToHistoryPurchase(purchaseId: string) {
    setOpenPurchaseId(purchaseId);
    setHighlightedProductId(undefined);
    setTab("history");
  }

  function handleGoToHistoryItem(itemId: string) {
    setOpenItemId(itemId);
    setTab("history");
  }

  function handleGoToHistoryPurchaseWithProduct(purchaseId: string, itemId: string) {
    setOpenPurchaseId(purchaseId);
    setHighlightedProductId(itemId);
    setTab("history");
  }

  function navigateTo(dest: string) {
    if (tab === "warehouse" && warehouseSelectionCount > 0 && dest !== "warehouse") {
      setPendingTab(dest);
    } else {
      setTab(dest);
    }
  }

  function handleRestore(data: {
    items: Item[]; markets: Market[]; purchases: Purchase[];
    shoppingList: ShoppingListEntry[]; warehouse: WarehouseItem[]; categories?: string[];
  }) {
    setItems(data.items); setMarkets(data.markets); setPurchases(data.purchases);
    setList(data.shoppingList); setWarehouse(data.warehouse || []);
    if (data.categories) setCategories(data.categories);
    setTab("shopping");
  }

  const isDark  = theme === "dark";
  const isExtra = EXTRA_TABS.includes(tab);

  const bg      = isDark ? "bg-slate-950" : "bg-slate-50";
  const surface = isDark ? "bg-slate-950/95" : "bg-slate-50/95";
  const border  = isDark ? "border-white/5" : "border-black/8";
  const text    = isDark ? "text-slate-100" : "text-slate-900";

  return (
    <ThemeCtx.Provider value={{ isDark }}>
      {showSplash && <SplashScreen onDone={() => setShowSplash(false)} />}
      <div className={`min-h-screen ${bg} ${text} flex flex-col max-w-lg mx-auto relative`}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header className={`sticky top-0 z-20 ${surface} backdrop-blur-xl border-b ${border} px-4 pt-safe`}
          style={{ paddingTop: `max(env(safe-area-inset-top, 0px), 20px)` }}>
          <div className="flex items-center gap-3 pb-3">
            {/* App icon */}
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm"
              style={{ background:"linear-gradient(135deg,#0f766e,#14b8a6)" }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
              </svg>
            </div>

            {/* Title area */}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                {isExtra && (
                  <button
                    onClick={() => navigateTo("home")}
                    className={`p-1 -ml-0.5 rounded-lg transition-colors ${isDark ? "text-slate-500 hover:text-slate-300 hover:bg-white/5" : "text-slate-400 hover:text-slate-600 hover:bg-black/5"}`}
                  >
                    <Icon name="back" size={15} />
                  </button>
                )}
                <div className="min-w-0">
                  {!isExtra && (
                    <p className="text-[9px] font-black text-teal-500 uppercase tracking-[0.2em] leading-none">
                      MercadoApp
                    </p>
                  )}
                  <p className={`text-sm font-black truncate leading-tight ${isExtra ? "" : "mt-0.5"} ${text}`}>
                    {TITLES[tab]}
                  </p>
                </div>
              </div>
            </div>

            {/* Right — action zone */}
            <div className="flex items-center gap-1 flex-shrink-0">
              {/* Shopping list badge */}
              {tab === "home" && list.filter(l => !l.saved).length > 0 && (
                <button
                  onClick={() => navigateTo("shopping")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all press-scale ${isDark ? "bg-teal-500/15 text-teal-400 border border-teal-500/25" : "bg-teal-50 text-teal-700 border border-teal-200"}`}
                >
                  <Icon name="list" size={12} />
                  {list.filter(l => !l.saved).length}
                </button>
              )}
              {/* Drawer button */}
              <button
                onClick={() => setDrawer(true)}
                className={`w-8 h-8 rounded-xl flex items-center justify-center transition-all press-scale ${isDark ? "text-slate-500 hover:text-slate-300 hover:bg-white/5" : "text-slate-400 hover:text-slate-600 hover:bg-black/5"} ${isExtra ? "text-teal-400" : ""}`}
              >
                <Icon name="menu" size={17} />
              </button>
            </div>
          </div>
        </header>

        {/* ── Content ─────────────────────────────────────────────────────── */}
        <main className="flex-1 overflow-hidden relative">
          {/* Always-mounted tabs — state preserved across switches */}
          <div style={{ display: tab === "home" ? undefined : "none" }}>
            <HomeSection
              items={items} markets={markets} purchases={purchases}
              warehouse={warehouse} shoppingList={list}
              onGoToNewPurchase={handleGoToNewPurchase}
              onGoToHistory={() => setTab("history")}
              onGoToWarehouse={() => setTab("warehouse")}
              onGoToItems={() => setTab("items")}
              onRepeatPurchase={handleRepeatPurchase}
              onGoToReports={handleGoToReports}
              onGoToHistoryPurchase={handleGoToHistoryPurchase}
            />
          </div>
          <div style={{ display: tab === "shopping" ? undefined : "none" }}>
            <ShoppingListSection
              items={items} markets={markets} purchases={purchases}
              warehouse={warehouse} shoppingList={list}
              setShoppingList={setList}
              onConvertToPurchase={handleConvertToPurchase}
              onGoToItems={() => setTab("items")}
              onGoToHistoryPurchase={handleGoToHistoryPurchase}
              onGoToHistoryPurchaseWithProduct={handleGoToHistoryPurchaseWithProduct}
            />
          </div>
          <div style={{ display: tab === "history" ? undefined : "none" }}>
            <HistorySection
              items={items} markets={markets} purchases={purchases}
              warehouse={warehouse}
              onGoToNewPurchase={handleGoToNewPurchase}
              onRepeatPurchase={handleRepeatPurchase}
              initialPurchaseId={openPurchaseId}
              initialItemId={openItemId}
              initialHighlightedProductId={highlightedProductId}
              onNavigateAway={() => { setOpenPurchaseId(undefined); setHighlightedProductId(undefined); setOpenItemId(undefined); }}
            />
          </div>
          <div style={{ display: tab === "warehouse" ? undefined : "none" }}>
            <WarehouseSection
              items={items} purchases={purchases} markets={markets} warehouse={warehouse}
              setWarehouse={setWarehouse} categories={categories}
              shoppingList={list} setShoppingList={setList}
              onGoToNewPurchase={handleGoToNewPurchase}
              onSelectionChange={setWarehouseSelectionCount}
            />
          </div>
          <div style={{ display: tab === "purchases" ? undefined : "none" }}>
            <PurchasesSection
              key={pendingKey}
              items={items} markets={markets} purchases={purchases}
              setPurchases={setPurchases} setItems={setItems}
              warehouse={warehouse} setWarehouse={setWarehouse}
              categories={categories} setCategories={setCategories}
              initialLines={pendingLines ?? undefined}
              onCreatedFromList={pendingLines ? handlePurchaseCreatedFromList : undefined}
            />
          </div>
          <div className="animate-fade-slide-up px-4 py-4 pb-28" style={{ display: ["items","markets","backup","reports"].includes(tab) ? undefined : "none", position: "absolute", inset: 0, overflowY: "auto" }}>
            {tab === "items"     && <ItemsSection items={items} setItems={setItems} categories={categories} setCategories={setCategories} />}
            {tab === "markets"   && <MarketsSection markets={markets} setMarkets={setMarkets} />}
            {tab === "reports"   && <ReportsSection items={items} markets={markets} purchases={purchases} warehouse={warehouse} initialMonth={reportsMonth} onGoToHistoryItem={handleGoToHistoryItem} />}
            {tab === "backup"    && (
              <BackupSection
                items={items} markets={markets} purchases={purchases}
                shoppingList={list} warehouse={warehouse} categories={categories}
                onRestore={handleRestore}
              />
            )}
          </div>
        </main>

        {/* ── Bottom Nav ──────────────────────────────────────────────────── */}
        <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg ${surface} backdrop-blur-xl border-t ${border} z-20 nav-safe`}>
          <div className="flex items-end pt-1 pb-2">

            <NavTab id="shopping"  label="Lista"   icon="list"      active={tab==="shopping"}  isDark={isDark} onClick={() => navigateTo("shopping")}  />
            <NavTab id="history"   label="Histórico" icon="history"  active={tab==="history"}   isDark={isDark} onClick={() => navigateTo("history")}   />

            {/* Home FAB */}
            <div className="flex-1 flex flex-col items-center pb-0.5">
              <button
                onClick={() => navigateTo("home")}
                className={`w-14 h-14 -mt-6 rounded-2xl flex items-center justify-center shadow-xl transition-all active:scale-90 press-scale fab-pulse ${
                  tab==="home"
                    ? "bg-teal-500 text-white shadow-teal-500/40"
                    : isDark
                      ? "bg-slate-800 text-teal-400 shadow-black/40"
                      : "bg-white text-teal-600 shadow-black/15"
                }`}
                style={{
                  border: `3px solid ${isDark ? "rgb(2 6 23)" : "rgb(248 250 252)"}`,
                }}
              >
                <Icon name="store" size={21} />
              </button>
              <span className={`text-[8px] font-black uppercase tracking-wider mt-1.5 ${tab==="home" ? "text-teal-400" : isDark ? "text-slate-600" : "text-slate-400"}`}>
                Início
              </span>
            </div>

            <NavTab id="warehouse" label="Armazém" icon="warehouse" active={tab==="warehouse"} isDark={isDark} onClick={() => navigateTo("warehouse")} />

            {/* More button */}
            <button
              onClick={() => setDrawer(true)}
              className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative ${isExtra ? "text-teal-400" : isDark ? "text-slate-700 hover:text-slate-500" : "text-slate-400 hover:text-slate-600"}`}
            >
              <Icon name="menu" size={18} />
              <span className="text-[8px] font-black uppercase tracking-wider leading-none">Mais</span>
              {isExtra && (
                <div className="absolute top-2 right-[calc(50%-14px)] w-1.5 h-1.5 rounded-full bg-teal-400" />
              )}
            </button>

          </div>
        </nav>

        {/* ── Warehouse leave-guard ────────────────────────────────────────── */}
        {pendingTab && (
          <div className="fixed inset-0 z-50 flex items-end justify-center p-4">
            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setPendingTab(null)} />
            <div className={`relative w-full max-w-sm rounded-2xl p-5 space-y-4 shadow-2xl animate-slide-up ${isDark ? "bg-slate-900 border border-white/8" : "bg-white border border-black/8"}`}>
              <div className="flex items-start gap-3">
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 ${isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-50 text-amber-600"}`}>
                  <Icon name="warn" size={16} />
                </div>
                <div>
                  <p className={`font-black text-sm ${text}`}>Sair com seleção ativa?</p>
                  <p className={`text-xs mt-1 ${isDark ? "text-slate-400" : "text-slate-500"}`}>
                    {warehouseSelectionCount} {warehouseSelectionCount===1?"item selecionado":"itens selecionados"} no armazém. A seleção será perdida.
                  </p>
                </div>
              </div>
              <div className="flex gap-3">
                <button onClick={() => setPendingTab(null)}
                  className={`flex-1 py-3 rounded-xl text-sm font-bold transition-all press-scale ${isDark ? "bg-white/5 text-slate-200 hover:bg-white/10" : "bg-black/5 text-slate-700 hover:bg-black/10"}`}>
                  Cancelar
                </button>
                <button onClick={() => { setTab(pendingTab); setWarehouseSelectionCount(0); setPendingTab(null); }}
                  className="flex-1 py-3 rounded-xl text-sm font-bold bg-amber-500 text-white hover:bg-amber-400 transition-all press-scale">
                  Sair assim mesmo
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ── Right Drawer ─────────────────────────────────────────────────── */}
        <RightDrawer
          open={drawerOpen} onClose={() => setDrawer(false)}
          tab={tab} setTab={setTab} theme={theme} setTheme={setTheme}
        />
      </div>
    </ThemeCtx.Provider>
  );
}

function NavTab({ label, icon, active, isDark, onClick }: {
  id: string; label: string; icon: string;
  active: boolean; isDark: boolean; onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`flex-1 flex flex-col items-center gap-0.5 py-2.5 transition-colors relative ${active ? "text-teal-400" : isDark ? "text-slate-700 hover:text-slate-500" : "text-slate-400 hover:text-slate-600"}`}
    >
      <Icon name={icon} size={18} />
      <span className="text-[8px] font-black uppercase tracking-wider leading-none">{label}</span>
      {active && (
        <div className="absolute bottom-0 left-1/2 -translate-x-1/2 w-4 h-0.5 rounded-full bg-teal-400 animate-scale-in" />
      )}
    </button>
  );
}
