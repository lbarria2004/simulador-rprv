# Constructor multimodalidad: alcance y validaciones pendientes

Desarrollo: **10-11-2026**, rama local `codex/constructor-escenarios`, creada desde `318f57f381b31f2ffb30fdab40cbb98ac4ba9592` de `codex/desarrollo`. La revisión de fuentes actuariales sigue congelada al **08-11-2026**. Este cambio recupera gestión de configuraciones; no valida cláusulas ni amplía la ventana de valoración del piloto.

## Revisión de la referencia histórica

Se leyeron mediante `git show master:ruta` los archivos `src/components/simulador/ModalitiesSelector.tsx`, `src/components/simulador/types.ts` y `src/lib/pension-calculator.ts` de `master` (`d1c619e`). No se cambió de rama para editar `master` ni se importaron sus componentes activos.

El selector histórico ofrecía cinco tipos, nombres y parámetros personalizables, pero mezclaba `tasaEspecialRV`/`esTasaEspecial` con términos de oferta comercial, reglas de familiares y modalidades no verificadas. Sus tipos combinaban cotización con beneficios y totales líquidos. El motor contenía factores ilustrativos de garantía, por ejemplo 0,985 a 60 meses y 0,970 a 120, que no constituyen una metodología contractual verificable. **No se recuperan esos factores, promesas, datos personales, porcentajes manuales ni beneficios.**

Se recuperan las operaciones de agregar y eliminar y se incorporan duplicación, edición, selección múltiple y comparación. Los contratos históricos de tipos no se reutilizan: la nueva configuración exige campos explícitos y no admite alias ni banderas antiguas de habilitación.

## Experiencia disponible

Desde el enlace **Escenarios** del encabezado se accede al constructor, al final del estudio. Comparte afiliado hipotético, saldo propio, UF/fecha/fuente y descuentos del formulario existente. El enlace **Revisar datos y tasas del estudio** devuelve al formulario. No se agregan nombres de afiliados, RUT ni campos de personas.

1. Elegir una modalidad en el catálogo. Dos tarjetas indican estimación habilitada; tres, pendiente actuarial.
2. Dar un nombre descriptivo sin información personal. Configurar meses de garantía, meses de aumento y porcentaje cuando corresponda. Cambiar de modalidad restablece cláusulas y sensibilidad, evitando parámetros ocultos.
3. Elegir referencia técnica del estudio o una sensibilidad hipotética. Para RP se selecciona por separado retorno AFP conservador/base/optimista. La RV no utiliza retorno AFP.
4. Guardar, duplicar, editar o eliminar configuraciones. Cancelar descarta la edición. Se admiten como máximo doce escenarios, con identificadores y nombres únicos, sin ambigüedad por mayúsculas o espacios repetidos.
5. Seleccionar configuraciones y comparar. Las simples muestran montos iniciales estimativos. Las pendientes muestran parámetros y motivo del bloqueo, **sin pensiones ni un cero monetario de relleno**.

Las configuraciones permanecen únicamente en memoria; recargar restablece los dos escenarios iniciales. Editar datos comunes, lista o selección oculta los montos anteriores. Mientras el editor está abierto se suspende la comparación. Si falla el servicio no se presentan valores de respaldo.

El constructor compara **pensiones iniciales**. Las curvas verificadas y el PDF superiores siguen perteneciendo al estudio base. No se producen nuevas curvas por cada configuración. Cambiar solo el retorno AFP conserva la pensión inicial del modelo; cambia su trayectoria, cuya revisión sigue en el estudio base. No hay ranking automático ni recomendación basada en la pensión mayor.

## Separación de tasas y parámetros

| Elemento | Semántica y controles |
| --- | --- |
| Referencia técnica del estudio | Tasa real anual RP o RV del formulario. RP 3,67% conserva el antecedente de Circular 2425 para octubre de 2026; no se selecciona circular por fecha. RV 2,82% sigue siendo una hipótesis financiera, no tarifa. Ninguna referencia manual se declara certificada. |
| Sensibilidad | Descuento real anual independiente por escenario, entre 0 y 10%. La tabla distingue tasa técnica base y tasa aplicada. No modifica la referencia del formulario ni se atribuye a una compañía. |
| Retorno real AFP | Supuestos existentes 0%, 2% y 4%, separados del descuento. Solo aplicables a RP; la API rechaza asignarlos como un retorno RV. |
| Tasas comerciales | No existe campo habilitado. `tasaComercial`, `tasaEspecialRV`, `esTasaEspecial`, ofertas y banderas de cálculo son rechazados. No se consulta un servicio comercial. |
| Períodos y aumento | Meses enteros 1–600 y aumento positivo de hasta 100%, solo como configuración pendiente. Valores iniciales ilustrativos: 120 meses de garantía, 36 de aumento y 25%. Son límites y valores operativos de la interfaz, **no plazos ofrecidos ni admisibilidad normativa**. |

