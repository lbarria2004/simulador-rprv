# Auditoría final: riesgos, recomendación y verificaciones

Fecha: **2026-11-08**. Base: `147c78b7300ccaf18994c6231204fa7ff045c221`, rama local `codex/desarrollo`. La [matriz de trazabilidad](fase-4-matriz-trazabilidad.md) es la entrega principal: 27 componentes, cobertura explícita de los 35 casos familiares del Anexo 7 y su cuota mortuoria, fuentes, vigencia, fórmulas, evidencia, pruebas, discrepancias y confianza. El [fundamento de cambios](fase-4-cambios-fundamentados.md) se escribió antes de las correcciones correspondientes.

**Recomendación: apto para orientación limitada y análisis de sensibilidad; no apto para determinar una pensión normativa ni comparar ofertas reales.** Ningún monto final es un resultado verificado documentalmente en su totalidad. Las tablas y ciertos porcentajes tienen respaldo; el capital completo, la tarifa RV y la aplicación a una persona siguen requiriendo validación especializada. No se implementaron nuevas modalidades, algoritmos de recálculo contractual ni selección automática de tasas.

## Hallazgos que cambian la conclusión anterior

Se localizaron y obtuvieron completas las circulares SP 2407, 2417 y 2425. El **3,67% tiene respaldo primario desde 01-10-2026**. Esta evidencia actualiza el pendiente del informe de fase 3, que no había encontrado la circular. No convierte ese valor en tasa apropiada para enero de 2026, para cualquier capital SIS o para todos los años de una proyección. El programa no selecciona la circular según la fecha; un override conserva naturaleza de hipótesis.

La circular prescribe aplicar su tasa escalar resultante a los flujos. Su cálculo a partir de un vector no significa que el motor deba sustituir la tasa RP publicada por la curva de origen. Las tasas de reservas, las medias comerciales y los descuentos hipotéticos de RV tienen ámbitos diferentes; no se certifica ninguno de los defaults RV del programa como tasa normativa de tarificación.

El producto `P(beneficiario vivo)×P(titular fallecido)` sí tiene correspondencia estructural en algunas fórmulas del Anexo 7. La discrepancia no es que todo ese producto sea inventado: son el fraccionamiento, los términos familiares omitidos, el calendario y la aplicación concreta los que impiden afirmar equivalencia completa.

Como contraste algebraico, para hombre65, año2026 y tasa hipotética3%, sin beneficiarios, el CNU local es **188,1754887969** unidades mensuales de capital. Con las mismas supervivencias locales y el mismo límite, la suma a tiempos enteros menos11/24, escalada por12, da **185,4772631008**. No es un caso oficial certificado ni una cota del error del simulador; demuestra que ambos métodos no son idénticos. Por eso no se reemplazó el CNU íntegro ni se añadió una corrección aislada como si resolviera todo el anexo.

## Riesgos priorizados

Prioridades: P0 impide tratar el producto como calculadora certificada; P1 puede cambiar materialmente decisiones o derechos; P2 afecta trazabilidad/reutilización. La prioridad no supone que se haya publicado ni utilizado con clientes.

