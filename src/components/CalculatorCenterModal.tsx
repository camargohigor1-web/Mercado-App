import { useMemo, useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Modal } from "./ui";
import { PriceCompareModal } from "./PriceCompareModal";
import { fmt } from "../utils";
import type { Item } from "../types";

type Tool = "compare" | "unit" | "calc" | "discount";
type Operator = "+" | "−" | "×" | "÷";
type Unit = "kg" | "g" | "l" | "ml" | "un";
const UNITS: { value: Unit; label: string }[] = [
  { value: "kg", label: "kg" }, { value: "g", label: "g" },
  { value: "l", label: "L" }, { value: "ml", label: "ml" }, { value: "un", label: "un" },
];
const UNIT_BASE: Record<Unit, string> = { kg: "kg", g: "kg", l: "L", ml: "L", un: "un" };

function numberOf(value: string) { return Number(value.replace(",", ".")) || 0; }
function Field({ label, value, onChange, placeholder = "0", suffix }: { label: string; value: string; onChange: (value: string) => void; placeholder?: string; suffix?: string }) {
  const { isDark } = useTheme();
  return <label className="block space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">{label}</span><span className="relative block"><input inputMode="decimal" value={value} onChange={e => onChange(e.target.value)} placeholder={placeholder} className={`w-full rounded-xl border px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 ${suffix ? "pr-12" : ""} ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`} />{suffix && <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-500">{suffix}</span>}</span></label>;
}

export function CalculatorCenterModal({ items, onClose }: { items: Item[]; onClose: () => void }) {
  const { isDark } = useTheme();
  const [tool, setTool] = useState<Tool>("compare");
  const [display, setDisplay] = useState("0");
  const [stored, setStored] = useState<number | null>(null);
  const [operator, setOperator] = useState<Operator | null>(null);
  const [fresh, setFresh] = useState(false);
  const [price, setPrice] = useState("");
  const [discount, setDiscount] = useState("");
  const [discountMode, setDiscountMode] = useState<"percent" | "amount">("percent");
  const [unitA, setUnitA] = useState({ qty: "", price: "", unit: "g" as Unit });
  const [unitB, setUnitB] = useState({ qty: "", price: "", unit: "kg" as Unit });

  const result = useMemo(() => {
    const qtyA = numberOf(unitA.qty), qtyB = numberOf(unitB.qty);
    if (!qtyA || !qtyB || !unitA.price || !unitB.price) return null;
    if (UNIT_BASE[unitA.unit] !== UNIT_BASE[unitB.unit]) return { incompatible: true as const };
    const normalizedUnit = UNIT_BASE[unitA.unit];
    const scaleToBase = (u: Unit) => u === "kg" || u === "l" ? 1 : u === "g" || u === "ml" ? 1000 : 1;
    const perA = numberOf(unitA.price) / (qtyA / scaleToBase(unitA.unit));
    const perB = numberOf(unitB.price) / (qtyB / scaleToBase(unitB.unit));
    return { incompatible: false as const, normalizedUnit, perA, perB, best: Math.abs(perA - perB) < 0.000001 ? "tie" as const : perA < perB ? "a" as const : "b" as const };
  }, [unitA, unitB]);

  function enterDigit(digit: string) {
    setDisplay(current => fresh || current === "0" ? digit : current.length < 14 ? current + digit : current);
    setFresh(false);
  }
  function enterDecimal() {
    if (fresh) { setDisplay("0,"); setFresh(false); }
    else if (!display.includes(",")) setDisplay(`${display},`);
  }
  function calculate(a: number, b: number, op: Operator) {
    if (op === "+") return a + b;
    if (op === "−") return a - b;
    if (op === "×") return a * b;
    return b === 0 ? NaN : a / b;
  }
  function chooseOperator(next: Operator) {
    const current = numberOf(display);
    if (stored !== null && operator && !fresh) {
      const value = calculate(stored, current, operator);
      setDisplay(Number.isFinite(value) ? String(Number(value.toPrecision(10))).replace(".", ",") : "Erro");
      setStored(Number.isFinite(value) ? value : null);
    } else setStored(current);
    setOperator(next);
    setFresh(true);
  }
  function equals() {
    if (stored === null || !operator) return;
    const value = calculate(stored, numberOf(display), operator);
    setDisplay(Number.isFinite(value) ? String(Number(value.toPrecision(10))).replace(".", ",") : "Erro");
    setStored(null); setOperator(null); setFresh(true);
  }
  function clearCalc() { setDisplay("0"); setStored(null); setOperator(null); setFresh(false); }

  const tabs: { id: Tool; label: string; icon: string }[] = [
    { id: "compare", label: "Comparar preços", icon: "scale" }, { id: "unit", label: "Unidades", icon: "scale" },
    { id: "calc", label: "Calculadora", icon: "calculator" }, { id: "discount", label: "Desconto", icon: "tag" },
  ];
  const softKey = isDark ? "bg-slate-800 text-slate-100 hover:bg-slate-700" : "bg-slate-100 text-slate-800 hover:bg-slate-200";
  const resultCard = `rounded-2xl border p-4 ${isDark ? "bg-teal-500/10 border-teal-500/20" : "bg-teal-50 border-teal-200"}`;
  const tabContent = (
    <div className="space-y-4">
      <div aria-label="Ferramentas da calculadora" className="flex gap-1.5 overflow-x-auto pb-1" style={{ scrollbarWidth: "none" }}>
        {tabs.map(t => <button key={t.id} type="button" aria-pressed={tool === t.id} onClick={() => setTool(t.id)} className={`flex flex-shrink-0 items-center gap-1.5 rounded-xl px-3 py-2 text-xs font-bold transition-colors ${tool === t.id ? "bg-teal-500 text-white" : isDark ? "bg-slate-900 text-slate-400" : "bg-slate-100 text-slate-600"}`}><Icon name={t.icon} size={13} />{t.label}</button>)}
      </div>

      {tool === "calc" && <div className="space-y-3">
        <div className={`rounded-2xl p-4 text-right ${isDark ? "bg-slate-900" : "bg-slate-100"}`}><p className="min-h-7 text-xs text-slate-500">{stored !== null ? `${String(stored).replace(".", ",")} ${operator ?? ""}` : "Calculadora"}</p><p className="overflow-hidden text-4xl font-black tabular-nums" aria-live="polite">{display}</p></div>
        <div className="grid grid-cols-4 gap-2">
          {["C", "⌫", "%", "÷", "7", "8", "9", "×", "4", "5", "6", "−", "1", "2", "3", "+", "±", "0", ",", "="].map(key => <button key={key} type="button" aria-label={key === "C" ? "Limpar cálculo" : key === "⌫" ? "Apagar último dígito" : undefined} onClick={() => {
            if (key === "C") clearCalc();
            else if (key === "⌫") { setDisplay(display.length > 1 ? display.slice(0, -1) : "0"); setFresh(false); }
            else if (key === "%") { setDisplay(String(numberOf(display) / 100).replace(".", ",")); setFresh(true); }
            else if (key === "±") setDisplay(String(-numberOf(display)).replace(".", ","));
            else if (["+", "−", "×", "÷"].includes(key)) chooseOperator(key as Operator);
            else if (key === "=") equals();
            else if (key === ",") enterDecimal();
            else enterDigit(key);
          }} className={`min-h-12 rounded-xl text-lg font-bold active:scale-95 ${["÷", "×", "−", "+", "="].includes(key) ? "bg-teal-500 text-white hover:bg-teal-600" : key === "C" ? "bg-red-500/15 text-red-400" : softKey}`}>{key}</button>)}
        </div>
      </div>}

      {tool === "discount" && <div className="space-y-4">
        <Field label="Preço original" value={price} onChange={setPrice} suffix="R$" />
        <div className="flex gap-2"><button onClick={() => setDiscountMode("percent")} className={`flex-1 rounded-xl py-2 text-sm font-bold ${discountMode === "percent" ? "bg-teal-500 text-white" : softKey}`}>Porcentagem</button><button onClick={() => setDiscountMode("amount")} className={`flex-1 rounded-xl py-2 text-sm font-bold ${discountMode === "amount" ? "bg-teal-500 text-white" : softKey}`}>Valor (R$)</button></div>
        <Field label={discountMode === "percent" ? "Desconto" : "Valor do desconto"} value={discount} onChange={setDiscount} suffix={discountMode === "percent" ? "%" : "R$"} />
        {price && <div className={resultCard}><p className="text-xs font-bold text-slate-500">PREÇO FINAL</p><p className="mt-1 text-3xl font-black text-teal-500">{fmt(Math.max(0, numberOf(price) - (discountMode === "percent" ? numberOf(price) * numberOf(discount) / 100 : numberOf(discount))))}</p><p className="mt-1 text-xs text-slate-500">Economia de {fmt(Math.min(numberOf(price), discountMode === "percent" ? numberOf(price) * numberOf(discount) / 100 : numberOf(discount)))}</p></div>}
      </div>}

      {tool === "unit" && <div className="space-y-3">
        <p className="text-xs text-slate-500">Informe duas embalagens. Convertemos g/kg e ml/L para comparar o preço pela mesma unidade.</p>
        {[{ id: "a", label: "Opção 1", value: unitA, update: setUnitA }, { id: "b", label: "Opção 2", value: unitB, update: setUnitB }].map(({ id, label, value, update }) => <div key={id} className={`grid grid-cols-2 gap-2 rounded-xl border p-3 ${isDark ? "border-slate-800 bg-slate-900/60" : "border-slate-200 bg-slate-50"}`}>
          <p className="col-span-2 text-xs font-bold">{label}</p><Field label="Quantidade" value={value.qty} onChange={qty => update({ ...value, qty })} />
          <label className="block space-y-1"><span className="text-[10px] font-bold uppercase tracking-wider text-slate-500">Unidade</span><select value={value.unit} onChange={e => update({ ...value, unit: e.target.value as Unit })} className={`w-full rounded-xl border px-3 py-2.5 text-sm ${isDark ? "bg-slate-900 border-slate-700 text-slate-100" : "bg-white border-slate-300 text-slate-900"}`}>{UNITS.map(u => <option key={u.value} value={u.value}>{u.label}</option>)}</select></label>
          <div className="col-span-2"><Field label="Preço da embalagem" value={value.price} onChange={price => update({ ...value, price })} suffix="R$" /></div>
        </div>)}
        {result && (result.incompatible ? <p className="rounded-xl bg-amber-500/10 p-3 text-sm text-amber-500">Escolha unidades da mesma categoria para comparar (massa, volume ou unidades).</p> : <div className={resultCard}><p className="text-xs font-bold text-slate-500">PREÇO POR {result.normalizedUnit.toUpperCase()}</p><div className="mt-2 grid grid-cols-2 gap-2"><div><p className="text-[10px] text-slate-500">Opção 1</p><p className={`font-black ${result.best === "a" ? "text-teal-500" : ""}`}>{fmt(result.perA)}/{result.normalizedUnit}</p></div><div><p className="text-[10px] text-slate-500">Opção 2</p><p className={`font-black ${result.best === "b" ? "text-teal-500" : ""}`}>{fmt(result.perB)}/{result.normalizedUnit}</p></div></div><p className="mt-2 text-xs font-bold text-teal-500">{result.best === "tie" ? "Mesmo custo por unidade" : `Opção ${result.best === "a" ? "1" : "2"} tem melhor custo`}</p></div>)}
      </div>}

      {tool === "compare" && <PriceCompareModal items={items} initialItem={null} onClose={() => setTool("calc")} embedded />}
    </div>
  );
  return <Modal title="Calculadora de compras" onClose={onClose}>{tabContent}</Modal>;
}
