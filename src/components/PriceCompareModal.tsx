import { useMemo, useRef, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Modal, Card, Badge, Btn, Inp, Sel, InfoBox } from "./ui";
import { fmt, fmtN, getDisplayUnit } from "../utils";
import type { Item } from "../types";

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
}

export function PriceCompareModal({ items, initialItem = null, onClose }: PriceCompareModalProps) {
  const { isDark } = useTheme();
  const [selectedItem, setSelectedItem] = useState<Item | null>(initialItem);
  const [itemSearch, setItemSearch] = useState("");
  const [genericUnit, setGenericUnit] = useState("un");
  const [options, setOptions] = useState<{ sizeNum: number; priceNum: number; unit: string }[]>([]);
  const [newOption, setNewOption] = useState({ size: "", price: "" });
  const sizeRef = useRef<HTMLInputElement>(null);
  const priceRef = useRef<HTMLInputElement>(null);

  const unit = selectedItem ? getDisplayUnit(selectedItem) : genericUnit;

  function pickItem(item: Item | null) {
    setSelectedItem(item);
    setOptions([]);
    setNewOption({ size: "", price: "" });
    setItemSearch("");
  }

  function addOption() {
    if (!newOption.size || !newOption.price) return;
    const size = Number(newOption.size.replace(",", "."));
    const price = Number(newOption.price.replace(",", "."));
    if (size > 0 && price >= 0) {
      setOptions(prev => [...prev, { sizeNum: size, priceNum: price, unit }]);
      setNewOption({ size: "", price: "" });
      sizeRef.current?.focus();
    }
  }

  const bestOption = useMemo(() => {
    if (!options.length) return null;
    return options.map(o => ({ ...o, ppu: o.priceNum / o.sizeNum })).reduce((a, b) => (b.ppu < a.ppu ? b : a));
  }, [options]);

  const searchResults = itemSearch.trim()
    ? items.filter(i => i.name.toLowerCase().includes(itemSearch.toLowerCase())).slice(0, 6)
    : [];

  return (
    <Modal title={selectedItem ? `Comparar — ${selectedItem.name}` : "Comparador de preços"} onClose={onClose}>
      <div className="space-y-4">
        <InfoBox color="blue">Compare tamanhos diferentes para o melhor custo-benefício por unidade.</InfoBox>

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
              <input value={itemSearch} onChange={e => setItemSearch(e.target.value)}
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
                    <button onClick={() => setOptions(options.filter((_, i) => i !== idx))}
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
            <Inp inputRef={sizeRef} label={`Qtd (${unit})`} type="number" value={newOption.size}
              onChange={(v) => setNewOption({ ...newOption, size: v })} placeholder="Ex: 500" min="0.001" step="0.001"
              onEnter={() => priceRef.current?.focus()} />
            <Inp inputRef={priceRef} label="Preço (R$)" type="number" value={newOption.price}
              onChange={(v) => setNewOption({ ...newOption, price: v })} placeholder="1,99" min="0.01" step="0.01"
              onEnter={addOption} />
          </div>
          <Btn onClick={addOption} className="w-full" size="sm"><Icon name="plus" size={13} />Adicionar opção</Btn>
        </div>
        <Btn onClick={onClose} variant="secondary" className="w-full justify-center">Fechar</Btn>
      </div>
    </Modal>
  );
}
