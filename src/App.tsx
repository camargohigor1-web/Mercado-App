import { PriceCompareModal } from "./components/PriceCompareModal";
import { useState, useCallback, useEffect, useRef, lazy, Suspense } from "react";
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
import { consumeRetiredBrowserBackClose, hasActiveBrowserBackClose } from "./hooks/useBrowserBackClose";

// Lazy load de seções pesadas
const HomeSection      = lazy(() => import("./components/HomeSection").then(m => ({ default: m.HomeSection })));
const ShoppingListSection = lazy(() => import("./components/ShoppingListSection").then(m => ({ default: m.ShoppingListSection })));
const HistorySection   = lazy(() => import("./components/HistorySection").then(m => ({ default: m.HistorySection })));
const PurchasesSection = lazy(() => import("./components/PurchasesSection").then(m => ({ default: m.PurchasesSection })));
const ItemsSection     = lazy(() => import("./components/ItemsSection").then(m => ({ default: m.ItemsSection })));
const MarketsSection   = lazy(() => import("./components/MarketsSection").then(m => ({ default: m.MarketsSection })));
const ReportsSection   = lazy(() => import("./components/ReportsSection").then(m => ({ default: m.ReportsSection })));
const BackupSection    = lazy(() => import("./components/BackupSection").then(m => ({ default: m.BackupSection })));
const CalculatorCenterModal = lazy(() => import("./components/CalculatorCenterModal").then(m => ({ default: m.CalculatorCenterModal })));

const EXTRA_TABS = ["purchases", "markets", "backup", "reports", "items"];

