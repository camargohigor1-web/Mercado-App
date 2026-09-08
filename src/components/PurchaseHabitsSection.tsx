import { useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAppContext } from "../context/AppContext";
import { useBrowserBackClose } from "../hooks/useBrowserBackClose";
import { Icon } from "./Icon";
import { Badge, BarChart, Card, Empty, InfoBox, StatBox } from "./ui";
import { CategoryPills } from "./ShoppingListSection";
import { calcPurchaseHabitStats, fmt, fmtN, getDisplayFactor, getDisplayUnit } from "../utils";
import type { Item, Purchase } from "../types";

type SortBy = "spent" | "frequency" | "monthly" | "recent" | "alpha";

function dateLabel(date: string) {
  return new Date(`${date}T12:00:00`).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" });
}

function monthLabel(key: string) {
  const [year, month] = key.split("-").map(Number);
  return new Date(year, month - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
}

function quantityLabel(item: Item, value: number, factor: number, internal = false) {
  if (item.type === "bulk") return `${fmtN(value * factor, 2)} ${getDisplayUnit(item)}`;
  if (internal) return `${fmtN(value, 0)} ${item.pkgUnit || "un"}`;
  return `${fmtN(value, 1)} emb`;
}

export function PurchaseHabitsSection() {
  const { isDark } = useTheme();
  const { items, purchases, categories, markets } = useAppContext();
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [sortBy, setSortBy] = useState<SortBy>("spent");
  const [selectedItem, setSelectedItem] = useState<Item | null>(null);
  const closeDetail = useBrowserBackClose(Boolean(selectedItem), () => setSelectedItem(null));

  const filteredPurchases = useMemo(() => purchases.filter(p =>
    (!dateFrom || p.date >= dateFrom) && (!dateTo || p.date <= dateTo)
  ), [purchases, dateFrom, dateTo]);

  const availableCategories = useMemo(() => categories.filter(cat => filteredPurchases.some(p =>
    p.lines.some(line => items.find(item => item.id === line.itemId)?.category === cat)
  )), [categories, filteredPurchases, items]);

  const habits = useMemo(() => items
    .map(item => ({ item, stats: calcPurchaseHabitStats(item.id, item, purchases, dateFrom || undefined, dateTo || undefined) }))
    .filter((entry): entry is { item: Item; stats: NonNullable<typeof entry.stats> } => entry.stats !== null)
    .filter(({ item }) => item.name.toLowerCase().includes(search.trim().toLowerCase()))
    .filter(({ item }) => !category || item.category === category)
    .sort((a, b) => {
      if (sortBy === "alpha") return a.item.name.localeCompare(b.item.name);
      if (sortBy === "recent") return b.stats.lastPurchaseDate.localeCompare(a.stats.lastPurchaseDate);
      if (sortBy === "frequency") return b.stats.purchaseCount - a.stats.purchaseCount || b.stats.totalSpent - a.stats.totalSpent;
      if (sortBy === "monthly") return b.stats.avgMonthlySpent - a.stats.avgMonthlySpent;
      return b.stats.totalSpent - a.stats.totalSpent;
    }), [items, purchases, dateFrom, dateTo, search, category, sortBy]);

  const totals = useMemo(() => ({
    spent: habits.reduce((sum, entry) => sum + entry.stats.totalSpent, 0),
    purchases: filteredPurchases.length,
    products: habits.length,
  }), [habits, filteredPurchases]);

  const card = `rounded-2xl border ${isDark ? "bg-slate-900/80 border-white/5" : "bg-white border-black/6"} p-4`;
  const label = `text-[10px] font-black uppercase tracking-widest ${isDark ? "text-slate-500" : "text-slate-400"}`;

  const quickPeriods = [
    { id: "month", label: "Este mês" }, { id: "90d", label: "3m" },
    { id: "180d", label: "6m" }, { id: "365d", label: "1a" }, { id: "all", label: "Tudo" },
  ] as const;

  function getQuickRange(id: (typeof quickPeriods)[number]["id"]) {
    const now = new Date();
    const today = now.toISOString().slice(0, 10);
    if (id === "all") return { from: "", to: "" };
    if (id === "month") return { from: `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-01`, to: today };
    const days = Number.parseInt(id, 10);
    const from = new Date(now); from.setDate(now.getDate() - days + 1);
    return { from: from.toISOString().slice(0, 10), to: today };
  }

  function isQuickPeriodActive(id: (typeof quickPeriods)[number]["id"]) {
    const range = getQuickRange(id);
    return dateFrom === range.from && dateTo === range.to;
  }

  if (selectedItem) {
    const stats = calcPurchaseHabitStats(selectedItem.id, selectedItem, purchases, dateFrom || undefined, dateTo || undefined);
    if (!stats) return <Empty icon="chart" title="Sem compras no período" sub="Ajuste o período para visualizar este produto." />;
    const factor = getDisplayFactor(selectedItem);
    const internal = selectedItem.type === "packaged";
    const productPurchases = purchases
      .filter(p => (!dateFrom || p.date >= dateFrom) && (!dateTo || p.date <= dateTo))
      .map(p => ({ purchase: p, lines: p.lines.filter(line => line.itemId === selectedItem.id) }))
      .filter(entry => entry.lines.length > 0)
      .sort((a, b) => b.purchase.date.localeCompare(a.purchase.date));

    return (
      <div className="space-y-4">
        <div className="flex items-center gap-3">
          <button onClick={closeDetail} className={`${isDark ? "text-slate-500 hover:text-slate-200" : "text-slate-400 hover:text-slate-700"} p-1`}><Icon name="back" size={20} /></button>
          <div className="min-w-0 flex-1">
            <h2 className={`text-base font-black truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>{selectedItem.name}</h2>
            <div className="flex gap-1.5 mt-1"><Badge>{selectedItem.category || "Sem categoria"}</Badge><Badge color="teal">{stats.purchaseCount} compras</Badge></div>
          </div>
        </div>

        <InfoBox color="blue">Indicadores calculados apenas pelas compras registradas; nenhuma contagem de estoque é necessária.</InfoBox>

        <div className="grid grid-cols-2 gap-2">
          <StatBox label="Média mensal" val={quantityLabel(selectedItem, stats.avgMonthlyQty, factor)} color="teal" />
          <StatBox label="Média por compra" val={quantityLabel(selectedItem, stats.avgQtyPerPurchase, factor)} color="blue" />
          {internal && <StatBox label={`Média mensal (${selectedItem.pkgUnit || "un"})`} val={quantityLabel(selectedItem, stats.avgMonthlyInternalQty || 0, factor, true)} color="green" />}
          {internal && <StatBox label={`Por compra (${selectedItem.pkgUnit || "un"})`} val={quantityLabel(selectedItem, stats.avgInternalQtyPerPurchase || 0, factor, true)} />}
          <StatBox label="Gasto médio/mês" val={fmt(stats.avgMonthlySpent)} color="green" />
          <StatBox label="Frequência" val={`${fmtN(stats.purchasesPerMonth, 1)}x/mês`} />
        </div>

        <Card>
          <p className={`${label} mb-3`}>Quantidade por mês</p>
          <BarChart data={stats.months.map(month => ({ label: monthLabel(month.key), value: month.qty * factor, sub: `${month.purchases} ida${month.purchases !== 1 ? "s" : ""} · ${fmt(month.spent)}` }))} formatValue={value => quantityLabel(selectedItem, value / factor, factor)} />
        </Card>

        <Card>
          <p className={`${label} mb-2`}>Período analisado</p>
          <p className={`text-sm font-bold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{dateLabel(stats.firstPurchaseDate)} até {dateLabel(stats.lastPurchaseDate)}</p>
          <p className="text-xs text-slate-500 mt-1">{stats.purchaseCount} idas com este produto · {fmt(stats.totalSpent)} gastos no total</p>
        </Card>

        <div>
          <p className={`${label} mb-2`}>Compras no período</p>
          <div className="space-y-2">
            {productPurchases.map(({ purchase, lines }) => {
              const qty = lines.reduce((sum, line) => sum + (selectedItem.type === "bulk" ? (line.totalQty || 0) : line.numPkgs), 0);
              const spent = lines.reduce((sum, line) => sum + line.total, 0);
              const market = markets.find(entry => entry.id === purchase.marketId)?.name || "Mercado";
              return <Card key={purchase.id}><div className="flex justify-between gap-3"><div><p className={`text-sm font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{dateLabel(purchase.date)}</p><p className="text-xs text-slate-500 mt-0.5">{market} · {quantityLabel(selectedItem, qty, factor)}</p></div><p className="text-sm font-black text-teal-400">{fmt(spent)}</p></div></Card>;
            })}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <InfoBox color="blue">Veja seu padrão real de compra. As médias usam as compras no período, incluindo os meses sem compra entre a primeira e a última ocorrência.</InfoBox>

      <div className="grid grid-cols-3 gap-2">
        <StatBox label="Gasto no período" val={fmt(totals.spent)} color="teal" />
        <StatBox label="Idas ao mercado" val={String(totals.purchases)} color="blue" />
        <StatBox label="Produtos" val={String(totals.products)} color="green" />
      </div>

      <div className={card}>
        <div className="mb-3">
          <p className={`${label} mb-2`}>Período rápido</p>
          <div className={`flex gap-1 p-1 rounded-xl ${isDark ? "bg-slate-950" : "bg-slate-100"}`}>
            {quickPeriods.map(period => <button key={period.id} onClick={() => { const range = getQuickRange(period.id); setDateFrom(range.from); setDateTo(range.to); }} className={`flex-1 py-1.5 text-[10px] font-black rounded-lg transition-all ${isQuickPeriodActive(period.id) ? "bg-teal-500 text-white shadow-sm" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>{period.label}</button>)}
          </div>
        </div>
        <div className="relative">
          <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Buscar produto..." className={`w-full ${isDark ? "bg-slate-950 border-slate-700 text-slate-100 placeholder-slate-700" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"} border rounded-xl pl-9 pr-8 py-2.5 text-sm focus:outline-none focus:border-teal-500`} />
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-500"><Icon name="search" size={14} /></span>
          {search && <button onClick={() => setSearch("")} className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-slate-500"><Icon name="x" size={13} /></button>}
        </div>
        <div className="mt-3"><p className={`${label} mb-2`}>Categoria</p><CategoryPills categories={availableCategories} active={category} onChange={setCategory} isDark={isDark} allLabel="Todas" /></div>
        <div className="grid grid-cols-2 gap-2 mt-3">
          <input type="date" value={dateFrom} aria-label="Data inicial" onChange={e => setDateFrom(e.target.value)} className={`${isDark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500`} />
          <input type="date" value={dateTo} aria-label="Data final" onChange={e => setDateTo(e.target.value)} className={`${isDark ? "bg-slate-950 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"} border rounded-xl px-3 py-2 text-xs focus:outline-none focus:border-teal-500`} />
        </div>
        {(dateFrom || dateTo) && <button onClick={() => { setDateFrom(""); setDateTo(""); }} className="mt-2 text-[10px] font-bold text-teal-400">Limpar período</button>}
      </div>

      <div className={`flex gap-1 p-1 rounded-xl overflow-x-auto ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
        {([ ["spent", "Gasto"], ["frequency", "Frequência"], ["monthly", "Média/mês"], ["recent", "Recentes"], ["alpha", "A–Z"] ] as [SortBy, string][]).map(([id, text]) => <button key={id} onClick={() => setSortBy(id)} className={`whitespace-nowrap flex-1 px-2.5 py-2 text-[10px] font-bold rounded-lg ${sortBy === id ? "bg-teal-500 text-white" : isDark ? "text-slate-500" : "text-slate-500"}`}>{text}</button>)}
      </div>

      {habits.length === 0 ? <Empty icon="chart" title="Nenhum hábito encontrado" sub="Registre compras ou ajuste os filtros para visualizar suas frequências." /> : (
        <div className="space-y-2">
          {habits.map(({ item, stats }) => {
            const factor = getDisplayFactor(item);
            const mainQuantity = item.type === "packaged" && stats.avgMonthlyInternalQty !== null
              ? quantityLabel(item, stats.avgMonthlyInternalQty, factor, true)
              : quantityLabel(item, stats.avgMonthlyQty, factor);
            return <Card key={item.id} onClick={() => setSelectedItem(item)}><div className="flex items-start gap-3"><div className="w-9 h-9 mt-0.5 rounded-xl bg-teal-500/15 text-teal-400 flex items-center justify-center"><Icon name="trend" size={16} /></div><div className="flex-1 min-w-0"><div className="flex gap-1.5 items-center"><p className={`text-sm font-bold truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>{item.name}</p><Badge>{item.category || "Outro"}</Badge></div><p className="text-xs text-slate-500 mt-1">{mainQuantity}/mês · {fmtN(stats.purchasesPerMonth, 1)}x/mês</p><p className="text-xs text-slate-500 mt-0.5">{quantityLabel(item, stats.avgQtyPerPurchase, factor)} por compra · {fmt(stats.avgMonthlySpent)}/mês</p></div><div className="text-slate-500 mt-2"><Icon name="chevron" size={16} /></div></div></Card>;
          })}
        </div>
      )}
    </div>
  );
}
