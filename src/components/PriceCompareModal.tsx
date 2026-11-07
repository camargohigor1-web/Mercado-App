import { useEffect, useMemo, useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Modal, Card, Badge, Btn, Inp, Sel, InfoBox, LineChart } from "./ui";
import { MoneyInp } from "./MoneyInput";
import { fmt, fmtN, getDisplayUnit, calcStats, getDisplayFactor } from "../utils";
import type { ComparisonOption } from "../types";
import { useAppContext } from "../context/AppContext";
import type { Item } from "../types";

const normalizeText = (value: string) => value.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR");

const GENERIC_UNITS = [
  { value: "un", label: "Unidades (un)" },
  { value: "kg", label: "Quilos (kg)" },
  { value: "g", label: "Gramas (g)" },
  { value: "l", label: "Litros (L)" },
  { value: "ml", label: "Mililitros (ml)" },
];

interface PriceCompareModalProps {
  items: Item[];
  initialItem?: Item | null;
  onClose: () => void;
  embedded?: boolean;
  initialOptions?: ComparisonOption[];
  onOptionsChange?: (options: ComparisonOption[]) => void;
  onBuyOption?: (purchase: { itemId: string; pkgQty: number; pricePerPkg: number; numPkgs: number; brand: string; note: string }) => void;
}