| Prioridad / riesgo | Evidencia y posible efecto | Mitigación realizada | Pendiente / condición para resolver |
| --- | --- | --- | --- |
| **P0 — Capital normativo incompleto** | M05–M09: descuento semianual en vez del fraccionamiento de S1; cuota mortuoria ausente, sin precisión final reglamentaria ni casos oficiales de equivalencia | Identificación explícita A/P, comparación por componente, aviso en pantalla/API y cada página PDF | Especialista debe implementar y validar el conjunto de capitales, unidades, correcciones y casos oficiales. No usar los montos como pensiones exigibles |
| **P1 — Garantías y precio RV sin calibración** | M16–M20: g fijo/interpolado no depende de sexo, tasa, supervivencia o asegurados; combinado no valora todos los flujos; ausencia de método tarifario verificable | Retirada afirmación genérica de garantía legal; factor rotulado ilustrativo; divisor informado corregido | Póliza/nota técnica y validación especializada de cada cláusula. No ofrecer la diferencia estimada de monto como costo real de contratarla |
| **P1 — Cambios familiares futuros incompletos** | M07/M22: capital no incorpora todos los acrecimientos ni transición futura15→11; RV mantiene cuotas iniciales; qx no genera eventos de fallecimiento en trayectoria | Conservadas advertencias de RV; corregido fallo de dominio >110 en RP; matriz identifica cada supuesto | Modelo por estados/eventos con calendarios y normas de recálculo. No presentar la curva como liquidación futura de cada beneficiario |
| **P1 — Tasas aplicadas fuera de su fecha o ámbito** | M12/M14: 3,67% por defecto también con fecha UF de enero de 2026; UI/API difieren en defaults RV; proyección mantiene tasas constantes | Metadata RP diferencia evidencia de Circular 2425 y falta de selección por fecha; tasas RV siguen ilustrativas | Fijar tasa, fecha y finalidad en cada estudio y verificar norma vigente. No extrapolar una tasa RP a la tarificación RV o al SIS sin fundamento |
| **P1 — SIS y saldo hipotético tratados como recursos disponibles** | M23: CN hereda CNU incompleto; cobertura e ingreso base declarados; AA supuesto se suma al saldo y puede alimentar RV | Mensajes cambian a hipótesis y aporte estimado; sin afirmación de obligación de aseguradora; referencia parcial corregida35→50 | Acreditación formal de cobertura, dictamen, ingreso base y capital/tasa SIS. No comunicar AA como aprobado ni usarlo como prima cierta |
| **P1 — Beneficios y monto líquido no verificados** | M25: PGU con constantes2025, reglas simplificadas BAC/BEV y descuentos; sumas pueden influir en la recomendación de modalidad | Advertencia de complementos heredados y no acreditación de vigencia/derecho | Auditoría específica de normativa y gradualidad2026, elegibilidad y comisiones. Excluir estos totales de promesas a clientes |
| **P2 — Edades y elegibilidad aparentes** | M04/M21: edad biológica/entera no equivale automáticamente a actuarial; vínculos, estudios y carga familiar pueden suponerse | Datos faltantes generan `requiere_datos`; corrección de redondeo expresamente indicada por S1 | Verificación de arts.5–10 y5bis, fechas de estudio/siniestro/dictamen y concurrencias complejas; booleano declarado no acredita derecho |
| **P2 — Datos comerciales, alias y compatibilidad** | M15/M26: media remota/local mezclable, fecha de consulta no fecha de dato; alias2020 expone proyección2026; categoría heredada `total_2_3` | Continúan avisos; alias/categoría delimitados en matriz; categoría ya no se presenta legalmente acreditada | No reutilizar aliases como datos2020 ni comercializar datos no cotejados. Revisar contratos de API y fuentes antes de otro desarrollo |
| **P2 — PDF/API confundidos con certificación** | M27: éxito HTTP solo significa cálculo realizado; PDF acepta resultados suministrados y no verifica integralmente el motor de origen | Aviso de validación especializada en cada página y advertencias en resultados; pruebas de contenido y navegador | Mantener trazabilidad de parámetros y origen en cada uso; un formato descargable no acredita conformidad |

Los riesgos P0/P1 permanecen abiertos aun cuando las regresiones pasan. Los avisos son una mitigación de presentación; no reparan el cálculo reglamentario ni bloquean técnicamente todos los usos indebidos. Este trabajo no autorizó publicación o uso comercial del simulador.

## Cambios futuros de derechos: evaluación concreta

