import { useState, useCallback, useEffect, lazy, Suspense } from "react";
import { ThemeCtx } from "./hooks/useTheme";
import { Icon } from "./components/Icon";
import { SplashScreen } from "./components/SplashScreen";
import { RightDrawer } from "./components/RightDrawer";
import { ToastContainer } from "./components/ToastContainer";
import { AppProvider, useAppContext } from "./context/AppContext";
import { useToast } from "./hooks/useToast";
import type { PurchaseLine, Purchase } from "./types";
import type { ReportsViewState } from "./components/ReportsSection";
import { SyncIndicator } from "./components/SyncIndicator"; // ◄ IMPORTADO AQUI

// Lazy load de seções pesadas
const HomeSection      = lazy(() => import("./components/HomeSection").then(m => ({ default: m.HomeSection })));
const ShoppingListSection = lazy(() => import("./components/ShoppingListSection").then(m => ({ default: m.ShoppingListSection })));
const HistorySection   = lazy(() => import("./components/HistorySection").then(m => ({ default: m.HistorySection })));
const PurchaseHabitsSection = lazy(() => import("./components/PurchaseHabitsSection").then(m => ({ default: m.PurchaseHabitsSection })));
const PurchasesSection = lazy(() => import("./components/PurchasesSection").then(m => ({ default: m.PurchasesSection })));
const ItemsSection     = lazy(() => import("./components/ItemsSection").then(m => ({ default: m.ItemsSection })));
const MarketsSection   = lazy(() => import("./components/MarketsSection").then(m => ({ default: m.MarketsSection })));
const ReportsSection   = lazy(() => import("./components/ReportsSection").then(m => ({ default: m.ReportsSection })));
const BackupSection    = lazy(() => import("./components/BackupSection").then(m => ({ default: m.BackupSection })));

const EXTRA_TABS = ["purchases", "markets", "backup", "reports", "items"];

const TITLES: Record<string, string> = {
  home:      "Início",
  shopping:  "Lista de Compras",
  purchases: "Compras",
  history:   "Histórico",
  warehouse: "Hábitos de compra",
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

function getMonthRange(month: string) {
  const [y, m] = month.split("-").map(Number);
  const lastDay = new Date(y, m, 0).getDate();
  return { dateFrom: `${month}-01`, dateTo: `${month}-${String(lastDay).padStart(2, "0")}` };
}

const DEFAULT_REPORTS_VIEW_STATE: ReportsViewState = {
  mainTab: "gastos",
  dateFrom: "",
  dateTo: "",
  selectedCategory: "",
  expandedPriceItemId: null,
  productSearch: "",
};

function AppInner() {
  const { theme, setTheme, list, setList, purchases, setPurchases, items, setItems, markets, categories, setCategories, restoreAll } = useAppContext();
  const { toasts, show: showToast, dismiss } = useToast();

  const [tab, setTab]           = useState("home");
  const [drawerOpen, setDrawer] = useState(false);
  const [showSplash, setShowSplash] = useState(true);
  const [pendingLines,  setPendingLines]  = useState<PurchaseLine[] | null>(null);
  const [pendingKey,    setPendingKey]    = useState(0);
  const [reportsMonth,  setReportsMonth]  = useState<string | undefined>(undefined);
  const [reportsViewState, setReportsViewState] = useState<ReportsViewState>(DEFAULT_REPORTS_VIEW_STATE);
  const [openPurchaseId, setOpenPurchaseId] = useState<string | undefined>(undefined);
  const [openItemId, setOpenItemId] = useState<string | undefined>(undefined);
  const [highlightedProductId, setHighlightedProductId] = useState<string | undefined>(undefined);

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
    setReportsViewState(prev => ({ ...prev, ...getMonthRange(month), mainTab: "gastos" }));
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
    setTab(dest);
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
                  onGoToHabits={() => setTab("warehouse")}
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
                <PurchaseHabitsSection />
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
                  viewState={reportsViewState}
                  onViewStateChange={setReportsViewState}
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

            <NavTab id="warehouse" label="Hábitos"   icon="trend" active={tab==="warehouse"} isDark={isDark} onClick={() => navigateTo("warehouse")} />

            <NavTab id="reports" label="Relatório" icon="chart" active={tab==="reports"} isDark={isDark} onClick={() => navigateTo("reports")} />

          </div>
        </nav>

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
