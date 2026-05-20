import type { Item, ItemStats, Purchase, WarehouseEntry, WarehouseItem } from "../types";

// ─── Storage ──────────────────────────────────────────────────────────────────
export const KEYS = {
  items:        "mkt3_items",
  markets:      "mkt3_markets",
  purchases:    "mkt3_purchases",
  shoppingList: "mkt3_list",
  warehouse:    "mkt3_warehouse",
  theme:        "mkt3_theme",
  categories:   "mkt3_categories",
};

export function load(key: string, fb: any): any {
  try {
    const v = localStorage.getItem(key);
    return v ? JSON.parse(v) : fb;
  } catch {
    return fb;
  }
}

export function save(key: string, val: any): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    window.dispatchEvent(new CustomEvent("storage-error", { detail: { key, error: e } }));
  }
}

// ─── Backup validation ────────────────────────────────────────────────────────
export interface BackupValidationResult {
  valid: boolean;
  errors: string[];
  data?: {
    items: any[];
    markets: any[];
    purchases: any[];
    shoppingList: any[];
    warehouse: any[];
    categories?: string[];
  };
}

export function validateBackup(raw: unknown): BackupValidationResult {
  const errors: string[] = [];

  if (!raw || typeof raw !== "object") {
    return { valid: false, errors: ["Arquivo inválido: não é um objeto JSON."] };
  }

  const data = raw as Record<string, unknown>;

  if (!Array.isArray(data.items))     errors.push("Campo 'items' ausente ou inválido.");
  if (!Array.isArray(data.markets))   errors.push("Campo 'markets' ausente ou inválido.");
  if (!Array.isArray(data.purchases)) errors.push("Campo 'purchases' ausente ou inválido.");

  if (errors.length) return { valid: false, errors };

  const items = data.items as any[];
  const markets = data.markets as any[];
  const purchases = data.purchases as any[];

  for (const item of items.slice(0, 5)) {
    if (!item.id || !item.name || !item.type) {
      errors.push("Alguns produtos estão com dados incompletos (id, name ou type ausente).");
      break;
    }
  }

  for (const market of markets.slice(0, 5)) {
    if (!market.id || !market.name) {
      errors.push("Alguns mercados estão com dados incompletos.");
      break;
    }
  }

  for (const purchase of purchases.slice(0, 5)) {
    if (!purchase.id || !purchase.date || !Array.isArray(purchase.lines)) {
      errors.push("Algumas compras estão com dados incompletos.");
      break;
    }
  }

  if (errors.length) return { valid: false, errors };

  return {
    valid: true,
    errors: [],
    data: {
      items,
      markets,
      purchases,
      shoppingList: Array.isArray(data.shoppingList) ? data.shoppingList : [],
      warehouse: Array.isArray(data.warehouse) ? data.warehouse : [],
      categories: Array.isArray(data.categories) ? data.categories : undefined,
    },
  };
}

// ─── Formatting ──────────────────────────────────────────────────────────────
export function uid(): string {
  return Math.random().toString(36).slice(2) + Date.now().toString(36);
}

