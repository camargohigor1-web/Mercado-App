import { useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAppContext } from "../context/AppContext";
import { Icon } from "./Icon";
import { Empty, StatBox, BarChart, LineChart } from "./ui";
import type { LineChartPoint } from "./ui";
import { CategoryPills } from "./ShoppingListSection";
import { fmt, fmtN, calcStats, calcPurchaseHabitStats, getDisplayFactor, getDisplayUnit } from "../utils";
import { MarketComparison } from "./MarketComparison";

interface ReportsSectionProps {
  initialMonth?: string;
  viewState: ReportsViewState;
  onViewStateChange: Dispatch<SetStateAction<ReportsViewState>>;
  onGoToHistoryItem?: (itemId: string) => void;
}

export interface ReportsViewState {
  mainTab: "gastos" | "mercados";
  dateFrom: string;
  dateTo: string;
  selectedCategory: string;
  expandedPriceItemId: string | null;
  productSearch: string;
}

function habitQuantity(item: { type: "bulk" | "packaged"; pkgUnit?: string }, qty: number, internalQty: number | null, factor: number, unit: string) {
  if (item.type === "packaged" && internalQty !== null) return `${fmtN(internalQty, 0)} ${item.pkgUnit || "un"}`;
  return item.type === "bulk" ? `${fmtN(qty * factor, 2)} ${unit}` : `${fmtN(qty, 1)} emb`;
}

