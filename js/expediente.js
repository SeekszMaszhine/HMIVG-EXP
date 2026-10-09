
import { db } from "./firebase-config.js";
import {
  collection, addDoc, doc, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (s) => document.querySelector(s);

// ============================================================
//  NÚMERO DE EXPEDIENTE — formato XX-XXXXX
//  XX = últimos 2 dígitos del año actual
//  XXXXX = correlativo que inicia en 89000 (doc 'contadores/expediente')
//  Se asigna con TRANSACCIÓN atómica al guardar (sin duplicados)
// ============================================================
function prefijoAnio() {
  return String(new Date().getFullYear()).slice(-2);
}
export function formateaExpediente(n) {
  return `${prefijoAnio()}-${String(n).padStart(5, "0")}`;
}

async function siguienteExpediente() {
  const ref = doc(db, "contadores", "expediente");
  return await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const actual = snap.exists() ? snap.data().ultimo : 89000; // base: 89000
    const nuevo = actual + 1;
    tx.set(ref, { ultimo: nuevo }, { merge: true });
    return nuevo;
  });
}

// ============================================================
//  VALIDACIÓN AUTOMÁTICA DE CURP
//  Estructura oficial: 4 letras + 6 dígitos (fecha) + H/M +
//  5 caracteres (entidad + consonantes) + dígito/homoclave + dígito
//  NOTA: RENAPO no expone un API público; la verificación ante
//  RENAPO se realiza vía convenio/contrato con la SEGOB. Aquí se
//  valida estructura + coherencia automática (fecha y sexo deben
//  coincidir con los datos del paciente). El hook verificaCURP()
//  queda listo para conectar un Cloud Function con RENAPO real.
// ============================================================
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

function extraeFechaCURP(curp) {
  const yy = +curp.slice(4, 6), mm = +curp.slice(6, 8), dd = +curp.slice(8, 10);
  const hoy = new Date();
  const siglo = yy <= (+String(hoy.getFullYear()).slice(-2)) ? 2000 : 1900;
  return new Date(siglo + yy, mm - 1, dd);
}

export function validaCURP(curp, fechaNac, sexo) {
  if (!CURP_RE.test(curp))
    return { ok: false, motivo: "La CURP no cumple el formato oficial de 18 caracteres." };
  const f = extraeFechaCURP(curp);
  const nac = new Date(fechaNac + "T00:00:00");
  if (f.getTime() !== nac.getTime())
    return { ok: false, motivo: "La fecha de nacimiento de la CURP no coincide con la capturada." };
  const curpSexo = curp.charAt(10) === "H" ? "Masculino" : "Femenino";
  if (curpSexo !== sexo)
    return { ok: false, motivo: `El sexo de la CURP (${curpSexo}) no coincide con el capturado.` };
  return { ok: true };
}

// Hook opcional para verificación real contra RENAPO (servidor)
export async function verificaCURP() { /* conectar Cloud Function + convenio RENAPO */ }

// ============================================================
//  FORMULARIO DE CAPTURA
// ============================================================
export function initExpediente() {
  const form = $("#formExpediente");
  if (!form) return;

  const fNac = $("#fechaNacimiento");
  const fEdad = $("#edad");
  const curpInput = $("#curp");
  const curpHint = $("#curpHint");
  const codigoMater = $("input[name='codigoMater']");
  const numCaso = $("#numCasoMater");

  // --- Edad automática e inmodificable ---
  fNac.addEventListener("change", () => {
    if (!fNac.value) { fEdad.value = ""; return; }
    const n = new Date(fNac.value + "T00:00:00");
    const hoy = new Date();
    let e = hoy.getFullYear() - n.getFullYear();
    const m = hoy.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e--;
    fEdad.value = e >= 0 ? e + " años" : "";
    validaCurpEnVivo();
  });

  // --- Validación CURP en vivo ---
  function validaCurpEnVivo() {
    const curp = curpInput.value.trim().toUpperCase();
    curpInput.value = curp;
    curpHint.className = "hint";
    if (!fNac.value || !curp) { curpHint.textContent = ""; return true; }
    const sexo = $("input[name='sexo']:checked")?.value;
    if (!sexo) { curpHint.textContent = "Selecciona el sexo para validar la CURP."; curpHint.classList.add("error"); return false; }
    const v = validaCURP(curp, fNac.value, sexo);
    curpHint.textContent = v.ok ? "✓ CURP válida y coherente con los datos del paciente." : v.motivo;
    curpHint.classList.add(v.ok ? "ok" : "error");
    return v.ok;
  }
  curpInput.addEventListener("input", validaCurpEnVivo);
  document.querySelectorAll("input[name='sexo']").forEach(r => r.addEventListener("change", validaCurpEnVivo));

  // --- Código mater: mostrar/ocultar número de caso ---
  codigoMater.forEach(r => r.addEventListener("change", () => {
    const esMater = $("#materSi").checked;
    $("#campoCasoMater").style.display = esMater ? "block" : "none";
    numCaso.required = esMater;
    if (!esMater) numCaso.value = "";
  }));

  // --- Envío ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#msg");
    msg.className = "msg"; msg.textContent = "";

    if (!validaCurpEnVivo()) {
      msg.className = "msg error"; msg.textContent = "Corrige la CURP antes de guardar.";
      curpInput.focus(); return;
    }
    const guardar = $("#btnGuardar");
    guardar.disabled = true; guardar.textContent = "Guardando…";

    try {
      const correlativo = await siguienteExpediente();
      const numeroExpediente = formateaExpediente(correlativo);

      await addDoc(collection(db, "expedientes"), {
        numeroExpediente,
        nombre: $("#nombre").value.trim(),
        fechaNacimiento: fNac.value,
        edad: parseInt(fEdad.value) || 0,
        // Fecha/hora de apertura: automática (hora del servidor), NO editable
        fechaHoraApertura: serverTimestamp(),
        domicilio: $("#domicilio").value.trim(),
        fechaMovimiento: $("#fechaMovimiento").value || null,
        fechaIngreso: $("#fechaIngreso").value || null,
        fechaEgreso: $("#fechaEgreso").value || null,
        curp: curpInput.value.trim(),
        curpVerificada: true,
        carnetCitas: $("input[name='carnet']:checked").value,
        telefono: $("#telefono").value.trim(),
        sexo: $("input[name='sexo']:checked").value,
        codigoMater: $("#materSi").checked,
        numeroCasoMater: $("#materSi").checked ? numCaso.value.trim() : null,
        creadoPor: auth.currentUser?.email || null
      });

      msg.className = "msg ok";
      msg.innerHTML = `Expediente <b>${numeroExpediente}</b> guardado correctamente.`;
      form.reset();
      $("#campoCasoMater").style.display = "none";
      fEdad.value = ""; curpHint.textContent = "";
    } catch (err) {
      msg.className = "msg error";
      msg.textContent = "Error al guardar: " + err.message;
    } finally {
      guardar.disabled = false; guardar.textContent = "Guardar expediente";
    }
  });
}
