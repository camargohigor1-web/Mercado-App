import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { ThemeCtx } from "./hooks/useTheme";
import { Icon } from "./components/Icon";
import { SplashScreen } from "./components/SplashScreen";
import { RightDrawer } from "./components/RightDrawer";
import { ToastContainer } from "./components/ToastContainer";
import { AppProvider, useAppContext } from "./context/AppContext";
import { useToast } from "./hooks/useToast";
import type { PurchaseLine, Purchase } from "./types";
import { SyncIndicator } from "./components/SyncIndicator"; // ◄ IMPORTADO AQUI

// Lazy load de seções pesadas
const HomeSection      = lazy(() => import("./components/HomeSection").then(m => ({ default: m.HomeSection })));
const ShoppingListSection = lazy(() => import("./components/ShoppingListSection").then(m => ({ default: m.ShoppingListSection })));
const HistorySection   = lazy(() => import("./components/HistorySection").then(m => ({ default: m.HistorySection })));
const WarehouseSection = lazy(() => import("./components/WarehouseSection").then(m => ({ default: m.WarehouseSection })));
const PurchasesSection = lazy(() => import("./components/PurchasesSection").then(m => ({ default: m.PurchasesSection })));
const ItemsSection     = lazy(() => import("./components/ItemsSection").then(m => ({ default: m.ItemsSection })));
const MarketsSection   = lazy(() => import("./components/MarketsSection").then(m => ({ default: m.MarketsSection })));
const ReportsSection   = lazy(() => import("./components/ReportsSection").then(m => ({ default: m.ReportsSection })));
const BackupSection    = lazy(() => import("./components/BackupSection").then(m => ({ default: m.BackupSection })));

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

function SectionLoading({ isDark }: { isDark: boolean }) {
  return (
    <div className="flex items-center justify-center py-20">
      <div className={`w-8 h-8 rounded-full border-2 border-t-transparent animate-spin ${isDark ? "border-teal-500" : "border-teal-600"}`} />
    </div>
  );
}

