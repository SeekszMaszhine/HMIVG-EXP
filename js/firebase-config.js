
// ============================================================
//  CONFIGURACIÓN FIREBASE — Reemplaza con los datos de tu proyecto
//  Firebase Console → Configuración del proyecto → " Tus aplicaciones"
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// For Firebase JS SDK v7.20.0 and later, measurementId is optional
const firebaseConfig = {
  apiKey: "AIzaSyArgUCa4QAeHbYzHgaENbyWFM9odcqybss",
  authDomain: "hmivg-exp.firebaseapp.com",
  projectId: "hmivg-exp",
  storageBucket: "hmivg-exp.firebasestorage.app",
  messagingSenderId: "211313053248",
  appId: "1:211313053248:web:27cb8bd40e2596b92659a5",
  measurementId: "G-97V16MYXBJ"
};

export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
