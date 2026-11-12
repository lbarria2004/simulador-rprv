# Constructor multimodalidad RP/RV

Entrega local del 12-11-2026. Rama **`codex/escenarios-multimodalidad`**, creada desde **`318f57f381b31f2ffb30fdab40cbb98ac4ba9592`** de `codex/desarrollo`. La referencia funcional del piloto en `version-piloto.json` sigue siendo `2dae5e0`; no se reetiqueta ni se presenta este constructor como validación del motor. El commit de esta ampliación se identifica con `git log -1 --oneline` en la rama de trabajo.

## Resultado funcional

Catálogo de cinco modalidades: Retiro Programado, RV inmediata simple, RV con período garantizado, RV con aumento temporal y RV combinada (garantía más aumento). Se pueden preparar hasta doce escenarios, nombrarlos con etiquetas ficticias, agregar, duplicar, editar, cancelar la edición, eliminar, seleccionar y comparar configuraciones. Garantía, duración del aumento y porcentaje son personalizables según la modalidad; los parámetros que no corresponden se excluyen al guardar.

La comparación de configuraciones incluye también cláusulas pendientes, sin pensiones, CNU ni factores inventados. La selección numérica admite únicamente RP simple y RV inmediata teórica, ambas aproximadas y pendientes de validación especializada. Seleccionar una cláusula bloquea todo el cálculo y el PDF: no se descarta silenciosamente ni se calcula parcialmente. Para calcular los escenarios simples, desmarcar las cláusulas pendientes.

Los escenarios comparten datos, UF/fecha y descuentos del estudio. Los descuentos técnicos, retornos hipotéticos AFP y tasas comerciales ausentes se explican por separado. Duplicar una modalidad simple con los mismos supuestos produce el mismo monto; cambiar el nombre no crea una oferta diferente. No se presentan tasas manuales como ofertas de aseguradoras.

Los cambios guardados de configuración, selección, valoración o supuestos invalidan los resultados y la descarga; una respuesta tardía para otros datos no vuelve a habilitarlos. Recalcular retira el resultado anterior, incluso si la nueva solicitud falla. El PDF utiliza exactamente las configuraciones de la comparación vigente, las valida y recalcula en servidor; pagina listas largas. Solo dibuja RP si fue seleccionado y cumple las condiciones del piloto.

Los controles están etiquetados para teclado/lectores y el catálogo/lista se adapta a pantalla. La tabla tiene desplazamiento horizontal dentro de una región enfocable en móvil, sin desbordar la página. No se persisten casos o escenarios ni se recuperan nombres, RUT u otros datos personales históricos.

## Referencia histórica revisada

Se revisaron en `master` (`d1c619ec335eba88c85871b443d288e72ab89df9`) los tres archivos solicitados:

- `src/components/simulador/ModalitiesSelector.tsx`: selección en lote, constructor de cláusulas y lista. Se recupera la interacción, con edición y duplicación, sin el modo de tasa especial ni etiquetas de ofertas/SCOMP.
- `src/components/simulador/types.ts`: catálogo histórico de cinco modalidades; se crea un contrato independiente sin estado de afiliado personal, compañías ni campos comerciales.
- `src/lib/pension-calculator.ts`: funciones históricas de garantía/aumento/combinación, factores interpolados y normalización ambigua de porcentaje. No se reactivan sus rutas ni se incorporan a la nueva política.

El motor, tablas, CNU y política base de `src/lib/piloto.ts` permanecen sin modificaciones. Los componentes históricos siguen sin incorporarse al flujo activo. Los [requisitos por modalidad](escenarios-validacion-pendiente.md) detallan qué falta para valorar cláusulas y por qué los límites de captura no acreditan admisibilidad normativa.

## Contratos y defensa ante manipulación

`src/lib/escenarios.ts` contiene el catálogo y la validación compartida. La API y el PDF llaman a `calcularComparacionEscenarios`, que autoriza las modalidades antes de entrar en el motor del piloto. Los estados de habilitación se derivan del catálogo, nunca de un campo enviado por el cliente.

```json
{
  "tipo": "comparacion_escenarios",
  "datos": "objeto completo del contrato DatosPiloto, no una cadena",
  "escenarios": [
    { "id": "rp-a", "nombre": "Escenario A", "modalidad": "retiro_programado" },
    { "id": "rv-a", "nombre": "Escenario B", "modalidad": "renta_vitalicia_simple" }
  ]
}
```