function AppInner() {
  const { theme, setTheme, list, setList, purchases, setPurchases, warehouse, setWarehouse, items, setItems, markets, categories, setCategories, restoreAll } = useAppContext();
  const { toasts, show: showToast, dismiss } = useToast();

  const [tab, setTab]           = useState("home");
  const [drawerOpen, setDrawer] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [pendingLines,  setPendingLines]  = useState<PurchaseLine[] | null>(null);
  const [pendingKey,    setPendingKey]    = useState(0);
  const [reportsMonth,  setReportsMonth]  = useState<string | undefined>(undefined);
  const [openPurchaseId, setOpenPurchaseId] = useState<string | undefined>(undefined);
  const [openItemId, setOpenItemId] = useState<string | undefined>(undefined);
  const [highlightedProductId, setHighlightedProductId] = useState<string | undefined>(undefined);
  const [warehouseSelectionCount, setWarehouseSelectionCount] = useState(0);
  const [pendingTab, setPendingTab] = useState<string | null>(null);

  // Listener de erro de storage
  useEffect(() => {
    function onStorageError() {
      showToast("Armazenamento quase cheio! Faça um backup e limpe dados antigos.", "warning", 6000);
    }
    window.addEventListener("storage-error", onStorageError);
    return () => window.removeEventListener("storage-error", onStorageError);
  }, [showToast]);

  function handleConvertToPurchase(lines: PurchaseLine[]) {
    setPendingLines(lines);
    setTab("purchases");
  }

  function handlePurchaseCreatedFromList() {
    setPendingLines(null);
    setList(list.filter((l: any) => l.saved));
    showToast("Compra registrada com sucesso!");
  }

  function handlePurchaseSaved() {
    showToast("Compra registrada com sucesso!");
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
    items: any[]; markets: any[]; purchases: any[];
    shoppingList: any[]; warehouse: any[]; categories?: string[];
  }) {
    restoreAll({
      items: data.items, markets: data.markets, purchases: data.purchases,
      list: data.shoppingList, warehouse: data.warehouse || [],
      categories: data.categories,
    });
    setTab("home");
    showToast("Dados restaurados com sucesso!");
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

      <ToastContainer toasts={toasts} onDismiss={dismiss} />

      <div className={`min-h-screen ${bg} ${text} flex flex-col max-w-lg mx-auto relative`}>

        {/* ── Header ──────────────────────────────────────────────────────── */}
        <header
          className={`sticky top-0 z-20 ${surface} backdrop-blur-xl border-b ${border} px-4`}
          style={{ paddingTop: `max(env(safe-area-inset-top, 0px), 20px)` }}
        >
          <div className="flex items-center gap-3 pb-3">
            <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0 overflow-hidden shadow-sm"
              style={{ background:"linear-gradient(135deg,#0f766e,#14b8a6)" }}>
              <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M6 2 3 6v14a2 2 0 002 2h14a2 2 0 002-2V6l-3-4zM3 6h18M16 10a4 4 0 01-8 0"/>
              </svg>
            </div>

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

            <div className="flex items-center gap-1 flex-shrink-0">
              {tab === "home" && list.filter((l: any) => !l.saved).length > 0 && (
                <button
                  onClick={() => navigateTo("shopping")}
                  className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all press-scale ${isDark ? "bg-teal-500/15 text-teal-400 border border-teal-500/25" : "bg-teal-50 text-teal-700 border border-teal-200"}`}
                >
                  <Icon name="list" size={12} />
                  {list.filter((l: any) => !l.saved).length}
                </button>
              )}
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
        <main className="flex-1 overflow-y-auto px-4 py-4 pb-28">
          <div key={tab} className="animate-fade-slide-up">
            <Suspense fallback={<SectionLoading isDark={isDark} />}>
              {tab === "home" && (
                <HomeSection
                  onGoToNewPurchase={handleGoToNewPurchase}
                  onGoToHistory={() => setTab("history")}
                  onGoToWarehouse={() => setTab("warehouse")}
                  onGoToItems={() => setTab("items")}
                  onRepeatPurchase={handleRepeatPurchase}
                  onGoToReports={handleGoToReports}
                  onGoToHistoryPurchase={handleGoToHistoryPurchase}
                />
              )}
              {tab === "shopping" && (
                <ShoppingListSection
                  onConvertToPurchase={handleConvertToPurchase}
                  onGoToItems={() => setTab("items")}
                  onGoToHistoryPurchase={handleGoToHistoryPurchase}
                  onGoToHistoryPurchaseWithProduct={handleGoToHistoryPurchaseWithProduct}
                />
              )}
              {tab === "history" && (
                <HistorySection
                  onGoToNewPurchase={handleGoToNewPurchase}
                  onRepeatPurchase={handleRepeatPurchase}
                  initialPurchaseId={openPurchaseId}
                  initialItemId={openItemId}
                  initialHighlightedProductId={highlightedProductId}
                  onNavigateAway={() => { setOpenPurchaseId(undefined); setHighlightedProductId(undefined); setOpenItemId(undefined); }}
                />
              )}
              {tab === "warehouse" && (
                <WarehouseSection
                  onGoToNewPurchase={handleGoToNewPurchase}
                  onSelectionChange={setWarehouseSelectionCount}
                />
              )}
              {tab === "purchases" && (
                <PurchasesSection
                  key={pendingKey}
                  initialLines={pendingLines ?? undefined}
                  onCreatedFromList={pendingLines ? handlePurchaseCreatedFromList : undefined}
                  onPurchaseSaved={handlePurchaseSaved}
                />
              )}
              {tab === "items" && (
                <ItemsSection />
              )}
              {tab === "markets" && (
                <MarketsSection />
              )}
              {tab === "reports" && (
                <ReportsSection
                  initialMonth={reportsMonth}
                  onGoToHistoryItem={handleGoToHistoryItem}
                />
              )}
              {tab === "backup" && (
                <BackupSection onRestore={handleRestore} />
              )}
            </Suspense>
          </div>
        </main>

        {/* ── Bottom Nav ──────────────────────────────────────────────────── */}
        <nav className={`fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-lg ${surface} backdrop-blur-xl border-t ${border} z-20 nav-safe`}>
          <div className="flex items-end pt-1 pb-2">

            <NavTab id="shopping"  label="Lista"     icon="list"      active={tab==="shopping"}  isDark={isDark} onClick={() => navigateTo("shopping")}  />
            <NavTab id="history"   label="Histórico" icon="history"   active={tab==="history"}   isDark={isDark} onClick={() => navigateTo("history")}   />

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

            <NavTab id="warehouse" label="Armazém"   icon="warehouse" active={tab==="warehouse"} isDark={isDark} onClick={() => navigateTo("warehouse")} />

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

        <RightDrawer
          open={drawerOpen} onClose={() => setDrawer(false)}
          tab={tab} setTab={setTab} theme={theme} setTheme={setTheme}
        />
        
        <SyncIndicator /> {/* ◄ INSERIDO AQUI ANTES DA CONCLUSÃO DA DIV PRINCIPAL */}
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

export default function App() {
  return (
    <AppProvider>
      <AppInner />
    </AppProvider>
  );
}