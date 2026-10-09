# Hospital Central — Expedientes Digitales

Aplicación web para la gestión de expedientes clínicos digitales con base de
datos en la nube (Firebase Firestore), autenticación por correo/contraseña
(Firebase Authentication) y folio automático con formato `XX-XXXXX`.

## Estructura
```
hospital-app/
├── index.html      # Landing page
├── login.html      # Inicio de sesión (correo + contraseña)
├── registro.html   # Registro de capturistas
├── captura.html    # Formulario de expediente (requiere sesión)
├── buscar.html     # Búsqueda de expedientes (requiere sesión)
├── css/style.css
└── js/
    ├── firebase-config.js  # ⚠️ Pega aquí las credenciales de tu proyecto
    ├── auth.js             # Auth + protección de rutas
    ├── expediente.js       # Lógica de captura, folio y validación CURP
    └── buscar.js           # Búsqueda y detalle
```

## Configuración (pasos)
1. Crea un proyecto en [Firebase Console](https://console.firebase.google.com).
2. **Authentication → Sign-in method →** habilita **Correo electrónico/Contraseña**.
3. **Firestore Database →** crea una base de datos **(modo producción)**.
4. **Reglas de Firestore (prueba):**
   ```
   rules_version = '2';
   service cloud.firestore {
     match /databases/{database}/documents {
       match /{document=**} {
         allow read, write: if request.auth != null;
       }
     }
   }
   ```
5. En **Configuración del proyecto → Tus aplicaciones → Web**, copia el
   `firebaseConfig` y pégalo en `js/firebase-config.js`.
6. Sube la carpeta a cualquier hosting estático (Firebase Hosting, Netlify,
   Vercel, GitHub Pages) y abre `index.html`.

## Reglas de negocio implementadas
- **Folio `XX-XXXXX`:** últimos 2 dígitos del año + correlativo de 5 dígitos
  que **inicia en 89000** (contador atómico en `contadores/expediente`,
  asignado con transacción — sin duplicados).
- **Fecha/hora de apertura:** `serverTimestamp()` automática, no editable.
- **Edad:** se calcula sola desde la fecha de nacimiento (campo de solo lectura).
- **CURP:** validación automática de estructura (18 caracteres) y coherencia
  con fecha de nacimiento y sexo, en vivo mientras se escribe.
- **Sexo:** solo Masculino / Femenino.
- **Código mater:** al seleccionar "Sí" se exige el número de caso.
- **Búsqueda:** por folio exacto, nombre (prefijo) o CURP.

## Nota sobre RENAPO
RENAPO **no ofrece un API público**; la consulta directa requiere convenio/
contrato con la SEGOB y se implementa normalmente con una Cloud Function
backend. En `js/expediente.js` la función `verificaCURP()` queda como hook
listo para conectar esa verificación; la app ya valida formato y coherencia
automáticamente del lado del cliente.
