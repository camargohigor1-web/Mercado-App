import { useState, useMemo } from "react";
import { useTheme } from "../hooks/useTheme";
import { useAppContext } from "../context/AppContext";
import { Icon } from "./Icon";
import { fmt, fmtN } from "../utils";

interface MarketComparisonProps {
  /** mês inicial no formato "YYYY-MM", padrão = mês atual */
  initialMonth?: string;
}

function buildMonths(n: number): string[] {
  return Array.from({ length: n }, (_, i) => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() - (n - 1 - i));
    return d.toISOString().slice(0, 7);
  });
}

function shortLabel(key: string) {
  const [y, m] = key.split("-");
  const s = new Date(+y, +m - 1, 1).toLocaleDateString("pt-BR", { month: "short", year: "2-digit" });
  return s.charAt(0).toUpperCase() + s.slice(1).replace(".", "");
}

export function MarketComparison({ initialMonth }: MarketComparisonProps) {
  const { isDark } = useTheme();
  const { purchases, markets, items } = useAppContext();

  const currentMonth = new Date().toISOString().slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState(initialMonth ?? currentMonth);

  const months = buildMonths(6);

  // ── Dados do mês selecionado ───────────────────────────────────────────────
  const monthPurchases = useMemo(
    () => purchases.filter(p => p.date.startsWith(selectedMonth)),
    [purchases, selectedMonth]
  );

  const getMkt  = (id: string) => markets.find(m => m.id === id)?.name ?? "Mercado";
  const getItem = (id: string) => items.find(i => i.id === id);

  // Agrupa compras por mercado
  const byMarket = useMemo(() => {
    const map: Record<string, {
      name: string;
      total: number;
      visits: number;
      avgTicket: number;
      byCategory: Record<string, number>;
      items: { name: string; total: number; count: number }[];
    }> = {};

    monthPurchases.forEach(p => {
      const name = getMkt(p.marketId);
      if (!map[name]) {
        map[name] = { name, total: 0, visits: 0, avgTicket: 0, byCategory: {}, items: [] };
      }
      map[name].total += p.total;
      map[name].visits += 1;

      p.lines.forEach(l => {
        const item = getItem(l.itemId);
        const cat  = item?.category ?? "Outros";
        map[name].byCategory[cat] = (map[name].byCategory[cat] ?? 0) + l.total;

        const existing = map[name].items.find(x => x.name === (item?.name ?? "?"));
        if (existing) { existing.total += l.total; existing.count += 1; }
        else map[name].items.push({ name: item?.name ?? "?", total: l.total, count: 1 });
      });
    });

    // calcular ticket médio e ordenar itens por gasto
    Object.values(map).forEach(m => {
      m.avgTicket = m.visits > 0 ? m.total / m.visits : 0;
      m.items.sort((a, b) => b.total - a.total);
    });

    return Object.values(map).sort((a, b) => b.total - a.total);
  }, [monthPurchases, markets, items]);

  // Totais mensais por mercado (para sparklines)
  const monthlyByMarket = useMemo(() => {
    const map: Record<string, Record<string, number>> = {};
    markets.forEach(m => { map[m.name] = {}; });
    purchases.forEach(p => {
      const name = getMkt(p.marketId);
      const mo   = p.date.slice(0, 7);
      if (!map[name]) map[name] = {};
      map[name][mo] = (map[name][mo] ?? 0) + p.total;
    });
    return map;
  }, [purchases, markets]);

  // Comparativo de itens comuns entre mercados
  const commonItems = useMemo(() => {
    // Itens comprados em 2+ mercados no mês
    const itemByMarket: Record<string, Record<string, number[]>> = {};
    monthPurchases.forEach(p => {
      const name = getMkt(p.marketId);
      p.lines.forEach(l => {
        const item = getItem(l.itemId);
        if (!item) return;
        const itemName = item.name;
        if (!itemByMarket[itemName]) itemByMarket[itemName] = {};
        if (!itemByMarket[itemName][name]) itemByMarket[itemName][name] = [];
        // preço por unidade relevante
        const price = item.type === "bulk"
          ? (l.pricePerUnit ?? l.pricePerPkg)
          : (l.pricePerPkgAfterDiscount ?? l.pricePerPkg);
        itemByMarket[itemName][name].push(price);
      });
    });

    return Object.entries(itemByMarket)
      .filter(([, mkt]) => Object.keys(mkt).length >= 2)
      .map(([name, mkt]) => {
        const entries = Object.entries(mkt).map(([market, prices]) => ({
          market,
          avg: prices.reduce((a, b) => a + b, 0) / prices.length,
        })).sort((a, b) => a.avg - b.avg);
        const cheapest    = entries[0];
        const mostExpensive = entries[entries.length - 1];
        const saving = mostExpensive.avg > 0
          ? ((mostExpensive.avg - cheapest.avg) / mostExpensive.avg) * 100
          : 0;
        return { name, entries, cheapest, mostExpensive, saving };
      })
      .filter(x => x.saving > 0.5)
      .sort((a, b) => b.saving - a.saving)
      .slice(0, 8);
  }, [monthPurchases]);

  const totalMonth = byMarket.reduce((s, m) => s + m.total, 0);
  const cheapestMarket = byMarket.length > 0 ? byMarket[byMarket.length - 1] : null;
  const mostSpentMarket = byMarket.length > 0 ? byMarket[0] : null;

  const card = `rounded-2xl border ${isDark ? "bg-slate-900/80 border-white/5" : "bg-white border-black/6"} p-4`;
  const lbl  = `text-[10px] font-black uppercase tracking-widest mb-3 ${isDark ? "text-slate-500" : "text-slate-400"}`;
  const sub  = `text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`;

  const COLORS = ["#14b8a6","#3b82f6","#8b5cf6","#f59e0b","#f43f5e","#10b981"];

  if (purchases.length === 0) {
    return (
      <div className="flex flex-col items-center text-center py-16 gap-3 px-8">
        <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}>
          <Icon name="store" size={24} />
        </div>
        <p className={`font-black text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Sem dados ainda</p>
        <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Registre compras em diferentes mercados para ver o comparativo.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">

      {/* Seletor de mês */}
      <div className={card}>
        <p className={lbl}>Mês de análise</p>
        <div className="flex items-end gap-1.5" style={{ height: 56 }}>
          {months.map(mo => {
            const total = purchases.filter(p => p.date.startsWith(mo)).reduce((s, p) => s + p.total, 0);
            const max   = Math.max(...months.map(m => purchases.filter(p => p.date.startsWith(m)).reduce((s, p) => s + p.total, 0)), 1);
            const h     = total > 0 ? Math.max((total / max) * 48, 5) : 3;
            const isSel = mo === selectedMonth;
            return (
              <button key={mo} onClick={() => setSelectedMonth(mo)}
                className="flex-1 flex flex-col items-center justify-end focus:outline-none group" style={{ height: 56 }}>
                <div className="w-full rounded-t-md transition-all duration-300"
                  style={{ height: `${h}px`, background: isSel ? "#14b8a6" : isDark ? "#1e293b" : "#e2e8f0", boxShadow: isSel ? "0 0 12px rgba(20,184,166,0.4)" : "none" }} />
                <span className="text-[9px] font-black mt-1" style={{ color: isSel ? "#2dd4bf" : isDark ? "#334155" : "#94a3b8" }}>
                  {shortLabel(mo)}
                </span>
              </button>
            );
          })}
        </div>
      </div>

      {monthPurchases.length === 0 ? (
        <div className={`${card} text-center py-8`}>
          <p className={`text-sm font-bold ${isDark ? "text-slate-400" : "text-slate-500"}`}>Nenhuma compra em {shortLabel(selectedMonth)}</p>
          <p className={`text-xs mt-1 ${sub}`}>Selecione outro mês ou registre compras.</p>
        </div>
      ) : (
        <>
          {/* Resumo rápido */}
          <div className="grid grid-cols-2 gap-3">
            <div className={card}>
              <p className={lbl}>Total do mês</p>
              <p className="text-2xl font-black text-teal-400">{fmt(totalMonth)}</p>
              <p className={`text-[10px] mt-1 ${sub}`}>{monthPurchases.length} compra{monthPurchases.length !== 1 ? "s" : ""}</p>
            </div>
            <div className={card}>
              <p className={lbl}>Mercados visitados</p>
              <p className={`text-2xl font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>{byMarket.length}</p>
              {mostSpentMarket && <p className={`text-[10px] mt-1 ${sub}`}>Maior gasto: {mostSpentMarket.name}</p>}
            </div>
          </div>

          {/* Ranking de mercados */}
          <div>
            <p className={`${lbl} mb-0`}>Ranking de gastos</p>
            <p className={`text-[10px] mb-3 ${sub}`}>Mercados ordenados pelo total gasto no mês</p>
            <div className="space-y-3">
              {byMarket.map((m, i) => {
                const pct  = totalMonth > 0 ? (m.total / totalMonth) * 100 : 0;
                const color = COLORS[i % COLORS.length];
                return (
                  <div key={m.name} className={card}>
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <div className="w-7 h-7 rounded-lg flex items-center justify-center flex-shrink-0 text-white text-xs font-black"
                          style={{ background: color }}>
                          {i + 1}
                        </div>
                        <div className="min-w-0">
                          <p className={`text-sm font-black truncate ${isDark ? "text-slate-100" : "text-slate-900"}`}>{m.name}</p>
                          <p className={`text-[10px] ${sub}`}>{m.visits} visita{m.visits !== 1 ? "s" : ""} · ticket médio {fmt(m.avgTicket)}</p>
                        </div>
                      </div>
                      <div className="text-right flex-shrink-0">
                        <p className="text-sm font-black" style={{ color }}>{fmt(m.total)}</p>
                        <p className={`text-[10px] ${sub}`}>{pct.toFixed(0)}% do total</p>
                      </div>
                    </div>

                    {/* Barra de progresso */}
                    <div className={`h-1.5 rounded-full ${isDark ? "bg-white/5" : "bg-black/5"} mb-3`}>
                      <div className="h-1.5 rounded-full transition-all duration-700" style={{ width: `${pct}%`, background: color }} />
                    </div>

                    {/* Top categorias */}
                    {Object.keys(m.byCategory).length > 0 && (
                      <div className="flex flex-wrap gap-1.5">
                        {Object.entries(m.byCategory)
                          .sort((a, b) => b[1] - a[1])
                          .slice(0, 4)
                          .map(([cat, val]) => (
                            <span key={cat} className={`text-[10px] font-bold px-2 py-0.5 rounded-lg ${isDark ? "bg-white/5 text-slate-400" : "bg-black/5 text-slate-500"}`}>
                              {cat} {fmt(val)}
                            </span>
                          ))}
                      </div>
                    )}

                    {/* Top itens neste mercado */}
                    {m.items.length > 0 && (
                      <div className={`mt-3 pt-3 border-t ${isDark ? "border-white/5" : "border-black/5"}`}>
                        <p className={`text-[10px] font-black uppercase tracking-widest mb-2 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Mais gastos aqui</p>
                        <div className="space-y-1">
                          {m.items.slice(0, 3).map(item => (
                            <div key={item.name} className="flex items-center justify-between">
                              <span className={`text-xs truncate max-w-[60%] ${isDark ? "text-slate-400" : "text-slate-600"}`}>{item.name}</span>
                              <span className="text-xs font-bold" style={{ color }}>{fmt(item.total)}</span>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Comparativo de itens comuns */}
          {commonItems.length > 0 && (
            <div>
              <p className={`${lbl} mb-0`}>Mesmo produto, preços diferentes</p>
              <p className={`text-[10px] mb-3 ${sub}`}>Itens comprados em 2+ mercados no mês — oportunidade de economia</p>
              <div className="space-y-3">
                {commonItems.map(({ name, entries, cheapest, mostExpensive, saving }) => (
                  <div key={name} className={card}>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <p className={`text-sm font-black ${isDark ? "text-slate-100" : "text-slate-900"}`}>{name}</p>
                      <span className={`text-[10px] font-black px-2 py-0.5 rounded-lg flex-shrink-0 ${isDark ? "bg-teal-500/15 text-teal-400" : "bg-teal-50 text-teal-700"}`}>
                        -{saving.toFixed(0)}%
                      </span>
                    </div>
                    <div className="space-y-2">
                      {entries.map((e, i) => {
                        const isCheapest = e.market === cheapest.market;
                        const pct = mostExpensive.avg > 0 ? (e.avg / mostExpensive.avg) * 100 : 100;
                        return (
                          <div key={e.market}>
                            <div className="flex items-center justify-between mb-1">
                              <div className="flex items-center gap-1.5">
                                {isCheapest && <Icon name="tag" size={11} />}
                                <span className={`text-xs ${isCheapest ? "text-teal-400 font-bold" : isDark ? "text-slate-400" : "text-slate-600"}`}>{e.market}</span>
                              </div>
                              <span className={`text-xs font-bold ${isCheapest ? "text-teal-400" : isDark ? "text-slate-300" : "text-slate-700"}`}>{fmt(e.avg)}</span>
                            </div>
                            <div className={`h-1.5 rounded-full ${isDark ? "bg-white/5" : "bg-black/5"}`}>
                              <div className="h-1.5 rounded-full transition-all duration-500"
                                style={{ width: `${pct}%`, background: isCheapest ? "#14b8a6" : COLORS[i + 1] ?? "#94a3b8" }} />
                            </div>
                          </div>
                        );
                      })}
                    </div>
                    <p className={`text-[10px] mt-2 ${sub}`}>
                      Comprando em <span className="text-teal-400 font-bold">{cheapest.market}</span> você economizaria{" "}
                      <span className="text-teal-400 font-bold">{fmt(mostExpensive.avg - cheapest.avg)}</span> por unidade vs {mostExpensive.market}
                    </p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Evolução mensal por mercado */}
          {byMarket.length > 1 && (
            <div className={card}>
              <p className={lbl}>Evolução histórica por mercado</p>
              <div className="space-y-3">
                {byMarket.slice(0, 4).map((m, i) => {
                  const mData = months.map(mo => monthlyByMarket[m.name]?.[mo] ?? 0);
                  const maxVal = Math.max(...mData, 1);
                  const color  = COLORS[i % COLORS.length];
                  return (
                    <div key={m.name}>
                      <div className="flex items-center justify-between mb-1.5">
                        <div className="flex items-center gap-2">
                          <div className="w-2 h-2 rounded-full" style={{ background: color }} />
                          <span className={`text-xs font-semibold ${isDark ? "text-slate-300" : "text-slate-600"}`}>{m.name}</span>
                        </div>
                        <span className="text-xs font-black" style={{ color }}>{fmt(m.total)}</span>
                      </div>
                      <div className="flex items-end gap-1" style={{ height: 28 }}>
                        {mData.map((val, j) => {
                          const h   = val > 0 ? Math.max((val / maxVal) * 24, 3) : 2;
                          const isSel = months[j] === selectedMonth;
                          return (
                            <div key={j} className="flex-1 rounded-t-sm transition-all duration-300"
                              style={{ height: `${h}px`, background: isSel ? color : isDark ? "#1e293b" : "#e2e8f0", opacity: isSel ? 1 : 0.5 }} />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {/* Insight final */}
          {cheapestMarket && byMarket.length > 1 && (
            <div className={`rounded-2xl border p-4 ${isDark ? "bg-teal-500/8 border-teal-500/20" : "bg-teal-50 border-teal-200/60"}`}>
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-xl bg-teal-500/20 text-teal-400 flex items-center justify-center flex-shrink-0">
                  <Icon name="trend" size={14} />
                </div>
                <div>
                  <p className={`text-sm font-black ${isDark ? "text-teal-300" : "text-teal-700"}`}>
                    {cheapestMarket.name} foi o mais econômico em {shortLabel(selectedMonth)}
                  </p>
                  <p className={`text-xs mt-1 leading-relaxed ${isDark ? "text-teal-400/70" : "text-teal-600/80"}`}>
                    Com ticket médio de <strong>{fmt(cheapestMarket.avgTicket)}</strong> por visita,
                    {byMarket.length > 1 && mostSpentMarket && mostSpentMarket.name !== cheapestMarket.name ? ` contra ${fmt(mostSpentMarket.avgTicket)} no ${mostSpentMarket.name}.` : "."}
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
