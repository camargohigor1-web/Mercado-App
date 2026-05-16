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
  await setDoc(
    getGroupDocRef(),
    { [key]: value, _updatedAt: new Date().toISOString() },
    { merge: true }
  );
}

export async function getSharedData(): Promise<SharedData | null> {
  const snapshot = await getDoc(getGroupDocRef());
  return snapshot.exists() ? (snapshot.data() as SharedData) : null;
}

export async function saveAllData(data: SharedData): Promise<void> {
  await setDoc(
    getGroupDocRef(),
    { ...data, _updatedAt: new Date().toISOString() },
    { merge: false }
  );
}