En JSON, tasas de descuento son fracciones anuales (`0.04` = 4%) y `porcentajeAumento` usa puntos porcentuales (`25` = 25%). Los parámetros de cláusulas nunca llegan a una fórmula del motor. No se convierten automáticamente a los contratos históricos.

## Catálogo y requisitos para habilitar cálculos

Las fuentes se identifican con S1–S7 de la [matriz de 27 componentes](fase-4-matriz-trazabilidad.md), que conserva URLs, fechas, evidencia y límites. No se realizó una nueva acreditación de vigencia normativa en esta fase.

| Modalidad | Estado actual | Requisitos pendientes antes de ampliar su cálculo |
| --- | --- | --- |
| Retiro Programado | Estimación del piloto, M05/M08–M10/M12/M13 | CNU íntegro del Anexo 7, corrección 11/24, cuota mortuoria, precisión y edad actuarial; aplicación temporal de la tasa; contraste con casos oficiales. Ver S1 Anexo 7 y S3 circulares RP. Mantiene retiros anuales simplificados y retornos constantes. |
| RV inmediata simple | Estimación teórica, M05/M06/M08/M14 | Capital completo de titular y reversión, CNCM cuando proceda, base familiar, tasas/estructura apropiadas a cada ámbito y casos de referencia. Una tasa de reserva o estadística CMF no valida un precio comercial. No se determina elegibilidad ni se emite oferta. Ver S1/S2/S4/S7. |
| RV con período garantizado | Solo configuración, M16/M17/M20 | Definir contratos y asegurados cubiertos, vigencia, plazos admisibles, calendario de pagos y beneficiarios/herederos bajo fallecimiento; descontar y ponderar todos los flujos garantizados y contingentes, evitando doble conteo. Falta calibración y casos contractuales verificables. El factor g histórico no sirve como sustituto. Ver S5 y límites de S1/S4. |
| RV con aumento temporal | Solo configuración, M18/M19/M20 | Acreditar condiciones y límites aplicables, base y proporción del aumento, vencimiento, coordinación con sobrevivencia y beneficiarios. Validar fuerza mensual, fechas de pago y reversión del aumento con casos independientes. El método temporal mensual local de fase 3 no certifica la tarificación RV completa. No confundir con aumento diferido y vitalicio ni su anticipo, tratados separadamente en S6. |
| RV combinada | Solo configuración, M16–M20 | Metodología conjunta de garantía y aumento con todos sus solapamientos, supervivencia, pagos al titular y beneficiarios, pérdidas de requisitos y cláusulas contractuales; revisión del dominio admitido. No combinar factores independientes sin demostrar consistencia de capital. Exige revisión actuarial y jurídica y casos verificables antes de habilitarla. |

