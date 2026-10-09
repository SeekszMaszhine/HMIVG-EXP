
import { auth } from "./firebase-config.js";
import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

const $ = (s) => document.querySelector(s);

// ----- Proteger páginas privadas (captura / búsqueda) -----
export function requiereSesion() {
  onAuthStateChanged(auth, (user) => {
    if (!user) window.location.href = "login.html";
    else {
      const el = $("#userEmail");
      if (el) el.textContent = user.email;
    }
  });
}

// ----- Cerrar sesión -----
export function initLogout(btnId = "btnLogout") {
  const btn = document.getElementById(btnId);
  if (btn) btn.addEventListener("click", async () => {
    await signOut(auth);
    window.location.href = "login.html";
  });
}

// ----- Login -----
export function initLogin() {
  const form = $("#formLogin");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#msg");
    msg.className = "msg"; msg.textContent = "";
    try {
      await signInWithEmailAndPassword(auth, $("#email").value.trim(), $("#password").value);
      window.location.href = "captura.html";
    } catch (err) {
      msg.className = "msg error";
      msg.textContent = "Correo o contraseña incorrectos. Intenta de nuevo.";
    }
  });
}

// ----- Registro de capturistas -----
export function initRegistro() {
  const form = $("#formRegistro");
  if (!form) return;
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#msg");
    msg.className = "msg"; msg.textContent = "";
    const pass = $("#password").value;
    if (pass.length < 6) {
      msg.className = "msg error";
      msg.textContent = "La contraseña debe tener al menos 6 caracteres.";
      return;
    }
    try {
      await createUserWithEmailAndPassword(auth, $("#email").value.trim(), pass);
      msg.className = "msg ok";
      msg.textContent = "Cuenta creada. Redirigiendo…";
      setTimeout(() => window.location.href = "captura.html", 1200);
    } catch (err) {
      msg.className = "msg error";
      msg.textContent = err.code === "auth/email-already-in-use"
        ? "Este correo ya está registrado."
        : "No se pudo crear la cuenta: " + err.message;
    }
  });
}
