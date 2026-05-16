// src/components/SyncIndicator.tsx
// ─── Indicador de Sincronização ───────────────────────────────────────────────
// Componente opcional: exibe um indicador discreto do status de conexão.
// Use em App.tsx se quiser que os usuários vejam quando estão sincronizando.

import { useAppContext } from "../context/AppContext";

export function SyncIndicator() {
  const { syncStatus } = useAppContext();

  if (syncStatus === "idle") return null;

  const configs = {
    syncing: {
      label: "Sincronizando…",
      className: "bg-teal-500/15 text-teal-400 border border-teal-500/30",
      dot: "bg-teal-400 animate-pulse",
    },
    error: {
      label: "Erro de conexão",
      className: "bg-red-500/15 text-red-400 border border-red-500/30",
      dot: "bg-red-400",
    },
    offline: {
      label: "Sem conexão",
      className: "bg-amber-500/15 text-amber-400 border border-amber-500/30",
      dot: "bg-amber-400",
    },
  } as const;

  const config = configs[syncStatus as keyof typeof configs];
  if (!config) return null;

  return (
    <div
      className={`fixed bottom-24 right-4 z-50 flex items-center gap-2 px-3 py-1.5 rounded-xl text-[10px] font-bold shadow-xl animate-fade-slide-up ${config.className}`}
    >
      <div className={`w-1.5 h-1.5 rounded-full ${config.dot}`} />
      {config.label}
    </div>
  );
}
