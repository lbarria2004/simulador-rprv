# Fase 3 — validación documental y metodología temporal

Revisión: **2026-11-08**. Base: `d1c7ef3d373106d223137858715366523ea46c4b`. Trabajo exclusivamente local en `codex/desarrollo`. No se conectó con SCOMP, no se utilizaron tokens personales ni servicios de pago y no se publicó en GitHub. Este informe no acredita conformidad normativa ni equivale a una oferta de AFP o aseguradora.

## Fuentes, versiones y alcance del cotejo

El [fundamento previo](fase-3-fundamentos.md) registra la evidencia y las decisiones antes de modificar los componentes. Fuentes consultadas en la fecha de revisión:

| Componente | Fuente original y versión | Resultado y límite |
| --- | --- | --- |
| Mortalidad base y mejoramiento | [NCG SP 306 / CMF 495, 24-02-2023](https://www.cmfchile.cl/normativa/ncg_495_2023.pdf), pp. 5–16; [Anexo 9 SP](https://www.spensiones.cl/portal/compendio/596/fo-article-15659.pdf) | Cotejo de 535 qx y dos matrices de 111 × 16 factores. Vigencia indicada desde 01-07-2023 por máximo seis años, como máximo hasta 30-06-2029 salvo reemplazo. No se acreditó un reemplazo posterior en las fuentes consultadas; no se afirma exhaustividad de esa búsqueda. |
| Ámbito de aplicación | [Compendio SP, tablas de mortalidad](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10624.html) | CB-H-2020: hombres no inválidos, titulares y beneficiarios; RV-M-2020: titulares mujeres no inválidas; B-M-2020: beneficiarias no inválidas; MI-H/M-2020: personas con invalidez. |
| Fórmulas de capital | [Anexo 7 SP](https://www.spensiones.cl/portal/compendio/596/fo-article-7253.pdf) | Referencia para identificar términos omitidos. El CNU local anual no reproduce el anexo completo. No se dispone de un caso oficial completo de CNU/pensión con todos sus datos para certificar equivalencia. |
| Porcentajes de referencia | [D.L. 3500 art.58, SUSESO](https://www.suseso.gob.cl/612/w3-propertyvalue-184728.html), [orientación SP](https://www.spensiones.cl/portal/institucional/594/w3-article-2959.html) y [conviviente civil CMF](https://www.cmfchile.cl/portal/principal/623/w4-article-102045.html) | Se separan porcentaje sobre la base del causante, incrementos y participación familiar. La acreditación de requisitos no se verifica con documentos personales. |
| Tasas técnicas, tasas por compañía y garantías heredadas | No se obtuvo circular primaria que acredite su aplicación y vigencia para este cálculo | Continúan como supuestos ilustrativos; se retiran las etiquetas de tasa oficial, clasificación de riesgo y oferta por compañía en pantalla. |

El PDF SP se obtuvo completo y se identificó por SHA-256 `aea2a6389234abdbe32c93f048cfd82f9215527c42a7e0228698098fddb6caf8`. Se contrastaron el texto CMF y las imágenes SP, incluidos los terminales q110=1. URL, páginas, fecha y método de extracción se conservan en `src/lib/data/tm2020-oficial.json`.

## Diferencias documentales y correcciones

| Dato | En d1c7ef3 | Fuente oficial |
| --- | ---: | ---: |
| MI-M qx2020, edad 3 | 0,00016066 | 0,00160661 |
| MI-M qx2020, edad 96 | 0,18859873 | 0,19400400 |
| CB-H AA, edad 103, 2032 | 0,013230 | 0,001323 |
| B-M AA, edad 103, 2027 | 0,015190 | 0,001519 |

Los restantes valores publicados cotejados coinciden. RV-M oficial comienza a los 20 años: se retiran los veinte qx locales de edades 0–19 sin respaldo en ese anexo. Su utilización como titular no inválida se rechaza explícitamente; una beneficiaria menor sigue usando B-M. Las tablas restantes abarcan 0–110.

La auditoría anterior comparó 8.880 posiciones de mejoramiento porque las matrices por sexo estaban repetidas en cinco tablas. Son 3.552 factores únicos, no 8.880 observaciones oficiales independientes. En el dominio final hay 8.560 posiciones replicadas: los factores de RV-M menor de 20 ya no se construyen. Factores acumulados y qx2026 se derivan del producto, sin transcribir derivados adicionales.

Para reproducir:

```bash
node scripts/auditar-tm2020.mjs d1c7ef3
node scripts/auditar-tm2020.mjs
```

El primer resultado está conservado en [diferencias respecto de la base](fuentes/tm2020-diferencias-base.json). El segundo comprueba el árbol actual y termina con error si detecta diferencias o edades sin respaldo; no descarga nuevos documentos ni comprueba futuras normas. No hay diferencias numéricas pendientes respecto de la transcripción documental cotejada.

## Auditoría del CNU y decisiones técnicas

1. **qx generacional**: `qx(x,t)=qx(x,2020) × producto(1-AA(x,s))`, con AA2036 constante para años posteriores. La fórmula y el ejemplo CB-H de edad 65 en 2022 de la NCG p.16 están respaldados. El ejemplo da **0,008526031**, redondeado a nueve decimales. La extrapolación matemática no extiende la vigencia jurídica de la tabla.
2. **CNU vitalicio anual conservado**: `12 × suma S(t) × (1+i)^(-t-0,5)`. Usa supervivencia al inicio del tramo y descuento a mitad de año. El pago inicial del titular, incluido el tramo terminal t=110−edad, y los calendarios difieren del CNU individual y del nuevo método mensual. No se sustituyó por una supuesta fórmula oficial.
3. **Titular con beneficiarios**: conserva la aproximación de reversión por `P(titular fallecido) × P(beneficiario vivo)`, que supone independencia. El CNU de causante ya fallecido es una suma ponderada de capitales individuales. No incluye todas las contingencias conjuntas, futuros acrecimientos, cuota mortuoria, factores regulatorios ni curvas de descuento del anexo.
4. **Temporal mensual**: exactamente M pagos vencidos; `CNU_M=suma S(m/12) × (1+i)^(-m/12)`. Dentro de cada tramo se supone fuerza de mortalidad constante: `S(t+d)=S(t)×(1-qx)^d`. Se parte en cumpleaños y cambios de año. La tasa es anual efectiva real y se convierte mediante potencias; no se vuelve a multiplicar el capital por doce. La convención de fecha es 30/360, no un fraccionamiento oficial atribuido a SP/CMF. Edades enteras suponen cumpleaños en la fecha de valoración; las fechas de nacimiento todavía no gobiernan todo el motor.
5. **Derecho temporal**: se evalúa al comienzo del mes cubierto y el pago al cierre. Un estudiante de 23 años financia doce meses hasta cumplir 24. Se conservan sexo, invalidez, rol y edad. El helper mensual permite una edad fraccionaria explícita; el CNU anual y las entradas de beneficiarios exigen edades enteras.
6. **Equivalencia del aumento**: `B=Fondos/(CNU_vitalicio/factorGarantia + aumento×CNU_temporal)`. Es un divisor híbrido estimativo: vitalicia anual más complemento mensual. `componentesCNU` expone cada término y `cnu` devuelve el divisor total en variantes temporales; antes devolvía solo el vitalicio en vejez/invalidez. No constituye un precio de aseguradora.
7. **Trayectoria**: se entregan pagos mensuales y promedio de doce pagos por fila anual. Trece meses aumentados producen doce meses en el primer año y uno en el segundo; este último es mixto. El gráfico usa el promedio incluso como respaldo. Con cero meses el primer pago es la base sin aumento; antes persistía un pago inicial aumentado incoherente con la trayectoria. Se rechazan aumentos negativos o no finitos. La garantía registra meses cubiertos por año sin simular una caída de la pensión al terminar la garantía; su factor sigue siendo ilustrativo.
8. **lx y expectativa auxiliar**: RV-M usa raíz condicional de 100.000 a los 20; las demás tablas a cero. Se retira el comienzo arbitrario en edad 18 para invalidez. No es un lx oficial. La expectativa de beneficiarios conserva invalidez y ya no sustituye edad cero por 60.

Ejemplo reproducible: hombre de 65, año 2026, descuento real 3%, plazo 13 meses. El método anterior daba **23,2122542366** unidades mensuales de capital al redondear a dos años; el nuevo da **12,7192173085**. Esa diferencia responde al plazo y fraccionamiento, no a una mejora garantizada de la pensión. No hay un benchmark oficial para atribuir certificación a esta hipótesis mensual.

## Sobrevivencia: bases y distribución

Se corrigen el 15% usado para padres (base legal 50%, sujeto a requisitos) y el falso 11% por orfandad (base de hijo 15%; 11% corresponde a invalidez parcial desde 24). Se distinguen vínculos comunes para cónyuge, conviviente civil y madre/padre de hijos no matrimoniales. Se implementa la división entre personas de la misma categoría adulta y el incremento de hijos sin cónyuge en casos documentados; las concurrencias complejas se advierten para revisión.

La regla local que rebajaba todos los porcentajes para sumar 100% no tenía fundamento demostrado en el art.58 y se elimina. Ejemplo: cónyuge con cuatro hijos comunes elegibles corresponde a 50% más cuatro bases de 15%, suma 110% de la base del causante. La participación relativa de cada persona en el total familiar sí suma 100%, pero no modifica su porcentaje de referencia.

Los resultados distinguen `porcentajeLegal`, `incrementoLegal`, `porcentaje` utilizado y `participacionFamiliar`. Un porcentaje manual no altera la regla legal registrada y queda marcado `personalizada`. Si faltan vínculos, grado de invalidez o carga familiar se declara la hipótesis y el estado `requiere_datos`. `documentada` describe la regla seleccionada, no certifica la acreditación personal. La base de referencia del causante, la base financiable del modelo y el total familiar son magnitudes distintas; API, pantalla y PDF las diferencian.

**Pendiente material**: RP continúa recalculando anualmente al grupo, pero la trayectoria de RV mantiene las cuotas iniciales. Aunque su CNU temporal trunca el derecho por edad, esa trayectoria no liquida futuros cambios de derecho, invalidez parcial, fallecimientos o acrecimientos. Se declara en resultados y PDF. No se debe interpretar el valor futuro de esa curva como un derecho adquirido.

## Consistencia monetaria

Se mantienen `ReferenciaUF {valor, fecha, fuente}`, `clpAUf` y `ufAClp` como punto único de conversión. Capitales y flujos permanecen en CLP reales de la fecha seleccionada, sin multiplicarlos por una UF nominal futura. El retorno AFP hipotético sigue separado del descuento del CNU y los escenarios RP conservador/base/optimista siguen siendo 0/2/4% reales.

Las regresiones comprueban que cambiar solo el valor UF conserva CLP y modifica su equivalente UF; cambiar la fecha también puede cambiar el año generacional y el capital mensual, por lo que no es una modificación exclusivamente monetaria. El PDF recalcula UF desde CLP y rechaza referencias incompatibles. La API de tasas remotas conserva metadatos de falta de validación y no acredita fecha de datos ni vigencia con la fecha de consulta.

## Verificaciones

- Base d1c7ef3: 104 pruebas aprobadas y TypeScript correcto; lint con tres errores anteriores.
- Árbol final: **143 pruebas, 19 suites, todas aprobadas** (39 pruebas adicionales). Incluyen cuatro correcciones documentales, ejemplo oficial qx, fronteras de dominio, series geométricas mensuales, mes 13, cambio de año/cumpleaños, hijos, invalidez, porcentajes familiares, CLP/UF y texto real del PDF.
- `npm run typecheck`: aprobado después de la compilación final.
- `npm run build -- --webpack`: aprobado; genera las ocho rutas/páginas previstas. Se utiliza webpack porque Turbopack fallaba previamente por restricciones del entorno; no se cambió la configuración para ocultarlo.
- `npm run lint`: siguen exactamente **tres errores anteriores** `react-hooks/set-state-in-effect` en `ModalitiesSelector.tsx`, `src/components/ui/carousel.tsx` y `src/hooks/use-mobile.ts`; cero errores nuevos y cero advertencias. No se deshabilitó la regla.
- Auditoría TM-2020 actual: cero diferencias y cero edades adicionales sin respaldo dentro del dominio soportado.
- `node scripts/verificar-integracion.mjs`: aprobado contra producción local. Ocho modalidades, tres escenarios RP, opciones de sobrevivencia, metadatos, aumentos de 13 meses en vejez/invalidez/sobrevivencia, plazo cero sin aumento, rechazo de aumentos negativos, vínculos explícitos, errores 400, referencia UF compartida y PDF.
- Chromium/Playwright sobre producción local: aprobado. Conservación de CLP al cambiar UF, fecha/valor coincidentes en la descarga PDF, tres curvas RP distintas, total familiar y edades actualizadas, y conservación de la referencia manual tras fallo remoto simulado. Cero errores JavaScript y cero solicitudes SCOMP.
- `git diff --check`: correcto.

El runner nativo avisa de la ausencia de `type: module` y reprocesa archivos TypeScript como ESM. No causa fallos y también estaba presente en la base; no se modificó el modo global del paquete para silenciarlo.

## Archivos modificados y nuevos

- Motor y datos: `src/lib/pension-calculator.ts`, `actuaria-mensual.ts` (nuevo), `reglas-sobrevivencia.ts` (nuevo), `tablas-mortalidad.ts`, `tablas-mortalidad-oficiales.ts`, `data/tm2020-oficial.json` (nuevo).
- API: `src/app/api/pension/route.ts`, `src/app/api/tasas-rv/route.ts`.
- Pantalla: `src/app/page.tsx`, `src/components/simulador/BeneficiariesManager.tsx`, `InsuranceRankingTable.tsx`, `ModalitiesSelector.tsx`, `MultiQuotationResults.tsx`, `TrajectoryChart.tsx`.
- PDF: `src/lib/reporte-pdf.ts`.
- Regresiones: `src/lib/__tests__/validacion-actuarial.test.ts` (nuevo), `pension-calculator.test.ts`, `tablas-mortalidad.test.ts`, `moneda-sobrevivencia.test.ts`, `reporte-pdf.test.ts`.
- Herramientas: `scripts/auditar-tm2020.mjs` (nuevo), `scripts/verificar-integracion.mjs`.
- Documentación: `README.md`, este informe, `docs/fase-3-fundamentos.md` y `docs/fuentes/tm2020-diferencias-base.json` (nuevos). Los informes anteriores se conservan como historial; este sustituye su estado pendiente sobre cotejo de tablas y porcentajes.

## Revisión actuarial y normativa pendiente

Se necesita un especialista para reproducir íntegramente el Anexo 7 con casos oficiales completos, fraccionamiento autorizado por edad/calendario, supervivencias conjuntas y dependencia familiar, cuota mortuoria, transición de invalidez parcial, requisitos de arts.5–10 y acrecimientos en concurrencias complejas. También debe verificar la tasa técnica y curva aplicable a la fecha, los factores y condiciones contractuales de garantías, SIS y cualquier admisibilidad de cláusulas de aumento. La interfaz mantiene fuera de alcance sus aumentos de sobrevivencia mientras se revisan; su disponibilidad matemática por API no demuestra autorización contractual.

PGU, BAC, BEV, comisiones, SIS y descuentos de salud contienen supuestos heredados; no fueron certificados por esta fase. Las tablas están transcritas y cotejadas, pero ello no valida los restantes componentes. La vigencia normativa debe revisarse antes de cada uso profesional.
