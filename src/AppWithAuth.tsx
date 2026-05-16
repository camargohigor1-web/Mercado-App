// src/AppWithAuth.tsx
// ─── Wrapper de autenticação ──────────────────────────────────────────────────
// Envolve o App principal com a verificação de login.
// Se não estiver logado ou não tiver permissão, mostra a LoginScreen.

import { useAuth } from "./hooks/useAuth";
import { LoginScreen } from "./components/LoginScreen";
import App from "./App";

export default function AppWithAuth() {
  const authState = useAuth();

  if (authState.status === "loading") {
    return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center">
        <div className="w-8 h-8 rounded-full border-2 border-teal-500 border-t-transparent animate-spin" />
      </div>
    );
  }

  if (authState.status !== "authorized") {
    return <LoginScreen authState={authState} />;
  }

  return <App />;
}
