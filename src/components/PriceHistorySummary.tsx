import { fmt, fmtN, getDisplayFactor, getDisplayUnit } from "../utils";
import type { Item } from "../types";

type PriceStats = {
  minPrice: number;
  avgPrice: number;
  lastPrice: number;
  entries: Array<{ pricePerUnit?: number; pricePerPkg?: number; pkgQty?: number }>;
};

export function PriceHistorySummary({ item, stats, isDark }: { item: Item; stats: PriceStats; isDark: boolean }) {
  const factor = getDisplayFactor(item);
  const unit = getDisplayUnit(item);
  const lastEntry = stats.entries[stats.entries.length - 1];
  const lastPackageQty = item.type === "bulk" && lastEntry?.pkgQty != null ? lastEntry.pkgQty * factor : null;
  const toDisplayPrice = (value: number) => item.type === "bulk" ? value / factor : value;
  const maxPrice = stats.entries.length
    ? Math.max(...stats.entries.map(entry => item.type === "bulk" ? entry.pricePerUnit ?? 0 : entry.pricePerPkg ?? 0))
    : null;
  const prices = [
    { label: "Mínimo", value: stats.minPrice },
    { label: "Médio", value: stats.avgPrice },
    { label: "Máximo", value: maxPrice },
    { label: "Último", value: stats.lastPrice },
  ];
  const equivalent = lastPackageQty !== null
    ? prices.map(({ label, value }) => ({ label: ({ Mínimo: "Mín", Médio: "Méd", Máximo: "Máx", Último: "Últ" } as Record<string, string>)[label], value: value === null ? null : toDisplayPrice(value) * lastPackageQty }))
    : null;

  return <div className="space-y-2">
    {equivalent ? <div className={`rounded-xl border px-2.5 py-2 ${isDark ? "bg-amber-500/10 border-amber-500/20" : "bg-amber-50 border-amber-100"}`}>
      <div className="flex items-center justify-between gap-2 mb-1.5">
        <p className={`text-[9px] font-black uppercase tracking-wide ${isDark ? "text-amber-400" : "text-amber-700"}`}>Equivalente à última embalagem</p>
        <p className="text-[9px] text-slate-500">{fmtN(lastPackageQty, 3).replace(/,?0+$/, "")} {unit}</p>
      </div>
      <div className="grid grid-cols-4 gap-1">{equivalent.map(({ label, value }) => <div key={label} className="min-w-0 flex items-baseline gap-1">
        <span className="text-[9px] text-slate-500">{label}</span><span className={`truncate text-[11px] font-black ${isDark ? "text-amber-300" : "text-amber-800"}`}>{value === null ? "—" : fmt(value)}</span>
      </div>)}</div>
    </div> : <div className="grid grid-cols-4 gap-1.5">{prices.map(({ label, value }) => <div key={label} className={`min-w-0 rounded-lg p-2 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}>
      <p className="truncate text-[9px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 truncate text-xs font-black">{value == null ? "—" : fmt(toDisplayPrice(value))}</p><p className="text-[9px] text-slate-500">/{item.type === "bulk" ? unit : "emb"}</p>
    </div>)}</div>}
  </div>;
}