export function ReportsSection({ initialMonth, viewState, onViewStateChange, onGoToHistoryItem }: ReportsSectionProps) {
  const { isDark } = useTheme();
  const { items, markets, purchases } = useAppContext();

  const { mainTab, dateFrom, dateTo, selectedCategory, expandedPriceItemId, productSearch } = viewState;
  const updateViewState = (patch: Partial<ReportsViewState>) => onViewStateChange(prev => ({ ...prev, ...patch }));

  const getMkt  = (id: string) => markets.find(m => m.id === id)?.name || "Mercado";
  const getItem = (id: string) => items.find(i => i.id === id);
  const renderMainTabSwitcher = (activeTab: "gastos" | "mercados") => (
    <div className={`flex gap-2 ${isDark ? "bg-slate-900" : "bg-slate-100"} rounded-xl p-1`}>
      <button onClick={() => updateViewState({ mainTab: "gastos" })}
        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "gastos" ? "bg-teal-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
        Gastos
      </button>
      <button onClick={() => updateViewState({ mainTab: "mercados" })}
        className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${activeTab === "mercados" ? "bg-teal-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
        Mercados
      </button>
    </div>
  );

  const filtered = useMemo(() => purchases.filter(p => {
    if (dateFrom && p.date < dateFrom) return false;
    if (dateTo   && p.date > dateTo)   return false;
    return true;
  }), [purchases, dateFrom, dateTo]);

  // Categories that appear in filtered purchases
  const categoriesWithData = useMemo(() => {
    const catSet = new Set<string>();
    filtered.forEach(p => p.lines.forEach(l => {
      const it = getItem(l.itemId);
      catSet.add(it?.category || "Outro");
    }));
    return [...catSet].sort();
  }, [filtered, items]);

  if (purchases.length === 0) {
    return <Empty icon="chart" title="Sem dados para relatório" sub="Registre algumas compras para visualizar os relatórios e gráficos do seu histórico." />;
  }

  // ── Mercados sub-tab ───────────────────────────────────────────────────────
  if (mainTab === "mercados") {
    return (
      <div className="space-y-4">
        {renderMainTabSwitcher(mainTab)}
        <MarketComparison initialMonth={initialMonth} />
      </div>
    );
  }

  // ── Gastos tab ─────────────────────────────────────────────────────────────
  const totalSpent     = filtered.reduce((s, p) => s + p.total, 0);
  const uniqueProducts = new Set(filtered.flatMap(p => p.lines.map(l => l.itemId))).size;

  const monthlyMap: Record<string, number> = {};
  filtered.forEach(p => { const k = p.date.slice(0, 7); monthlyMap[k] = (monthlyMap[k] || 0) + p.total; });
  const last12 = Object.keys(monthlyMap).sort().slice(-12);
  const monthlyData = last12.map(key => {
    const [y, m] = key.split("-");
    return { label: new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), value: monthlyMap[key] };
  });
  const avgMonthlySpend = monthlyData.length > 0 ? monthlyData.reduce((s, d) => s + d.value, 0) / monthlyData.length : 0;

  const marketMap: Record<string, number> = {};
  filtered.forEach(p => { const n = getMkt(p.marketId); marketMap[n] = (marketMap[n] || 0) + p.total; });
  const marketData = Object.entries(marketMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const productMap: Record<string, number> = {};
  filtered.forEach(p => p.lines.forEach(l => { productMap[l.itemId] = (productMap[l.itemId] || 0) + l.total; }));
  const productData = Object.entries(productMap).map(([id, value]) => ({ label: getItem(id)?.name || "Desconhecido", value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const freqMap: Record<string, number> = {};
  filtered.forEach(p => p.lines.forEach(l => { freqMap[l.itemId] = (freqMap[l.itemId] || 0) + 1; }));
  const freqData = Object.entries(freqMap).map(([id, value]) => ({ label: getItem(id)?.name || "Desconhecido", value })).sort((a, b) => b.value - a.value).slice(0, 6);

  const mktCountMap: Record<string, number> = {};
  filtered.forEach(p => { const n = getMkt(p.marketId); mktCountMap[n] = (mktCountMap[n] || 0) + 1; });
  const mostVisited = Object.entries(mktCountMap).sort((a, b) => b[1] - a[1])[0];

  const sortedMonths = Object.keys(monthlyMap).sort();
  const lastMonthSpend = sortedMonths.length >= 1 ? monthlyMap[sortedMonths[sortedMonths.length - 1]] : 0;
  const prevMonthSpend = sortedMonths.length >= 2 ? monthlyMap[sortedMonths[sortedMonths.length - 2]] : null;
  const trendPct = prevMonthSpend && prevMonthSpend > 0 ? ((lastMonthSpend - prevMonthSpend) / prevMonthSpend) * 100 : null;

  const catMap: Record<string, number> = {};
  filtered.forEach(p => p.lines.forEach(l => { const it = getItem(l.itemId); const cat = it?.category || "Outro"; catMap[cat] = (catMap[cat] || 0) + l.total; }));
  const catData = Object.entries(catMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);

  // Category detail entries
  const categoryEntries = filtered.flatMap(p =>
    p.lines.map(line => ({ purchase: p, line, item: getItem(line.itemId), market: getMkt(p.marketId) }))
          .filter(e => e.item && e.item.category === selectedCategory)
  );
  const categoryTotalSpent = categoryEntries.reduce((s, e) => s + e.line.total, 0);
  const categoryProductIds = new Set(categoryEntries.map(e => e.line.itemId));
  const categoryPurchaseIds = new Set(categoryEntries.map(e => e.purchase.id));

  const categoryMonthlyMap: Record<string, number> = {};
  const categoryMarketMap: Record<string, number> = {};
  const categoryProductSpendMap: Record<string, number> = {};
  const categoryProductFreqMap: Record<string, number> = {};

  categoryEntries.forEach(({ purchase, line, market }) => {
    const monthKey = purchase.date.slice(0, 7);
    categoryMonthlyMap[monthKey] = (categoryMonthlyMap[monthKey] || 0) + line.total;
    categoryMarketMap[market] = (categoryMarketMap[market] || 0) + line.total;
    categoryProductSpendMap[line.itemId] = (categoryProductSpendMap[line.itemId] || 0) + line.total;
    categoryProductFreqMap[line.itemId] = (categoryProductFreqMap[line.itemId] || 0) + 1;
  });

  const categoryMonthlyData = Object.keys(categoryMonthlyMap).sort().slice(-12).map(key => {
    const [y, m] = key.split("-");
    return { label: new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }), value: categoryMonthlyMap[key] };
  });
  const categoryMarketData = Object.entries(categoryMarketMap).map(([label, value]) => ({ label, value })).sort((a, b) => b.value - a.value).slice(0, 6);
  const categoryProductSpendData = Object.entries(categoryProductSpendMap).map(([id, value]) => ({ label: getItem(id)?.name || "Desconhecido", value })).sort((a, b) => b.value - a.value).slice(0, 8);
  const categoryProductFreqData = Object.entries(categoryProductFreqMap).map(([id, value]) => ({ label: getItem(id)?.name || "Desconhecido", value })).sort((a, b) => b.value - a.value).slice(0, 8);

  const productPriceDetails = Array.from(categoryProductIds).flatMap(id => {
    const item = getItem(id);
    if (!item) return [];
    const stats = calcStats(id, items, filtered, []);
    if (!stats) return [];
    const habit = calcPurchaseHabitStats(id, item, filtered);
    const factor = getDisplayFactor(item);
    const isUnit = item.type === "bulk";
    const du = getDisplayUnit(item);
    const freq = categoryProductFreqMap[id] || 0;
    const spent = categoryProductSpendMap[id] || 0;

    const allEntries: any[] = [];
    filtered.forEach(p => {
      p.lines.forEach(line => {
        if (line.itemId !== id) return;
        allEntries.push({ ...line, date: p.date, market: getMkt(p.marketId), purchaseId: p.id });
      });
    });
    allEntries.sort((a, b) => b.date.localeCompare(a.date));

    const priceEvolution: LineChartPoint[] = [...allEntries].reverse().map(e => ({
      label: new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
      value: isUnit ? (e.pricePerUnit || 0) / factor : e.pricePerPkgAfterDiscount ?? e.pricePerPkg,
      date: e.date,
      market: e.market,
      qty: isUnit ? `${fmtN((e.totalQty || 0) * factor, 2)} ${du}` : `${e.numPkgs} emb`,
      discount: e.discountTotal > 0 ? `Desc: ${fmt(e.discountTotal)}` : undefined,
    }));

    return [{
      id, item, factor, du, isUnit, freq, spent, habit,
      avg: isUnit ? stats.avgPrice / factor : stats.avgPrice,
      min: isUnit ? stats.minPrice / factor : stats.minPrice,
      last: isUnit ? stats.lastPrice / factor : stats.lastPrice,
      avgMonthly: isUnit ? stats.avgMonthly * factor : stats.avgMonthly,
      unit: isUnit ? `/${du}` : "/emb",
      recentEntries: allEntries.slice(0, 4),
      priceEvolution,
    }];
  }).sort((a, b) => b.spent - a.spent);
  const productSearchQuery = productSearch.trim().toLowerCase();
  const filteredProductPriceDetails = productSearchQuery
    ? productPriceDetails.filter(pd =>
        pd.item.name.toLowerCase().includes(productSearchQuery) ||
        (pd.item.category || "").toLowerCase().includes(productSearchQuery)
      )
    : productPriceDetails;

  const recentCategoryEntries = [...categoryEntries].sort((a, b) => b.purchase.date.localeCompare(a.purchase.date)).slice(0, 10);
  const categoryAvgPerProduct = categoryProductIds.size > 0 ? categoryTotalSpent / categoryProductIds.size : 0;
  const hasFilter = dateFrom || dateTo;
  const categoryMode = Boolean(selectedCategory);

  const card = `rounded-2xl border ${isDark ? "bg-slate-900/80 border-white/5" : "bg-white border-black/6"} p-4`;
  const lbl  = `text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? "text-slate-500" : "text-slate-400"}`;
  const sub  = `text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`;

  return (
    <div className="space-y-5">

      {/* Main tab switcher */}
      {renderMainTabSwitcher(mainTab)}

      {/* Filters */}
      <div className={card}>
        <p className={lbl}>Filtros</p>

        {/* Quick period presets */}
        <div className="flex flex-col gap-1 mb-3">
          <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}>Período rápido</label>
          <div className={`flex gap-1.5 p-1 rounded-xl ${isDark ? "bg-slate-900/80" : "bg-slate-100"}`}>
            {([
              { label: "7d", days: 7 }, { label: "1m", days: 30 }, { label: "3m", days: 90 },
              { label: "6m", days: 180 }, { label: "1a", days: 365 }, { label: "Tudo", days: 0 },
            ] as { label: string; days: number }[]).map(preset => {
              const isActive = (() => {
                if (preset.days === 0) return !dateFrom && !dateTo;
                const from = new Date(); from.setDate(from.getDate() - preset.days + 1);
                return dateFrom === from.toISOString().slice(0, 10) && dateTo === new Date().toISOString().slice(0, 10);
              })();
              return (
                <button key={preset.label} onClick={() => {
                  if (preset.days === 0) { updateViewState({ dateFrom: "", dateTo: "" }); return; }
                  const from = new Date(); from.setDate(from.getDate() - preset.days + 1);
                  updateViewState({ dateFrom: from.toISOString().slice(0, 10), dateTo: new Date().toISOString().slice(0, 10) });
                }}
                  className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${isActive ? "bg-teal-500 text-white shadow-sm" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* Category filter — pills */}
        <div className="flex flex-col gap-1 mb-3">
          <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}>Categoria</label>
          <CategoryPills
            categories={categoriesWithData}
            active={selectedCategory}
            onChange={(cat) => updateViewState({ selectedCategory: cat, expandedPriceItemId: null, productSearch: "" })}
            isDark={isDark}
            allLabel="Todas"
          />
        </div>

        {categoryMode && (
          <div className="flex flex-col gap-1 mb-3">
            <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}>Produto</label>
            <div className="relative">
              <input
                value={productSearch}
                onChange={e => updateViewState({ productSearch: e.target.value })}
                placeholder="Buscar produto..."
                className={`w-full ${isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-700" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"} border rounded-xl pl-9 pr-9 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-all`}
              />
              <span className={`absolute left-3 top-1/2 -translate-y-1/2 ${isDark ? "text-slate-700" : "text-slate-400"}`}>
                <Icon name="search" size={13} />
              </span>
              {productSearch && (
                <button onClick={() => updateViewState({ productSearch: "" })}
                  className={`absolute right-2 top-1/2 -translate-y-1/2 p-1 rounded-lg ${isDark ? "text-slate-600 hover:text-slate-300 hover:bg-white/5" : "text-slate-400 hover:text-slate-700 hover:bg-black/5"}`}>
                  <Icon name="x" size={12} />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Custom date range */}
        <div className="flex flex-col gap-1 mb-1">
          <label className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`}>Período personalizado</label>
          <div className="grid grid-cols-2 gap-3">
            <input type="date" value={dateFrom} onChange={e => updateViewState({ dateFrom: e.target.value })}
              className={`${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500`} />
            <input type="date" value={dateTo} onChange={e => updateViewState({ dateTo: e.target.value })}
              className={`${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500`} />
          </div>
        </div>

        {(hasFilter || categoryMode) && (
          <div className="flex items-center justify-between mt-2">
            <p className={`text-[10px] ${isDark ? "text-slate-600" : "text-slate-400"}`}>
              {categoryMode
                ? `${categoryEntries.length} movimentação${categoryEntries.length !== 1 ? "ões" : ""} em ${selectedCategory}`
                : `${filtered.length} compra${filtered.length !== 1 ? "s" : ""} no período`}
            </p>
            {hasFilter && (
              <button onClick={() => updateViewState({ dateFrom: "", dateTo: "" })}
                className={`text-[10px] font-bold flex items-center gap-1 ${isDark ? "text-teal-400 hover:text-teal-300" : "text-teal-600 hover:text-teal-700"}`}>
                <Icon name="x" size={10} />Limpar datas
              </button>
            )}
          </div>
        )}
      </div>

      {filtered.length === 0 ? (
        <Empty icon="chart" title="Nenhuma compra no período" sub="Ajuste o filtro de datas para ver dados." />
      ) : categoryMode ? (
        categoryEntries.length === 0 ? (
          <Empty icon="chart" title="Sem dados nesta categoria" sub="Ajuste a categoria ou o período." />
        ) : (
          <div className="space-y-5 animate-fade-slide-up">
            <div>
              <p className={lbl}>Visão — {selectedCategory}</p>
              <div className="grid grid-cols-2 gap-2">
                <StatBox label="Total na categoria" val={fmt(categoryTotalSpent)} color="teal" />
                <StatBox label="Produtos distintos" val={String(categoryProductIds.size)} color="blue" />
                <StatBox label="Compras com itens" val={String(categoryPurchaseIds.size)} />
                <StatBox label="Média/produto" val={fmt(categoryAvgPerProduct)} color="green" />
              </div>
            </div>

            {categoryMonthlyData.length > 0 && (
              <div className={card}><p className={lbl}>Evolução mensal</p><BarChart data={categoryMonthlyData} colorClass="bg-teal-500" formatValue={fmt} /></div>
            )}

            {productPriceDetails.length > 0 && (
              <div>
                <p className={lbl}>Análise de preços por produto</p>
                {filteredProductPriceDetails.length === 0 ? (
                  <div className={`rounded-2xl border px-4 py-6 text-center ${isDark ? "bg-slate-900/80 border-white/5" : "bg-white border-black/6"}`}>
                    <p className={`text-xs font-bold ${isDark ? "text-slate-500" : "text-slate-400"}`}>Nenhum produto encontrado</p>
                  </div>
                ) : (
                <div className="space-y-3">
                  {filteredProductPriceDetails.map(pd => {
                    const { id, item, factor, du, isUnit, freq, spent, avg, min, last, avgMonthly, unit, recentEntries, priceEvolution, habit } = pd;
                    const isAboveAvg = last > avg;
                    const savings = avg > 0 ? ((avg - min) / avg) * 100 : 0;
                    const isExpanded = expandedPriceItemId === id;
                    return (
                      <div key={id}
                        className={`rounded-2xl border transition-all overflow-hidden ${isExpanded ? isDark ? "bg-slate-900 border-teal-500/40 shadow-lg shadow-teal-500/5" : "bg-white border-teal-400/50 shadow-lg shadow-teal-500/5" : isDark ? "bg-slate-900/80 border-white/5 hover:border-teal-500/30" : "bg-white border-black/6 hover:border-teal-300"}`}>
                        <button type="button" onClick={() => onViewStateChange(current => ({ ...current, expandedPriceItemId: current.expandedPriceItemId === id ? null : id }))}
                          className="w-full text-left p-4 transition-all active:scale-[0.99]">
                        <div className="flex items-start justify-between gap-2 mb-3">
                          <div>
                            <p className={`text-sm font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>{item.name}</p>
                            <p className={sub}>{freq}x comprado · {fmt(spent)} total</p>
                          </div>
                          <span className={`text-[9px] font-bold flex items-center gap-0.5 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                            Detalhes <Icon name="chevron" size={9} />
                          </span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className={`rounded-xl p-2.5 ${isDark ? "bg-teal-500/10" : "bg-teal-50"}`}>
                            <p className={`text-[9px] font-black uppercase tracking-wide ${isDark ? "text-teal-600" : "text-teal-500"} mb-1`}>Menor</p>
                            <p className={`text-sm font-black ${isDark ? "text-teal-300" : "text-teal-700"}`}>{fmt(min)}</p>
                            <p className={`text-[9px] ${isDark ? "text-teal-600" : "text-teal-500"}`}>{unit}</p>
                          </div>
                          <div className={`rounded-xl p-2.5 ${isDark ? "bg-green-500/10" : "bg-green-50"}`}>
                            <p className={`text-[9px] font-black uppercase tracking-wide ${isDark ? "text-green-600" : "text-green-500"} mb-1`}>Médio</p>
                            <p className={`text-sm font-black ${isDark ? "text-green-300" : "text-green-700"}`}>{fmt(avg)}</p>
                            <p className={`text-[9px] ${isDark ? "text-green-600" : "text-green-500"}`}>{unit}</p>
                          </div>
                          <div className={`rounded-xl p-2.5 ${isAboveAvg ? isDark ? "bg-red-500/10" : "bg-red-50" : isDark ? "bg-blue-500/10" : "bg-blue-50"}`}>
                            <p className={`text-[9px] font-black uppercase tracking-wide mb-1 ${isAboveAvg ? isDark ? "text-red-500" : "text-red-400" : isDark ? "text-blue-500" : "text-blue-400"}`}>Último</p>
                            <p className={`text-sm font-black ${isAboveAvg ? isDark ? "text-red-300" : "text-red-600" : isDark ? "text-blue-300" : "text-blue-700"}`}>{fmt(last)}</p>
                            <p className={`text-[9px] ${isAboveAvg ? isDark ? "text-red-500" : "text-red-400" : isDark ? "text-blue-500" : "text-blue-400"}`}>
                              {isAboveAvg ? `▲ +${fmt(last - avg)}` : `▼ ${fmt(last - avg)}`}
                            </p>
                          </div>
                        </div>
                        {savings > 2 && (
                          <div className={`mt-2.5 flex items-center gap-2 px-3 py-2 rounded-xl ${isDark ? "bg-amber-500/8 border border-amber-500/15" : "bg-amber-50 border border-amber-100"}`}>
                            <Icon name="tag" size={11} />
                            <p className={`text-[10px] font-bold ${isDark ? "text-amber-400" : "text-amber-700"}`}>
                              Potencial de economia de {savings.toFixed(0)}% comprando no mínimo histórico
                            </p>
                          </div>
                        )}
                        </button>

                        {isExpanded && (
                          <div className={`border-t px-4 pb-4 pt-3 space-y-3 animate-fade-slide-up ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                            <div>
                              <p className={`text-[10px] font-black uppercase tracking-widest mb-1.5 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Seus hábitos no período</p>
                              <div className="grid grid-cols-3 gap-2">
                                <div className={`rounded-xl p-2.5 ${isDark ? "bg-teal-500/10 text-teal-400" : "bg-teal-50 text-teal-700"}`}>
                                  <p className="text-[9px] font-black uppercase tracking-wide opacity-70 mb-1">Média/mês</p>
                                  <p className="text-xs font-black">{habit ? habitQuantity(item, habit.avgMonthlyQty, habit.avgMonthlyInternalQty, factor, du) : isUnit ? `${fmtN(avgMonthly, 2)} ${du}` : `${fmtN(avgMonthly, 1)} emb`}</p>
                                </div>
                                <div className={`rounded-xl p-2.5 ${isDark ? "bg-green-500/10 text-green-400" : "bg-green-50 text-green-700"}`}>
                                  <p className="text-[9px] font-black uppercase tracking-wide opacity-70 mb-1">Por compra</p>
                                  <p className="text-xs font-black">{habit ? habitQuantity(item, habit.avgQtyPerPurchase, habit.avgInternalQtyPerPurchase, factor, du) : "—"}</p>
                                </div>
                                <div className={`rounded-xl p-2.5 ${isDark ? "bg-blue-500/10 text-blue-400" : "bg-blue-50 text-blue-700"}`}>
                                  <p className="text-[9px] font-black uppercase tracking-wide opacity-70 mb-1">Frequência</p>
                                  <p className="text-xs font-black">{habit ? `${fmtN(habit.purchasesPerMonth, 1)}x/mês` : "—"}</p>
                                </div>
                              </div>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              <div className={`rounded-xl p-3 ${isDark ? "bg-slate-950 border border-slate-800" : "bg-slate-50 border border-slate-200"}`}>
                                <p className={`text-[9px] font-black uppercase tracking-wide mb-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Média comprada/mês</p>
                                <p className={`text-sm font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>
                                  {isUnit ? `${fmtN(avgMonthly, 2)} ${du}` : `${fmtN(avgMonthly, 1)} emb`}
                                </p>
                              </div>
                              <div className={`rounded-xl p-3 ${isDark ? "bg-slate-950 border border-slate-800" : "bg-slate-50 border border-slate-200"}`}>
                                <p className={`text-[9px] font-black uppercase tracking-wide mb-1 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Compras</p>
                                <p className={`text-sm font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>{priceEvolution.length} registros</p>
                              </div>
                            </div>

                            {priceEvolution.length >= 2 && (
                              <div className={`rounded-xl p-3 ${isDark ? "bg-slate-950 border border-slate-800" : "bg-slate-50 border border-slate-200"}`}>
                                <LineChart data={priceEvolution} formatValue={fmt} unit={isUnit ? `R$/${du}` : "R$/emb"} />
                              </div>
                            )}

                            {recentEntries.length > 0 && (
                              <div className="space-y-1.5">
                                <p className={`text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-600" : "text-slate-400"}`}>
                                  Ultimas compras
                                </p>
                                {recentEntries.map((e: any, i: number) => (
                                  <div key={`${e.purchaseId}-${i}`}
                                    className={`flex items-center justify-between gap-3 px-3 py-2 rounded-xl border ${isDark ? "bg-slate-950 border-slate-800" : "bg-white border-slate-200"}`}>
                                    <div className="min-w-0">
                                      <p className={`text-xs font-semibold truncate ${isDark ? "text-slate-200" : "text-slate-800"}`}>{e.market}</p>
                                      <p className="text-[10px] text-slate-500">
                                        {new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}
                                      </p>
                                    </div>
                                    <div className="text-right flex-shrink-0">
                                      <p className="text-xs font-bold text-teal-400">
                                        {isUnit
                                          ? `${fmt((e.pricePerUnit || 0) / factor)}/${du}`
                                          : `${fmt(e.pricePerPkgAfterDiscount ?? e.pricePerPkg)}/emb`}
                                      </p>
                                      {e.discountTotal > 0 && <p className="text-[9px] text-amber-400 font-bold">desc</p>}
                                    </div>
                                  </div>
                                ))}
                              </div>
                            )}

                            {onGoToHistoryItem && (
                              <button onClick={() => onGoToHistoryItem(id)}
                                className={`w-full flex items-center justify-center gap-1.5 py-2.5 rounded-xl text-xs font-bold transition-all active:scale-95 ${isDark ? "bg-teal-500/15 text-teal-400 border border-teal-500/30 hover:bg-teal-500/25" : "bg-teal-50 text-teal-700 border border-teal-200 hover:bg-teal-100"}`}>
                                <Icon name="history" size={13} />Abrir historico completo
                              </button>
                            )}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
                )}
              </div>
            )}

            {categoryProductSpendData.length > 0 && (
              <div className={card}><p className={lbl}>Gasto por produto</p><BarChart data={categoryProductSpendData} colorClass="bg-blue-500" formatValue={fmt} /></div>
            )}
            {categoryProductFreqData.length > 0 && (
              <div className={card}><p className={lbl}>Frequência por produto</p><BarChart data={categoryProductFreqData} colorClass="bg-teal-400" formatValue={(v: number) => `${v}x`} /></div>
            )}
            {categoryMarketData.length > 1 && (
              <div className={card}><p className={lbl}>Gasto por mercado (nesta categoria)</p><BarChart data={categoryMarketData} colorClass="bg-blue-400" formatValue={fmt} /></div>
            )}

            <div className={card}>
              <p className={lbl}>Movimentações recentes</p>
              <div className="space-y-0">
                {recentCategoryEntries.map(({ purchase, line, item, market }, index) => (
                  <div key={`${purchase.id}-${line.itemId}-${index}`}
                    className={`flex items-center justify-between gap-3 py-3 ${index > 0 ? isDark ? "border-t border-white/4" : "border-t border-black/4" : ""}`}>
                    <div className="min-w-0">
                      <p className={`text-sm font-semibold truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>{item?.name || "Produto"}</p>
                      <p className={`text-xs truncate ${sub}`}>{market} · {new Date(purchase.date + "T12:00:00").toLocaleDateString("pt-BR")}</p>
                    </div>
                    <div className="text-right flex-shrink-0">
                      <p className="text-teal-400 text-sm font-black">{fmt(line.total)}</p>
                      <p className={`text-[10px] ${sub}`}>{line.numPkgs} {line.numPkgs === 1 ? "emb" : "embs"}</p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )
      ) : (
        <>
          <div>
            <p className={lbl}>Visão geral</p>
            <div className="grid grid-cols-2 gap-2">
              <StatBox label={hasFilter ? "Total no período" : "Total gasto"} val={fmt(totalSpent)} color="teal" />
              <StatBox label="Média mensal" val={fmt(avgMonthlySpend)} color="blue" />
              <StatBox label="Nº de compras" val={String(filtered.length)} />
              <StatBox label="Produtos distintos" val={String(uniqueProducts)} />
            </div>
            {mostVisited && (
              <div className={`mt-2 ${isDark ? "bg-slate-900 border-white/5" : "bg-white border-black/6"} border rounded-xl px-4 py-3 flex items-center gap-3`}>
                <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center flex-shrink-0"><Icon name="store" size={14} /></div>
                <div className="flex-1">
                  <p className={sub}>Mercado mais visitado</p>
                  <p className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{mostVisited[0]} <span className={`font-normal text-xs ${sub}`}>({mostVisited[1]} visita{mostVisited[1] > 1 ? "s" : ""})</span></p>
                </div>
                {trendPct !== null && !hasFilter && (
                  <div className="text-right flex-shrink-0">
                    <p className={`text-[10px] ${sub}`}>vs. mês ant.</p>
                    <p className={`text-sm font-black ${trendPct > 0 ? "text-red-400" : "text-teal-400"}`}>{trendPct > 0 ? "+" : ""}{trendPct.toFixed(1)}%</p>
                  </div>
                )}
              </div>
            )}
          </div>
          {monthlyData.length > 0 && <div className={card}><p className={lbl}>Gastos mensais</p><BarChart data={monthlyData} colorClass="bg-teal-500" formatValue={fmt} /></div>}
          {catData.length > 0 && <div className={card}><p className={lbl}>Gastos por categoria</p><BarChart data={catData} colorClass="bg-blue-500" formatValue={fmt} /></div>}
          {marketData.length > 1 && <div className={card}><p className={lbl}>Total por mercado</p><BarChart data={marketData} colorClass="bg-amber-500" formatValue={fmt} /></div>}
          {productData.length > 0 && <div className={card}><p className={lbl}>Produtos com maior gasto</p><BarChart data={productData} colorClass="bg-teal-400" formatValue={fmt} /></div>}
          {freqData.length > 0 && <div className={card}><p className={lbl}>Produtos mais comprados (frequência)</p><BarChart data={freqData} colorClass="bg-blue-400" formatValue={(v: number) => `${v}x`} /></div>}
        </>
      )}
    </div>
  );
}