export function fmt(n: number): string {
  return Number(n).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

export function fmtN(n: number, d = 2): string {
  return Number(n).toLocaleString("pt-BR", {
    minimumFractionDigits: d,
    maximumFractionDigits: d,
  });
}

// ─── Unit Scale System ────────────────────────────────────────────────────────
export const BULK_UNITS = ["kg", "L", "m", "un", "dz"];
export const PKG_UNITS = [
  "un", "g", "kg", "mL", "L", "m", "rolos", "folhas", "pares", "caps", "saches", "doses",
];

export const DEFAULT_CATEGORIES = [
  "Hortifruti", "Carnes e Aves", "Laticinios", "Padaria", "Bebidas",
  "Limpeza", "Higiene", "Mercearia", "Congelados", "Outro",
];

export const UNIT_SCALE_MAP: Record<string, { unit: string; factor: number }[]> = {
  kg: [{ unit: "kg", factor: 1 }, { unit: "g", factor: 1000 }],
  L:  [{ unit: "L", factor: 1 }, { unit: "mL", factor: 1000 }],
  m:  [{ unit: "m", factor: 1 }, { unit: "cm", factor: 100 }],
};

export function getScaleOptions(baseUnit: string): { unit: string; factor: number }[] {
  return UNIT_SCALE_MAP[baseUnit] || [{ unit: baseUnit, factor: 1 }];
}

export function getDisplayFactor(item: Item): number {
  if (!item || item.type !== "bulk") return 1;
  const options = getScaleOptions(item.unit!);
  const opt = options.find((o) => o.unit === item.displayUnit);
  return opt ? opt.factor : 1;
}

export function getDisplayUnit(item: Item): string {
  if (!item) return "";
  if (item.type !== "bulk") return item.pkgUnit || "un";
  return item.displayUnit || item.unit || "";
}

export function getWarehouseUnit(item: Item): string {
  if (!item) return "";
  if (item.type !== "bulk") return "emb";
  return item.displayUnit || item.unit || "";
}

// ─── Consumo por linha do tempo de eventos ────────────────────────────────────
//
// Monta uma sequência ordenada de eventos (compras e atualizações reais) e
// calcula o consumo real em cada intervalo entre eventos consecutivos.
//
// Regras:
//   - Compras somam ao estoque vigente (não resetam)
//   - Atualizações reais definem o estoque exato naquele momento
//   - No mesmo dia: compras vêm antes das atualizações
//   - Segmentos com consumo negativo (recontagem maior que esperado) são descartados
//   - Segmentos com menos de MIN_DAYS dias são descartados (muito curtos para ser confiáveis)
//   - A média final é ponderada pelos dias de cada segmento
//
// Retorna consumo médio mensal em unidade base (sem fator de escala aplicado).
// Retorna null se não houver segmentos válidos suficientes (usa fallback).

const MIN_SEGMENT_DAYS = 3;

interface TimelineEvent {
  date: string;       // "YYYY-MM-DD"
  order: number;      // 0 = compra, 1 = atualização (desempate no mesmo dia)
  type: "purchase" | "update";
  qty: number;        // para compra: quantidade comprada (base); para update: estoque real (base)
}

function daysBetween(dateA: string, dateB: string): number {
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.round(
    (new Date(dateB + "T12:00:00").getTime() - new Date(dateA + "T12:00:00").getTime()) / msPerDay
  );
}

export function calcAvgMonthlyFromTimeline(
  itemId: string,
  item: Item,
  purchases: Purchase[],
  warehouseEntries: WarehouseEntry[]
): number | null {
  // Monta eventos de compra para este produto (quantidade em unidade base)
  const events: TimelineEvent[] = [];

  purchases.forEach((p) => {
    p.lines.forEach((l) => {
      if (l.itemId !== itemId) return;
      // quantidade em unidade base (sem display factor)
      const qty = item.type === "bulk" ? (l.totalQty ?? 0) : l.numPkgs;
      if (qty > 0) {
        events.push({ date: p.date, order: 0, type: "purchase", qty });
      }
    });
  });

  // Monta eventos de atualização real (quantidade em unidade base)
  warehouseEntries.forEach((e) => {
    // realQty já está em unidade base no WarehouseEntry
    events.push({ date: e.date, order: 1, type: "update", qty: e.realQty });
  });

  if (events.filter(e => e.type === "update").length === 0) {
    // Sem nenhuma atualização real — não há dados para este método
    return null;
  }

  // Ordena por data e depois por order (compras antes de atualizações no mesmo dia)
  events.sort((a, b) => {
    const dateCmp = a.date.localeCompare(b.date);
    return dateCmp !== 0 ? dateCmp : a.order - b.order;
  });

  // Percorre a linha do tempo reconstituindo o estoque e coletando segmentos de consumo
  let currentStock = 0;
  let lastUpdateDate: string | null = null;
  let lastUpdateStock: number | null = null;

  const segments: { consumed: number; days: number }[] = [];

  for (const event of events) {
    if (event.type === "purchase") {
      currentStock += event.qty;
    } else {
      // É uma atualização real
      if (lastUpdateDate !== null && lastUpdateStock !== null) {
        // Temos um intervalo entre a última atualização e esta
        const days = daysBetween(lastUpdateDate, event.date);
        const consumed = lastUpdateStock - event.qty; // quanto foi consumido no intervalo

        if (days >= MIN_SEGMENT_DAYS && consumed > 0) {
          segments.push({ consumed, days });
        }
        // consumed < 0 significa recontagem maior (descartamos)
        // days < MIN_SEGMENT_DAYS é muito curto para ser confiável (descartamos)
      }

      // Atualiza referência para próxima iteração
      currentStock = event.qty;
      lastUpdateDate = event.date;
      lastUpdateStock = event.qty;
    }
  }

  if (segments.length === 0) return null;

  // Média ponderada por dias: consumo_diário = Σ(consumo_i) / Σ(dias_i)
  const totalConsumed = segments.reduce((sum, s) => sum + s.consumed, 0);
  const totalDays     = segments.reduce((sum, s) => sum + s.days, 0);
  const dailyRate     = totalConsumed / totalDays;

  return dailyRate * 30; // converte para mensal
}

// ─── Fallback: cálculo original por frequência de compra ─────────────────────
function calcAvgMonthlyFallback(
  itemId: string,
  item: Item,
  purchases: Purchase[]
): number {
  const byMonth: Record<string, number> = {};
  purchases.forEach((p) => {
    p.lines.forEach((l) => {
      if (l.itemId !== itemId) return;
      const qty = item.type === "bulk" ? (l.totalQty ?? 0) : l.numPkgs;
      const k = p.date.slice(0, 7);
      byMonth[k] = (byMonth[k] || 0) + qty;
    });
  });
  const monthValues = Object.values(byMonth);
  return monthValues.length
    ? monthValues.reduce((a, b) => a + b, 0) / monthValues.length
    : 0;
}

// ─── Stats Calculation ────────────────────────────────────────────────────────
export function calcStats(
  itemId: string,
  items: Item[],
  purchases: Purchase[],
  warehouseEntries: WarehouseEntry[]
): ItemStats | null {
  const item = items.find((i) => i.id === itemId);
  if (!item) return null;

  // Monta entradas de preço (igual à lógica original)
  const entries: any[] = [];
  purchases.forEach((p) => {
    p.lines.forEach((l) => {
      if (l.itemId !== itemId) return;
      if (item.type === "bulk") {
        entries.push({
          qty: l.totalQty,
          pricePerUnit: l.pricePerUnit,
          date: p.date,
          market: p.marketId,
          numPkgs: l.numPkgs,
          pkgQty: l.pkgQty,
          totalQty: l.totalQty,
          discountTotal: l.discountTotal,
          discountPerPkg: l.discountPerPkg,
          pricePerPkg: l.pricePerPkg,
          pricePerPkgAfterDiscount: l.pricePerPkgAfterDiscount,
          total: l.total,
          brand: l.brand,
        });
      } else {
        const effectivePricePerPkg = l.pricePerPkgAfterDiscount ?? l.pricePerPkg;
        const effectivePricePerInternal =
          l.discountTotal > 0
            ? effectivePricePerPkg / (item.pkgSize || 1)
            : l.pricePerInternal;
        entries.push({
          qty: l.numPkgs,
          pricePerPkg: effectivePricePerPkg,
          pricePerInternal: effectivePricePerInternal,
          date: p.date,
          market: p.marketId,
          numPkgs: l.numPkgs,
          discountTotal: l.discountTotal,
          discountPerPkg: l.discountPerPkg,
          pricePerPkgAfterDiscount: l.pricePerPkgAfterDiscount,
          total: l.total,
          brand: l.brand,
        });
      }
    });
  });

  // Calcula avgMonthly: tenta linha do tempo primeiro, usa fallback se necessário
  const timelineAvg = calcAvgMonthlyFromTimeline(itemId, item, purchases, warehouseEntries);
  const avgMonthly  = timelineAvg !== null
    ? timelineAvg
    : calcAvgMonthlyFallback(itemId, item, purchases);

  // Preços (igual à lógica original)
  if (item.type === "bulk") {
    const prices = entries.map((e: any) => e.pricePerUnit);
    if (!prices.length) return null;
    return {
      avgMonthly,
      count: entries.length,
      entries,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      minPrice: Math.min(...prices),
      lastPrice: prices[prices.length - 1],
    };
  } else {
    const pkgPrices = entries.map((e: any) => e.pricePerPkg);
    const intPrices = entries.map((e: any) => e.pricePerInternal).filter(Boolean);
    if (!pkgPrices.length) return null;
    return {
      avgMonthly,
      count: entries.length,
      entries,
      avgPrice: pkgPrices.reduce((a, b) => a + b, 0) / pkgPrices.length,
      minPrice: Math.min(...pkgPrices),
      lastPrice: pkgPrices[pkgPrices.length - 1],
      avgInternal: intPrices.length ? intPrices.reduce((a, b) => a + b, 0) / intPrices.length : null,
      minInternal: intPrices.length ? Math.min(...intPrices) : null,
      lastInternal: intPrices.length ? intPrices[intPrices.length - 1] : null,
    };
  }
}

// ─── Low Stock ────────────────────────────────────────────────────────────────
export interface LowStockItem {
  item: Item;
  warehouseItem: WarehouseItem;
  stock: number;
  avgMonthly: number;
  daysLeft: number;
  threshold: number;
  unit: string;
}

export function getLowStockItems(
  items: Item[],
  purchases: Purchase[],
  warehouse: WarehouseItem[]
): LowStockItem[] {
  return items
    .map(item => {
      const warehouseItem = warehouse.find(wh => wh.itemId === item.id);
      if (!warehouseItem) return null;

      const stats = calcStats(item.id, items, purchases, warehouseItem.entries || []);
      if (!stats || stats.avgMonthly <= 0) return null;

      const factor = item.type === "bulk" ? getDisplayFactor(item) : 1;
      const stock = (warehouseItem.stock || 0) * factor;
      const avgMonthly = stats.avgMonthly * factor;
      const daysLeft = Math.round((stock / avgMonthly) * 30);
      const threshold = item.alertDays ?? 15;

      if (threshold === 0) return null;
      if (daysLeft >= threshold) return null;

      return {
        item,
        warehouseItem,
        stock,
        avgMonthly,
        daysLeft,
        threshold,
        unit: getWarehouseUnit(item),
      };
    })
    .filter((entry): entry is LowStockItem => entry !== null)
    .sort((a, b) => a.daysLeft - b.daysLeft);
}

// ─── Price by Market ──────────────────────────────────────────────────────────
export function calcPriceByMarket(
  itemId: string,
  items: Item[],
  purchases: Purchase[],
  markets: { id: string; name: string }[]
): { marketName: string; avgPrice: number; count: number }[] {
  const item = items.find((i) => i.id === itemId);
  if (!item) return [];

  const byMarket: Record<string, number[]> = {};
  purchases.forEach((p) => {
    p.lines.forEach((l) => {
      if (l.itemId !== itemId) return;
      const mktName = markets.find((m) => m.id === p.marketId)?.name || "?";
      if (!byMarket[mktName]) byMarket[mktName] = [];
      if (item.type === "bulk") {
        byMarket[mktName].push(l.pricePerUnit || 0);
      } else {
        byMarket[mktName].push(l.pricePerPkgAfterDiscount ?? l.pricePerPkg);
      }
    });
  });

  return Object.entries(byMarket)
    .map(([marketName, prices]) => ({
      marketName,
      avgPrice: prices.reduce((a, b) => a + b, 0) / prices.length,
      count: prices.length,
    }))
    .sort((a, b) => a.avgPrice - b.avgPrice);
}
