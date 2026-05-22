// src/services/firestoreService.ts
// ─── Firestore Service ────────────────────────────────────────────────────────
// Os dados ficam em: firestore → "groups" → "{groupId}" → "data"
// Assim cada grupo/família tem seus próprios dados isolados.

import {
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  type Unsubscribe,
} from "firebase/firestore";
import { db } from "../firebase";
import { GROUP_ID } from "../hooks/useAuth";

function getGroupDocRef() {
  return doc(db, "groups", GROUP_ID, "data", "shared");
}

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

// ─── Remove undefined recursivamente ─────────────────────────────────────────
// Firestore não aceita `undefined` em nenhum campo.
// Esta função converte undefined → null em toda a estrutura,
// garantindo que o dado seja válido antes de enviar.
function removeUndefined(value: any): any {
  if (value === undefined) return null;
  if (value === null) return null;
  if (Array.isArray(value)) return value.map(removeUndefined);
  if (typeof value === "object") {
    const cleaned: Record<string, any> = {};
    for (const key of Object.keys(value)) {
      cleaned[key] = removeUndefined(value[key]);
    }
    return cleaned;
  }
  return value;
}

export function subscribeToSharedData(
  callback: (data: SharedData | null) => void
): Unsubscribe {
  return onSnapshot(
    getGroupDocRef(),
    (snapshot) => {
      callback(snapshot.exists() ? (snapshot.data() as SharedData) : null);
    },
    (error) => {
      console.error("[Firestore] Erro no listener:", error);
    }
  );
}

export async function saveField(
  key: FirestoreDataKey,
  value: any
): Promise<void> {
  const cleanValue = removeUndefined(value);
  try {
    await setDoc(
      getGroupDocRef(),
      { [key]: cleanValue, _updatedAt: new Date().toISOString() },
      { merge: true }
    );
  } catch (err) {
    console.error("[firestore] saveField ERRO:", key, err);
  }
}

export async function getSharedData(): Promise<SharedData | null> {
  const snapshot = await getDoc(getGroupDocRef());
  return snapshot.exists() ? (snapshot.data() as SharedData) : null;
}

export async function saveAllData(data: SharedData): Promise<void> {
  const cleanData = removeUndefined(data);
  await setDoc(
    getGroupDocRef(),
    { ...cleanData, _updatedAt: new Date().toISOString() },
    { merge: false }
  );
}