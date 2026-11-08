# Fase 2: consistencia monetaria y actuarial

Base de trabajo: commit local `8c7affa`, rama `codex/desarrollo`. Fecha: 2026-11-08.

Esta entrega se ejecutó exclusivamente en la rama local. No se modificó `master`, no se hizo push, no se utilizaron tokens personales y no se agregaron dependencias ni servicios de pago. El simulador sigue siendo orientativo e independiente de SCOMP.

## Fundamento y límites del cambio

El [fundamento previo](fase-2-fundamentos.md) registra las fuentes primarias y las decisiones antes de cambiar selección de tablas, frontera temporal y flujo de sobrevivencia. Se conserva la suma anual de CNU; no se implantó una fórmula regulatoria nueva ni una calibración contra ofertas.

| Componente | Respaldo y situación |
| --- | --- |
| Existencia y poblaciones TM-2020 | Respaldadas por el [Capítulo IX de SP](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10624.html). Se corrigió RV-M para pensionadas de vejez y B-M para beneficiarias, con rol explícito e independiente de modalidad RP/RV. |
| qx y mejora por edad/año | Su estructura está respaldada por el [Anexo 9](https://www.spensiones.cl/portal/institucional/594/w3-article-15659.html). La transcripción numérica local y su prolongación después de 2036 siguen sin cotejo integral contra la fuente original. |
| CNU del grupo y situaciones familiares | El [Anexo 7](https://www.spensiones.cl/portal/institucional/594/w3-article-7253.html) fundamenta la distinción de casos y capitales por beneficiario. El código conserva una suma anual simplificada, con tasa plana y descuento a mitad de año; omite términos y reglas mensuales del cálculo oficial. |
| Límite de hijos | La [orientación oficial de ChileAtiende](https://www.chileatiende.gob.cl/fichas/5258-pension-de-sobrevivencia-del-sistema-de-pensiones-afp) respalda las condiciones de edad/estudio/invalidez. Se elimina el año adicional del bucle inclusivo; siguen pendientes las condiciones completas de acreditación y reglas mensuales. |
| Tasas técnicas, retornos 0/2/4%, garantía y aumentos | Supuestos locales o aproximaciones; no ofertas, pronósticos ni reproducción de condiciones de aseguradoras. Los factores porcentuales de garantías no tienen certificación actuarial. |
| Beneficios y comisiones | Parámetros heredados; se alineó su aplicación monetaria entre pantalla/PDF. No se certificaron vigencia, elegibilidad completa o adecuación legal. |

Los comentarios que citaban «SP 2.164 / CMF 2.272» como fundamento de TM-2020 se corrigieron. La referencia comprobada en el Compendio es SP NCG 306, de 24-02-2023. Se compararon mediante igualdad estructural las cinco matrices con las del commit base: **ningún qx ni factor numérico cambió**.

## Auditoría UF/CLP

Antes coexistían: UF 38.500 en pensiones, 40.876,41 en pantalla/financiamiento/respaldo remoto, 40.000 en ramas PDF y una UF inferida por cociente en tarjetas. El gráfico mezclaba UF obtenidas del motor con conversiones al valor de la interfaz. El PDF confiaba en `pensionEnUF` remitida por el cliente y redondeaba el saldo UF a enteros.

Ahora `src/lib/moneda.ts` centraliza:

- `ReferenciaUF = { valor, fecha, fuente }`, validada y copiada por cálculo.
- `clpAUf()` y `ufAClp()` sin redondeo intermedio, con valores finitos y UF positiva.
- Un único supuesto inicial inmutable: $40.000 por UF, fecha 2026-01-01 y fuente explícitamente ilustrativa. **No se presenta como un dato oficial de esa fecha ni como UF vigente.**

La UF se puede configurar en pantalla y en el último parámetro monetario de los motores. Se retiró `UF_ACTUAL` y los valores alternativos fijos. Los resultados de pensión incluyen `referenciaUF` y `unidadMonetaria: CLP_REALES`. Los parámetros que antes recibían un `valorUF` numérico ahora reciben el objeto fechado; esto es una migración explícita de la API del módulo.

El año actuarial predeterminado procede del año de la referencia UF, en lugar de fijarse en 2026 en recálculos internos. RP permite un año de escenario explícito mediante `anoCalculo`; esa opción representa una hipótesis de calendario y no actualiza el poder adquisitivo por sí sola.

Las proyecciones conservan CLP de poder adquisitivo constante de la fecha indicada. La tasa técnica descuenta flujos reales y el retorno real mueve el saldo. Cambiar solo el valor UF altera la representación, sin alterar CLP ni CNU. Cambiar el año de valoración sí puede alterar el CNU generacional. No se reexpresan automáticamente importes históricos por IPC: al elegir otra fecha, el usuario debe introducir los CLP reales de esa base.

Pantalla conserva CLP como dato canónico al cambiar la UF y recalcula los equivalentes de ahorro e ingreso base, evitando reconvertir UF ya redondeadas. Los resultados se derivan en la misma renderización con `useMemo`; se retiró el estado duplicado que podía mezclar una UF nueva con resultados anteriores. También se alinearon los interruptores de beneficios con su aplicación en el PDF.

## API y PDF

Ejemplo de entrada nueva:

```json
{
  "tipo": "sobrevivencia_rp",
  "datos": {
    "fondos": 80000000,
    "edad": 65,
    "sexo": "M",
    "unidadMonetaria": "CLP_REALES",
    "tasaTecnicaCNU": 0.0367,
    "rentabilidadRealAnual": 0.02,
    "referenciaUF": { "valor": 45000.13, "fecha": "2026-10-01", "fuente": "Supuesto del usuario" },
    "beneficiarios": [{ "tipo": "conyuge", "edad": 62, "sexo": "F", "porcentajePension": 0 }]
  }
}
```

`fondos` siempre corresponde a CLP reales, no UF. El valor de ejemplo no es un dato oficial. Las tasas se expresan en decimales. Si no se envía `referenciaUF` en cálculo se utiliza el supuesto inicial y se devuelve en la respuesta. Las entradas monetarias antiguas `uf`/`valorUF` y unidades incompatibles se rechazan con 400 para evitar interpretaciones silenciosas.

`POST /api/reporte` requiere `parametros.referenciaUF`. Se separó el renderizador en `src/lib/reporte-pdf.ts`, permitiendo probar las cadenas que efectivamente dibuja. El PDF:

- Recalcula cada equivalente UF desde CLP y la referencia validada; no confía en `pensionEnUF` precalculada.
- Conserva centavos del valor UF, saldo UF con dos decimales y fecha de referencia.
- Rechaza resultados anotados con valor/fecha distintos del reporte para evitar informes con datos desactualizados.
- Rechaza la antigua proyección nominal lineal de UF dentro de las series reales.
- Usa los helpers del motor para BAC y compensación; deja de forzar PGU a menores de 65.
- Dibuja el aviso de orientación en todas las páginas.

La consulta opcional de UF mantiene SII como fuente primaria y mindicador como secundaria. El parser se limita al mes/día solicitado, con fecha de Chile; no busca un día homónimo en otro mes. Una fuente secundaria conserva su fecha real, aunque sea anterior al día consultado. Si ambas fallan, retorna 503 y no inventa un valor con fecha de hoy. La interfaz conserva la referencia seleccionada. Las pruebas remotas son con respuestas controladas; no garantizan disponibilidad futura de esas fuentes.

## Sobrevivencia

Se retiraron las proyecciones duplicadas del cliente y de `calcularOpcionesSobrevivencia()`. Ambas llaman al mismo motor RP que:

1. Actualiza edad y año calendario, conservando identidad, estudio e invalidez.
2. Recalcula elegibilidad, porcentajes y CNU cada año; un porcentaje personalizado no fuerza a un hijo sin derecho a seguir cobrando.
3. Distingue `pensionBaseReparto` de la suma pagada al grupo. El campo principal, gráfico y PDF presentan el total familiar.
4. Retira `min(saldo, 12 × baseReparto × sumaPorcentajes)` y aplica el retorno real al remanente.
5. Expone pagos individuales, retiro anual efectivo y saldo final auditables. El acumulado representa retiros efectuados al inicio de la fila anual.
6. Mantiene el saldo sin inventar pagos cuando no queda ningún beneficiario con derecho.

RV de sobrevivencia también distingue base y total, conserva la base sin redondear al elaborar variantes y convierte el agregado con la referencia elegida. Se eliminó el redondeo de porcentajes antes del prorrateo/CNU; se redondean las cuotas monetarias al presentarlas. Las diferencias de centavos o pesos entre importes de presentación y flujos internos se explican por ese redondeo, no por cambio de unidad.

Ejemplo de auditoría: saldo $80.000.000, causante hombre 65, cónyuge mujer 62 e hijo hombre 17, porcentajes automáticos. En `8c7affa`, el resultado mensual principal era $760.299 y las cuotas sumaban $494.194. Ahora el principal y la suma coinciden en $502.339. La base es $772.829,1263; el retiro anual efectivo $6.028.067,1853. La diferencia respecto del agregado anterior incluye la corrección de la frontera anual del hijo. Son cifras ilustrativas del modelo, no ofertas.

## Verificación

Entorno conservado: Node.js 24.22.1, Next.js 16.4.5 y dependencias ya instaladas. No hubo nuevas dependencias.

| Comprobación | Base 8c7affa | Resultado de la fase |
| --- | --- | --- |
| `npm test` | 63 pruebas superadas | 104 pruebas, 16 suites, todas superadas; 41 casos nuevos. |
| `npm run typecheck` | Superado | Superado, incluidas pruebas y renderizador PDF. |
| `npm run build -- --webpack` | Superado en fase anterior | Superado con TypeScript habilitado. El sandbox produjo un fallo al leer `--showConfig`; la compilación local fuera de esa restricción pasó. |
| `npm run lint` | 5 errores anteriores | 3 errores anteriores; se resolvieron los dos de la página. No quedan errores nuevos. |
| Regresión HTTP | Sin script versionado | `node scripts/verificar-integracion.mjs`: cinco modalidades, opciones de sobrevivencia, referencia, pagos, errores 400 y PDF superados. |
| Navegador | Comprobación de fase 1 | CLP conservados al editar UF, tres curvas diferentes, referencia/fecha iguales en resultados/PDF, total familiar, edades y conservación de UF ante fallo remoto. |

Los tres errores pendientes de lint son `react-hooks/set-state-in-effect` en `ModalitiesSelector.tsx`, `src/components/ui/carousel.tsx` y `src/hooks/use-mobile.ts`, reproducidos al inicio de la fase. No se silenciaron reglas. Turbopack mantiene el antecedente de restricción de puertos documentado en la fase 1; esta fase valida compilación con Webpack.

Las pruebas PDF decodifican el contenido realmente dibujado con `pdf-lib`, sin instalar herramientas nuevas ni limitarse a inspeccionar metadatos. Cubren moneda, fecha, rechazo de referencias incompatibles, importes UF precalculados erróneamente, PGU antes de 65 y avisos en múltiples páginas. Las pruebas de mortalidad se ampliaron con selección de rol, cese del hijo, prorrateo y año de valoración.

## Limitaciones pendientes

- No hay certificación de CNU, transcripción de tablas ni metodología mensual regulatoria. Permanecen tasa plana, discretización anual, independencia de vidas, horizonte máximo y ausencia de cuota mortuoria y otros ajustes.
- Deben revisarse todos los porcentajes legales y la taxonomía familiar. Por ejemplo, el 11% heredado para hijo huérfano no quedó acreditado por las fuentes consultadas; **no debe interpretarse como porcentaje legal validado**. Tampoco se modelan todos los casos de convivientes, concurrencias o invalidez parcial.
- Los derechos de estudio/invalidez se mantienen como hipótesis salvo el límite de edad; no se modela acreditación ni fallecimientos durante la trayectoria. Los porcentajes positivos personalizados conservan el valor ingresado mientras exista derecho por edad y no certifican elegibilidad legal.
- RV con cláusulas de sobrevivencia conserva aproximaciones y afirmaciones regulatorias heredadas cuya revisión jurídica está pendiente. La corrección de totales no valida la contratación de tales cláusulas. Las proyecciones RV no modelan todas las futuras salidas del grupo.
- Las funciones temporales generales siguen redondeando meses a años y variantes antiguas aún reutilizan importes de presentación para algunos ajustes. No se sustituyeron esos métodos por calibraciones sin fundamento.
- Las funciones genéricas de PGU, BAC, SIS, compensación y comisiones son simplificadas. Se alinearon pantalla/PDF, no se certificó normativa vigente ni elegibilidad. No incorporan impuestos, salud o todos los gastos en la caja del fondo.
- La referencia monetaria expresa una base real elegida, no un índice histórico de IPC; mover la fecha no calcula inflación. No se ofrecen retornos nominales ni trayectorias nominales.
- Las tablas duplicadas inactivas (`datos-oficiales.*`, `tablas-mortalidad.json`) no se consolidaron ni se certificaron. El motor activo usa el adaptador y la transcripción TM-2020 ya identificados.
- Se mantiene la ausencia de lockfile del proyecto; resolver versiones a futuro puede cambiar el entorno. No se actualizaron dependencias en esta fase.
- Continúan los tres errores previos de lint. No se validaron visualmente todas las combinaciones de cláusulas ni la paginación de cada caso legal.

## Archivos de la entrega

Son 25 archivos modificados o nuevos:

- `README.md`
- `docs/fase-2-fundamentos.md`
- `docs/fase-2-resultados.md`
- `scripts/generate_proposal.mjs`
- `scripts/verificar-integracion.mjs`
- `src/app/api/pension/route.ts`
- `src/app/api/reporte/route.ts`
- `src/app/api/uf/route.ts`
- `src/app/page.tsx`
- `src/components/simulador/AffiliateSidebar.tsx`
- `src/components/simulador/InsuranceRankingTable.tsx`
- `src/components/simulador/MultiQuotationResults.tsx`
- `src/components/simulador/SummaryCards.tsx`
- `src/components/simulador/TrajectoryChart.tsx`
- `src/lib/__tests__/moneda-sobrevivencia.test.ts`
- `src/lib/__tests__/pension-calculator.test.ts`
- `src/lib/__tests__/reporte-pdf.test.ts`
- `src/lib/__tests__/tablas-mortalidad.test.ts`
- `src/lib/__tests__/uf-remota.test.ts`
- `src/lib/moneda.ts`
- `src/lib/pension-calculator.ts`
- `src/lib/reporte-pdf.ts`
- `src/lib/tablas-mortalidad-oficiales.ts`
- `src/lib/tablas-mortalidad.ts`
- `src/lib/uf-remota.ts`
