# Checklist de seguridad, privacidad y operación

Estado al 09-11-2026. `[x]` significa comprobación acotada de este cierre; `[ ]` identifica trabajo pendiente o requisito para ampliar la operación. No es una certificación ni una auditoría integral de ciberseguridad. Solo está habilitada la demostración local con datos ficticios.

## Código y distribución

- [x] Referencia funcional `2dae5e0` registrada en `version-piloto.json`; `master` preservada y sin publicación.
- [x] Empaquetado desde objetos Git con lista de inclusión; exclusión de historial, secretos, `.env*`, configuraciones de credenciales, dependencias instaladas, compilados, bases y cargas de usuario.
- [x] Inventario SHA-256 por archivo, checksum del comprimido y generación determinista; verificación de contenido y metadatos.
- [x] Retirado el nombre personal de la metadata HTML; búsqueda de correos y RUT formateados en los textos incluidos. Capturas y PDF limitados por hashes a los ejemplos ficticios revisados.
- [x] Pruebas de exclusión, integridad, detección de patrones de credenciales y datos personales sin imprimir coincidencias.
- [ ] Revisión independiente de secretos y privacidad antes de distribuir a terceros. Los patrones automáticos no detectan todo dato sensible, nombres libres o credenciales arbitrarias.
- [ ] Auditoría de vulnerabilidades y licencias de dependencias antes de cualquier exposición más amplia; no se afirma que el lockfile esté libre de vulnerabilidades. No se añadieron bibliotecas de pago.
- [ ] Canal de distribución autenticado y conservación externa del checksum. Los checksums verifican integridad, no firma de autoría.

## Datos y advertencias

- [x] API exige `datosFicticios: true`; la pantalla exige confirmación. No se agregaron almacenamiento ni expedientes.
- [x] Política compartida rechaza campos desconocidos, cláusulas, resultados precalculados y supuestos modos expertos.
- [x] API/PDF coherentes en moneda, fecha, entradas y clasificación estimativa; caché de resultados y PDF deshabilitada con `no-store`.
- [x] CNU aproximado, ausencia de oferta/certificación y falta de validación especializada visibles; sin conexión con SCOMP.
- [x] Con beneficiarios: solo comparación inicial; sin curvas familiares. Saldo cero: sin curvas. Errores: sin valores inventados de respaldo.
- [ ] La casilla de datos ficticios es una declaración, **no anonimización ni detección automática de datos reales**. El operador debe evitar toda información personal, incluso en identificadores y fuente UF libres.
- [ ] Definir responsables, finalidad, retención, eliminación, gestión de incidentes y revisión legal antes de considerar datos personales. Este cierre no autoriza su uso.
- [ ] Revisar logs del host/proxy: no registrar cuerpos de solicitudes, datos de formulario, PDF ni secretos. No enviar a analítica externa.
- [ ] Establecer tratamiento de descargas y limpieza de temporales/evidencias ficticias en equipos compartidos. `no-store` no elimina un PDF descargado.

## Acceso y configuración

- [x] `dev` y `start` enlazados a `127.0.0.1`; producción local compilada y probada. Robots configurados como noindex/nofollow en metadata.
- [ ] **No hay autenticación ni autorización en la aplicación.** `noindex`, localhost y la casilla ficticia no son controles de identidad.
- [ ] Para demostración remota futura: host privado, firewall sin puerto 3000 entrante y túnel SSH con llaves ajenas al paquete; cuentas nominativas y mínimo privilegio del sistema.
- [ ] Para cualquier acceso multiusuario: autenticación, autorización para todas las API y descargas, cierre de sesiones, revocación y trazabilidad sin payloads personales.
- [ ] Si en el futuro se autoriza un proxy: TLS, cookies/sesiones seguras, protección de orígenes/CSRF según arquitectura, límites de cuerpo, rate limiting, tiempos de espera y límites de concurrencia del cálculo/PDF.
- [ ] Definir CSP y encabezados de seguridad, aislamiento de procesos, actualizaciones del host y dependencias, alertas y procedimiento de reversión. No se instalaron estos controles en el piloto.
- [ ] Restringir egreso del host de demostración al mínimo necesario. La instalación/compilación requiere red; el flujo piloto no consulta servicios de pensiones. Se conserva una ruta UF histórica que no utiliza la pantalla piloto.
- [ ] Verificar bindings, firewall, usuario del proceso y acceso desde otro equipo antes de cada demostración remota. Esa infraestructura no se validó aquí.

## Configuración actuarial y aprobación de uso

- [x] Alcance congelado a RP simple y RV inmediata teórica con ahorro propio. Sin modalidades nuevas, fórmulas nuevas ni datos reales habilitados.
- [x] Descuentos y retornos reales separados; UF/fecha/fuente explícitas. Referencia manual y escenarios 0/2/4% identificados como hipótesis.
- [x] Fuentes y fecha de revisión actuarial siguen en 08-11-2026. El cierre no selecciona nuevas normas por fecha ni acredita vigencia futura.
- [ ] Revisión actuarial del CNU completo, Anexo 7, cuota mortuoria, edades y familias; calibración contra casos oficiales antes de uso individual.
- [ ] Validación especializada de garantías, aumentos, combinaciones y eventos familiares antes de reconsiderar bloqueos. No basta con quitar avisos.
- [ ] Aprobación expresa posterior para publicar código, abrir una PR o exponer una demostración. Este documento prepara esos pasos; no los ejecuta.