| Evento | Qué hace hoy | Qué falta |
| --- | --- | --- |
| Fallecimiento del titular | CNU incorpora reversión esperada mediante marginales | No se simula fecha de fallecimiento ni activación real de cada pago; la trayectoria mostrada está condicionada a su escenario |
| Fallecimiento de cónyuge/otro adulto | Probabilidad individual reduce su capital esperado | No distribuye dinámicamente su cuota a otros adultos ni recalcula una RV con el procedimiento de Circular 2062/2375 |
| Hijo cumple18 sin estudios o24 con estudios | Regla actual excluye según edad; RP actualiza al siguiente punto anual; capital temporal limita pagos por edad | Fecha real del derecho, curso de estudios y recálculo mensual normativo. La RV conserva cuotas iniciales |
| Invalidez parcial del hijo antes/después24 | Porcentaje actual15/11 y RP anual lo reevalúa | Capital inicial debería considerar ambos tramos y correcciones del caso; no se presume validado |
| Pérdida de otros requisitos | `requisitosAcreditados=false` permite excluir en un cálculo nuevo | No calendario ni procedimiento de acreditación, pérdida/suspensión/restablecimiento, art.5bis o transición legal documentada |
| Último hijo pierde derecho / fallece otro hijo | RP vuelve a calcular porcentajes con los datos que conserva | CNU inicial y RV no capitalizan o liquidan todos los acrecimientos; incremento50/n no es una garantía de suma familiar fija |
| Beneficiario supera110 en proyección | Se omite del soporte futuro sin rechazar todo el cálculo | Esto es solo el límite del modelo; no es una muerte real ni regla jurídica de extinción de derecho |
| Muerte durante garantía | El modelo mantiene un monto ajustado con g | No identifica asegurados garantizados ni liquida pagos a beneficiarios/designados por póliza. No se simula el siniestro |

## Qué puede mostrarse a clientes

Se pueden mostrar antecedentes documentales delimitados: tablas/versiones, ejemplo generacional, porcentajes bajo condiciones explícitas y tasa RP publicada con su fecha. También conversiones monetarias con valor, fecha y fuente UF, y **escenarios de orientación** con ahorro propio, tasa/retorno declarados y advertencia cercana al resultado. Las conversiones verificadas no convierten la pensión resultante en oficial.

RP y RV simples pueden servir para explicar sensibilidad e incertidumbre, **como aproximaciones**, evitando atribución a una AFP/aseguradora o recomendación de contratación basada solo en el monto. Debe explicarse que se comparan modelos con supuestos, no ofertas homogéneas. Para una decisión individual se necesita revisión profesional y antecedentes oficiales, obtenidos fuera del simulador.

Las garantías, combinaciones y aumentos deben permanecer claramente identificados como aproximaciones exploratorias. No recomiendo presentar su diferencia de pensión como precio actuarial de una cláusula. No presentar aumentos de sobrevivencia, aumentos superiores al100%, cláusulas nuevas no implementadas ni la convención `total_2_3` como alternativas contractuales disponibles. El modelo matemático acepta más hipótesis que las condiciones de S5: la existencia de un endpoint no acredita admisibilidad.

No recomiendo comunicar como ciertos el aporte SIS, el saldo con ese aporte, la elegibilidad de beneficios, los montos líquidos futuros o las cuotas RV posteriores a cambios familiares. Hasta validarlos, deben quedar como hipótesis separadas del monto que se use para cualquier recomendación al cliente. El código mantiene sus funciones existentes con advertencias; este informe no dice que estén deshabilitadas.

## Correcciones efectuadas y alcance

1. Se evita el fallo de RP al proyectar una edad de beneficiario superior al dominio tabular, sin aceptar entradas iniciales inválidas ni simular fallecimientos nuevos.
2. Se redondea la división de porcentajes adultos como exige el ejemplo de S1: tres cónyuges con hijos 16,67% cada uno; no se renormaliza el pequeño residuo.
3. Referencia de invalidez parcial de la ruta duplicada 35→50%, coherente con art.56 y con la función de referencia existente. API/PDF se actualizan y `total_2_3` conserva compatibilidad con aviso de falta de categoría acreditada. El porcentaje no prueba derecho SIS.
4. Se informa `CNU_base/g` en tres rutas de garantía sola para expresar el divisor aplicado; no se cambia el pago. El redondeo previo limita la identidad a tolerancia de 1 CLP en vejez/invalidez.
5. Se corrigen certezas no respaldadas de cobertura SIS, aportes, garantías y complementos; se conservan avisos de independencia y estimación. Metadata de tasas reconoce la nueva evidencia primaria sin automatizar ni modificar defaults.