El ejemplo ilustra el envoltorio: reemplazar `datos` por un objeto completo válido del piloto, como el fixture ficticio de las pruebas. `POST /api/pension` devuelve `resultado` del piloto y `cotizaciones` con las configuraciones seleccionadas y sus montos estimativos. `POST /api/reporte` recibe exclusivamente `{datos, escenarios}` y devuelve PDF recalculado. Los contratos anteriores del piloto siguen disponibles y mantienen sus restricciones.

Una configuración de cláusula válida para comparar, como `{id: "g-a", nombre: "Garantía A", modalidad: "rv_garantizada", mesesGarantizados: 180}`, devuelve **403 `CLAUSULA_NO_VALIDADA`** al intentar calcular o generar PDF, sola o mezclada. Campos desconocidos, flags `calculable`/`activa`, modos expertos, tasas comerciales/especiales, compañías, factores y resultados precalculados devuelven 403. Datos malformados, números convertibles desde texto, parámetros omitidos, exceso de escenarios o IDs duplicados se rechazan con 400. Las respuestas POST usan `Cache-Control: no-store`, también los errores.

Reclasificar como simple conservando parámetros de cláusulas también se rechaza. Una modalidad simple sin parámetros contractuales solo genera la aproximación simple y se identifica como tal junto al nombre ficticio. Las restricciones de familia, datos ficticios, fecha, SIS y prestaciones se delegan sin excepciones en la política del piloto.

## Verificación reproducible

Usar Node 24.22.1/npm 11.9.0, dependencias fijadas sin actualizarlas, y la [instalación del piloto](piloto/instalacion-y-demostracion.md). No crear `.env`, base de datos ni migraciones. Generar los tipos con `npm run db:generate`.

```bash
npm test
python scripts/pruebas-paquete-piloto.py
npm run lint
NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack
npm run typecheck
npm run start
```

Con producción escuchando solo en `127.0.0.1:3000`, ejecutar en otra terminal:

```bash
node scripts/verificar-piloto-http.mjs
node scripts/verificar-escenarios-http.mjs
python scripts/verificar-piloto-navegador.py --salida /tmp/piloto-navegador
python scripts/verificar-escenarios-navegador.py --salida /tmp/escenarios-navegador
```

| Comprobación | Resultado |
| --- | --- |
| Pruebas del simulador | 228 aprobadas en 24 suites: 195 existentes y 33 nuevas de catálogo, validación, política, motor y PDF. |
| Pruebas del paquete | Ocho aprobadas; se conservan exclusiones e integridad. |
| TypeScript, ESLint y build webpack | Aprobados sin omitir tipos ni reglas. |
| HTTP de producción | 200 solicitudes aprobadas: 79 del piloto y 121 del contrato nuevo, incluidas manipuladas, cláusulas mixtas y PDF. |
| Chromium | Nueve casos del piloto y once del constructor aprobados; sin errores JS, solicitudes externas ni SCOMP durante esos flujos. |
| Responsive | Anchos 1440, 768, 390 y 320 px comprobados; tabla con desplazamiento interno. |

Las pruebas del nuevo PDF comprueban recálculo, selección exclusiva, avisos en cada página y paginación de doce etiquetas largas. Las de navegador cubren duplicación independiente, edición/cancelación, eliminación, validación, cambio de modalidad, porcentajes, invalidación, respuesta tardía y límite de lista, etiquetas largas y saldo máximo en móvil. Los scripts guardan capturas, resúmenes JSON y PDF exclusivamente ficticios en la ruta indicada fuera del repositorio. El aviso conocido de Node `MODULE_TYPELESS_PACKAGE_JSON` no produce fallos.

Las comprobaciones verifican la implementación y sus bloqueos; **no validan actuarialmente el CNU ni habilitan contratos**. La revisión normativa continúa pendiente. No se realizó una nueva auditoría integral de infraestructura o dependencias, ni instalación multiusuario. Ver [requisitos pendientes](escenarios-validacion-pendiente.md).

## Conservación

`master` y `origin/master` siguen en `d1c619e`; la base de desarrollo sigue en `318f57f`. No se hace push, PR, merge, despliegue Vercel ni demostración pública. La copia local se obtuvo mediante lectura del repositorio conectado y todo el trabajo nuevo se conserva en la rama indicada. Sin nuevas dependencias ni cambios del lockfile. El cierre y las evidencias previas siguen identificando el piloto anterior, no sustituyen las pruebas nuevas.
