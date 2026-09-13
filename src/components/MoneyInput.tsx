import { useState } from "react";
import { useTheme } from "../hooks/useTheme";
import { Icon } from "./Icon";
import { Modal, Btn } from "./ui";

// ─── MoneyInp ───────────────────────────────────────────────────────────────
// Campo de preço que usa o teclado numérico nativo do celular (inputMode="numeric",
// sem tecla de vírgula), mas formata o valor como dinheiro à medida que os dígitos
// são digitados — ex: digitar "1234" mostra "12,34", como numa maquininha de cartão.
// O valor entregue via onChange continua no formato "12.34" (ponto), igual ao
// contrato do <Inp type="number"> que ele substitui, então nada mais no app precisa mudar.
interface MoneyInpProps {
  label?: string;
  value: string; // formato "12.34" (ponto), pode ser ""
  onChange: (v: string) => void;
  placeholder?: string;
  className?: string;
  required?: boolean;
  onEnter?: () => void;
  inputRef?: React.RefObject<HTMLInputElement | null>;
}

function centsFromValue(value: string): number {
  const num = parseFloat(value);
  if (!value || isNaN(num)) return 0;
  return Math.round(num * 100);
}

function formatCents(cents: number): string {
  const intPart = Math.floor(cents / 100);
  const centPart = Math.abs(cents % 100);
  return `${intPart.toLocaleString("pt-BR")},${String(centPart).padStart(2, "0")}`;
}

export function MoneyInp({ label, value, onChange, placeholder, className = "", required, onEnter, inputRef }: MoneyInpProps) {
  const { isDark } = useTheme();
  const [calcOpen, setCalcOpen] = useState(false);
  const display = value === "" ? "" : formatCents(centsFromValue(value));

  function handleChange(raw: string) {
    const digitsOnly = raw.replace(/\D/g, "");
    if (digitsOnly === "") { onChange(""); return; }
    const cents = parseInt(digitsOnly, 10);
    onChange((cents / 100).toFixed(2));
  }

  return (
    <div className={`flex flex-col gap-1 ${className}`}>
      {label && <label className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{label}{required && <span className="text-red-400 ml-1">*</span>}</label>}
      <div className="relative">
        <input
          ref={inputRef} type="text" inputMode="numeric" pattern="[0-9]*" value={display}
          onChange={e => {
            const el = e.target;
            handleChange(el.value);
            requestAnimationFrame(() => el.setSelectionRange(el.value.length, el.value.length));
          }}
          placeholder={placeholder}
          onKeyDown={e => { if (e.key === "Enter" && onEnter) { e.preventDefault(); onEnter(); } }}
          className={`w-full pr-10 ${isDark ? "bg-slate-900 border-slate-700 text-slate-100 placeholder-slate-700" : "bg-white border-slate-300 text-slate-900 placeholder-slate-400"} border rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:border-teal-500 focus:ring-1 focus:ring-teal-500/40 transition-all`}
        />
        <button type="button" onClick={() => setCalcOpen(true)} tabIndex={-1}
          className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1.5 rounded-lg transition-colors ${isDark ? "text-slate-500 hover:text-teal-400 hover:bg-slate-800" : "text-slate-400 hover:text-teal-600 hover:bg-slate-100"}`}
          aria-label="Abrir calculadora">
          <Icon name="calculator" size={15} />
        </button>
      </div>
      {calcOpen && (
        <PriceCalculatorModal
          initialValue={value}
          onUse={(v) => { onChange(v); setCalcOpen(false); }}
          onClose={() => setCalcOpen(false)}
        />
      )}
    </div>
  );
}

// ─── Calculadora auxiliar ───────────────────────────────────────────────────
// Calculadora simples de 4 operações, para apoiar contas (ex: dividir um valor,
// somar dois preços) antes de usar o resultado no campo de preço.
const CALC_KEYS = [
  ["7", "8", "9", "÷"],
  ["4", "5", "6", "×"],
  ["1", "2", "3", "−"],
  ["0", ",", "=", "+"],
];

function PriceCalculatorModal({ initialValue, onUse, onClose }: { initialValue: string; onUse: (v: string) => void; onClose: () => void }) {
  const { isDark } = useTheme();
  const [display, setDisplay] = useState(initialValue ? formatCents(centsFromValue(initialValue)) : "0");
  const [stored, setStored] = useState<number | null>(null);
  const [pendingOp, setPendingOp] = useState<string | null>(null);
  const [freshEntry, setFreshEntry] = useState(true);

  function toNumber(s: string): number {
    return parseFloat(s.replace(/\./g, "").replace(",", ".")) || 0;
  }

  function pressDigit(d: string) {
    if (freshEntry) { setDisplay(d === "," ? "0," : d); setFreshEntry(false); return; }
    if (d === "," && display.includes(",")) return;
    setDisplay(prev => (prev === "0" && d !== "," ? d : prev + d));
  }

  function applyOp(a: number, op: string, b: number): number {
    if (op === "+") return a + b;
    if (op === "−") return a - b;
    if (op === "×") return a * b;
    if (op === "÷") return b !== 0 ? a / b : 0;
    return b;
  }

  function pressOperator(op: string) {
    const current = toNumber(display);
    if (op === "=") {
      if (stored !== null && pendingOp) {
        const result = applyOp(stored, pendingOp, current);
        setDisplay(result.toFixed(2).replace(".", ","));
        setStored(null); setPendingOp(null); setFreshEntry(true);
      }
      return;
    }
    setStored(stored !== null && pendingOp ? applyOp(stored, pendingOp, current) : current);
    setPendingOp(op);
    setFreshEntry(true);
  }

  function pressClear() { setDisplay("0"); setStored(null); setPendingOp(null); setFreshEntry(true); }
  function pressBackspace() { setDisplay(prev => (prev.length > 1 ? prev.slice(0, -1) : "0")); }

  return (
    <Modal title="Calculadora" onClose={onClose}>
      <div className="space-y-4">
        <div className={`rounded-xl px-4 py-4 text-right ${isDark ? "bg-slate-900" : "bg-slate-100"}`}>
          <p className={`text-3xl font-black tabular-nums ${isDark ? "text-slate-100" : "text-slate-900"}`}>{display}</p>
        </div>
        <div className="grid grid-cols-4 gap-2">
          <button onClick={pressClear} className={`py-3 rounded-xl text-sm font-bold ${isDark ? "bg-slate-800 text-red-400" : "bg-slate-200 text-red-500"}`}>C</button>
          <button onClick={pressBackspace} className={`py-3 rounded-xl text-sm font-bold ${isDark ? "bg-slate-800 text-slate-300" : "bg-slate-200 text-slate-700"}`}>⌫</button>
          <div className="col-span-2" />
          {CALC_KEYS.map((row, ri) => row.map((k, ci) => {
            const isOp = ["÷", "×", "−", "+", "="].includes(k);
            return (
              <button key={`${ri}-${ci}`}
                onClick={() => (isOp ? pressOperator(k) : pressDigit(k))}
                className={`py-3 rounded-xl text-base font-bold transition-colors ${
                  isOp
                    ? "bg-teal-500 text-white"
                    : isDark ? "bg-slate-900 text-slate-100 hover:bg-slate-800" : "bg-white border border-slate-200 text-slate-900 hover:bg-slate-50"
                }`}>
                {k}
              </button>
            );
          }))}
        </div>
        <Btn onClick={() => onUse(toNumber(display).toFixed(2))} className="w-full justify-center">Usar este valor</Btn>
      </div>
    </Modal>
  );
}
