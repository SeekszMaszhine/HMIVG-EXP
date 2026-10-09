# Expedientes Digitales

Aplicación web para la gestión de expedientes clínicos digitales con base de
datos en la nube (Firebase Firestore), autenticación por correo/contraseña
(Firebase Authentication) y folio automático con formato `XX-XXXXX`.


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
