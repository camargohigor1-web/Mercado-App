// src/services/firestoreService.ts
// ─── Firestore Service ────────────────────────────────────────────────────────
// Encapsula toda lógica de leitura/escrita no Firestore.
// Cada "collection" representa um array de dados do app.
// Os dados de TODOS os usuários compartilham o mesmo documento raiz: "shared/data".

import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";

// ─── Configuração do documento compartilhado ──────────────────────────────────
// Todos os usuários lêem/escrevem no mesmo documento.
// Estrutura: firestore → "shared" (collection) → "data" (document)
const SHARED_DOC_REF = doc(db, "shared", "data");

// ─── Tipos ───────────────────────────────────────────────────────────────────
export type FirestoreDataKey =
  | "items"
  | "markets"
  | "purchases"
  | "shoppingList"
  | "warehouse"
  | "categories"
  | "theme";

export interface SharedData {
  items?: any[];
  markets?: any[];
  purchases?: any[];
  shoppingList?: any[];
  warehouse?: any[];
  categories?: string[];
  theme?: string;
  _updatedAt?: string;
}

// ─── Listener em tempo real ───────────────────────────────────────────────────
// Retorna uma função de cleanup (unsubscribe).
export function subscribeToSharedData(
  callback: (data: SharedData | null) => void
): Unsubscribe {
  return onSnapshot(
    SHARED_DOC_REF,
    (snapshot) => {
      if (snapshot.exists()) {
        callback(snapshot.data() as SharedData);
      } else {
        // Documento não existe ainda — primeiro uso
        callback(null);
      }
    },
    (error) => {
      console.error("[Firestore] Erro no listener:", error);
      // Não chama callback em caso de erro para não limpar dados locais
    }
  );
}

// ─── Escrita de um campo específico ──────────────────────────────────────────
// Usa setDoc com merge:true para não sobrescrever os outros campos.
export async function saveField(
  key: FirestoreDataKey,
  value: any
): Promise<void> {
  try {
    await setDoc(
      SHARED_DOC_REF,
      {
        [key]: value,
        _updatedAt: new Date().toISOString(),
      },
      { merge: true }
    );
  } catch (error) {
    console.error(`[Firestore] Erro ao salvar campo '${key}':`, error);
    throw error;
  }
}

// ─── Leitura única (sem listener) ────────────────────────────────────────────
// Usado apenas na inicialização como fallback.
export async function getSharedData(): Promise<SharedData | null> {
  try {
    const snapshot = await getDoc(SHARED_DOC_REF);
    if (snapshot.exists()) {
      return snapshot.data() as SharedData;
    }
    return null;
  } catch (error) {
    console.error("[Firestore] Erro ao ler dados:", error);
    return null;
  }
}

// ─── Escrita completa (usado no restore/backup) ───────────────────────────────
export async function saveAllData(data: SharedData): Promise<void> {
  try {
    await setDoc(
      SHARED_DOC_REF,
      {
        ...data,
        _updatedAt: new Date().toISOString(),
      },
      { merge: false } // sobrescreve tudo
    );
  } catch (error) {
    console.error("[Firestore] Erro ao salvar todos os dados:", error);
    throw error;
  }
}