export function PriceCompareModal({ items, initialItem = null, onClose, embedded = false, initialOptions = [], onOptionsChange, onBuyOption }: PriceCompareModalProps) {
  const { isDark } = useTheme();
  const { purchases } = useAppContext();
  const [selectedItem, setSelectedItem] = useState<Item | null>(initialItem);
  const [itemSearch, setItemSearch] = useState("");
  const [genericUnit, setGenericUnit] = useState("un");
  const [options, setOptions] = useState<ComparisonOption[]>(initialOptions);
  const [newOption, setNewOption] = useState({ size: initialItem?.type === "packaged" && initialItem.pkgSize ? String(initialItem.pkgSize) : "", price: "" });
  const [buyingOption, setBuyingOption] = useState<number | null>(null);
  const [buyForm, setBuyForm] = useState({ numPkgs: "1", brand: "", note: "" });
  const buyQtyRef = useRef<HTMLInputElement>(null);
  const buyBrandRef = useRef<HTMLInputElement>(null);
  const buyNoteRef = useRef<HTMLInputElement>(null);
  const itemSearchRef = useRef<HTMLInputElement>(null);
  const sizeRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (selectedItem) sizeRef.current?.focus();
    else itemSearchRef.current?.focus();
  }, [selectedItem]);

  useEffect(() => {
    if (buyingOption === null) return;
    const timer = window.setTimeout(() => buyQtyRef.current?.focus(), 0);
    return () => window.clearTimeout(timer);
  }, [buyingOption]);

  const unit = selectedItem ? getDisplayUnit(selectedItem) : genericUnit;
  const itemStats = selectedItem ? calcStats(selectedItem.id, items, purchases, []) : null;
  const priceFactor = selectedItem ? getDisplayFactor(selectedItem) : 1;
  const historicalPrice = (value: number) => selectedItem?.type === "bulk" ? value / priceFactor : value;

  function updateOptions(next: ComparisonOption[]) {
    setOptions(next);
    if (!initialItem || selectedItem?.id === initialItem.id) onOptionsChange?.(next);
  }

  function pickItem(item: Item | null) {
    setSelectedItem(item);
    setOptions([]);
    setNewOption({ size: item?.type === "packaged" && item.pkgSize ? String(item.pkgSize) : "", price: "" });
    setBuyingOption(null);
    setItemSearch("");
  }

  function addOption() {
    if (!newOption.size || !newOption.price) return;
    const size = Number(newOption.size.replace(",", "."));
    const price = Number(newOption.price.replace(",", "."));
    if (size > 0 && price >= 0) {
      updateOptions([...options, { sizeNum: size, priceNum: price, unit, note: "" }]);
      setNewOption({ size: "", price: "" });
      sizeRef.current?.focus();
    }
  }

  function confirmBuyOption(option: { sizeNum: number; priceNum: number }) {
    const numPkgs = Number(buyForm.numPkgs);
    if (!onBuyOption || !selectedItem || !Number.isFinite(numPkgs) || numPkgs <= 0) return;
    const storedPkgQty = selectedItem.type === "bulk" ? option.sizeNum / priceFactor : option.sizeNum;
    onBuyOption({ itemId: selectedItem.id, pkgQty: storedPkgQty, pricePerPkg: option.priceNum, numPkgs, brand: buyForm.brand.trim(), note: buyForm.note.trim() });
    setBuyingOption(null);
    onClose();
  }

  const bestOption = useMemo(() => {
    if (!options.length) return null;
    return options.map(o => ({ ...o, ppu: o.priceNum / o.sizeNum })).reduce((a, b) => (b.ppu < a.ppu ? b : a));
  }, [options]);

  const normalizedSearch = normalizeText(itemSearch.trim());
  const searchResults = normalizedSearch
    ? items.filter(i => normalizeText(i.name).includes(normalizedSearch)).slice(0, 6)
    : [];

  const itemHistory = selectedItem ? purchases.flatMap(p => p.lines
    .filter(line => line.itemId === selectedItem.id)
    .map(line => ({ purchase: p, line })))
    .sort((a, b) => a.purchase.date.localeCompare(b.purchase.date)) : [];
  const chartData = selectedItem ? itemHistory.map(({ purchase, line }) => ({
    label: new Date(purchase.date + "T12:00:00").toLocaleDateString("pt-BR", { month: "short", year: "2-digit" }),
    value: selectedItem.type === "bulk" ? historicalPrice(line.pricePerUnit || 0) : line.pricePerPkgAfterDiscount ?? line.pricePerPkg,
    date: purchase.date,
    qty: selectedItem.type === "bulk" ? `${fmtN(line.totalQty || 0, 2)} ${unit}` : `${line.numPkgs} emb`,
  })) : [];

  const content = (
      <div className="space-y-4">
        <InfoBox color="blue">Compare tamanhos diferentes para o melhor custo-benefício por unidade.</InfoBox>
        {selectedItem && <>
          <div className="grid grid-cols-3 gap-2">{[
            { label: "Mínimo", value: itemStats?.minPrice }, { label: "Médio", value: itemStats?.avgPrice }, { label: "Último", value: itemStats?.lastPrice },
          ].map(({label,value}) => <div key={label} className={`rounded-xl p-2.5 ${isDark ? "bg-slate-900" : "bg-slate-50"}`}><p className="text-[9px] font-bold uppercase text-slate-500">{label}</p><p className="mt-1 text-sm font-black">{value == null ? "—" : fmt(historicalPrice(value))}</p><p className="text-[9px] text-slate-500">/{selectedItem.type === "bulk" ? unit : "emb"}</p></div>)}</div>
          {chartData.length >= 2 && <div className={`rounded-xl p-3 ${isDark ? "bg-slate-950 border border-slate-800" : "bg-slate-50 border border-slate-200"}`}><LineChart data={chartData} formatValue={fmt} unit={selectedItem.type === "bulk" ? `R$/${unit}` : "R$/emb"} /></div>}
        </>}

        <div className="space-y-2">
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Produto (opcional)</p>
          {selectedItem ? (
            <div className={`flex items-center justify-between rounded-xl border px-3 py-2.5 ${isDark ? "border-slate-700 bg-slate-900" : "border-slate-300 bg-white"}`}>
              <span className={`text-sm font-bold ${isDark ? "text-slate-100" : "text-slate-900"}`}>{selectedItem.name}</span>
              <button onClick={() => pickItem(null)} className={isDark ? "text-slate-500 hover:text-red-400" : "text-slate-400 hover:text-red-500"}>
                <Icon name="x" size={15} />
              </button>
            </div>
          ) : (
            <>
              <input ref={itemSearchRef} value={itemSearch} onChange={e => setItemSearch(e.target.value)}
                placeholder="Buscar produto cadastrado..."
                className={`w-full ${isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-700" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 transition-all`} />
              {searchResults.length > 0 && (
                <div className="space-y-1">
                  {searchResults.map(i => (
                    <button key={i.id} onClick={() => pickItem(i)}
                      className={`w-full text-left px-3 py-2 rounded-lg text-sm transition-colors ${isDark ? "hover:bg-slate-800 text-slate-200" : "hover:bg-slate-100 text-slate-800"}`}>
                      {i.name}
                    </button>
                  ))}
                </div>
              )}
              <Sel label="Ou escolha a unidade de medida" value={genericUnit} onChange={setGenericUnit} options={GENERIC_UNITS} />
            </>
          )}
        </div>

        {options.length > 0 && (
          <div className="space-y-2">
            {options.map((opt, idx) => {
              const ppu = opt.priceNum / opt.sizeNum;
              const isBest = !!bestOption && Math.abs(bestOption.ppu - ppu) < 0.001;
              const min = itemStats ? selectedItem?.type === "bulk" ? historicalPrice(itemStats.minPrice) : itemStats.minInternal ?? null : null;
              const average = itemStats ? selectedItem?.type === "bulk" ? historicalPrice(itemStats.avgPrice) : itemStats.avgInternal ?? null : null;
              const last = itemStats ? selectedItem?.type === "bulk" ? historicalPrice(itemStats.lastPrice) : itemStats.lastInternal ?? null : null;
              const priceContext = min !== null && ppu < min ? "Abaixo do mínimo histórico" : average !== null && ppu <= average ? "Abaixo da média histórica" : last !== null && ppu <= last ? "Abaixo do último preço" : last !== null ? "Acima do último preço" : null;
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
                      {selectedItem?.type === "packaged" && selectedItem.pkgSize && selectedItem.pkgUnit && <p className="mt-1 text-[10px] text-slate-500">Embalagem cadastrada: {fmtN(selectedItem.pkgSize, 3)} {selectedItem.pkgUnit} · estimado {fmt(ppu * selectedItem.pkgSize)}/emb.</p>}
                      {priceContext && <p className={`mt-1 text-[10px] font-semibold ${priceContext.startsWith("Abaixo") ? "text-teal-500" : "text-amber-500"}`}>{priceContext}</p>}
                    </div>
                    <button onClick={() => updateOptions(options.filter((_, i) => i !== idx))}
                      className={`p-1 ${isDark ? "text-slate-600 hover:text-red-400" : "text-slate-400 hover:text-red-500"}`}>
                      <Icon name="trash" size={13} />
                    </button>
                    {onBuyOption && selectedItem && <button onClick={() => { setBuyingOption(buyingOption === idx ? null : idx); setBuyForm({ numPkgs: "1", brand: "", note: "" }); }} title="Registrar como comprado" aria-label="Registrar como comprado" className="flex items-center gap-1 rounded-lg px-2 py-1.5 text-xs font-bold text-teal-500 hover:bg-teal-500/10">
                      <Icon name="cart" size={15} />Comprar
                    </button>}
                  </div>
                  <div className="mt-2">
                    <Inp label="Observação (opcional)" value={opt.note || ""} onChange={value => updateOptions(options.map((option, i) => i === idx ? { ...option, note: value } : option))} placeholder="Ex.: promoção, marca, validade" />
                  </div>
                  {buyingOption === idx && onBuyOption && selectedItem && <div className={`mt-3 border-t pt-3 space-y-3 ${isDark ? "border-slate-800" : "border-slate-100"}`}>
                    <p className="text-xs font-bold">Registrar {selectedItem.name} como comprado</p>
                    <p className="text-xs text-teal-500">Total: {fmt(opt.priceNum * (Number(buyForm.numPkgs) || 0))}</p>
                    <div className="grid grid-cols-2 gap-2">
                      <Inp inputRef={buyQtyRef} label="Embalagens" type="number" value={buyForm.numPkgs} onChange={v => setBuyForm({ ...buyForm, numPkgs: v })} min="1" step="1" onEnter={() => buyBrandRef.current?.focus()} />
                      <Inp inputRef={buyBrandRef} label="Marca (opcional)" value={buyForm.brand} onChange={v => setBuyForm({ ...buyForm, brand: v })} placeholder="Marca" onEnter={() => buyNoteRef.current?.focus()} />
                    </div>
                    <Inp inputRef={buyNoteRef} label="Observações (opcional)" value={buyForm.note} onChange={v => setBuyForm({ ...buyForm, note: v })} placeholder="Ex.: promoção" onEnter={() => confirmBuyOption(opt)} />
                    <div className="flex gap-2">
                      <Btn variant="secondary" onClick={() => setBuyingOption(null)} className="flex-1">Cancelar</Btn>
                      <Btn onClick={() => confirmBuyOption(opt)} className="flex-1">Confirmar</Btn>
                    </div>
                  </div>}
                </Card>
              );
            })}
          </div>
        )}

        <div className={`space-y-3 ${isDark ? "bg-slate-900/50" : "bg-slate-50"} rounded-xl p-3`}>
          <p className="text-[10px] font-black text-slate-600 uppercase tracking-widest">Adicionar opção</p>
          <div className="grid grid-cols-2 gap-2">
            <Inp inputRef={sizeRef} label={`Qtd (${unit})`} type="number" value={newOption.size}
              onChange={(v) => setNewOption({ ...newOption, size: v })} placeholder="Ex: 500" min="0.001" step="0.001"
              onEnter={() => priceRef.current?.focus()} />
            <MoneyInp inputRef={priceRef} label="Preço (R$)" value={newOption.price}
              onChange={(v) => setNewOption({ ...newOption, price: v })} placeholder="1,99"
              onEnter={addOption} />
          </div>
          <Btn onClick={addOption} className="w-full" size="sm"><Icon name="plus" size={13} />Adicionar opção</Btn>
        </div>
        {!embedded && <Btn onClick={onClose} variant="secondary" className="w-full justify-center">Fechar</Btn>}
      </div>
  );

  if (embedded) return content;
  return <Modal title={selectedItem ? `Comparar — ${selectedItem.name}` : "Comparador de preços"} onClose={onClose}>{content}</Modal>;
}

