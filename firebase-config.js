
// ============================================================
//  CONFIGURACIÓN FIREBASE — Reemplaza con los datos de tu proyecto
//  Firebase Console → Configuración del proyecto → " Tus aplicaciones"
// ============================================================
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

  // TODO: Add SDKs for Firebase products that you want to use
  // https://firebase.google.com/docs/web/setup#available-libraries

  // Your web app's Firebase configuration
  // For Firebase JS SDK v7.20.0 and later, measurementId is optional
  const firebaseConfig = {
    apiKey: "AIzaSyDAsro6Gh4Bb-bmEFG2z2Ocn1q17s2seuQ",
    authDomain: "exp-hmivg.firebaseapp.com",
    projectId: "exp-hmivg",
    storageBucket: "exp-hmivg.firebasestorage.app",
    messagingSenderId: "365135551030",
    appId: "1:365135551030:web:6fc22d1749bc08ef501697",
    measurementId: "G-VJ28BMFPG1"
  };

  // Initialize Firebase
export const app  = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db   = getFirestore(app);