const TITLES: Record<string, string> = {
  home:      "Início",
  shopping:  "Lista de Compras",
  purchases: "Compras",
  history:   "Histórico",
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
  const [compareModalOpen, setCompareModalOpen] = useState(false);
  const [calculatorModalOpen, setCalculatorModalOpen] = useState(false);
  const [showExitConfirmation, setShowExitConfirmation] = useState(false);
  const currentTabRef = useRef(tab);
  const historyIndexRef = useRef(0);
  const appHistoryInitializedRef = useRef(false);
  const exitApprovedRef = useRef(false);

  const navigateTo = useCallback((dest: string) => {
    if (currentTabRef.current === dest) return;
    const nextIndex = historyIndexRef.current + 1;
    currentTabRef.current = dest;
    historyIndexRef.current = nextIndex;
    const nextState = { mercadoAppNavigation: true, appNavigationIndex: nextIndex, tab: dest };
    if (hasActiveBrowserBackClose() && window.history.state?.mercadoBackCloseId) {
      window.history.replaceState(nextState, "");
    } else {
      window.history.pushState(nextState, "");
    }
    setTab(dest);
  }, []);

  useEffect(() => {
    if (!appHistoryInitializedRef.current) {
      window.history.pushState({ mercadoAppNavigation: true, appNavigationIndex: 0, tab: currentTabRef.current }, "");
      appHistoryInitializedRef.current = true;
    }

    const handlePopState = (event: PopStateEvent) => {
      if (exitApprovedRef.current) {
        exitApprovedRef.current = false;
        return;
      }

      // Allow modal and detail hooks to handle their own back entry first.
      queueMicrotask(() => {
        if (hasActiveBrowserBackClose()) return;

        const state = event.state as { mercadoAppNavigation?: boolean; appNavigationIndex?: number; tab?: string; mercadoBackCloseId?: string } | null;
        if (state?.mercadoAppNavigation && state.tab) {
          historyIndexRef.current = state.appNavigationIndex || 0;
          currentTabRef.current = state.tab;
          setTab(state.tab);
          setShowExitConfirmation(false);
          return;
        }

        if (state?.mercadoBackCloseId) {
          consumeRetiredBrowserBackClose(state.mercadoBackCloseId);
          window.history.back();
          return;
        }

        setShowExitConfirmation(true);
        window.history.pushState({
          mercadoAppNavigation: true,
          appNavigationIndex: historyIndexRef.current,
          tab: currentTabRef.current,
        }, "");
      });
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, []);

  const confirmExit = useCallback(() => {
    setShowExitConfirmation(false);
    exitApprovedRef.current = true;
    window.history.back();
  }, []);

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
    navigateTo("purchases");
  }

  function handlePurchaseCreatedFromList() {
    const purchasedIds = new Set((pendingLines || []).map(line => line.itemId));
    setPendingLines(null);
    setList(list.filter((entry: any) => entry.saved || !purchasedIds.has(entry.itemId)));
    showToast("Compra registrada com sucesso!");
  }

  function handlePurchaseSaved() {
    showToast("Compra registrada com sucesso!");
  }

  function handleRepeatPurchase(purchase: Purchase) {
    setPendingLines(purchase.lines.map(l => ({ ...l })));
    setPendingKey(Date.now());
    navigateTo("purchases");
  }

  function handleGoToNewPurchase() {
    setPendingLines(null);
    setPendingKey(Date.now());
    navigateTo("purchases");
  }

  function handleGoToReports(month: string) {
    setReportsMonth(month);
    setReportsViewState(prev => ({ ...prev, ...getMonthRange(month), mainTab: "gastos" }));
    navigateTo("reports");
  }

  function handleGoToHistoryPurchase(purchaseId: string) {
    setOpenPurchaseId(purchaseId);
    setHighlightedProductId(undefined);
    navigateTo("history");
  }

  function handleGoToHistoryItem(itemId: string) {
    setOpenItemId(itemId);
    navigateTo("history");
  }

  function handleGoToHistoryPurchaseWithProduct(purchaseId: string, itemId: string) {
    setOpenPurchaseId(purchaseId);
    setHighlightedProductId(itemId);
    navigateTo("history");
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
    navigateTo("home");
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
      {compareModalOpen && <PriceCompareModal items={items} initialItem={null} onClose={() => setCompareModalOpen(false)} />}
      {calculatorModalOpen && <Suspense fallback={null}><CalculatorCenterModal items={items} onClose={() => setCalculatorModalOpen(false)} /></Suspense>}

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
                  onGoToShopping={() => navigateTo("shopping")}
                  onOpenCalculator={() => setCalculatorModalOpen(true)}
                  onGoToHistory={() => navigateTo("history")}
                  onGoToHabits={() => navigateTo("history")}
                  onGoToItems={() => navigateTo("items")}
                  onRepeatPurchase={handleRepeatPurchase}
                  onGoToReports={handleGoToReports}
                  onGoToHistoryPurchase={handleGoToHistoryPurchase}
                  onGoToHistoryItem={handleGoToHistoryItem}
                />
              )}
              {tab === "shopping" && (
                <ShoppingListSection
                  onConvertToPurchase={handleConvertToPurchase}
                  onGoToItems={() => navigateTo("items")}
                  onGoToHistoryPurchase={handleGoToHistoryPurchase}
                  onGoToHistoryPurchaseWithProduct={handleGoToHistoryPurchaseWithProduct}
                />
              )}
              {tab === "history" && (
                <HistorySection
                  onGoToNewPurchase={handleGoToNewPurchase}
                  onRepeatPurchase={handleRepeatPurchase}
                  onOpenCompare={() => setCompareModalOpen(true)}
                  initialPurchaseId={openPurchaseId}
                  initialItemId={openItemId}
                  initialHighlightedProductId={highlightedProductId}
                  onNavigateAway={() => { setOpenPurchaseId(undefined); setHighlightedProductId(undefined); setOpenItemId(undefined); }}
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

            <NavTab id="purchases" label="Compras" icon="cart" active={tab==="purchases"} isDark={isDark} onClick={() => navigateTo("purchases")} />
            <NavTab id="reports" label="Relatório" icon="chart" active={tab==="reports"} isDark={isDark} onClick={() => navigateTo("reports")} />

          </div>
        </nav>

        <RightDrawer
          open={drawerOpen} onClose={() => setDrawer(false)}
          tab={tab} setTab={navigateTo} theme={theme} setTheme={setTheme}
        />

        {showExitConfirmation && (
          <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 px-5 backdrop-blur-sm" role="presentation">
            <div role="dialog" aria-modal="true" aria-labelledby="exit-dialog-title" className={`w-full max-w-sm rounded-2xl border p-5 shadow-2xl ${isDark ? "bg-slate-900 border-slate-700" : "bg-white border-slate-200"}`}>
              <h2 id="exit-dialog-title" className={`text-base font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>Deseja sair do app?</h2>
              <p className={`mt-2 text-sm ${isDark ? "text-slate-400" : "text-slate-600"}`}>Você pode continuar usando o MercadoApp ou confirmar a saída.</p>
              <div className="mt-5 flex gap-3">
                <button onClick={() => setShowExitConfirmation(false)} className={`flex-1 rounded-xl px-4 py-2.5 text-sm font-bold ${isDark ? "bg-slate-800 text-slate-200" : "bg-slate-100 text-slate-700"}`}>Continuar no app</button>
                <button onClick={confirmExit} className="flex-1 rounded-xl bg-teal-500 px-4 py-2.5 text-sm font-bold text-white">Sair</button>
              </div>
            </div>
          </div>
        )}
        
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

export default function App({ userId }: { userId: string }) {
  return (
    <AppProvider userId={userId}>
      <AppInner />
    </AppProvider>
  );
}
