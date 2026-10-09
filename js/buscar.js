
import { db } from "./firebase-config.js";
import {
  collection, query, where, orderBy, startAt, endAt, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const fmt = (t) => t?.toDate ? t.toDate().toLocaleString("es-MX") : "—";
const fD = (t) => t?.toDate ? t.toDate().toLocaleDateString("es-MX") : "—";

export function initBusqueda() {
  const form = $("#formBuscar");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const criterio = $("#criterio").value;
    const valor = $("#busqueda").value.trim();
    const cont = $("#resultados");
    cont.innerHTML = "<p class='empty'>Buscando…</p>";

    let expedientes = [];

    try {
      if (criterio === "numero") {
        const q = query(collection(db, "expedientes"),
          where("numeroExpediente", "==", valor));
        expedientes = (await getDocs(q)).docs.map(d => d.data());
      } else if (criterio === "curp") {
        const q = query(collection(db, "expedientes"),
          where("curp", "==", valor.toUpperCase()));
        expedientes = (await getDocs(q)).docs.map(d => d.data());
      } else { // nombre (prefijo)
        const q = query(collection(db, "expedientes"),
          orderBy("nombreLower"), startAt(valor.toLowerCase()), endAt(valor.toLowerCase() + "\uf8ff"));
        expedientes = (await getDocs(q)).docs.map(d => d.data());
      }
    } catch (err) {
      cont.innerHTML = `<p class="empty">Error en la búsqueda: ${err.message}</p>`;
      return;
    }

    if (!expedientes.length) {
      cont.innerHTML = "<p class='empty'>No se encontraron expedientes con ese criterio.</p>";
      return;
    }

    cont.innerHTML = `
      <table>
        <thead><tr>
          <th>Expediente</th><th>Nombre</th><th>CURP</th><th>Sexo</th>
          <th>Código mater</th><th>Apertura</th><th></th>
        </tr></thead>
        <tbody>
          ${expedientes.map((x, i) => `
            <tr>
              <td><span class="tag tag-blue">${x.numeroExpediente}</span></td>
              <td>${x.nombre}</td>
              <td>${x.curp}</td>
              <td>${x.sexo === "Femenino" ? '<span class="tag tag-teal">F</span>' : '<span class="tag tag-gray">M</span>'}</td>
              <td>${x.codigoMater ? `<span class="tag tag-red">SÍ · ${x.numeroCasoMater || ""}</span>` : '<span class="tag tag-gray">No</span>'}</td>
              <td>${fmt(x.fechaHoraApertura)}</td>
              <td><button class="btn btn-outline btn-sm" data-i="${i}">Ver</button></td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    cont.querySelectorAll("button[data-i]").forEach(btn =>
      btn.addEventListener("click", () => mostrarDetalle(expedientes[+btn.dataset.i])));
  });
}

function mostrarDetalle(x) {
  const kv = (k, v) => `<div><span>${k}</span>${v ?? "—"}</div>`;
  $("#detalle").innerHTML = `
    ${kv("Número de expediente", `<b>${x.numeroExpediente}</b>`)}
    ${kv("Nombre", x.nombre)}
    ${kv("Fecha de nacimiento", fD(x.fechaHoraNac ? x.fechaHoraNac : null) || x.fechaNacimiento)}
    ${kv("Edad", x.edad + " años")}
    ${kv("Apertura del expediente", fmt(x.fechaHoraApertura))}
    ${kv("CURP", x.curp + (x.curpVerificada ? " ✓" : ""))}
    ${kv("Domicilio", x.domicilio)}
    ${kv("Fecha de movimiento", x.fechaMovimiento || "—")}
    ${kv("Fecha de ingreso", x.fechaIngreso || "—")}
    ${kv("Fecha de egreso", x.fechaEgreso || "—")}
    ${kv("Carnet de citas", x.carnetCitas)}
    ${kv("Teléfono", x.telefono)}
    ${kv("Sexo", x.sexo)}
    ${kv("Código mater", x.codigoMater ? `SÍ · Caso ${x.numeroCasoMater}` : "No")}
    ${kv("Registrado por", x.creadoPor)}
  `;
  $("#modal").classList.add("open");
}

export function initModal() {
  $("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal" || e.target.id === "btnCerrarModal")
      $("#modal").classList.remove("open");
  });
}
