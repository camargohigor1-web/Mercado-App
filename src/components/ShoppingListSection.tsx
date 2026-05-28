import { useState, useRef, useCallback, useMemo, memo } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAppContext } from "../context/AppContext";
import { Icon } from "./Icon";
import { Btn, Inp, Modal, Card, Badge, Empty, InfoBox, ConfirmModal, LineChart } from "./ui";
import type { LineChartPoint } from "./ui";
import { uid, fmt, fmtN, getDisplayFactor, getDisplayUnit, calcStats } from "../utils";
import type { Item, ShoppingListItem, SavedShoppingList, PurchaseLine } from "../types";

interface ShoppingListSectionProps {
  onConvertToPurchase: (lines: PurchaseLine[]) => void;
  onGoToItems?: () => void;
  onGoToHistoryPurchase?: (purchaseId: string) => void;
  onGoToHistoryPurchaseWithProduct?: (purchaseId: string, itemId: string) => void;
}

// ─── Shared CategoryPills ─────────────────────────────────────────────────────
export function CategoryPills({
  categories,
  active,
  onChange,
  isDark,
  allLabel = "Tudo",
}: {
  categories: string[];
  active: string;
  onChange: (cat: string) => void;
  isDark: boolean;
  allLabel?: string;
}) {
  if (categories.length <= 1) return null;
  return (
    <div className="flex gap-2 overflow-x-auto pb-0.5" style={{ scrollbarWidth: "none" }}>
      {["", ...categories].map((cat) => (
        <button
          key={cat || "__all__"}
          onClick={() => onChange(cat)}
          className={`flex-shrink-0 px-3 py-1.5 rounded-full text-xs font-bold transition-all active:scale-95 ${
            active === cat
              ? "bg-teal-500 text-white shadow-sm"
              : isDark
              ? "bg-slate-800 text-slate-400 hover:text-slate-200"
              : "bg-slate-100 text-slate-500 hover:text-slate-700"
          }`}
        >
          {cat || allLabel}
        </button>
      ))}
    </div>
  );
}

