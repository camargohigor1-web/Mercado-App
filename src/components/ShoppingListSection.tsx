import { useState, useRef } from "react";
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

export function ShoppingListSection({
  onConvertToPurchase, onGoToItems, onGoToHistoryPurchase, onGoToHistoryPurchaseWithProduct,
}: ShoppingListSectionProps) {
  const { isDark } = useTheme();
  const { items, markets, purchases, warehouse, list: shoppingList, setList: setShoppingList } = useAppContext();

  const [listMode, setListMode] = useState<"plan" | "market">("plan");
  const [search, setSearch] = useState("");
  const [filterCat, setFilterCat] = useState("");
  const [filterCatAdd, setFilterCatAdd] = useState("");
  const [editModal, setEditModal] = useState(false);
  const [editName, setEditName] = useState("");
  const [savedListsModal, setSavedListsModal] = useState(false);
  const [decisionItem, setDecisionItem] = useState<Item | null>(null);
  const [priceCompareModal, setPriceCompareModal] = useState(false);
  const [compareItem, setCompareItem] = useState<Item | null>(null);
  const [compareOptions, setCompareOptions] = useState<{ sizeNum: number; priceNum: number; unit: string }[]>([]);
  const [newOption, setNewOption] = useState({ size: "", price: "" });
  const [convertModal, setConvertModal] = useState(false);
  const [clearAllConfirm, setClearAllConfirm] = useState(false);
  const [qtyModal, setQtyModal] = useState<{ itemId: string; qty: string } | null>(null);
  const [shareModal, setShareModal] = useState(false);
  const sizeRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const activeList = shoppingList.filter((l): l is ShoppingListItem => !l.saved);
  const savedLists = shoppingList.filter((l): l is SavedShoppingList => l.saved);
  const inList = new Set(activeList.map(l => l.itemId));

  const withStats = items.map(i => ({
    item: i,
    stats: calcStats(i.id, items, purchases, warehouse.flatMap(w => w.entries || [])),
  }));
  const available = withStats.filter(({ item }) => !inList.has(item.id));
  const addCategoryOptions = [...new Set(available.map(({ item }) => item.category || "Sem categoria"))].sort();
  const filtAvail = available
    .filter(({ item }) => item.name.toLowerCase().includes(search.toLowerCase()))
    .filter(({ item }) => !filterCatAdd || (item.category || "Sem categoria") === filterCatAdd);

  function add(itemId: string) {
    setShoppingList([...shoppingList, { itemId, done: false, saved: false, qty: 1 }]);
  }
  function remove(itemId: string) {
    setShoppingList(shoppingList.filter(l => l.saved || (l as ShoppingListItem).itemId !== itemId));
  }
  function toggle(itemId: string) {
    setShoppingList(shoppingList.map(l =>
      (!l.saved && (l as ShoppingListItem).itemId === itemId)
        ? { ...l, done: !(l as ShoppingListItem).done }
        : l
    ));
  }
  function updateQty(itemId: string, qty: number) {
    setShoppingList(shoppingList.map(l =>
      (!l.saved && (l as ShoppingListItem).itemId === itemId)
        ? { ...l, qty: Math.max(1, qty) }
        : l
    ));
  }
  function clearDone() { setShoppingList(shoppingList.filter(l => l.saved || !(l as ShoppingListItem).done)); }
  function clearAll() { setShoppingList(shoppingList.filter(l => l.saved)); setClearAllConfirm(false); }

  function saveList() {
    if (!editName.trim() || activeList.length === 0) return;
    const saved: SavedShoppingList = { id: uid(), name: editName.trim(), date: new Date().toISOString().slice(0, 10), items: activeList, saved: true };
    setShoppingList([...shoppingList.filter(l => l.saved), saved, ...shoppingList.filter(l => !l.saved)]);
    setEditModal(false); setEditName("");
  }

  function loadSavedList(list: SavedShoppingList) {
    const newItems = list.items.filter(i => !inList.has(i.itemId));
    setShoppingList([...shoppingList.filter(l => !l.saved), ...shoppingList.filter(l => l.saved), ...newItems]);
    setSavedListsModal(false);
  }

  function deleteSavedList(id: string) {
    setShoppingList(shoppingList.filter(l => !(l.saved && (l as SavedShoppingList).id === id)));
  }

  function buildShareText(): string {
    const lines: string[] = ['*Lista de Compras 🛒*', ''];
    const grouped: Record<string, typeof activeList> = {};
    activeList.forEach(li => {
      const item = items.find(i => i.id === li.itemId);
      if (!item) return;
      const cat = item.category || 'Sem categoria';
      if (!grouped[cat]) grouped[cat] = [];
      grouped[cat].push(li);
    });
    Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).forEach(([cat, catItems]) => {
      lines.push(`*${cat}*`);
      catItems.forEach(li => {
        const item = items.find(i => i.id === li.itemId);
        if (!item) return;
        const qty = (li as any).qty || 1;
        const qtyStr = qty > 1 ? `${qty}x ` : '';
        lines.push(`  ☐ ${qtyStr}${item.name}`);
      });
      lines.push('');
    });
    lines.push(`_Total: ${activeList.length} item${activeList.length !== 1 ? 's' : ''}_`);
    return lines.join('\n');
  }

  function shareViaWhatsApp() {
    const text = buildShareText();
    const url = `https://wa.me/?text=${encodeURIComponent(text)}`;
    window.open(url, '_blank');
  }

  function shareViaText() {
    const text = buildShareText();
    if (navigator.share) {
      navigator.share({ title: 'Lista de Compras', text }).catch(() => {});
    } else {
      navigator.clipboard?.writeText(text).then(() => setShareModal(false)).catch(() => {});
    }
  }

  function autoSuggest() {
    const ids = available
      .filter(({ stats }) => stats !== null)
      .sort((a, b) => b.stats!.avgMonthly - a.stats!.avgMonthly)
      .slice(0, 8)
      .map(({ item }) => item.id);
    const toAdd = ids.filter(id => !inList.has(id)).map(id => ({ itemId: id, done: false, saved: false as const, qty: 1 }));
    setShoppingList([...shoppingList, ...toAdd]);
  }

  function handleConvertToPurchase() {
    const lines: PurchaseLine[] = activeList
      .map(li => {
        const item = items.find(i => i.id === li.itemId);
        if (!item) return null;
        const stats = calcStats(li.itemId, items, purchases, warehouse.flatMap(w => w.entries || []));
        if (!stats || !stats.entries.length) return null;
        const last = stats.entries[stats.entries.length - 1];
        const qty = (li as any).qty || 1;
        if (item.type === "bulk") {
          const pricePerUnit = last.pricePerUnit || 0;
          const pkgQty = last.pkgQty || 1;
          const numPkgs = qty;
          const totalQty = numPkgs * pkgQty;
          const pricePerPkg = pricePerUnit * pkgQty;
          return { itemId: li.itemId, numPkgs, pkgQty, totalQty, pricePerPkg, pricePerPkgAfterDiscount: pricePerPkg, discountTotal: 0, discountPerPkg: 0, pricePerUnit, total: pricePerPkg * numPkgs } as PurchaseLine;
        } else {
          const pricePerPkg = last.pricePerPkg || 0;
          const pricePerInternal = last.pricePerInternal || 0;
          return { itemId: li.itemId, numPkgs: qty, pricePerPkg, pricePerPkgAfterDiscount: pricePerPkg, discountTotal: 0, discountPerPkg: 0, pricePerInternal, total: pricePerPkg * qty } as PurchaseLine;
        }
      })
      .filter(Boolean) as PurchaseLine[];
    if (lines.length > 0) { onConvertToPurchase(lines); setConvertModal(false); }
  }

  function openPriceCompare(item: Item) {
    setCompareItem(item); setCompareOptions([]); setNewOption({ size: "", price: "" }); setPriceCompareModal(true);
  }

  function addCompareOption() {
    if (newOption.size && newOption.price && compareItem) {
      const size = Number(newOption.size.replace(",", "."));
      const price = Number(newOption.price.replace(",", "."));
      if (size > 0 && price >= 0) {
        const du = getDisplayUnit(compareItem);
        setCompareOptions([...compareOptions, { sizeNum: size, priceNum: price, unit: du }]);
        setNewOption({ size: "", price: "" });
        if (sizeRef.current) sizeRef.current.focus();
      }
    }
  }

  function calculateBestOption() {
    if (compareOptions.length === 0) return null;
    const analyzed = compareOptions.map(opt => ({ ...opt, pricePerUnit: opt.priceNum / opt.sizeNum }));
    return analyzed.reduce((min, curr) => curr.pricePerUnit < min.pricePerUnit ? curr : min);
  }

  function getItemInsights(item: Item, stats: ReturnType<typeof calcStats>) {
    if (!stats) return null;
    const factor = getDisplayFactor(item);
    const du = getDisplayUnit(item);
    if (item.type === "bulk") {
      return {
        consumption: `${fmtN(stats.avgMonthly * factor, 2)} ${du}/mês`,
        avg: `${fmt(stats.avgPrice / factor)}/${du}`,
        last: `${fmt(stats.lastPrice / factor)}/${du}`,
        min: `${fmt(stats.minPrice / factor)}/${du}`,
      };
    }
    return {
      consumption: `${fmtN(stats.avgMonthly, 1)} emb/mês`,
      avg: `${fmt(stats.avgPrice)}/emb`,
      last: `${fmt(stats.lastPrice)}/emb`,
      min: `${fmt(stats.minPrice)}/emb`,
    };
  }

  const listFull = activeList.map(l => ({
    ...l,
    item: items.find(i => i.id === l.itemId),
    stats: calcStats(l.itemId, items, purchases, warehouse.flatMap(w => w.entries || [])),
    qty: (l as any).qty || 1,
  })).filter(l => l.item);

  const pending = listFull.filter(l => !l.done);
  const done    = listFull.filter(l => l.done);

  const pendingByCategory: Record<string, typeof pending> = {};
  pending.forEach(entry => {
    const cat = entry.item!.category || "Sem categoria";
    if (!pendingByCategory[cat]) pendingByCategory[cat] = [];
    pendingByCategory[cat].push(entry);
  });

  const categoryOptions = Object.keys(pendingByCategory).sort();
  const filteredByCategory = filterCat
    ? { [filterCat]: pendingByCategory[filterCat] ?? [] }
    : pendingByCategory;

  // ── QTY Modal ─────────────────────────────────────────────────────────────
  const QtyModal = () => {
    if (!qtyModal) return null;
    const item = items.find(i => i.id === qtyModal.itemId);
    if (!item) return null;
    const du = item.type === "bulk" ? (item.displayUnit || item.unit || "un") : "emb";
    return (
      <Modal title={`Quantidade — ${item.name}`} onClose={() => setQtyModal(null)}>
        <div className="space-y-4">
          <Inp
            label={`Quantidade (${du})`}
            type="number"
            value={qtyModal.qty}
            onChange={v => setQtyModal({ ...qtyModal, qty: v })}
            placeholder="1"
            min="1"
            step="1"
            onEnter={() => {
              const n = parseFloat(qtyModal.qty);
              if (!isNaN(n) && n > 0) { updateQty(qtyModal.itemId, n); setQtyModal(null); }
            }}
          />
          <div className="flex gap-3">
            <Btn onClick={() => setQtyModal(null)} variant="secondary" className="flex-1">Cancelar</Btn>
            <Btn onClick={() => {
              const n = parseFloat(qtyModal.qty);
              if (!isNaN(n) && n > 0) { updateQty(qtyModal.itemId, n); setQtyModal(null); }
            }} className="flex-1">Confirmar</Btn>
          </div>
        </div>
      </Modal>
    );
  };

  return (
    <div className="space-y-4">
      {/* Tab toggle */}
      <div className={`flex gap-2 ${isDark ? "bg-slate-900" : "bg-slate-100"} rounded-xl p-1`}>
        <button onClick={() => setListMode("plan")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${listMode === "plan" ? "bg-teal-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
          Planejar
        </button>
        <button onClick={() => setListMode("market")}
          className={`flex-1 py-2 text-xs font-bold rounded-lg transition-all ${listMode === "market" ? "bg-blue-500 text-white" : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"}`}>
          Mercado
        </button>
      </div>

      {/* Toolbar — planejar */}
      {listMode === "plan" && (
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex gap-2">
            {available.some(({ stats }) => stats !== null) && (
              <Btn onClick={autoSuggest} variant="outline" size="sm"><Icon name="history" size={13} />Sugerir</Btn>
            )}
            {savedLists.length > 0 && (
              <Btn onClick={() => setSavedListsModal(true)} variant="outline" size="sm"><Icon name="list" size={13} />Listas ({savedLists.length})</Btn>
            )}
          </div>
          <div className="flex gap-2">
            {listFull.some(l => l.done) && <Btn onClick={clearDone} variant="ghost" size="sm">Limpar marcados</Btn>}
            {activeList.length > 0 && (
              <>
                <Btn onClick={() => setClearAllConfirm(true)} variant="danger" size="sm"><Icon name="trash" size={13} /></Btn>
                <Btn onClick={() => setShareModal(true)} variant="outline" size="sm"><Icon name="share" size={13} /></Btn>
                <Btn onClick={() => setConvertModal(true)} variant="outline" size="sm"><Icon name="cart" size={13} />Compra</Btn>
                <Btn onClick={() => { setEditName(""); setEditModal(true); }} variant="success" size="sm"><Icon name="check" size={13} />Salvar</Btn>
              </>
            )}
          </div>
        </div>
      )}

      {/* Modo mercado */}
      {listMode === "market" && (
        listFull.length === 0 ? (
          <Empty icon="list" title="Lista vazia" sub="Volte para Planejar e adicione os produtos antes de ir ao mercado." />
        ) : (
          <div className="space-y-3">
            <div className={`flex items-center justify-between px-4 py-3 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl`}>
              <div>
                <p className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Modo mercado</p>
                <p className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{pending.length} pendente{pending.length === 1 ? "" : "s"} · {done.length} comprado{done.length === 1 ? "" : "s"}</p>
              </div>
              {done.length > 0 && <Btn onClick={clearDone} variant="ghost" size="sm">Limpar</Btn>}
            </div>

            {categoryOptions.length > 1 && (
              <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
                className={`w-full ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 appearance-none`}>
                <option value="">Todas as categorias</option>
                {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            )}

            {pending.length === 0 ? (
              <Empty icon="check" title="Tudo marcado!" sub="Os itens da lista foram marcados como comprados." />
            ) : (
              Object.entries(filteredByCategory).map(([cat, catItems]) => (
                <div key={cat}>
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-1">{cat}</p>
                  <div className="space-y-2">
                    {catItems.map(({ itemId, item, stats, qty }) => {
                      const it = item!;
                      const du = getDisplayUnit(it);
                      const insights = getItemInsights(it, stats);
                      return (
                        <Card key={itemId}>
                          <div className="space-y-3">
                            <div className="flex items-start gap-3">
                              <button onClick={() => toggle(itemId)}
                                className="mt-0.5 w-9 h-9 rounded-xl bg-teal-500/15 text-teal-400 border border-teal-500/30 flex-shrink-0 flex items-center justify-center">
                                <Icon name="check" size={17} />
                              </button>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <p className={`${isDark ? "text-slate-100" : "text-slate-900"} text-base font-black`}>{it.name}</p>
                                  <Badge color={it.type === "bulk" ? "teal" : "amber"}>{it.type === "bulk" ? du : `${fmtN(it.pkgSize || 0, 0)} ${it.pkgUnit}`}</Badge>
                                </div>
                                {/* Quantidade */}
                                <button onClick={() => setQtyModal({ itemId, qty: String(qty) })}
                                  className={`mt-1 flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs font-bold transition-all ${isDark ? "bg-slate-800 text-teal-400 hover:bg-slate-700" : "bg-slate-100 text-teal-600 hover:bg-slate-200"}`}>
                                  <Icon name="edit" size={11} />
                                  Qtd: {qty} {it.type === "bulk" ? "emb" : "emb"}
                                </button>
                                {insights ? (
                                  <div className="grid grid-cols-3 gap-2 mt-2">
                                    <div className={`${isDark ? "bg-slate-800/70" : "bg-slate-100"} rounded-xl px-2.5 py-2`}>
                                      <p className="text-[9px] text-slate-500">Consumo</p>
                                      <p className="text-[11px] font-bold text-slate-300">{insights.consumption}</p>
                                    </div>
                                    <div className="bg-green-500/10 rounded-xl px-2.5 py-2">
                                      <p className="text-[9px] text-green-700">Médio</p>
                                      <p className="text-[11px] font-bold text-green-400">{insights.avg}</p>
                                    </div>
                                    <div className="bg-blue-500/10 rounded-xl px-2.5 py-2">
                                      <p className="text-[9px] text-blue-700">Último</p>
                                      <p className="text-[11px] font-bold text-blue-400">{insights.last}</p>
                                    </div>
                                  </div>
                                ) : (
                                  <p className="text-xs text-slate-600 mt-1">Sem histórico de compras</p>
                                )}
                              </div>
                            </div>
                            <div className="grid grid-cols-2 gap-2">
                              <Btn onClick={() => openPriceCompare(it)} variant="outline" size="sm" className="justify-center"><Icon name="scale" size={13} />Comparar</Btn>
                              <Btn onClick={() => remove(itemId)} variant="ghost" size="sm" className="justify-center"><Icon name="x" size={13} />Remover</Btn>
                            </div>
                          </div>
                        </Card>
                      );
                    })}
                  </div>
                </div>
              ))
            )}

            {done.length > 0 && (
              <div className="space-y-2">
                <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest pt-1">Já comprado ({done.length})</p>
                {done.map(({ itemId, item, qty }) => (
                  <Card key={itemId} className="opacity-50">
                    <div className="flex items-center gap-3">
                      <button onClick={() => toggle(itemId)} className="w-8 h-8 rounded-xl border border-teal-500 bg-teal-500 flex-shrink-0 flex items-center justify-center"><Icon name="check" size={14} /></button>
                      <p className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"} line-through flex-1`}>{item!.name}</p>
                      <span className="text-xs text-slate-600">{qty}x</span>
                      <button onClick={() => remove(itemId)} className={`p-1 ${isDark ? "text-slate-700" : "text-slate-400"}`}><Icon name="x" size={13} /></button>
                    </div>
                  </Card>
                ))}
              </div>
            )}
          </div>
        )
      )}

      {/* Lista ativa — planejar */}
      {listMode === "plan" && listFull.length > 0 && (
        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Para comprar ({pending.length})</p>
          </div>

          {categoryOptions.length > 1 && (
            <select value={filterCat} onChange={e => setFilterCat(e.target.value)}
              className={`w-full ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 appearance-none`}>
              <option value="">Todas as categorias</option>
              {categoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
            </select>
          )}

          {Object.entries(filteredByCategory).map(([cat, catItems]) => (
            <div key={cat}>
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider mb-1.5 px-1">{cat}</p>
              <div className="space-y-2">
                {catItems.map(({ itemId, item, stats, qty }) => {
                  const it = item!;
                  const du = getDisplayUnit(it);
                  const factor = getDisplayFactor(it);
                  return (
                    <Card key={itemId}>
                      <div className="flex items-start gap-3">
                        <button onClick={() => toggle(itemId)}
                          className={`mt-1 w-5 h-5 rounded-full border-2 ${isDark ? "border-slate-700" : "border-slate-300"} flex-shrink-0 hover:border-teal-500 transition-colors`} />
                        <div className="flex-1 min-w-0" onClick={() => setDecisionItem(it)}>
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className={`${isDark ? "text-slate-100" : "text-slate-900"} text-sm font-semibold`}>{it.name}</p>
                            <Badge color={it.type === "bulk" ? "teal" : "amber"}>{it.type === "bulk" ? du : `${fmtN(it.pkgSize || 0, 0)} ${it.pkgUnit}`}</Badge>
                          </div>
                          {stats && (
                            <div className="flex flex-wrap gap-x-3 mt-1">
                              <span className="text-[10px] text-slate-600">Médio: <span className="text-green-400 font-semibold">{it.type === "bulk" ? `${fmt(stats.avgPrice / factor)}/${du}` : `${fmt(stats.avgPrice)}/emb`}</span></span>
                              <span className="text-[10px] text-slate-600">Último: <span className="text-blue-400">{it.type === "bulk" ? fmt(stats.lastPrice / factor) : fmt(stats.lastPrice)}</span></span>
                            </div>
                          )}
                        </div>
                        {/* Quantidade inline */}
                        <div className="flex items-center gap-1 flex-shrink-0">
                          <button onClick={() => updateQty(itemId, qty - 1)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm font-black transition-colors ${isDark ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                            −
                          </button>
                          <span className={`text-xs font-black w-5 text-center ${isDark ? "text-slate-200" : "text-slate-800"}`}>{qty}</span>
                          <button onClick={() => updateQty(itemId, qty + 1)}
                            className={`w-6 h-6 rounded-lg flex items-center justify-center text-sm font-black transition-colors ${isDark ? "bg-slate-800 text-slate-400 hover:bg-slate-700 hover:text-white" : "bg-slate-100 text-slate-500 hover:bg-slate-200"}`}>
                            +
                          </button>
                        </div>
                        <div className="flex gap-0.5 flex-shrink-0">
                          <button onClick={() => openPriceCompare(it)} className={`p-1 ${isDark ? "text-slate-700 hover:text-blue-400" : "text-slate-400 hover:text-blue-500"}`}><Icon name="scale" size={13} /></button>
                          <button onClick={() => remove(itemId)} className={`p-1 ${isDark ? "text-slate-700 hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}><Icon name="x" size={13} /></button>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            </div>
          ))}

          {done.length > 0 && (
            <>
              <p className="text-[10px] font-black text-slate-700 uppercase tracking-widest pt-1">Já comprado ({done.length})</p>
              {done.map(({ itemId, item, qty }) => (
                <Card key={itemId} className="opacity-40">
                  <div className="flex items-center gap-3">
                    <button onClick={() => toggle(itemId)} className="w-5 h-5 rounded-full border-2 border-teal-500 bg-teal-500 flex-shrink-0 flex items-center justify-center"><Icon name="check" size={11} /></button>
                    <p className={`text-sm ${isDark ? "text-slate-500" : "text-slate-400"} line-through flex-1`}>{item!.name}</p>
                    <span className="text-xs text-slate-600">{qty}x</span>
                    <button onClick={() => remove(itemId)} className={`p-1 ${isDark ? "text-slate-800" : "text-slate-300"}`}><Icon name="x" size={13} /></button>
                  </div>
                </Card>
              ))}
            </>
          )}
        </div>
      )}

      {/* Adicionar à lista */}
      {listMode === "plan" && (
        <div>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Adicionar à lista</p>
          {addCategoryOptions.length > 1 && (
            <div className="mb-2">
              <select value={filterCatAdd} onChange={e => setFilterCatAdd(e.target.value)}
                className={`w-full ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 appearance-none`}>
                <option value="">Todas as categorias</option>
                {addCategoryOptions.map(cat => <option key={cat} value={cat}>{cat}</option>)}
              </select>
            </div>
          )}
          <Inp value={search} onChange={setSearch} placeholder="Buscar produto..." />
          {filtAvail.length === 0 ? (
            items.length === 0 ? (
              <div className="flex flex-col items-center text-center py-8 gap-3 px-4">
                <div className={`w-12 h-12 rounded-2xl flex items-center justify-center ${isDark ? "bg-slate-800" : "bg-slate-100"}`}><Icon name="package" size={20} /></div>
                <div className="space-y-1">
                  <p className={`font-black text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>Nenhum produto cadastrado</p>
                  <p className={`text-xs ${isDark ? "text-slate-500" : "text-slate-400"}`}>Cadastre produtos para montar sua lista de compras.</p>
                </div>
                {onGoToItems && (
                  <button onClick={onGoToItems} className="px-4 py-2 rounded-xl bg-teal-500 text-white text-xs font-black flex items-center gap-1.5">
                    <Icon name="plus" size={13} />Cadastrar produtos
                  </button>
                )}
              </div>
            ) : items.length === inList.size ? (
              <p className={`text-xs text-center py-5 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Todos os produtos já estão na lista</p>
            ) : (
              <p className={`text-xs text-center py-5 ${isDark ? "text-slate-600" : "text-slate-400"}`}>Nenhum resultado</p>
            )
          ) : (
            <div className="space-y-2 mt-2">
              {filtAvail.map(({ item, stats }) => {
                const du = getDisplayUnit(item);
                const factor = getDisplayFactor(item);
                return (
                  <button key={item.id} onClick={() => add(item.id)} className="w-full text-left">
                    <Card className={`flex items-center justify-between ${isDark ? "hover:border-teal-500/40" : "hover:border-teal-400"}`}>
                      <div>
                        <p className={`${isDark ? "text-slate-200" : "text-slate-800"} text-sm font-medium`}>{item.name}</p>
                        <p className="text-[10px] mt-0.5">
                          {stats
                            ? <span>Médio <span className="text-green-400 font-semibold">{item.type === "bulk" ? `${fmt(stats.avgPrice / factor)}/${du}` : `${fmt(stats.avgPrice)}/emb`}</span></span>
                            : <span className="text-slate-600">Sem histórico</span>
                          }
                        </p>
                      </div>
                      <div className="text-teal-500 flex-shrink-0"><Icon name="plus" size={16} /></div>
                    </Card>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Modal de quantidade */}
      <QtyModal />

      {/* Decision Guide Modal */}
      {decisionItem && (() => {
        const item = decisionItem;
        const stats = calcStats(item.id, items, purchases, warehouse.flatMap(w => w.entries || []));
        const factor = getDisplayFactor(item);
        const du = getDisplayUnit(item);
        const allEntries: any[] = [];
        purchases.forEach(p => {
          p.lines.forEach(l => {
            if (l.itemId !== item.id) return;
            const mkt = markets.find(m => m.id === p.marketId)?.name || "?";
            allEntries.push({ ...l, date: p.date, market: mkt, purchaseId: p.id });
          });
        });
        allEntries.sort((a, b) => b.date.localeCompare(a.date));
        const recentEntries = allEntries.slice(0, 5);

        return (
          <Modal title={`Guia — ${item.name}`} onClose={() => setDecisionItem(null)}>
            <div className="space-y-4">
              <div className="flex gap-1.5 flex-wrap">
                <Badge color={item.type === "bulk" ? "teal" : "amber"}>{item.type === "bulk" ? "Granel" : "Emb. fixa"}</Badge>
                <Badge>{item.category}</Badge>
              </div>

              {!stats ? (
                <InfoBox>Nenhuma compra registrada para este produto ainda.</InfoBox>
              ) : (
                <>
                  <div className="grid grid-cols-2 gap-2">
                    {item.type === "bulk" ? (
                      <>
                        <div className="bg-teal-500/10 rounded-xl p-3"><p className="text-[10px] text-teal-700 mb-0.5">Menor preço/{du}</p><p className="font-black text-sm text-teal-400">{fmt(stats.minPrice / factor)}</p></div>
                        <div className="bg-green-500/10 rounded-xl p-3"><p className="text-[10px] text-green-700 mb-0.5">Preço médio/{du}</p><p className="font-black text-sm text-green-400">{fmt(stats.avgPrice / factor)}</p></div>
                        <div className="bg-blue-500/10 rounded-xl p-3"><p className="text-[10px] text-blue-700 mb-0.5">Último preço/{du}</p><p className="font-black text-sm text-blue-400">{fmt(stats.lastPrice / factor)}</p></div>
                        <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} rounded-xl p-3`}><p className="text-[10px] text-slate-500 mb-0.5">Consumo médio/mês</p><p className="font-black text-sm">{fmtN(stats.avgMonthly * factor, 2)} {du}</p></div>
                      </>
                    ) : (
                      <>
                        <div className="bg-teal-500/10 rounded-xl p-3"><p className="text-[10px] text-teal-700 mb-0.5">Menor preço/emb</p><p className="font-black text-sm text-teal-400">{fmt(stats.minPrice)}</p></div>
                        <div className="bg-green-500/10 rounded-xl p-3"><p className="text-[10px] text-green-700 mb-0.5">Preço médio/emb</p><p className="font-black text-sm text-green-400">{fmt(stats.avgPrice)}</p></div>
                        <div className="bg-blue-500/10 rounded-xl p-3"><p className="text-[10px] text-blue-700 mb-0.5">Último preço/emb</p><p className="font-black text-sm text-blue-400">{fmt(stats.lastPrice)}</p></div>
                        <div className={`${isDark ? "bg-slate-800" : "bg-slate-100"} rounded-xl p-3`}><p className="text-[10px] text-slate-500 mb-0.5">Consumo médio/mês</p><p className="font-black text-sm">{fmtN(stats.avgMonthly, 1)} emb</p></div>
                      </>
                    )}
                  </div>

                  {allEntries.length >= 2 && (() => {
                    const chronoEntries = [...allEntries].sort((a, b) => a.date.localeCompare(b.date));
                    const priceEvolution: LineChartPoint[] = chronoEntries.map(e => ({
                      label: new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
                      value: item.type === "bulk" ? (e.pricePerUnit || 0) / factor : (e.pricePerPkgAfterDiscount ?? e.pricePerPkg),
                      date: e.date, market: e.market,
                      qty: item.type === "bulk" ? `${fmtN((e.totalQty || 0) * factor, 2)} ${du}` : `${e.numPkgs} emb`,
                      discount: e.discountTotal > 0 ? `Desc: ${fmt(e.discountTotal)}` : undefined,
                    }));
                    return (
                      <div className={`rounded-2xl border p-3 ${isDark ? "bg-slate-900 border-white/5" : "bg-slate-50 border-black/6"}`}>
                        <LineChart data={priceEvolution} formatValue={fmt} unit={item.type === "bulk" ? `R$/${du}` : "R$/emb"} />
                      </div>
                    );
                  })()}

                  {recentEntries.length > 0 && (
                    <div>
                      <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest mb-2">Últimas compras</p>
                      <div className="space-y-2">
                        {recentEntries.map((e: any, i: number) => {
                          const canNav = !!(onGoToHistoryPurchaseWithProduct || onGoToHistoryPurchase);
                          return (
                            <div key={i} onClick={() => {
                              if (onGoToHistoryPurchaseWithProduct) { setDecisionItem(null); onGoToHistoryPurchaseWithProduct(e.purchaseId, item.id); }
                              else if (onGoToHistoryPurchase) { setDecisionItem(null); onGoToHistoryPurchase(e.purchaseId); }
                            }}
                              className={`flex items-center justify-between px-3 py-2.5 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl ${canNav ? "cursor-pointer active:scale-95 transition-transform" : ""}`}>
                              <div>
                                <p className={`text-xs font-semibold ${isDark ? "text-slate-200" : "text-slate-800"}`}>{e.market}</p>
                                <p className="text-[10px] text-slate-500">{new Date(e.date + "T12:00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "2-digit" })}</p>
                              </div>
                              <div className="flex items-center gap-2">
                                <div className="text-right">
                                  <p className="text-xs font-bold text-teal-400">
                                    {item.type === "bulk" ? `${fmt((e.pricePerUnit || 0) / factor)}/${du}` : `${fmt(e.pricePerPkgAfterDiscount ?? e.pricePerPkg)}/emb`}
                                  </p>
                                  {e.discountTotal > 0 && <p className="text-[10px] text-amber-400">c/ desc</p>}
                                </div>
                                {canNav && <Icon name="chevron" size={12} />}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </>
              )}
              <div className="flex gap-2">
                <Btn onClick={() => { setDecisionItem(null); openPriceCompare(item); }} variant="outline" className="flex-1" size="sm"><Icon name="scale" size={13} />Comparar emb.</Btn>
                <Btn onClick={() => setDecisionItem(null)} variant="secondary" className="flex-1" size="sm">Fechar</Btn>
              </div>
            </div>
          </Modal>
        );
      })()}

      {/* Price Compare Modal */}
      {priceCompareModal && compareItem && (() => {
        const best = calculateBestOption();
        const du = getDisplayUnit(compareItem);
        return (
          <Modal title={`Comparar — ${compareItem.name}`} onClose={() => setPriceCompareModal(false)}>
            <div className="space-y-4">
              <InfoBox color="blue">Compare diferentes tamanhos para encontrar o melhor custo-benefício por unidade.</InfoBox>
              {compareOptions.length > 0 && (
                <div className="space-y-2">
                  {compareOptions.map((opt, idx) => {
                    const pricePerUnit = opt.priceNum / opt.sizeNum;
                    const isBest = best && Math.abs(best.pricePerUnit - pricePerUnit) < 0.001;
                    return (
                      <Card key={idx} className={isBest ? "border-teal-500/50 bg-teal-500/5" : ""}>
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex-1">
                            <div className="flex items-center gap-2 mb-1">
                              <p className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{fmtN(opt.sizeNum, 3).replace(/,?0+$/, "")} {opt.unit}</p>
                              {isBest && <Badge color="teal">Melhor custo</Badge>}
                            </div>
                            <p className="text-xs text-slate-500">{fmt(opt.priceNum)} · <span className="text-teal-400 font-semibold">{fmt(pricePerUnit)}/{opt.unit}</span></p>
                          </div>
                          <button onClick={() => setCompareOptions(compareOptions.filter((_, i) => i !== idx))} className={`p-1 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}><Icon name="trash" size={13} /></button>
                        </div>
                      </Card>
                    );
                  })}
                </div>
              )}
              <div className={`space-y-3 ${isDark ? "bg-slate-900/50" : "bg-slate-50"} rounded-xl p-3`}>
                <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Adicionar opção</p>
                <div className="grid grid-cols-2 gap-2">
                  <Inp inputRef={sizeRef} label={`Quantidade (${du})`} type="number" value={newOption.size} onChange={v => setNewOption({ ...newOption, size: v })} placeholder="Ex: 500" min="0.001" step="0.001"
                    onEnter={() => { if (priceRef.current) priceRef.current.focus(); }} />
                  <Inp inputRef={priceRef} label="Preço (R$)" type="number" value={newOption.price} onChange={v => setNewOption({ ...newOption, price: v })} placeholder="1,99" min="0.01" step="0.01" onEnter={addCompareOption} />
                </div>
                <Btn onClick={addCompareOption} className="w-full" size="sm"><Icon name="plus" size={13} />Adicionar opção</Btn>
              </div>
              <Btn onClick={() => setPriceCompareModal(false)} variant="secondary" className="w-full justify-center">Fechar</Btn>
            </div>
          </Modal>
        );
      })()}

      {/* Saved Lists Modal */}
      {savedListsModal && (
        <Modal title="Listas Salvas" onClose={() => setSavedListsModal(false)}>
          <div className="space-y-3">
            {savedLists.length === 0 ? (
              <Empty icon="list" title="Nenhuma lista salva" />
            ) : (
              savedLists.map(list => (
                <Card key={list.id}>
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex-1 min-w-0">
                      <p className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{list.name}</p>
                      <p className="text-xs text-slate-500 mt-0.5">{new Date(list.date + "T12:00:00").toLocaleDateString("pt-BR")} · {list.items.length} {list.items.length === 1 ? "item" : "itens"}</p>
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {list.items.slice(0, 4).map(li => {
                          const it = items.find(i => i.id === li.itemId);
                          return it ? <Badge key={li.itemId}>{it.name}</Badge> : null;
                        })}
                        {list.items.length > 4 && <Badge>+{list.items.length - 4}</Badge>}
                      </div>
                    </div>
                    <div className="flex gap-1 flex-shrink-0">
                      <Btn onClick={() => loadSavedList(list)} size="sm" variant="success"><Icon name="copy" size={12} />Carregar</Btn>
                      <button onClick={() => deleteSavedList(list.id)} className={`p-1.5 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}><Icon name="trash" size={13} /></button>
                    </div>
                  </div>
                </Card>
              ))
            )}
            <Btn onClick={() => setSavedListsModal(false)} variant="secondary" className="w-full justify-center">Fechar</Btn>
          </div>
        </Modal>
      )}

      {editModal && (
        <Modal title="Salvar Lista de Compras" onClose={() => setEditModal(false)}>
          <div className="space-y-4">
            <Inp label="Nome da lista" value={editName} onChange={setEditName} placeholder="Ex: Compras do mês..." required onEnter={saveList} />
            <div className="flex gap-3">
              <Btn onClick={() => setEditModal(false)} variant="secondary" className="flex-1">Cancelar</Btn>
              <Btn onClick={saveList} disabled={!editName.trim()} className="flex-1">Salvar</Btn>
            </div>
          </div>
        </Modal>
      )}

      {convertModal && (
        <Modal title="Converter em Compra" onClose={() => setConvertModal(false)}>
          <div className="space-y-4">
            <InfoBox color="teal">Os itens com histórico serão adicionados com o último preço registrado. Ajuste os valores antes de salvar.</InfoBox>
            <div className="space-y-1.5">
              {activeList.map(li => {
                const item = items.find(i => i.id === li.itemId);
                const stats = calcStats(li.itemId, items, purchases, warehouse.flatMap(w => w.entries || []));
                if (!item) return null;
                const hasHistory = stats && stats.entries.length > 0;
                const qty = (li as any).qty || 1;
                return (
                  <div key={li.itemId} className={`flex items-center justify-between px-3 py-2 ${isDark ? "bg-slate-900 border-slate-800" : "bg-slate-50 border-slate-200"} border rounded-xl`}>
                    <div>
                      <p className={`text-sm ${isDark ? "text-slate-200" : "text-slate-800"}`}>{item.name}</p>
                      <p className="text-xs text-slate-500">Qtd: {qty}</p>
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

      {clearAllConfirm && (
        <ConfirmModal title="Limpar lista inteira" message="Remover todos os itens da lista ativa? Os itens marcados como comprados também serão removidos."
          confirmLabel="Limpar tudo" onConfirm={clearAll} onCancel={() => setClearAllConfirm(false)} />
      )}

      {/* Share Modal */}
      {shareModal && activeList.length > 0 && (
        <Modal title="Compartilhar Lista" onClose={() => setShareModal(false)}>
          <div className="space-y-4">
            {/* Preview da lista */}
            <div className={`rounded-xl p-4 font-mono text-xs leading-relaxed ${isDark ? "bg-slate-900 border border-slate-800 text-slate-300" : "bg-slate-50 border border-slate-200 text-slate-700"}`}>
              <p className="font-black mb-2">Lista de Compras 🛒</p>
              {(() => {
                const grouped: Record<string, typeof activeList> = {};
                activeList.forEach(li => {
                  const item = items.find(i => i.id === li.itemId);
                  if (!item) return;
                  const cat = item.category || 'Sem categoria';
                  if (!grouped[cat]) grouped[cat] = [];
                  grouped[cat].push(li);
                });
                return Object.entries(grouped).sort(([a],[b])=>a.localeCompare(b)).map(([cat, catItems]) => (
                  <div key={cat} className="mb-2">
                    <p className={`font-bold text-[11px] mb-1 ${isDark ? "text-teal-400" : "text-teal-600"}`}>{cat}</p>
                    {catItems.map(li => {
                      const item = items.find(i => i.id === li.itemId);
                      if (!item) return null;
                      const qty = (li as any).qty || 1;
                      return (
                        <p key={li.itemId} className="ml-2">
                          ☐ {qty > 1 ? `${qty}x ` : ''}{item.name}
                        </p>
                      );
                    })}
                  </div>
                ));
              })()}
              <p className={`mt-2 text-[10px] ${isDark ? "text-slate-500" : "text-slate-400"}`}>
                Total: {activeList.length} item{activeList.length !== 1 ? 's' : ''}
              </p>
            </div>

            {/* Botões de compartilhamento */}
            <div className="space-y-2">
              <button
                onClick={shareViaWhatsApp}
                className="w-full flex items-center gap-3 px-4 py-3.5 rounded-xl bg-green-500 text-white font-bold text-sm transition-all active:scale-95 press-scale"
              >
                <Icon name="whatsapp" size={20} />
                Compartilhar no WhatsApp
              </button>
              <button
                onClick={() => { shareViaText(); setShareModal(false); }}
                className={`w-full flex items-center gap-3 px-4 py-3.5 rounded-xl text-sm font-bold transition-all active:scale-95 press-scale ${isDark ? "bg-white/5 text-slate-200 border border-white/10 hover:bg-white/10" : "bg-black/5 text-slate-700 border border-black/10 hover:bg-black/8"}`}
              >
                <Icon name="share" size={18} />
                {'share' in navigator ? 'Compartilhar…' : 'Copiar texto'}
              </button>
            </div>

            <Btn onClick={() => setShareModal(false)} variant="secondary" className="w-full justify-center">
              Fechar
            </Btn>
          </div>
        </Modal>
      )}
    </div>
  );
}
