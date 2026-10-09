
import { db, auth } from "./firebase-config.js";
import {
  collection, addDoc, serverTimestamp, query, where, getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const $ = (s) => document.querySelector(s);
const FOLIO_RE = /^\d{2}-\d{5}$/;
const CURP_RE = /^[A-Z]{4}\d{6}[HM][A-Z]{5}[A-Z0-9]\d$/;

// Mapeo de encabezados (acepta variantes comunes)
const COLUMNAS = {
  numeroExpediente: ["expediente", "numero_expediente", "no_expediente", "folio"],
  nombre: ["nombre", "nombre_completo", "paciente"],
  fechaNacimiento: ["fecha_nacimiento", "nacimiento", "fecha_de_nacimiento"],
  sexo: ["sexo", "genero"],
  curp: ["curp"],
  domicilio: ["domicilio", "direccion"],
  telefono: ["telefono", "contacto", "numero_contacto"],
  carnetCitas: ["carnet_citas", "carnet"],
  fechaMovimiento: ["fecha_movimiento", "movimiento"],
  fechaIngreso: ["fecha_ingreso", "ingreso"],
  fechaEgreso: ["fecha_egreso", "egreso"],
  codigoMater: ["codigo_mater", "codigo_materno", "mater"],
  numeroCasoMater: ["numero_caso_mater", "caso_mater", "no_caso_mater"]
};

function normalizaEncabezados(row) {
  const out = {};
  for (const [k, aliases] of Object.entries(COLUMNAS)) {
    for (const a of aliases) {
      if (row[a] !== undefined) { out[k] = row[a]; break; }
    }
  }
  return out;
}

function excelDate(v) {
  if (v == null || v === "") return null;
  if (v instanceof Date) return v.toISOString().slice(0, 10);
  if (typeof v === "number") { // serial de Excel
    const d = XLSX.SSF.parse_date_code(v);
    if (d) return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  return String(v).trim().slice(0, 10);
}

function normalizaSexo(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["m", "masculino", "h", "hombre"].includes(s)) return "Masculino";
  if (["f", "femenino", "mujer"].includes(s)) return "Femenino";
  return null;
}

function normalizaSN(v) {
  const s = String(v || "").trim().toLowerCase();
  if (["sí", "si", "s", "yes", "1", "verdadero", "true"].includes(s)) return "Sí";
  if (["no", "n", "0", "falso", "false"].includes(s)) return "No";
  return null;
}

let filasListas = [];

export function initImportar() {
  // Plantilla CSV
  $("#btnPlantilla").addEventListener("click", () => {
    const encabezados = Object.values(COLUMNAS).map(c => c[0]).join(",");
    const blob = new Blob(["\uFEFF" + encabezados + "\n"], { type: "text/csv;charset=utf-8" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "plantilla_expedientes.csv";
    a.click();
  });

  // Lectura del archivo
  $("#archivo").addEventListener("change", async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    const msg = $("#msg"); msg.className = "msg"; msg.textContent = "";
    filasListas = [];
    try {
      const wb = XLSX.read(await file.arrayBuffer());
      const ws = wb.Sheets[wb.SheetNames[0]];
      const raw = XLSX.utils.sheet_to_json(ws, { defval: "" });
      if (!raw.length) throw new Error("El archivo no contiene filas de datos.");

      filasListas = raw.map((r, i) => {
        const x = normalizaEncabezados(r);
        const curp = String(x.curp || "").trim().toUpperCase();
        const sexo = normalizaSexo(x.sexo);
        const fNac = excelDate(x.fechaNacimiento);
        const errores = [];
        if (!x.numeroExpediente || !FOLIO_RE.test(String(x.numeroExpediente).trim()))
          errores.push("folio inválido");
        if (!x.nombre) errores.push("sin nombre");
        if (!sexo) errores.push("sexo inválido (use M/F)");
        if (curp && !CURP_RE.test(curp)) errores.push("CURP con formato incorrecto");
        if (curp && fNac && sexo) {
          const yy = +curp.slice(4, 6), mm = +curp.slice(6, 8), dd = +curp.slice(8, 10);
          const hoy = new Date();
          const siglo = yy <= (+String(hoy.getFullYear()).slice(-2)) ? 2000 : 1900;
          const fCurp = new Date(siglo + yy, mm - 1, dd);
          const fCap = new Date(fNac + "T00:00:00");
          if (fCurp.getTime() !== fCap.getTime()) errores.push("CURP no coincide con fecha de nacimiento");
          const sCurp = curp.charAt(10) === "H" ? "Masculino" : "Femenino";
          if (sCurp !== sexo) errores.push("CURP no coincide con el sexo");
        }
        return {
          fila: i + 2,
          ok: errores.length === 0,
          errores,
          datos: {
            numeroExpediente: String(x.numeroExpediente || "").trim(),
            nombre: String(x.nombre || "").trim(),
            nombreLower: String(x.nombre || "").trim().toLowerCase(),
            fechaNacimiento: fNac,
            edad: fNac ? calcEdad(fNac) : 0,
            sexo: sexo || String(x.sexo || "").trim(),
            curp,
            domicilio: String(x.domicilio || "").trim(),
            telefono: String(x.telefono || "").trim(),
            carnetCitas: normalizaSN(x.carnetCitas) || "No",
            fechaMovimiento: excelDate(x.fechaMovimiento),
            fechaIngreso: excelDate(x.fechaIngreso),
            fechaEgreso: excelDate(x.fechaEgreso),
            codigoMater: (normalizaSN(x.codigoMater) || "No") === "Sí",
            numeroCasoMater: x.codigoMater && String(x.numeroCasoMater || "").trim()
              ? String(x.numeroCasoMater).trim() : null
          }
        };
      });

      // Vista previa
      $("#preview").innerHTML = `
        <table>
          <thead><tr><th>Fila</th><th>Expediente</th><th>Nombre</th><th>Estado</th></tr></thead>
          <tbody>
            ${filasListas.map(f => `
              <tr>
                <td>${f.fila}</td>
                <td><span class="tag ${f.ok ? "tag-blue" : "tag-red"}">${f.datos.numeroExpediente || "—"}</span></td>
                <td>${f.datos.nombre || "—"}</td>
                <td>${f.ok ? '<span class="tag tag-teal">Válida</span>'
                            : `<span class="tag tag-red" title="${f.errores.join(", ")}">${f.errores.join(", ")}</span>`}</td>
              </tr>`).join("")}
          </tbody>
        </table>`;
      $("#accionesCarga").style.display = "flex";
      const validas = filasListas.filter(f => f.ok).length;
      msg.className = validas ? "msg ok" : "msg error";
      msg.textContent = validas
        ? `${validas} de ${filasListas.length} filas listas para cargar${validas < filasListas.length ? " (las inválidas se omitirán)" : ""}.`
        : "Ninguna fila es válida. Revisa la plantilla.";
    } catch (err) {
      $("#preview").innerHTML = "";
      $("#accionesCarga").style.display = "none";
      msg.className = "msg error";
      msg.textContent = "No se pudo leer el archivo: " + err.message;
    }
  });

  // Carga a Firestore (omite folios duplicados)
  $("#btnCargar").addEventListener("click", async () => {
    const msg = $("#msg");
    const btn = $("#btnCargar");
    btn.disabled = true; btn.textContent = "Cargando…";
    let cargados = 0, duplicados = 0, fallos = 0;

    for (const f of filasListas) {
      if (!f.ok) continue;
      try {
        const dup = await getDocs(query(collection(db, "expedientes"),
          where("numeroExpediente", "==", f.datos.numeroExpediente)));
        if (!dup.empty) { duplicados++; continue; }
        await addDoc(collection(db, "expedientes"), {
          ...f.datos,
          curpVerificada: true,
          fechaHoraApertura: serverTimestamp(),
          creadoPor: auth.currentUser?.email || null,
          origen: "importacion"
        });
        cargados++;
      } catch { fallos++; }
    }

    msg.className = cargados ? "msg ok" : "msg error";
    msg.innerHTML = `Carga terminada: <b>${cargados}</b> cargados · ` +
      `${duplicados} omitidos (folio duplicado) · ${fallos} con error.`;
    btn.disabled = false; btn.textContent = "Cargar expedientes";
  });
}

function calcEdad(fNac) {
  const n = new Date(fNac + "T00:00:00");
  const hoy = new Date();
  let e = hoy.getFullYear() - n.getFullYear();
  const m = hoy.getMonth() - n.getMonth();
  if (m < 0 || (m === 0 && hoy.getDate() < n.getDate())) e--;
  return e >= 0 ? e : 0;
}