// ─── MarketItemCard ───────────────────────────────────────────────────────────
const MarketItemCard = memo(function MarketItemCard({
  itemId, item, stats, qty, isDark, isExpanded,
  onToggle, onRemove, onExpand, onQtyChange,
  recentEntries, priceEvolution, onNavigatePurchase, onCompare,
}: {
  itemId: string; item: Item; stats: ReturnType<typeof calcStats>;
  qty: number; isDark: boolean; isExpanded: boolean;
  onToggle: () => void; onRemove: () => void; onExpand: () => void;
  onQtyChange: (val: number) => void; recentEntries: any[];
  priceEvolution: LineChartPoint[];
  onNavigatePurchase?: (purchaseId: string, itemId: string) => void;
  onCompare: () => void;
}) {
  const du = getDisplayUnit(item);
  const factor = getDisplayFactor(item);
  const inputRef = useRef<HTMLInputElement>(null);
  const [localQty, setLocalQty] = useState(String(qty));

  const prevQtyRef = useRef(qty);
  if (prevQtyRef.current !== qty) {
    prevQtyRef.current = qty;
    setLocalQty(String(qty));
  }

  const lastPrice = stats ? (item.type === "bulk" ? stats.lastPrice / factor : stats.lastPrice) : null;
  const minPrice  = stats ? (item.type === "bulk" ? stats.minPrice  / factor : stats.minPrice)  : null;
  const avgPrice  = stats ? (item.type === "bulk" ? stats.avgPrice  / factor : stats.avgPrice)  : null;
  const priceVsAvg = lastPrice !== null && avgPrice !== null && avgPrice > 0
    ? ((lastPrice - avgPrice) / avgPrice) * 100 : null;

  const handleQtyBlur = useCallback(() => {
    const n = parseFloat(localQty);
    if (!isNaN(n) && n > 0) onQtyChange(n);
    else setLocalQty(String(qty));
  }, [localQty, qty, onQtyChange]);

  return (
    <div className={`rounded-2xl border transition-all duration-200 overflow-hidden ${
      isExpanded
        ? isDark ? "bg-slate-900 border-teal-500/40 shadow-lg shadow-teal-500/5"
                 : "bg-white border-teal-400/50 shadow-lg shadow-teal-500/5"
        : isDark  ? "bg-slate-900 border-slate-800"
                  : "bg-white border-slate-200"
    }`}>
      {/* ── Main row ── */}
      <div className="flex items-center gap-2.5 px-3 py-3">
        <button onClick={onToggle}
          className={`w-6 h-6 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all active:scale-90 ${
            isDark ? "border-slate-600 hover:border-teal-400" : "border-slate-300 hover:border-teal-500"
          }`}>
          <div className={`w-2.5 h-2.5 rounded-full ${isDark ? "bg-slate-700" : "bg-slate-200"}`} />
        </button>

        <button onClick={onExpand} className="flex-1 min-w-0 text-left">
          <p className={`text-sm font-bold truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>{item.name}</p>
          <div className="flex items-center gap-2 mt-0.5 flex-wrap">
            {lastPrice !== null ? (
              <>
                <span className="text-[11px] text-blue-400 font-semibold">
                  {fmt(lastPrice)}/{item.type === "bulk" ? du : "emb"}
                </span>
                {priceVsAvg !== null && Math.abs(priceVsAvg) > 2 && (
                  <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-md ${
                    priceVsAvg > 0
                      ? isDark ? "bg-red-500/15 text-red-400" : "bg-red-50 text-red-600"
                      : isDark ? "bg-teal-500/15 text-teal-400" : "bg-teal-50 text-teal-600"
                  }`}>
                    {priceVsAvg > 0 ? "▲" : "▼"}{Math.abs(priceVsAvg).toFixed(0)}% vs média
                  </span>
                )}
              </>
            ) : (
              <span className={`text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>Sem histórico</span>
            )}
          </div>
        </button>

        {/* Qty controls */}
        <div className="flex items-center gap-1 flex-shrink-0">
          <button onClick={() => onQtyChange(Math.max(1, qty - 1))}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-base font-black transition-colors active:scale-90 ${
              isDark ? "bg-slate-800 text-slate-500 hover:text-slate-200" : "bg-slate-100 text-slate-400 hover:text-slate-700"
            }`}>−</button>
          <input ref={inputRef} type="number" inputMode="decimal" value={localQty}
            onChange={(e) => setLocalQty(e.target.value)}
            onBlur={handleQtyBlur}
            onKeyDown={(e) => { if (e.key === "Enter") inputRef.current?.blur(); }}
            className={`w-9 text-center text-sm font-black rounded-lg border focus:outline-none focus:border-teal-500 py-1 transition-colors ${
              isDark ? "bg-slate-800 border-slate-700 text-slate-100" : "bg-slate-100 border-slate-300 text-slate-900"
            }`} />
          <button onClick={() => onQtyChange(qty + 1)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center text-base font-black transition-colors active:scale-90 ${
              isDark ? "bg-slate-800 text-slate-500 hover:text-slate-200" : "bg-slate-100 text-slate-400 hover:text-slate-700"
            }`}>+</button>
        </div>

        <button onClick={onExpand}
          className={`p-1 flex-shrink-0 transition-all ${
            isDark ? "text-slate-600 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"
          } ${isExpanded ? "rotate-90" : ""}`}>
          <Icon name="chevron" size={15} />
        </button>
      </div>

      {/* ── Expanded panel ── */}
      {isExpanded && (
        <div className={`border-t px-3 pb-3 pt-3 space-y-3 animate-fade-slide-up ${
          isDark ? "border-slate-800" : "border-slate-100"
        }`}>
          {/* Price grid */}
          {stats ? (
            <div className="grid grid-cols-3 gap-1.5">
              {[
                { label: "Mínimo",  val: minPrice,  colorBg: isDark ? "bg-teal-500/10"  : "bg-teal-50",  colorTxt: "text-teal-400",  colorLbl: isDark ? "text-teal-700"  : "text-teal-500"  },
                { label: "Médio",   val: avgPrice,  colorBg: isDark ? "bg-green-500/10" : "bg-green-50", colorTxt: "text-green-400", colorLbl: isDark ? "text-green-700" : "text-green-500" },
                { label: "Último",
                  val: lastPrice,
                  colorBg: priceVsAvg !== null && priceVsAvg > 5 ? (isDark ? "bg-red-500/10" : "bg-red-50") : (isDark ? "bg-blue-500/10" : "bg-blue-50"),
                  colorTxt: priceVsAvg !== null && priceVsAvg > 5 ? "text-red-400" : "text-blue-400",
                  colorLbl: priceVsAvg !== null && priceVsAvg > 5 ? (isDark ? "text-red-700" : "text-red-400") : (isDark ? "text-blue-700" : "text-blue-400"),
                },
              ].map(({ label, val, colorBg, colorTxt, colorLbl }) => (
                <div key={label} className={`rounded-xl p-2.5 ${colorBg}`}>
                  <p className={`text-[9px] font-black uppercase tracking-wide mb-1 ${colorLbl}`}>{label}</p>
                  <p className={`text-xs font-black ${colorTxt}`}>{fmt(val!)}</p>
                  <p className={`text-[9px] ${colorLbl}`}>/{item.type === "bulk" ? du : "emb"}</p>
                </div>
              ))}
            </div>
          ) : (
            <p className={`text-xs text-center py-2 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
              Sem histórico de preços ainda
            </p>
          )}

          {/* Price evolution chart */}
          {priceEvolution.length >= 2 && (
            <div className={`rounded-xl p-3 ${isDark ? "bg-slate-950 border border-slate-800" : "bg-slate-50 border border-slate-200"}`}>
              <LineChart data={priceEvolution} formatValue={fmt} unit={item.type === "bulk" ? `R$/${du}` : "R$/emb"} />
            </div>
          )}

          {/* Recent purchases */}
          {recentEntries.length > 0 && (
            <div className="space-y-1.5">
              <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                Últimas compras
              </p>
              {recentEntries.map((e: any, i: number) => (
                <button key={i} onClick={() => onNavigatePurchase?.(e.purchaseId, itemId)}
                  className={`w-full flex items-center justify-between px-3 py-2 rounded-xl border text-left transition-all active:scale-[0.98] ${
                    isDark ? "bg-slate-950 border-slate-800 hover:border-slate-700" : "bg-white border-slate-200 hover:border-slate-300"
                  } ${onNavigatePurchase ? "cursor-pointer" : "cursor-default"}`}>
                  <div>
                    <p className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{e.market}</p>
                    <p className="text-[10px] text-slate-500">
                      {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold text-teal-400">
                      {item.type === "bulk"
                        ? `${fmt((e.pricePerUnit || 0) / factor)}/${du}`
                        : `${fmt(e.pricePerPkgAfterDiscount ?? e.pricePerPkg)}/emb`}
                    </span>
                    {e.discountTotal > 0 && (
                      <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded-md ${isDark ? "bg-amber-500/15 text-amber-400" : "bg-amber-50 text-amber-600"}`}>desc</span>
                    )}
                    {onNavigatePurchase && <Icon name="chevron" size={12} />}
                  </div>
                </button>
              ))}
            </div>
          )}

          {/* Action row */}
          <div className="flex gap-2 pt-0.5">
            <button onClick={onToggle}
              className={`flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                isDark ? "bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25"
                       : "bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"
              }`}>
              <Icon name="check" size={13} />Marcar comprado
            </button>
            <button onClick={onCompare}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                isDark ? "bg-blue-500/10 text-blue-400 border border-blue-500/20 hover:bg-blue-500/20"
                       : "bg-blue-50 text-blue-600 border border-blue-100 hover:bg-blue-100"
              }`}>
              <Icon name="scale" size={13} />
            </button>
            <button onClick={onRemove}
              className={`flex items-center justify-center gap-1.5 px-3 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${
                isDark ? "bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20"
                       : "bg-red-50 text-red-500 border border-red-100 hover:bg-red-100"
              }`}>
              <Icon name="trash" size={13} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
});

// ─── QuickAddItem ─────────────────────────────────────────────────────────────
const QuickAddItem = memo(function QuickAddItem({
  item, stats, isDark, onAdd,
}: { item: Item; stats: ReturnType<typeof calcStats>; isDark: boolean; onAdd: () => void; }) {
  const du = getDisplayUnit(item);
  const factor = getDisplayFactor(item);
  const avgPrice = stats ? (item.type === "bulk" ? stats.avgPrice / factor : stats.avgPrice) : null;
  return (
    <button onClick={onAdd}
      className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all active:scale-[0.98] text-left ${
        isDark ? "bg-slate-900/60 border-slate-800 hover:border-teal-500/40 hover:bg-teal-500/5"
               : "bg-white/80 border-slate-200 hover:border-teal-400 hover:bg-teal-50/50"
      }`}>
      <div className="flex-1 min-w-0">
        <p className={`text-sm font-medium truncate ${isDark ? "text-slate-200" : "text-slate-700"}`}>{item.name}</p>
        {avgPrice !== null
          ? <p className="text-[10px] text-green-400 mt-0.5">Médio {fmt(avgPrice)}/{item.type === "bulk" ? du : "emb"}</p>
          : <p className={`text-[10px] mt-0.5 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Sem histórico</p>
        }
      </div>
      <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? "bg-teal-500/15 text-teal-400" : "bg-teal-100 text-teal-600"}`}>
        <Icon name="plus" size={14} />
      </div>
    </button>
  );
});

// ─── Main Section ─────────────────────────────────────────────────────────────
export function ShoppingListSection({
  onConvertToPurchase, onGoToItems, onGoToHistoryPurchase, onGoToHistoryPurchaseWithProduct,
}: ShoppingListSectionProps) {
  const { isDark } = useTheme();
  const { items, markets, purchases, warehouse, list: shoppingList, setList: setShoppingList } = useAppContext();

  // ── State ──────────────────────────────────────────────────────────────────
  // Default to "market" tab
  const [listMode, setListMode] = useState<"plan" | "market">("market");

  // plan
  const [planSearch, setPlanSearch] = useState("");
  const [filterCatPlan, setFilterCatPlan] = useState("");
  const [inListSearch, setInListSearch] = useState("");
  const [filterCatInList, setFilterCatInList] = useState("");
  const [inListSort, setInListSort] = useState<"category" | "alpha" | "added">("category");

  // market
  const [marketSearch, setMarketSearch] = useState("");
  const [filterCatMarket, setFilterCatMarket] = useState("");
  const [marketSort, setMarketSort] = useState<"category" | "alpha">("category");
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [showQuickAdd, setShowQuickAdd] = useState(false);
  const [quickSearch, setQuickSearch] = useState("");
  const quickSearchRef = useRef<HTMLInputElement>(null);

  // price compare (shared between plan + market)
  const [compareItem, setCompareItem] = useState<Item | null>(null);
  const [compareOptions, setCompareOptions] = useState<{ sizeNum: number; priceNum: number; unit: string }[]>([]);
  const [newOption, setNewOption] = useState({ size: "", price: "" });
  const cmpSizeRef = useRef<HTMLInputElement>(null);
  const cmpPriceRef = useRef<HTMLInputElement>(null);

  // modals
  const [saveModal, setSaveModal] = useState(false);
  const [saveName, setSaveName] = useState("");
  const [dupModal, setDupModal] = useState<{ name: string; existingId: string } | null>(null);
  const [savedListsModal, setSavedListsModal] = useState(false);
  const [convertModal, setConvertModal] = useState(false);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [shareModal, setShareModal] = useState(false);

  // ── Derived ────────────────────────────────────────────────────────────────
  const activeList = useMemo(() => shoppingList.filter((l): l is ShoppingListItem => !l.saved), [shoppingList]);
  const savedLists  = useMemo(() => shoppingList.filter((l): l is SavedShoppingList => l.saved), [shoppingList]);
  const inListSet   = useMemo(() => new Set(activeList.map((l) => l.itemId)), [activeList]);

  const statsCache = useMemo(() => {
    const cache: Record<string, ReturnType<typeof calcStats>> = {};
    items.forEach((item) => {
      cache[item.id] = calcStats(item.id, items, purchases, warehouse.find((w) => w.itemId === item.id)?.entries ?? []);
    });
    return cache;
  }, [items, purchases, warehouse]);

  const recentEntriesCache = useMemo(() => {
    const cache: Record<string, any[]> = {};
    items.forEach((item) => {
      const all: any[] = [];
      purchases.forEach((p) => {
        p.lines.forEach((l) => {
          if (l.itemId !== item.id) return;
          const mkt = markets.find((m) => m.id === p.marketId)?.name || "?";
          all.push({ ...l, date: p.date, market: mkt, purchaseId: p.id });
        });
      });
      cache[item.id] = all.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 4);
    });
    return cache;
  }, [items, purchases, markets]);

  const priceEvolutionCache = useMemo(() => {
    const cache: Record<string, LineChartPoint[]> = {};
    items.forEach((item) => {
      const factor = getDisplayFactor(item);
      const du = getDisplayUnit(item);
      const entries = (recentEntriesCache[item.id] || []).slice().sort((a: any, b: any) => a.date.localeCompare(b.date));
      cache[item.id] = entries.map((e: any) => ({
        label: new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
        value: item.type === "bulk" ? (e.pricePerUnit || 0) / factor : e.pricePerPkgAfterDiscount ?? e.pricePerPkg,
        date: e.date, market: e.market,
        qty: item.type === "bulk" ? `${fmtN((e.totalQty || 0) * factor, 2)} ${du}` : `${e.numPkgs} emb`,
        discount: e.discountTotal > 0 ? `Desc: ${fmt(e.discountTotal)}` : undefined,
      }));
    });
    return cache;
  }, [items, recentEntriesCache]);

  const listFull = useMemo(() =>
    activeList.map((l) => ({
      ...l, item: items.find((i) => i.id === l.itemId),
      stats: statsCache[l.itemId] ?? null, qty: (l as any).qty || 1,
    })).filter((l) => l.item),
    [activeList, items, statsCache]
  );

  const availableItems = useMemo(() => items.filter((i) => !inListSet.has(i.id)), [items, inListSet]);

  // Plan: search + filter among items NOT in list
  const planFiltered = useMemo(() => {
    const q = planSearch.toLowerCase();
    return availableItems
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q))
      .filter((i) => !filterCatPlan || (i.category || "Sem categoria") === filterCatPlan);
  }, [availableItems, planSearch, filterCatPlan]);

  const planCategories = useMemo(
    () => [...new Set(availableItems.map((i) => i.category || "Sem categoria"))].sort(),
    [availableItems]
  );

  // Plan grouped
  const groupedPlan = useMemo(() => {
    const g: Record<string, Item[]> = {};
    planFiltered.forEach((item) => {
      const cat = item.category || "Sem categoria";
      if (!g[cat]) g[cat] = [];
      g[cat].push(item);
    });
    return g;
  }, [planFiltered]);

  // In-list items grouped by category (for plan "already added" section)
  const inListCategories = useMemo(
    () => [...new Set(listFull.map((l) => l.item?.category || "Sem categoria"))].sort(),
    [listFull]
  );
  const filteredInList = useMemo(() => {
    const q = inListSearch.toLowerCase();
    const filtered = listFull.filter((entry) => {
      const item = entry.item!;
      const matchSearch = !q || item.name.toLowerCase().includes(q) || (item.category || "").toLowerCase().includes(q);
      const matchCat = !filterCatInList || (item.category || "Sem categoria") === filterCatInList;
      return matchSearch && matchCat;
    });

    if (inListSort === "alpha") {
      return [...filtered].sort((a, b) => a.item!.name.localeCompare(b.item!.name));
    }
    if (inListSort === "category") {
      return [...filtered].sort((a, b) => {
        const catCmp = (a.item!.category || "Sem categoria").localeCompare(b.item!.category || "Sem categoria");
        return catCmp !== 0 ? catCmp : a.item!.name.localeCompare(b.item!.name);
      });
    }
    return filtered;
  }, [listFull, inListSearch, filterCatInList, inListSort]);

  const groupedInList = useMemo(() => {
    const g: Record<string, typeof filteredInList> = {};
    filteredInList.forEach((entry) => {
      const cat = inListSort === "category" ? entry.item?.category || "Sem categoria" : "Produtos";
      if (!g[cat]) g[cat] = [];
      g[cat].push(entry);
    });
    return g;
  }, [filteredInList, inListSort]);

  // Market filtered + grouped
  const marketFiltered = useMemo(() => {
    const q = marketSearch.toLowerCase();
    const filtered = listFull.filter((l) => {
      const matchSearch = !q || l.item!.name.toLowerCase().includes(q) || (l.item!.category || "").toLowerCase().includes(q);
      const matchCat = !filterCatMarket || (l.item!.category || "Sem categoria") === filterCatMarket;
      return matchSearch && matchCat;
    });
    return [...filtered].sort((a, b) => {
      if (marketSort === "alpha") return a.item!.name.localeCompare(b.item!.name);
      const catCmp = (a.item!.category || "Sem categoria").localeCompare(b.item!.category || "Sem categoria");
      return catCmp !== 0 ? catCmp : a.item!.name.localeCompare(b.item!.name);
    });
  }, [listFull, marketSearch, filterCatMarket, marketSort]);

  const pendingList = useMemo(() => marketFiltered.filter((l) => !l.done), [marketFiltered]);
  const doneList    = useMemo(() => marketFiltered.filter((l) => l.done), [marketFiltered]);

  const marketCategories = useMemo(
    () => [...new Set(listFull.map((l) => l.item?.category || "Sem categoria"))].sort(),
    [listFull]
  );

  const groupedPending = useMemo(() => {
    const g: Record<string, typeof pendingList> = {};
    pendingList.forEach((l) => {
      const cat = marketSort === "category" ? l.item?.category || "Sem categoria" : "Produtos";
      if (!g[cat]) g[cat] = [];
      g[cat].push(l);
    });
    return g;
  }, [pendingList, marketSort]);

  const quickAddFiltered = useMemo(() => {
    const q = quickSearch.toLowerCase();
    return availableItems
      .filter((i) => !q || i.name.toLowerCase().includes(q) || (i.category || "").toLowerCase().includes(q))
      .slice(0, 15);
  }, [availableItems, quickSearch]);

  const pendingCount = listFull.filter((l) => !l.done).length;
  const doneCount    = listFull.filter((l) => l.done).length;

  // ── CRUD ───────────────────────────────────────────────────────────────────
  const addItem = useCallback((itemId: string) => {
    setShoppingList([...shoppingList, { itemId, done: false, saved: false, qty: 1 }]);
  }, [shoppingList, setShoppingList]);

  const removeItem = useCallback((itemId: string) => {
    setShoppingList(shoppingList.filter((l) => l.saved || (l as ShoppingListItem).itemId !== itemId));
    setExpandedId((id) => (id === itemId ? null : id));
  }, [shoppingList, setShoppingList]);

  const toggleDone = useCallback((itemId: string) => {
    setShoppingList(shoppingList.map((l) =>
      !l.saved && (l as ShoppingListItem).itemId === itemId
        ? { ...l, done: !(l as ShoppingListItem).done } : l
    ) as typeof shoppingList);
    setExpandedId((id) => (id === itemId ? null : id));
  }, [shoppingList, setShoppingList]);

  const updateQty = useCallback((itemId: string, qty: number) => {
    setShoppingList(shoppingList.map((l) =>
      !l.saved && (l as ShoppingListItem).itemId === itemId
        ? { ...l, qty: Math.max(0.001, qty) } : l
    ) as typeof shoppingList);
  }, [shoppingList, setShoppingList]);

  const clearDone = useCallback(() => {
    setShoppingList(shoppingList.filter((l) => l.saved || !(l as ShoppingListItem).done));
  }, [shoppingList, setShoppingList]);

  const clearAll = useCallback(() => {
    setShoppingList(shoppingList.filter((l) => l.saved));
    setClearAllConfirm(false);
  }, [shoppingList, setShoppingList]);

  // ── Save list ──────────────────────────────────────────────────────────────
  function attemptSave() {
    if (!saveName.trim() || activeList.length === 0) return;
    const existing = savedLists.find((l) => l.name.toLowerCase() === saveName.trim().toLowerCase());
    if (existing) { setDupModal({ name: saveName.trim(), existingId: existing.id }); setSaveModal(false); }
    else commitSaveAsNew();
  }

  function commitSaveAsNew() {
    const saved: SavedShoppingList = {
      id: uid(), name: saveName.trim(),
      date: new Date().toISOString().slice(0, 10), items: activeList, saved: true,
    };
    setShoppingList([...shoppingList.filter((l) => l.saved), saved, ...shoppingList.filter((l) => !l.saved)]);
    setSaveModal(false); setDupModal(null); setSaveName("");
  }

  function commitUpdateExisting() {
    if (!dupModal) return;
    const updated: SavedShoppingList = {
      id: dupModal.existingId, name: dupModal.name,
      date: new Date().toISOString().slice(0, 10), items: activeList, saved: true,
    };
    setShoppingList([
      ...shoppingList.filter((l) => l.saved && (l as SavedShoppingList).id !== dupModal.existingId),
      updated, ...shoppingList.filter((l) => !l.saved),
    ]);
    setDupModal(null); setSaveName("");
  }

  function updateSavedListDirect(listId: string) {
    const listName = savedLists.find((l) => l.id === listId)?.name || "";
    const updated: SavedShoppingList = {
      id: listId, name: listName, date: new Date().toISOString().slice(0, 10), items: activeList, saved: true,
    };
    setShoppingList([
      ...shoppingList.filter((l) => l.saved && (l as SavedShoppingList).id !== listId),
      updated, ...shoppingList.filter((l) => !l.saved),
    ]);
  }

  function loadSavedList(list: SavedShoppingList) {
    const newItems = list.items.filter((i) => !inListSet.has(i.itemId));
    setShoppingList([...shoppingList.filter((l) => !l.saved), ...shoppingList.filter((l) => l.saved), ...newItems]);
    setSavedListsModal(false);
  }

  function deleteSavedList(id: string) {
    setShoppingList(shoppingList.filter((l) => !(l.saved && (l as SavedShoppingList).id === id)));
  }

  // ── Convert ────────────────────────────────────────────────────────────────
  function handleConvertToPurchase() {
    const lines: PurchaseLine[] = activeList.map((li) => {
      const item = items.find((i) => i.id === li.itemId);
      if (!item) return null;
      const stats = statsCache[li.itemId];
      if (!stats || !stats.entries.length) return null;
      const last = stats.entries[stats.entries.length - 1];
      const qty = (li as any).qty || 1;
      if (item.type === "bulk") {
        const pricePerUnit = last.pricePerUnit || 0;
        const pkgQty = last.pkgQty || 1;
        const pricePerPkg = pricePerUnit * pkgQty;
        return { itemId: li.itemId, numPkgs: qty, pkgQty, totalQty: qty * pkgQty, pricePerPkg, pricePerPkgAfterDiscount: pricePerPkg, discountTotal: 0, discountPerPkg: 0, pricePerUnit, total: pricePerPkg * qty } as PurchaseLine;
      } else {
        const pricePerPkg = last.pricePerPkg || 0;
        return { itemId: li.itemId, numPkgs: qty, pricePerPkg, pricePerPkgAfterDiscount: pricePerPkg, discountTotal: 0, discountPerPkg: 0, pricePerInternal: last.pricePerInternal || 0, total: pricePerPkg * qty } as PurchaseLine;
      }
    }).filter(Boolean) as PurchaseLine[];
    if (lines.length > 0) { onConvertToPurchase(lines); setConvertModal(false); }
  }

  // ── Auto suggest ───────────────────────────────────────────────────────────
  function autoSuggest() {
    const toAdd = availableItems
      .filter((i) => (statsCache[i.id]?.avgMonthly ?? 0) > 0)
      .sort((a, b) => (statsCache[b.id]?.avgMonthly ?? 0) - (statsCache[a.id]?.avgMonthly ?? 0))
      .slice(0, 8)
      .map((i) => ({ itemId: i.id, done: false, saved: false as const, qty: 1 }));
    setShoppingList([...shoppingList, ...toAdd]);
  }

  // ── Price compare ──────────────────────────────────────────────────────────
  function openCompare(item: Item) {
    setCompareItem(item); setCompareOptions([]); setNewOption({ size: "", price: "" });
  }

  function addCompareOption() {
    if (!newOption.size || !newOption.price || !compareItem) return;
    const size = Number(newOption.size.replace(",", "."));
    const price = Number(newOption.price.replace(",", "."));
    if (size > 0 && price >= 0) {
      setCompareOptions((prev) => [...prev, { sizeNum: size, priceNum: price, unit: getDisplayUnit(compareItem) }]);
      setNewOption({ size: "", price: "" });
      cmpSizeRef.current?.focus();
    }
  }

  const bestOption = useMemo(() => {
    if (!compareOptions.length) return null;
    return compareOptions.map((o) => ({ ...o, ppu: o.priceNum / o.sizeNum })).reduce((a, b) => b.ppu < a.ppu ? b : a);
  }, [compareOptions]);

  // ── Navigate ───────────────────────────────────────────────────────────────
  function handleNavigatePurchase(purchaseId: string, itemId: string) {
    if (onGoToHistoryPurchaseWithProduct) onGoToHistoryPurchaseWithProduct(purchaseId, itemId);
    else if (onGoToHistoryPurchase) onGoToHistoryPurchase(purchaseId);
  }

  // ── Share ──────────────────────────────────────────────────────────────────
  function buildShareText() {
    const lines = ["*Lista de Compras 🛒*", ""];
    const grouped: Record<string, typeof activeList> = {};
    activeList.forEach((li) => {
      const item = items.find((i) => i.id === li.itemId);
      if (!item) return;
      const cat = item.category || "Sem categoria";
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(li);
    });
    Object.entries(grouped).sort(([a], [b]) => a.localeCompare(b)).forEach(([cat, catItems]) => {
      lines.push(`*${cat}*`);
      catItems.forEach((li) => {
        const item = items.find((i) => i.id === li.itemId);
        if (!item) return;
        const qty = (li as any).qty || 1;
        lines.push(`  ☐ ${qty > 1 ? `${qty}x ` : ""}${item.name}`);
      });
      lines.push("");
    });
    lines.push(`_Total: ${activeList.length} item${activeList.length !== 1 ? "s" : ""}_`);
    return lines.join("\n");
  }

  // ══════════════════════════════════════════════════════════════════════════
  // RENDER
  // ══════════════════════════════════════════════════════════════════════════
  return (
    <div className="space-y-4">

      {/* ── Tab Toggle ── */}
      <div className={`flex gap-2 p-1 rounded-xl ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
        <button onClick={() => setListMode("plan")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            listMode === "plan" ? "bg-teal-500 text-white shadow-sm"
              : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"
          }`}>
          Planejar
          {availableItems.length > 0 && (
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
              listMode === "plan" ? "bg-white/20" : isDark ? "bg-slate-800 text-slate-500" : "bg-slate-200 text-slate-400"
            }`}>{availableItems.length}</span>
          )}
        </button>
        <button onClick={() => setListMode("market")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${
            listMode === "market" ? "bg-blue-500 text-white shadow-sm"
              : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"
          }`}>
          Mercado
          {activeList.length > 0 && (
            <span className={`ml-1.5 text-[10px] px-1.5 py-0.5 rounded-full ${
              listMode === "market" ? "bg-white/20" : isDark ? "bg-blue-500/20 text-blue-400" : "bg-blue-100 text-blue-600"
            }`}>{activeList.length}</span>
          )}
        </button>
      </div>

      {/* ════════════════════════════════════════════════════════════════════
          PLANEJAR MODE
      ════════════════════════════════════════════════════════════════════ */}
      {listMode === "plan" && (
        <>
          {/* Toolbar */}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <div className="flex gap-2">
              {availableItems.some((i) => (statsCache[i.id]?.avgMonthly ?? 0) > 0) && (
                <Btn onClick={autoSuggest} variant="outline" size="sm"><Icon name="history" size={13} />Sugerir</Btn>
              )}
              {savedLists.length > 0 && (
                <Btn onClick={() => setSavedListsModal(true)} variant="outline" size="sm">
                  <Icon name="list" size={13} />Listas ({savedLists.length})
                </Btn>
              )}
            </div>
            <div className="flex gap-2">
              {activeList.length > 0 && (
                <>
                  <Btn onClick={() => setClearAllConfirm(true)} variant="danger" size="sm"><Icon name="trash" size={13} /></Btn>
                  <Btn onClick={() => setShareModal(true)} variant="outline" size="sm"><Icon name="share" size={13} /></Btn>
                  <Btn onClick={() => setConvertModal(true)} variant="outline" size="sm"><Icon name="cart" size={13} />Compra</Btn>
                  <Btn onClick={() => { setSaveName(""); setSaveModal(true); }} variant="success" size="sm">
                    <Icon name="check" size={13} />Salvar
                  </Btn>
                </>
              )}
            </div>
          </div>

          {/* ── Search bar — always on top ── */}
          <div className="relative">
            <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-slate-600" : "text-slate-400"}`}>
              <Icon name="search" size={15} />
            </div>
            <input value={planSearch} onChange={(e) => setPlanSearch(e.target.value)}
              placeholder="Buscar produto…"
              className={`w-full pl-9 ${planSearch ? "pr-9" : "pr-3"} py-2.5 rounded-xl border text-sm focus:outline-none focus:border-teal-500 transition-all ${
                isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-600"
                       : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"
              }`} />
            {planSearch && (
              <button onClick={() => setPlanSearch("")}
                className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-600 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}>
                <Icon name="x" size={14} />
              </button>
            )}
          </div>

          {/* Category pills */}
          <CategoryPills categories={planCategories} active={filterCatPlan} onChange={setFilterCatPlan} isDark={isDark} />

          {/* ── Items to add (grouped by category) ── */}
          {items.length === 0 ? (
            <div className="flex flex-col items-center text-center py-8 gap-3 px-4">
              <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                <Icon name="package" size={20} />
              </div>
              <p className={`font-black text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Nenhum produto cadastrado</p>
              {onGoToItems && (
                <button onClick={onGoToItems} className="px-4 py-2 rounded-xl bg-teal-500 text-white text-xs font-black flex items-center gap-1.5">
                  <Icon name="plus" size={13} />Cadastrar produtos
                </button>
              )}
            </div>
          ) : planFiltered.length > 0 ? (
            <div className="space-y-4">
              {Object.entries(groupedPlan).map(([cat, catItems]) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">{cat}</p>
                  <div className="space-y-1.5">
                    {catItems.map((item) => {
                      const s = statsCache[item.id];
                      const factor = getDisplayFactor(item);
                      const du = getDisplayUnit(item);
                      const avg = s ? (item.type === "bulk" ? s.avgPrice / factor : s.avgPrice) : null;
                      return (
                        <button key={item.id} onClick={() => addItem(item.id)}
                          className={`w-full text-left px-3 py-2.5 rounded-xl border flex items-center justify-between gap-3 transition-all active:scale-[0.98] ${
                            isDark ? "bg-slate-900 border-slate-800 hover:border-teal-500/50 hover:bg-teal-500/5"
                                   : "bg-white border-slate-200 hover:border-teal-400 hover:bg-teal-50/50"
                          }`}>
                          <div className="min-w-0">
                            <p className={`text-sm font-medium truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>{item.name}</p>
                            {avg !== null
                              ? <p className="text-[10px] text-green-400 mt-0.5">Médio {fmt(avg)}/{du}</p>
                              : <p className="text-[10px] text-slate-600 mt-0.5">Sem histórico</p>
                            }
                          </div>
                          <div className={`w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 ${isDark ? "bg-teal-500/15 text-teal-400" : "bg-teal-100 text-teal-600"}`}>
                            <Icon name="plus" size={14} />
                          </div>
                        </button>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          ) : availableItems.length === 0 ? (
            <p className={`text-xs text-center py-3 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Todos os produtos já estão na lista</p>
          ) : (
            <p className={`text-xs text-center py-3 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Nenhum resultado para "{planSearch}"</p>
          )}

          {/* ── Already in list (below, grouped by category) ── */}
          {listFull.length > 0 && (
            <div>
              <div className={`flex items-center justify-between mb-2 pt-2 border-t ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">
                  Na lista ({listFull.length})
                </p>
                {doneCount > 0 && (
                  <button onClick={clearDone} className={`text-[10px] font-bold ${isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}>
                    Limpar marcados ({doneCount})
                  </button>
                )}
              </div>

              {/* Category pills for in-list items */}
              <div className="mb-3">
                <div className="relative mb-3">
                  <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                    <Icon name="search" size={14} />
                  </div>
                  <input value={inListSearch} onChange={(e) => setInListSearch(e.target.value)}
                    placeholder="Buscar produto na lista…"
                    className={`w-full pl-8 ${inListSearch ? "pr-9" : "pr-3"} py-2 rounded-xl border text-sm focus:outline-none focus:border-teal-500 transition-all ${
                      isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-600"
                             : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"
                    }`} />
                  {inListSearch && (
                    <button onClick={() => setInListSearch("")}
                      className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-600 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}>
                      <Icon name="x" size={13} />
                    </button>
                  )}
                </div>
                <div className="mb-3">
                  <CategoryPills categories={inListCategories} active={filterCatInList} onChange={setFilterCatInList} isDark={isDark} allLabel="Tudo" />
                </div>
                <div className={`flex gap-1.5 p-1 rounded-xl ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
                  {([
                    { id: "category", label: "Categoria" },
                    { id: "alpha", label: "A-Z" },
                    { id: "added", label: "Adição" },
                  ] as { id: "category" | "alpha" | "added"; label: string }[]).map(opt => (
                    <button key={opt.id} onClick={() => setInListSort(opt.id)}
                      className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                        inListSort === opt.id ? "bg-teal-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"
                      }`}>
                      {opt.label}
                    </button>
                  ))}
                </div>
              </div>

              {filteredInList.length === 0 ? (
                <Empty icon="search" title={`Nenhum resultado para "${inListSearch || filterCatInList}"`} />
              ) : (
              <div className="space-y-4">
                {Object.entries(groupedInList).map(([cat, catEntries]) => (
                  <div key={cat}>
                    <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">{cat}</p>
                    <div className="space-y-1.5">
                      {catEntries.map(({ itemId, item, stats, qty, done }) => {
                        const it = item!;
                        const du = getDisplayUnit(it);
                        const factor = getDisplayFactor(it);
                        const avgPrice = stats
                          ? it.type === "bulk" ? stats.avgPrice / factor : stats.avgPrice
                          : null;
                        return (
                          <div key={itemId} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all ${
                            done
                              ? isDark ? "opacity-40 bg-slate-900/40 border-slate-800" : "opacity-40 bg-slate-50 border-slate-200"
                              : isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"
                          }`}>
                            <button onClick={() => toggleDone(itemId)}
                              className={`w-5 h-5 rounded-full border-2 flex-shrink-0 flex items-center justify-center transition-all ${
                                done ? "bg-teal-500 border-teal-500" : isDark ? "border-slate-600 hover:border-teal-500" : "border-slate-300 hover:border-teal-500"
                              }`}>
                              {done && <Icon name="check" size={10} />}
                            </button>
                            <div className="flex-1 min-w-0">
                              <p className={`text-sm font-semibold truncate ${done ? "line-through text-slate-500" : isDark ? "text-slate-100" : "text-slate-900"}`}>
                                {it.name}
                              </p>
                              {avgPrice !== null && !done && (
                                <p className="text-[10px] text-green-400">Médio {fmt(avgPrice)}/{it.type === "bulk" ? du : "emb"}</p>
                              )}
                            </div>
                            <div className="flex items-center gap-1 flex-shrink-0">
                              <button onClick={() => updateQty(itemId, qty - 1)}
                                className={`w-6 h-6 rounded-md flex items-center justify-center text-sm font-black ${isDark ? "bg-slate-800 text-slate-500 hover:text-white" : "bg-slate-100 text-slate-400 hover:text-slate-700"}`}>−</button>
                              <span className={`text-xs font-black w-5 text-center ${isDark ? "text-slate-200" : "text-slate-800"}`}>{qty}</span>
                              <button onClick={() => updateQty(itemId, qty + 1)}
                                className={`w-6 h-6 rounded-md flex items-center justify-center text-sm font-black ${isDark ? "bg-slate-800 text-slate-500 hover:text-white" : "bg-slate-100 text-slate-400 hover:text-slate-700"}`}>+</button>
                            </div>
                            <button onClick={() => removeItem(itemId)}
                              className={`p-1 flex-shrink-0 ${isDark ? "text-slate-700 hover:text-red-400" : "text-slate-300 hover:text-red-500"} transition-colors`}>
                              <Icon name="x" size={13} />
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
              )}
            </div>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MERCADO MODE
      ════════════════════════════════════════════════════════════════════ */}
      {listMode === "market" && (
        <>
          {listFull.length === 0 ? (
            <div className="flex flex-col items-center text-center py-12 gap-4 px-4">
              <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
                <Icon name="list" size={24} />
              </div>
              <div className="space-y-1">
                <p className={`font-black text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Lista vazia</p>
                <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Vá para "Planejar" e adicione produtos antes de ir ao mercado.</p>
              </div>
              <Btn onClick={() => setListMode("plan")} size="sm"><Icon name="plus" size={13} />Planejar compras</Btn>
            </div>
          ) : (
            <>
              {/* Stats bar */}
              <div className={`flex items-center justify-between px-4 py-3 rounded-xl border ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                <div>
                  <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modo mercado</p>
                  <p className={`text-sm font-bold mt-0.5 ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                    {pendingCount} pendente{pendingCount !== 1 ? "s" : ""}
                    {doneCount > 0 && <span className="text-slate-500"> · <span className="text-teal-400">{doneCount} comprado{doneCount !== 1 ? "s" : ""}</span></span>}
                  </p>
                </div>
                <div className="flex gap-2">
                  {doneCount > 0 && <Btn onClick={clearDone} variant="ghost" size="sm">Limpar</Btn>}
                  <Btn onClick={() => setConvertModal(true)} variant="outline" size="sm">
                    <Icon name="cart" size={12} />Registrar
                  </Btn>
                </div>
              </div>

              {/* Search */}
              <div className="relative">
                <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                  <Icon name="search" size={15} />
                </div>
                <input value={marketSearch} onChange={(e) => setMarketSearch(e.target.value)}
                  placeholder="Buscar na lista…"
                  className={`w-full pl-9 ${marketSearch ? "pr-9" : "pr-3"} py-2.5 rounded-xl border text-sm focus:outline-none focus:border-teal-500 transition-all ${
                    isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-600"
                           : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"
                  }`} />
                {marketSearch && (
                  <button onClick={() => setMarketSearch("")}
                    className={`absolute right-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-600 hover:text-slate-300" : "text-slate-400 hover:text-slate-600"}`}>
                    <Icon name="x" size={14} />
                  </button>
                )}
              </div>

              {/* Category pills */}
              <CategoryPills categories={marketCategories} active={filterCatMarket} onChange={setFilterCatMarket} isDark={isDark} />

              <div className={`flex gap-1.5 p-1 rounded-xl ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
                {([
                  { id: "category", label: "Por categoria" },
                  { id: "alpha", label: "A-Z" },
                ] as { id: "category" | "alpha"; label: string }[]).map(opt => (
                  <button key={opt.id} onClick={() => setMarketSort(opt.id)}
                    className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${
                      marketSort === opt.id ? "bg-blue-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"
                    }`}>
                    {opt.label}
                  </button>
                ))}
              </div>

              {/* Pending */}
              {pendingList.length === 0 && marketSearch ? (
                <Empty icon="search" title={`Nenhum resultado para "${marketSearch}"`} />
              ) : pendingList.length === 0 && doneList.length > 0 ? (
                <div className={`flex flex-col items-center py-8 gap-2 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                  <Icon name="check" size={32} />
                  <p className="text-sm font-bold">Tudo marcado!</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {Object.entries(groupedPending).map(([cat, catItems]) => (
                    <div key={cat}>
                      <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-2 px-1">{cat}</p>
                      <div className="space-y-2">
                        {catItems.map(({ itemId, item, stats, qty }) => (
                          <MarketItemCard
                            key={itemId} itemId={itemId} item={item!} stats={stats} qty={qty}
                            isDark={isDark} isExpanded={expandedId === itemId}
                            onToggle={() => toggleDone(itemId)}
                            onRemove={() => removeItem(itemId)}
                            onExpand={() => setExpandedId(expandedId === itemId ? null : itemId)}
                            onQtyChange={(n) => updateQty(itemId, n)}
                            recentEntries={recentEntriesCache[itemId] || []}
                            priceEvolution={priceEvolutionCache[itemId] || []}
                            onNavigatePurchase={(onGoToHistoryPurchase || onGoToHistoryPurchaseWithProduct) ? handleNavigatePurchase : undefined}
                            onCompare={() => openCompare(item!)}
                          />
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Done */}
              {doneList.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest">Já comprado ({doneList.length})</p>
                  {doneList.map(({ itemId, item, qty }) => (
                    <div key={itemId} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl border opacity-50 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"}`}>
                      <button onClick={() => toggleDone(itemId)} className="w-6 h-6 rounded-full bg-teal-500 border-2 border-teal-500 flex-shrink-0 flex items-center justify-center">
                        <Icon name="check" size={12} />
                      </button>
                      <p className={`text-sm flex-1 line-through ${isDark ? "text-slate-500" : "text-slate-400"}`}>{item!.name}</p>
                      <span className="text-xs text-slate-600">{qty}x</span>
                      <button onClick={() => removeItem(itemId)} className={`p-1 ${isDark ? "text-slate-700" : "text-slate-400"}`}><Icon name="x" size={13} /></button>
                    </div>
                  ))}
                </div>
              )}

              {/* Quick Add */}
              {availableItems.length > 0 && (
                <div>
                  <button
                    onClick={() => {
                      setShowQuickAdd(!showQuickAdd);
                      setQuickSearch("");
                      if (!showQuickAdd) setTimeout(() => quickSearchRef.current?.focus(), 100);
                    }}
                    className={`w-full flex items-center justify-center gap-2 py-3 rounded-xl border-2 border-dashed text-sm font-bold transition-all ${
                      showQuickAdd
                        ? isDark ? "border-teal-500/50 text-teal-400 bg-teal-500/5" : "border-teal-400 text-teal-600 bg-teal-50"
                        : isDark ? "border-slate-700 text-slate-500 hover:border-slate-600 hover:text-slate-300"
                                 : "border-slate-300 text-slate-400 hover:border-slate-400 hover:text-slate-600"
                    }`}>
                    <Icon name={showQuickAdd ? "x" : "plus"} size={16} />
                    {showQuickAdd ? "Fechar" : `Adicionar item (${availableItems.length} disponíveis)`}
                  </button>

                  {showQuickAdd && (
                    <div className={`mt-3 rounded-2xl border overflow-hidden ${isDark ? "bg-slate-900 border-slate-800" : "bg-white border-slate-200"}`}>
                      <div className={`px-3 pt-3 pb-2 border-b ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                        <div className="relative">
                          <div className={`absolute left-3 top-1/2 -translate-y-1/2 pointer-events-none ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                            <Icon name="search" size={14} />
                          </div>
                          <input ref={quickSearchRef} value={quickSearch}
                            onChange={(e) => setQuickSearch(e.target.value)}
                            placeholder="Buscar produto para adicionar…"
                            className={`w-full pl-8 pr-3 py-2 rounded-xl text-sm focus:outline-none focus:border-teal-500 border transition-all ${
                              isDark ? "bg-slate-800 border-slate-700 text-slate-100 placeholder-slate-600"
                                     : "bg-slate-50 border-slate-200 text-slate-900 placeholder-slate-400"
                            }`} />
                          {quickSearch && (
                            <button onClick={() => setQuickSearch("")}
                              className={`absolute right-2.5 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                              <Icon name="x" size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                      <div className="max-h-64 overflow-y-auto">
                        {quickAddFiltered.length === 0 ? (
                          <div className="py-6 text-center">
                            <p className={`text-xs ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                              {quickSearch ? `Nenhum resultado para "${quickSearch}"` : "Todos os produtos já estão na lista"}
                            </p>
                            {onGoToItems && (
                              <button onClick={onGoToItems} className="mt-2 text-xs text-teal-400 font-bold flex items-center gap-1 mx-auto">
                                <Icon name="plus" size={11} />Cadastrar novo produto
                              </button>
                            )}
                          </div>
                        ) : (
                          <div className="p-2 space-y-1">
                            {quickAddFiltered.map((item) => (
                              <QuickAddItem key={item.id} item={item} stats={statsCache[item.id] ?? null} isDark={isDark}
                                onAdd={() => { addItem(item.id); if (quickAddFiltered.length === 1) setShowQuickAdd(false); }} />
                            ))}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}
            </>
          )}
        </>
      )}

      {/* ════════════════════════════════════════════════════════════════════
          MODALS
      ════════════════════════════════════════════════════════════════════ */}

      {/* Price Compare */}
      {compareItem && (
        <Modal title={`Comparar — ${compareItem.name}`} onClose={() => setCompareItem(null)}>
          <div className="space-y-4">
            <InfoBox color="blue">Compare tamanhos diferentes para o melhor custo-benefício por unidade.</InfoBox>
            {compareOptions.length > 0 && (
              <div className="space-y-2">
                {compareOptions.map((opt, idx) => {
                  const ppu = opt.priceNum / opt.sizeNum;
                  const isBest = bestOption && Math.abs((bestOption as any).ppu - ppu) < 0.001;
                  return (
                    <Card key={idx} className={isBest ? "border-teal-500/50 bg-teal-500/5" : ""}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex-1">
                          <div className="flex items-center gap-2 mb-1">
                            <p className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                              {fmtN(opt.sizeNum, 3).replace(/,?0+$/, "")} {opt.unit}
                            </p>
                            {isBest && <Badge color="teal">Melhor custo</Badge>}
                          </div>
                          <p className="text-xs text-slate-500">{fmt(opt.priceNum)} · <span className="text-teal-400 font-semibold">{fmt(ppu)}/{opt.unit}</span></p>
                        </div>
                        <button onClick={() => setCompareOptions(compareOptions.filter((_, i) => i !== idx))}
                          className={`p-1 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}>
                          <Icon name="trash" size={13} />
                        </button>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
            <div className={`space-y-3 ${isDark ? "bg-slate-900/50" : "bg-slate-50"} rounded-xl p-3`}>
              <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Adicionar opção</p>
              <div className="grid grid-cols-2 gap-2">
                <Inp inputRef={cmpSizeRef} label={`Qtd (${getDisplayUnit(compareItem)})`} type="number" value={newOption.size}
                  onChange={(v) => setNewOption({ ...newOption, size: v })} placeholder="Ex: 500" min="0.001" step="0.001"
                  onEnter={() => cmpPriceRef.current?.focus()} />
                <Inp inputRef={cmpPriceRef} label="Preço (R$)" type="number" value={newOption.price}
                  onChange={(v) => setNewOption({ ...newOption, price: v })} placeholder="1,99" min="0.01" step="0.01"
                  onEnter={addCompareOption} />
              </div>
              <Btn onClick={addCompareOption} className="w-full" size="sm"><Icon name="plus" size={13} />Adicionar opção</Btn>
            </div>
            <Btn onClick={() => setCompareItem(null)} variant="secondary" className="w-full justify-center">Fechar</Btn>
          </div>
        </Modal>
      )}

      {/* Save modal */}
      {saveModal && (
        <Modal title="Salvar Lista" onClose={() => setSaveModal(false)}>
          <div className="space-y-4">
            <Inp label="Nome da lista" value={saveName} onChange={setSaveName} placeholder="Ex: Compras do mês…" required onEnter={attemptSave} />
            {savedLists.length > 0 && (
              <div className={`rounded-xl p-3 ${isDark ? "bg-slate-900/50" : "bg-slate-50"}`}>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest mb-2">Ou atualizar uma lista existente</p>
                <div className="space-y-1.5">
                  {savedLists.map((sl) => (
                    <button key={sl.id} onClick={() => { updateSavedListDirect(sl.id); setSaveModal(false); }}
                      className={`w-full flex items-center justify-between gap-3 px-3 py-2 rounded-lg text-left transition-all ${isDark ? "hover:bg-white/5 text-slate-300" : "hover:bg-white text-slate-700"}`}>
                      <div>
                        <p className="text-sm font-semibold">{sl.name}</p>
                        <p className="text-[10px] text-slate-500">{sl.items.length} itens · {new Date(sl.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                      </div>
                      <span className={`text-[10px] font-bold px-2 py-1 rounded-lg ${isDark ? "bg-blue-500/15 text-blue-400" : "bg-blue-50 text-blue-600"}`}>Atualizar</span>
                    </button>
                  ))}
                </div>
              </div>
            )}
            <div className="flex gap-3">
              <Btn onClick={() => setSaveModal(false)} variant="secondary" className="flex-1">Cancelar</Btn>
              <Btn onClick={attemptSave} disabled={!saveName.trim()} className="flex-1">Salvar como nova</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Duplicate modal */}
      {dupModal && (
        <Modal title="Lista já existe" onClose={() => { setDupModal(null); setSaveModal(true); }}>
          <div className="space-y-4">
            <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/30 rounded-xl p-4">
              <span className="text-amber-400 flex-shrink-0 mt-0.5"><Icon name="warn" size={18} /></span>
              <div>
                <p className="text-amber-300 font-bold text-sm">Já existe "{dupModal.name}"</p>
                <p className="text-amber-400/80 text-xs mt-1">O que você quer fazer?</p>
              </div>
            </div>
            <div className="space-y-2">
              <button onClick={commitUpdateExisting}
                className={`w-full px-4 py-3 rounded-xl text-sm font-bold text-left flex items-center gap-3 transition-all ${isDark ? "bg-blue-500/10 border border-blue-500/30 text-blue-400 hover:bg-blue-500/20" : "bg-blue-50 border border-blue-200 text-blue-700 hover:bg-blue-100"}`}>
                <Icon name="refresh" size={16} />
                <div>
                  <p className="font-bold">Atualizar lista existente</p>
                  <p className="text-xs opacity-70">Substitui os itens da lista "{dupModal.name}"</p>
                </div>
              </button>
              <button onClick={commitSaveAsNew}
                className={`w-full px-4 py-3 rounded-xl text-sm font-bold text-left flex items-center gap-3 transition-all ${isDark ? "bg-teal-500/10 border border-teal-500/30 text-teal-400 hover:bg-teal-500/20" : "bg-teal-50 border border-teal-200 text-teal-700 hover:bg-teal-100"}`}>
                <Icon name="copy" size={16} />
                <div>
                  <p className="font-bold">Salvar como nova lista</p>
                  <p className="text-xs opacity-70">Cria uma cópia com o mesmo nome</p>
                </div>
              </button>
            </div>
            <Btn onClick={() => { setDupModal(null); setSaveModal(true); }} variant="secondary" className="w-full justify-center">Cancelar</Btn>
          </div>
        </Modal>
      )}

      {/* Saved lists modal */}
      {savedListsModal && (
        <Modal title="Listas Salvas" onClose={() => setSavedListsModal(false)}>
          <div className="space-y-3">
            {savedLists.length === 0 ? <Empty icon="list" title="Nenhuma lista salva" /> : savedLists.map((list) => (
              <Card key={list.id}>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <p className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{list.name}</p>
                    <p className="text-xs text-slate-500 mt-0.5">
                      {new Date(list.date + "T12:00:00").toLocaleDateString("pt-BR")} · {list.items.length} item{list.items.length !== 1 ? "s" : ""}
                    </p>
                    <div className="flex flex-wrap gap-1 mt-1.5">
                      {list.items.slice(0, 3).map((li) => { const it = items.find((i) => i.id === li.itemId); return it ? <Badge key={li.itemId}>{it.name}</Badge> : null; })}
                      {list.items.length > 3 && <Badge>+{list.items.length - 3}</Badge>}
                    </div>
                  </div>
                  <div className="flex gap-1 flex-shrink-0">
                    <Btn onClick={() => loadSavedList(list)} size="sm" variant="success"><Icon name="copy" size={12} />Carregar</Btn>
                    <button onClick={() => deleteSavedList(list.id)} className={`p-1.5 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}><Icon name="trash" size={13} /></button>
                  </div>
                </div>
              </Card>
            ))}
            <Btn onClick={() => setSavedListsModal(false)} variant="secondary" className="w-full justify-center">Fechar</Btn>
          </div>
        </Modal>
      )}

      {/* Convert modal */}
      {convertModal && (
        <Modal title="Converter em Compra" onClose={() => setConvertModal(false)}>
          <div className="space-y-4">
            <InfoBox color="teal">Os itens com histórico serão adicionados com o último preço. Ajuste antes de salvar.</InfoBox>
            <div className="space-y-1.5">
              {activeList.map((li) => {
                const item = items.find((i) => i.id === li.itemId);
                if (!item) return null;
                const hasHistory = (statsCache[li.itemId]?.entries?.length ?? 0) > 0;
                return (
                  <div key={li.itemId} className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl`}>
                    <div>
                      <p className={`text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>{item.name}</p>
                      <p className="text-xs text-slate-500">Qtd: {(li as any).qty || 1}</p>
                    </div>
                    {hasHistory ? <Badge color="teal">incluso</Badge> : <Badge color="slate">sem histórico</Badge>}
                  </div>
                );
              })}
            </div>
            <div className="flex gap-3">
              <Btn onClick={() => setConvertModal(false)} variant="secondary" className="flex-1">Cancelar</Btn>
              <Btn onClick={handleConvertToPurchase} className="flex-1"><Icon name="cart" size={15} />Criar Compra</Btn>
            </div>
          </div>
        </Modal>
      )}

      {/* Clear confirm */}
      {clearAllConfirm && (
        <ConfirmModal title="Limpar lista inteira"
          message="Remover todos os itens da lista ativa?"
          confirmLabel="Limpar tudo" onConfirm={clearAll} onCancel={() => setClearAllConfirm(false)} />
      )}

      {/* Share modal */}
      {shareModal && activeList.length > 0 && (
        <Modal title="Compartilhar Lista" onClose={() => setShareModal(false)}>
          <div className="space-y-4">
            <div className={`rounded-xl p-4 font-mono text-xs leading-relaxed ${isDark ? "bg-slate-900 border border-slate-800 text-slate-300" : "bg-slate-50 border border-slate-200 text-slate-700"}`}>
              <p className="font-black mb-2">Lista de Compras 🛒</p>
              {(() => {
                const g: Record<string, typeof activeList> = {};
                activeList.forEach((li) => { const item = items.find((i) => i.id === li.itemId); if (!item) return; const cat = item.category || "Sem categoria"; if (!g[cat]) g[cat] = []; g[cat].push(li); });
                return Object.entries(g).sort(([a], [b]) => a.localeCompare(b)).map(([cat, catItems]) => (
                  <div key={cat} className="mb-2">
                    <p className={`font-bold text-[11px] mb-1 ${isDark ? "text-teal-400" : "text-teal-600"}`}>{cat}</p>
                    {catItems.map((li) => { const item = items.find((i) => i.id === li.itemId); if (!item) return null; const qty = (li as any).qty || 1; return <p key={li.itemId} className="ml-2">☐ {qty > 1 ? `${qty}x ` : ""}{item.name}</p>; })}
                  </div>
                ));
              })()}
            </div>
            <div className="space-y-2">
              <button onClick={() => { window.open(`https://wa.me/?text=${encodeURIComponent(buildShareText())}`, "_blank"); }}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-green-500 text-white font-bold text-sm active:scale-95 press-scale">
                <Icon name="whatsapp" size={20} />Compartilhar no WhatsApp
              </button>
              <button onClick={() => { const text = buildShareText(); if (navigator.share) navigator.share({ title: "Lista de Compras", text }).catch(() => {}); else navigator.clipboard?.writeText(text).catch(() => {}); setShareModal(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold active:scale-95 press-scale ${isDark ? "bg-white/5 text-slate-200 border border-white/10" : "bg-black/5 text-slate-700 border border-black/10"}`}>
                <Icon name="share" size={18} />{"share" in navigator ? "Compartilhar…" : "Copiar texto"}
              </button>
            </div>
            <Btn onClick={() => setShareModal(false)} variant="secondary" className="w-full justify-center">Fechar</Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
