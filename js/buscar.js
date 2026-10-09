
import { db } from "./firebase-config.js";
import {
  collection, query, where, orderBy, startAt, endAt, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const fmt = (t) => t?.toDate ? t.toDate().toLocaleString("es-MX") : "—";

export function initBusqueda() {
  const form = $("#formBuscar");
  if (!form) return;

  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const criterio = $("#criterio").value;
    const valor = $("#busqueda").value.trim();
    const cont = $("#resultados");
    cont.innerHTML = "<p class='empty'>Buscando…</p>";

    let docs = [];

    try {
      let q;
      if (criterio === "numero") {
        q = query(collection(db, "expedientes"), where("numeroExpediente", "==", valor));
      } else if (criterio === "curp") {
        q = query(collection(db, "expedientes"), where("curp", "==", valor.toUpperCase()));
      } else {
        q = query(collection(db, "expedientes"),
          orderBy("nombreLower"), startAt(valor.toLowerCase()), endAt(valor.toLowerCase() + "\uf8ff"));
      }
      docs = (await getDocs(q)).docs.map(d => ({ id: d.id, ...d.data() }));
    } catch (err) {
      cont.innerHTML = `<p class="empty">Error en la búsqueda: ${err.message}</p>`;
      return;
    }

    if (!docs.length) {
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
          ${docs.map((x, i) => `
            <tr>
              <td><span class="tag tag-blue">${x.numeroExpediente}</span></td>
              <td>${x.nombre}</td>
              <td>${x.curp}</td>
              <td>${x.sexo === "Femenino" ? '<span class="tag tag-teal">F</span>' : '<span class="tag tag-gray">M</span>'}</td>
              <td>${x.codigoMater ? `<span class="tag tag-red">SÍ${x.numeroCasoMater ? " · " + x.numeroCasoMater : ""}</span>` : '<span class="tag tag-gray">No</span>'}</td>
              <td>${fmt(x.fechaHoraApertura)}</td>
              <td style="white-space:nowrap">
                <button class="btn btn-outline btn-sm" data-ver="${i}">Ver</button>
                <button class="btn btn-primary btn-sm" data-edit="${x.id}">Editar</button>
              </td>
            </tr>`).join("")}
        </tbody>
      </table>`;

    cont.querySelectorAll("button[data-ver]").forEach(btn =>
      btn.addEventListener("click", () => mostrarDetalle(docs[+btn.dataset.ver])));
    cont.querySelectorAll("button[data-edit]").forEach(btn =>
      btn.addEventListener("click", () => {
        window.location.href = `captura.html?id=${btn.dataset.edit}`;
      }));
  });
}

function mostrarDetalle(x) {
  const kv = (k, v) => `<div><span>${k}</span>${v ?? "—"}</div>`;
  $("#detalle").innerHTML = `
    ${kv("Número de expediente", `<b>${x.numeroExpediente}</b>`)}
    ${kv("Nombre", x.nombre)}
    ${kv("Fecha de nacimiento", x.fechaNacimiento)}
    ${kv("Edad", (x.edad ?? "—") + (x.edad != null ? " años" : ""))}
    ${kv("Apertura del expediente", fmt(x.fechaHoraApertura))}
    ${kv("CURP", x.curp + (x.curpVerificada ? " ✓" : ""))}
    ${kv("Domicilio", x.domicilio)}
    ${kv("Fecha de movimiento", x.fechaMovimiento || "—")}
    ${kv("Fecha de ingreso", x.fechaIngreso || "—")}
    ${kv("Fecha de egreso", x.fechaEgreso || "—")}
    ${kv("Carnet de citas", x.carnetCitas)}
    ${kv("Teléfono", x.telefono)}
    ${kv("Sexo", x.sexo)}
    ${kv("Código mater", x.codigoMater ? `SÍ${x.numeroCasoMater ? " · Caso " + x.numeroCasoMater : " · sin número de caso"}` : "No")}
    ${kv("Registrado por", x.creadoPor)}
    ${kv("Última edición", x.ultimaEdicionPor ? `${x.ultimaEdicionPor} · ${fmt(x.fechaUltimaEdicion)}` : "—")}
  `;
  $("#modal").classList.add("open");
}

export function initModal() {
  $("#modal").addEventListener("click", (e) => {
    if (e.target.id === "modal" || e.target.id === "btnCerrarModal")
      $("#modal").classList.remove("open");
  });
}
