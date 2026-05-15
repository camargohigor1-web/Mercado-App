import { useContext } from "react";
import { ThemeCtx } from "../hooks/useTheme";
import { Icon } from "./Icon";
import type { ToastType } from "../hooks/useToast";

interface ToastItem {
  id: string;
  type: ToastType;
  message: string;
}

interface ToastContainerProps {
  toasts: ToastItem[];
  onDismiss: (id: string) => void;
}

const ICONS: Record<ToastType, string> = {
  success: "check",
  error: "warn",
  info: "info",
  warning: "warn",
};

const COLORS: Record<ToastType, string> = {
  success: "bg-teal-500 text-white shadow-teal-500/30",
  error: "bg-red-500 text-white shadow-red-500/30",
  info: "bg-blue-500 text-white shadow-blue-500/30",
  warning: "bg-amber-500 text-white shadow-amber-500/30",
};

export function ToastContainer({ toasts, onDismiss }: ToastContainerProps) {
  if (!toasts.length) return null;

  return (
    <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] flex flex-col gap-2 w-full max-w-sm px-4 pointer-events-none">
      {toasts.map(toast => (
        <div
          key={toast.id}
          className={`${COLORS[toast.type]} flex items-center gap-3 px-4 py-3 rounded-2xl shadow-xl animate-fade-slide-up pointer-events-auto`}
          style={{ paddingTop: "max(12px, env(safe-area-inset-top, 12px))" }}
          onClick={() => onDismiss(toast.id)}
        >
          <Icon name={ICONS[toast.type]} size={16} />
          <p className="text-sm font-bold flex-1 leading-tight">{toast.message}</p>
        </div>
      ))}
    </div>
  );
}
