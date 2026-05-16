// src/hooks/useAuth.ts
// ─── Hook de Autenticação ─────────────────────────────────────────────────────
// Gerencia login Google, estado do usuário e verificação de acesso ao grupo.
//
// Conceito de "grupo":
//   - Os dados ficam em: firestore → "groups" → "{GROUP_ID}" → "data"
//   - GROUP_ID é fixo e definido abaixo (uma string única para sua família)
//   - Qualquer usuário cujo e-mail esteja na lista ALLOWED_EMAILS pode acessar
//   - Basta adicionar o e-mail de um novo membro à lista e ele terá acesso

import { useState, useEffect } from "react";
import {
  signInWithPopup,
  signOut as firebaseSignOut,
  onAuthStateChanged,
  type User,
} from "firebase/auth";
import { auth, provider } from "../firebase";

// ─── CONFIGURAÇÃO — edite estes valores ──────────────────────────────────────

// ID único do seu grupo familiar.
// Pode ser qualquer string. Gere uma em: https://www.uuidgenerator.net/
// Exemplo: "familia-silva-2024"
export const GROUP_ID = "Camargo";

// E-mails com permissão de acesso (em minúsculas).
// Adicione quantos quiser.
export const ALLOWED_EMAILS: string[] = [
  "camargohigor1@gmail.com",
  "darciekelly8@gmail.com",
  // adicione mais e-mails aqui
];

// ─────────────────────────────────────────────────────────────────────────────

export type AuthStatus = "loading" | "unauthenticated" | "unauthorized" | "authorized";

export interface AuthState {
  user: User | null;
  status: AuthStatus;
  signIn: () => Promise<void>;
  signOut: () => Promise<void>;
}

export function useAuth(): AuthState {
  const [user, setUser]     = useState<User | null>(null);
  const [status, setStatus] = useState<AuthStatus>("loading");

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (firebaseUser) => {
      if (!firebaseUser) {
        setUser(null);
        setStatus("unauthenticated");
        return;
      }

      const email = firebaseUser.email?.toLowerCase() ?? "";
      const allowed = ALLOWED_EMAILS.map(e => e.toLowerCase());

      if (allowed.length === 0 || allowed.includes(email)) {
        // Lista vazia = aceita qualquer um autenticado (útil no início)
        setUser(firebaseUser);
        setStatus("authorized");
      } else {
        setUser(firebaseUser);
        setStatus("unauthorized");
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async () => {
    try {
      await signInWithPopup(auth, provider);
    } catch (err) {
      console.error("[Auth] Erro ao fazer login:", err);
    }
  };

  const signOut = async () => {
    try {
      await firebaseSignOut(auth);
    } catch (err) {
      console.error("[Auth] Erro ao fazer logout:", err);
    }
  };

  return { user, status, signIn, signOut };
}
