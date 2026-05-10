import { useEffect, useState } from "react";

interface SplashScreenProps {
  onDone: () => void;
}

export function SplashScreen({ onDone }: SplashScreenProps) {
  const [phase, setPhase] = useState<"in" | "hold" | "out">("in");

  useEffect(() => {
    const t1 = setTimeout(() => setPhase("hold"), 400);
    const t2 = setTimeout(() => setPhase("out"), 1600);
    const t3 = setTimeout(() => onDone(), 2050);
    return () => { clearTimeout(t1); clearTimeout(t2); clearTimeout(t3); };
  }, [onDone]);

  const isIn  = phase === "in";
  const isOut = phase === "out";

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col items-center justify-center overflow-hidden"
      style={{
        background: "linear-gradient(160deg,#0f766e 0%,#0d9488 45%,#0891b2 100%)",
        opacity: isOut ? 0 : 1,
        transition: isOut ? "opacity 450ms cubic-bezier(0.4,0,1,1)" : "none",
        pointerEvents: isOut ? "none" : "all",
      }}
    >
      {/* Decorative rings */}
      <div className="absolute rounded-full border border-white/5"
        style={{ width:480,height:480, opacity:isIn?0:1, transform:isIn?"scale(0.75)":"scale(1)", transition:"all 900ms cubic-bezier(0.22,1,0.36,1) 100ms" }} />
      <div className="absolute rounded-full border border-white/8"
        style={{ width:340,height:340, opacity:isIn?0:1, transform:isIn?"scale(0.75)":"scale(1)", transition:"all 900ms cubic-bezier(0.22,1,0.36,1) 200ms" }} />

      {/* Content */}
      <div className="flex flex-col items-center gap-6 relative z-10"
        style={{
          opacity: isIn?0:1,
          transform: isIn?"scale(0.85) translateY(16px)":"scale(1) translateY(0)",
          transition:"all 550ms cubic-bezier(0.22,1,0.36,1)",
        }}
      >
        <div className="w-24 h-24 rounded-[26px] flex items-center justify-center"
          style={{
            background:"rgba(255,255,255,0.15)",
            backdropFilter:"blur(12px)",
            border:"1px solid rgba(255,255,255,0.25)",
            boxShadow:"0 24px 48px rgba(0,0,0,0.25),inset 0 1px 0 rgba(255,255,255,0.3)",
          }}
        >
          <svg viewBox="0 0 64 64" width="52" height="52">
            <path d="M10 18h5l6 20h20l5-14H22" stroke="white" strokeWidth="2.8" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            <circle cx="29" cy="42" r="2.8" fill="white"/>
            <circle cx="42" cy="42" r="2.8" fill="white"/>
            <circle cx="48" cy="16" r="11" fill="rgba(255,255,255,0.18)"/>
            <path d="M48 11v10M43 16h10" stroke="white" strokeWidth="2.8" strokeLinecap="round"/>
          </svg>
        </div>
        <div className="text-center space-y-1.5">
          <p className="text-white font-black text-[26px] tracking-tight leading-none"
            style={{ textShadow:"0 2px 12px rgba(0,0,0,0.15)" }}>
            MercadoApp
          </p>
          <p className="text-white/60 text-sm font-medium tracking-wide">
            Suas compras sob controle
          </p>
        </div>
      </div>

      {/* Progress bar */}
      <div className="absolute bottom-0 left-0 right-0 h-0.5 bg-white/10"
        style={{ opacity:isIn?0:1, transition:"opacity 300ms ease 500ms" }}>
        <div className="h-full bg-white/40 rounded-full"
          style={{
            width: isOut?"100%": isIn?"0%":"70%",
            transition: isIn?"none": isOut?"width 450ms cubic-bezier(0.4,0,1,1)":"width 1200ms cubic-bezier(0.4,0,0.2,1)",
          }} />
      </div>
    </div>
  );
}