No se cambian las tablas TM-2020, los factores de garantía, tasas, rendimientos hipotéticos, fórmula vitalicia anual, método mensual temporal, ni se añaden funciones de cláusulas o estados familiares. La aritmética de referencia parcial y de redondeo sí cambia por los defectos documentados arriba. Los informes anteriores se conservan como historial; esta matriz actualiza su evaluación de tasas y alcance de validación.

## Verificaciones

- Base 147c78b: **143 pruebas**, todas aprobadas; TypeScript correcto; lint con tres errores anteriores.
- Árbol auditado: **150 pruebas, 20 suites, todas aprobadas**. Siete nuevas regresiones: dominio futuro en RP de dos regímenes; dos ejemplos de redondeo del Anexo 7; referencia parcial entre rutas; divisor de garantía en tres regímenes; categoría heredada sin acreditación legal. Se amplía la prueba de PDF multipágina para exigir el aviso especializado.
- `npm run typecheck`: aprobado.
- `npm run build -- --webpack`: aprobado, con generación de páginas y rutas de producción completada. Se usa la alternativa webpack ya comprobada en etapas anteriores; no se alteró configuración para ocultar errores.
- `npm run lint`: **tres errores anteriores, cero nuevos**, `react-hooks/set-state-in-effect` en `ModalitiesSelector.tsx`, `src/components/ui/carousel.tsx` y `src/hooks/use-mobile.ts`. No se deshabilitaron reglas. Un aviso del runner por el modo ESM del paquete también es anterior y no hace fallar pruebas.
- `node scripts/auditar-tm2020.mjs`: cero diferencias respecto de la transcripción oficial cotejada y cero edades adicionales sin respaldo en dominio activo. No implica una nueva consulta de todas las tablas originales en cada ejecución.
- `node scripts/verificar-integracion.mjs`: aprobado en producción local; incluye ocho modalidades, escenarios y opciones, avisos API, referencia parcial 50%, beneficiario mayor, fecha de Circular 2425, períodos13/0, UF, errores400 y PDF. Una aserción nueva quedó inicialmente fuera de su bucle, se corrigió antes del resultado final; no era fallo del motor de base.
- Chromium/Playwright: aprobado; prueba conservada en `scripts/verificar-presentacion.py` (requiere Python, Playwright y Chromium instalado; sin nuevas dependencias del proyecto). Verifica aviso visible, SIS como hipótesis, ausencia de afirmación de aporte obligatorio, CLP conservados al cambiar UF, referencia exacta en descarga PDF, tres curvas RP, derechos/edades, respuesta a fallo UF simulado y cero errores JavaScript. **Cero solicitudes a SCOMP**.
- `git diff --check`: aprobado.

No se interpreta ninguna prueba numérica interna como prueba de conformidad del Anexo 7. Falta un conjunto oficial de escenarios completos, revisión especializada y validación de pólizas/requisitos.

## Archivos de esta fase

- Documentación: `docs/fase-4-matriz-trazabilidad.md`, `docs/fase-4-riesgos-y-resultados.md`, `docs/fase-4-cambios-fundamentados.md`, `docs/fuentes/fase-4-documentos.json`, `README.md`.
- Cálculo y presentación: `src/lib/pension-calculator.ts`, `src/lib/reglas-sobrevivencia.ts`, `src/lib/reporte-pdf.ts`, `src/app/api/pension/route.ts`.
- Pantalla: `src/components/simulador/AffiliateSidebar.tsx`, `ModalitiesSelector.tsx`, `MultiQuotationResults.tsx`, `SummaryCards.tsx`.
- Verificación: `src/lib/__tests__/validacion-actuarial.test.ts`, `src/lib/__tests__/reporte-pdf.test.ts`, `scripts/verificar-integracion.mjs`, `scripts/verificar-presentacion.py`.

Se mantienen `master` y `origin/master` en `d1c619ec335eba88c85871b443d288e72ab89df9`; no se ejecutó push, no se usaron tokens personales y no se conectó el simulador con SCOMP. El commit de esta fase se crea localmente solo tras las verificaciones, con los errores anteriores de lint expresamente identificados.
