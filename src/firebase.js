// src/firebase.js
// ─── Firebase Initialization ──────────────────────────────────────────────────
// INSTRUÇÕES: Substitua os valores abaixo com as credenciais do seu projeto Firebase.
// Acesse: https://console.firebase.google.com → Seu projeto → Configurações → Apps

import { initializeApp } from "firebase/app";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey:            "AIzaSyA0kU_Tsi-1KnKgj49TP9flhVvcO1YzkI4",
  authDomain:        "mercadoapp-6cd6b.firebaseapp.com",
  projectId:         "mercadoapp-6cd6b",
  storageBucket:     "mercadoapp-6cd6b.firebasestorage.app",
  messagingSenderId: "701410190492",
  appId:             "1:701410190492:web:dce617b46f34fe28d2f959",
};

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app);
