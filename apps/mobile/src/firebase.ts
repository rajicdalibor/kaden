import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { initializeFirestore } from "firebase/firestore";

// Klijentski config (nije tajna — štite ga Firestore rules + App Check).
const firebaseConfig = {
  apiKey: "AIzaSyCVwCTbyTmMjeLZrmAIUvyx-WU_cVTVHsY",
  authDomain: "kaden-7b907.firebaseapp.com",
  projectId: "kaden-7b907",
  storageBucket: "kaden-7b907.firebasestorage.app",
  messagingSenderId: "933464988742",
  appId: "1:933464988742:web:4584b00feaa242b269be47",
};

export const app = initializeApp(firebaseConfig);

// firebase v12: RN persistence je automatska kad je async-storage instaliran.
export const auth = getAuth(app);

// Long polling — Firestore WebChannel zna da zapne u Expo Go / RN.
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
});
