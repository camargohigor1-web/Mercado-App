import { useBrowserBackClose } from "../hooks/useBrowserBackClose";
import { Icon } from "./Icon";

interface RightDrawerProps {
  open: boolean; onClose: () => void;
  tab: string; setTab: (t: string) => void;
  theme: string; setTheme: (t: string) => void;
}

const drawerTabs = [
  { id:"purchases", label:"Nova Compra",  icon:"cart",    desc:"Registre uma nova compra" },
  { id:"items",     label:"Produtos",     icon:"package", desc:"Cadastre e edite produtos" },
  { id:"markets",   label:"Mercados",     icon:"store",   desc:"Gerencie supermercados" },
  { id:"reports",   label:"Relatório",    icon:"chart",   desc:"Gráficos e estatísticas" },
  { id:"backup",    label:"Backup",       icon:"shield",  desc:"Exporte e importe dados" },
];

export function RightDrawer({ open, onClose, tab, setTab, theme, setTheme }: RightDrawerProps) {
  const isDark = theme === "dark";
  const closeDrawer = useBrowserBackClose(open, onClose);

  const bg     = isDark ? "bg-slate-950" : "bg-white";
  const border = isDark ? "border-white/5" : "border-black/8";

  return (
    <>
      {/* Overlay */}
      {open && (
        <div
          className="fixed inset-0 z-30 bg-black/60 backdrop-blur-sm animate-fade-in"
          onClick={closeDrawer}
        />
      )}

      {/* Drawer — slides from right */}
      <div className={`fixed top-0 right-0 h-full w-72 max-w-[85vw] z-40 ${bg} border-l ${border} shadow-2xl transition-transform duration-300 ease-in-out ${open ? "translate-x-0" : "translate-x-full"}`}>

        {/* Header */}
        <div className={`flex items-center justify-between px-5 pt-12 pb-4 border-b ${border}`}>
          <div>
            <p className="text-[9px] font-black text-teal-500 uppercase tracking-[0.22em]">MercadoApp</p>
            <p className={`text-sm font-black mt-0.5 ${isDark ? "text-slate-100" : "text-slate-900"}`}>Mais opções</p>
          </div>
          <button onClick={closeDrawer}
            className={`w-8 h-8 rounded-xl flex items-center justify-center transition-colors ${isDark ? "text-slate-500 hover:text-slate-300 hover:bg-white/5" : "text-slate-400 hover:text-slate-700 hover:bg-black/5"}`}>
            <Icon name="x" size={17} />
          </button>
        </div>

        {/* Nav items */}
        <div className="px-3 py-3 space-y-0.5">
          {drawerTabs.map(t => {
            const isActive = tab === t.id;
            return (
              <button key={t.id}
                onClick={() => { setTab(t.id); closeDrawer(); }}
                className={`w-full flex items-center gap-3 px-3 py-3.5 rounded-xl text-left transition-all ${
                  isActive
                    ? isDark ? "bg-teal-500/12 border border-teal-500/25" : "bg-teal-50 border border-teal-200/80"
                    : isDark ? "hover:bg-white/4 border border-transparent" : "hover:bg-black/3 border border-transparent"
                }`}>
                <div className={`w-9 h-9 rounded-xl flex items-center justify-center flex-shrink-0 transition-colors ${
                  isActive
                    ? isDark ? "bg-teal-500/20 text-teal-400" : "bg-teal-100 text-teal-700"
                    : isDark ? "bg-white/5 text-slate-500" : "bg-black/5 text-slate-500"
                }`}>
                  <Icon name={t.icon} size={16} />
                </div>
                <div className="min-w-0 flex-1">
                  <p className={`text-sm font-bold leading-tight ${isActive ? isDark ? "text-teal-400" : "text-teal-700" : isDark ? "text-slate-300" : "text-slate-700"}`}>
                    {t.label}
                  </p>
                  <p className={`text-[10px] mt-0.5 leading-tight ${isDark ? "text-slate-600" : "text-slate-400"}`}>{t.desc}</p>
                </div>
                {isActive && <div className="w-1.5 h-1.5 rounded-full bg-teal-400 flex-shrink-0" />}
              </button>
            );
          })}
        </div>

        {/* Theme toggle */}
        <div className={`mx-3 mt-2 pt-3 border-t ${border}`}>
          <p className={`text-[9px] font-black uppercase tracking-[0.2em] px-1 mb-2.5 ${isDark ? "text-slate-600" : "text-slate-400"}`}>
            Tema
          </p>
          <div className={`flex gap-2 p-1 rounded-xl ${isDark ? "bg-white/4" : "bg-black/4"}`}>
            {[
              { val:"dark",  icon:"moon", label:"Escuro" },
              { val:"light", icon:"sun",  label:"Claro"  },
            ].map(opt => (
              <button key={opt.val} onClick={() => setTheme(opt.val)}
                className={`flex-1 flex items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-bold transition-all ${
                  theme === opt.val
                    ? "bg-teal-500 text-white shadow-md shadow-teal-500/30"
                    : isDark ? "text-slate-500 hover:text-slate-300" : "text-slate-500 hover:text-slate-700"
                }`}>
                <Icon name={opt.icon} size={13} />{opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Version footer */}
        <div className="absolute bottom-8 left-0 right-0 px-5">
          <p className={`text-[10px] text-center ${isDark ? "text-slate-800" : "text-slate-300"}`}>
            MercadoApp · v1.0
          </p>
        </div>
      </div>
    </>
  );
}