Fuentes principales ya documentadas: [SP, Anexo 7](https://www.spensiones.cl/portal/compendio/596/fo-article-7253.pdf), [NCG CMF 495/TM-2020](https://www.cmfchile.cl/normativa/ncg_495_2023.pdf), [SP, descripción de cláusulas RV](https://www.spensiones.cl/portal/institucional/594/w3-article-6684.html), [artículo 58](https://www.suseso.gob.cl/612/w3-propertyvalue-184728.html). Su existencia respalda referencias y reglas concretas, no las fórmulas contractuales faltantes. Ningún monto final es normativamente certificado.

Antes de habilitar cada cláusula se requiere documentar fórmula y fuente primaria vigentes, supuestos, unidades, calendario, capitales y casos familiares; obtener revisión especializada; añadir casos oficiales o contractuales verificables y regresiones independientes de la implementación; y revisar simultáneamente catálogo, política, API y PDF. No basta con cambiar `calculable` en el navegador ni con retirar el aviso.

## Contratos y defensa de API/PDF

- `GET /api/escenarios`: catálogo, estados controlados en servidor, límite y aviso estimativo.
- `POST /api/escenarios`: únicamente `{ datos: DatosPiloto, escenarios: EscenarioCotizacion[] }`. Se valida primero el lote completo. Una cláusula en cualquier posición provoca **403**, sin resultado parcial. Campos desconocidos, banderas, resultados suministrados y cláusulas encubiertas en una modalidad simple también provocan 403. Datos inválidos, listas vacías o mayores de doce, nombres/IDs duplicados y tipos incorrectos provocan 400.
- La UI puede mostrar configuraciones pendientes junto a estimaciones simples, pero envía al cálculo **solo** las modalidades simples. Si se seleccionan únicamente cláusulas, la comparación es de parámetros locales y no hace una solicitud de cálculo.
- Los resultados permitidos se obtienen mediante `calcularPiloto` y su `validarDatosPiloto`, sin fórmulas nuevas. Se devuelve una lista explícita de montos y metadatos; no curvas familiares ni resultados internos del motor.
- `POST /api/pension`, `POST /api/reporte` y `/api/tasas-rv` conservan sus restricciones. El PDF se recalcula en servidor; rechaza `escenarios`, `resultados` o cláusulas en los datos. **No se implementó exportación PDF de la lista ni de las sensibilidades.** El PDF disponible corresponde al estudio base y se advierte en la interfaz.
- Las respuestas de cálculo y error del nuevo endpoint tienen `Cache-Control: no-store`. No hay almacenamiento, autenticación nueva, SCOMP ni ofertas comerciales. La declaración de datos ficticios no detecta por sí sola información personal en texto libre; el operador debe usar descripciones sintéticas.

## Pruebas y reproducción

```bash
npm test
python scripts/pruebas-paquete-piloto.py
npm run lint
npm run build -- --webpack
npm run typecheck
npm run start
# En otra terminal, producción local en 127.0.0.1:3000:
node scripts/verificar-escenarios-http.mjs
node scripts/verificar-piloto-http.mjs
python scripts/verificar-escenarios-navegador.py --salida /tmp/escenarios-evidencias
python scripts/verificar-piloto-navegador.py --salida /tmp/piloto-regresion
```

Se requiere Node 24 y, para navegador, Python/Playwright/Chromium conforme a la [guía de instalación](piloto/instalacion-y-demostracion.md). Sin dependencias nuevas ni cambios en el lockfile.

Resultados: **233 pruebas del simulador** (195 conservadas y 38 nuevas), 23 suites; **ocho pruebas del paquete histórico**; TypeScript, lint y compilación webpack aprobados. Integración: **46 solicitudes nuevas** de escenarios y **79 del piloto**, incluidas solicitudes manipuladas y PDF real. Navegador: **diez flujos nuevos** y **nueve del piloto**, escritorio 1440 y móvil 390 px, sin errores JS, solicitudes externas ni conexión con SCOMP. Se inspeccionaron capturas del catálogo y tabla; el desplazamiento horizontal queda dentro de la tabla móvil, sin desbordar el documento.

Las regresiones cubren identidad con el motor original, UF/CLP, sensibilidad vs tasa base/retorno, beneficiarios, lotes mixtos, campos maliciosos, tasas falsas, parámetros ocultos, rangos, duplicados y rechazo de PDF. El navegador cubre CRUD, validación de nombre, selección, comparación mixta y solo pendiente, cancelación, datos obsoletos, error 503 sin respaldo, cambio de modalidad con limpieza de cláusulas, teclado, móvil y ausencia de persistencia.

Durante las comprobaciones se normalizaron espacios repetidos en nombres para impedir etiquetas visualmente indistinguibles y se hizo explícito el retorno AFP en la tabla. Las fórmulas actuariales, tablas, `piloto.ts`, generador PDF y dependencias **no se modificaron**. La advertencia conocida de Node sobre módulos sin tipo explícito sigue siendo informativa.

Archivos: `src/lib/escenarios.ts`, `src/lib/__tests__/escenarios.test.ts`, `src/components/escenarios/ScenarioBuilder.tsx`, `src/app/api/escenarios/route.ts`, integración en `src/app/page.tsx`, `scripts/verificar-escenarios-http.mjs`, `scripts/verificar-escenarios-navegador.py`, este informe y `README.md`. Capturas ficticias generadas fuera del repositorio en `/workspace/entregables/constructor-escenarios/`; no se reemplazan las evidencias ni el paquete cerrado del piloto.

No se publica la nueva rama ni se crea PR ni se despliega en Vercel. Se mantienen intactos `master`, `codex/desarrollo`, la etiqueta y los entregables congelados de la versión anterior. La recomendación de operación continúa siendo una prueba interna local con datos ficticios; garantías, aumentos y combinaciones no deben usarse para estimar pagos a clientes mientras falte su validación.
