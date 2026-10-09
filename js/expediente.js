
import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, doc, updateDoc, serverTimestamp, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const FOLIO_RE = /^\d{2}-\d{5}$/;

// ============================================================
//  NÚMERO DE EXPEDIENTE — ahora lo ASIGNA EL CAPTURISTA
//  Formato obligatorio: XX-XXXXX
// ============================================================
function folioValido(f) { return FOLIO_RE.test(f.trim()); }

async function folioDuplicado(folio, excluirId = null) {
  const q = query(collection(db, "expedientes"),
    where("numeroExpediente", "==", folio.trim()));
  const snap = await getDocs(q);
  if (excluirId) return snap.docs.some(d => d.id !== excluirId);
  return !snap.empty;
}

// ============================================================
//  VALIDACIÓN AUTOMÁTICA DE CURP (estructura + coherencia)
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

export async function verificaCURP() { /* hook para Cloud Function + RENAPO */ }

// ============================================================
//  CAPTURA / EDICIÓN DE EXPEDIENTE
//  Modo edición: captura.html?id=<docId> (se carga el expediente
//  consultado y se actualiza con updateDoc)
// ============================================================
let editId = null;

export async function initExpediente() {
  const form = $("#formExpediente");
  if (!form) return;

  const fNac = $("#fechaNacimiento");
  const fEdad = $("#edad");
  const curpInput = $("#curp");
  const curpHint = $("#curpHint");
  const folioInput = $("#folio");
  const folioHint = $("#folioHint");
  const numCaso = $("#numCasoMater");
  const titulo = $("#tituloPagina");
  const sub = $("#subPagina");

  // --- ¿Modo edición? ---
  editId = new URLSearchParams(location.search).get("id");
  if (editId) {
    titulo.textContent = "Editar expediente";
    sub.textContent = `Folio ${editId ? "cargado" : ""} · los cambios se guardan sobre el expediente consultado.`;
    await cargarExpediente(editId, form);
  }

  // --- Folio: validar formato y duplicado en vivo ---
  async function validaFolio() {
    const f = folioInput.value.trim();
    folioHint.className = "hint";
    if (!f) { folioHint.textContent = ""; return false; }
    if (!folioValido(f)) {
      folioHint.textContent = "Formato requerido: XX-XXXXX (ej. 26-89001).";
      folioHint.classList.add("error");
      return false;
    }
    const dup = await folioDuplicado(f, editId);
    if (dup) {
      folioHint.textContent = "⚠ Este número de expediente ya existe en la base de datos.";
      folioHint.classList.add("error");
      return false;
    }
    folioHint.textContent = "✓ Folio disponible.";
    folioHint.classList.add("ok");
    return true;
  }
  folioInput.addEventListener("input", validaFolio);

  // --- Edad automática e inmodificable ---
  fNac.addEventListener("change", () => {
    if (!fNac.value) { fEdad.value = ""; return; }
    const n = new Date(fNac.value + "T00:00:00");
    const hoy = new Date();
    let e = hoy.getFullYear() - n.getFullYear();
    const m = hoy.getMonth() - n.getMonth();
    if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e--;
    fEdad.value = e >= 0 ? e : "";
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

  // --- Código mater: habilita campo OPCIONAL de número de caso ---
  document.querySelectorAll("input[name='codigoMater']").forEach(r =>
    r.addEventListener("change", () => {
      const esMater = $("#materSi").checked;
      $("#campoCasoMater").style.display = esMater ? "block" : "none";
      numCaso.required = false; // <-- OPCIONAL
      if (!esMater) numCaso.value = "";
    }));

  // --- Envío: crear o actualizar ---
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const msg = $("#msg");
    msg.className = "msg"; msg.textContent = "";

    if (!folioValido(folioInput.value)) {
      msg.className = "msg error"; msg.textContent = "Ingresa un folio válido con formato XX-XXXXX.";
      folioInput.focus(); return;
    }
    if (await folioDuplicado(folioInput.value, editId)) {
      msg.className = "msg error"; msg.textContent = "El número de expediente ya existe. Usa uno diferente.";
      folioInput.focus(); return;
    }
    if (!validaCurpEnVivo()) {
      msg.className = "msg error"; msg.textContent = "Corrige la CURP antes de guardar.";
      curpInput.focus(); return;
    }

    const guardar = $("#btnGuardar");
    guardar.disabled = true;
    guardar.textContent = editId ? "Actualizando…" : "Guardando…";

    const datos = {
      numeroExpediente: folioInput.value.trim(),
      nombre: $("#nombre").value.trim(),
      nombreLower: $("#nombre").value.trim().toLowerCase(),
      fechaNacimiento: fNac.value,
      edad: parseInt(fEdad.value) || 0,
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
      numeroCasoMater: $("#materSi").checked && numCaso.value.trim() ? numCaso.value.trim() : null,
      ultimaEdicionPor: auth.currentUser?.email || null,
      fechaUltimaEdicion: serverTimestamp()
    };

    try {
      if (editId) {
        await updateDoc(doc(db, "expedientes", editId), datos);
        msg.className = "msg ok";
        msg.innerHTML = `Expediente <b>${datos.numeroExpediente}</b> actualizado correctamente.`;
      } else {
        datos.fechaHoraApertura = serverTimestamp(); // automática e inmodificable
        datos.creadoPor = auth.currentUser?.email || null;
        await addDoc(collection(db, "expedientes"), datos);
        msg.className = "msg ok";
        msg.innerHTML = `Expediente <b>${datos.numeroExpediente}</b> guardado correctamente.`;
        form.reset();
        $("#campoCasoMater").style.display = "none";
        fEdad.value = ""; curpHint.textContent = ""; folioHint.textContent = "";
      }
    } catch (err) {
      msg.className = "msg error";
      msg.textContent = "Error al guardar: " + err.message;
    } finally {
      guardar.disabled = false;
      guardar.textContent = editId ? "Actualizar expediente" : "Guardar expediente";
    }
  });
}

async function cargarExpediente(id, form) {
  const { getDoc } = await import("https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js");
  const snap = await getDoc(doc(db, "expedientes", id));
  if (!snap.exists()) {
    $("#msg").className = "msg error";
    $("#msg").textContent = "No se encontró el expediente solicitado.";
    return;
  }
  const x = snap.data();
  const val = (idSel, v) => { if (v != null) $(idSel).value = v; };
  val("#folio", x.numeroExpediente);
  val("#nombre", x.nombre);
  val("#fechaNacimiento", x.fechaNacimiento);
  val("#domicilio", x.domicilio);
  val("#telefono", x.telefono);
  val("#curp", x.curp);
  val("#fechaMovimiento", x.fechaMovimiento);
  val("#fechaIngreso", x.fechaIngreso);
  val("#fechaEgreso", x.fechaEgreso);
  if (x.fechaNacimiento) $("#fechaNacimiento").dispatchEvent(new Event("change"));
  if (x.sexo) $(`input[name='sexo'][value='${x.sexo}']`).checked = true;
  if (x.carnetCitas) $(`input[name='carnet'][value='${x.carnetCitas}']`).checked = true;
  if (x.codigoMater) {
    $("#materSi").checked = true;
    $("#campoCasoMater").style.display = "block";
    val("#numCasoMater", x.numeroCasoMater);
  }
  $("#btnGuardar").textContent = "Actualizar expediente";
}
