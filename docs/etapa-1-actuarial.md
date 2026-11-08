# Revisión actuarial — etapa 1

Fecha: 8 de noviembre de 2026. Base revisada: `d1c619e`. Trabajo exclusivo en la rama local `codex/desarrollo`.

## Alcance

Simulador independiente de orientación previsional en Chile. Compara estimaciones de Retiro Programado (RP) y Renta Vitalicia (RV); no representa ofertas de AFP o aseguradoras, no garantiza pensiones ni rentabilidad y no se conecta con SCOMP. No se agregaron dependencias, servicios de pago ni credenciales personales. No se publicaron cambios.

Esta entrega corrige `calcularRetiroProgramado()` y su variante de invalidez, agrega escenarios de retorno para esas modalidades y corrige la asociación de datos personales en el CNU. Las proyecciones específicas de sobrevivencia todavía requieren la migración indicada en los pendientes.

## Estructura revisada

| Archivo o directorio | Función |
| --- | --- |
| `src/app/page.tsx` | Interfaz cliente; comparación de modalidades, proyecciones y selección del escenario de retorno. |
| `src/components/simulador/` | Formularios, resultados, gráficos y referencias de RV. |
| `src/lib/pension-calculator.ts` | CNU, RP, RV, invalidez, sobrevivencia y beneficios complementarios. |
| `src/lib/tablas-mortalidad.ts` | Adaptador que selecciona mortalidad y expone tasas locales de referencia. |
| `src/lib/tablas-mortalidad-oficiales.ts` | Cinco tablas con qx base 2020, factores de mejora y proyección por año. |
| `src/app/api/pension/route.ts` | API local de estimaciones; ahora expone tasas separadas y tres escenarios de RP. |
| `src/app/api/reporte/route.ts` | Exportación PDF con aviso de orientación en cada página. |
| `src/app/api/uf/route.ts`, `src/app/api/tasas-rv/route.ts` | Consultas heredadas a SII/mindicador y CMF. No son conexiones con SCOMP. |
| `src/lib/__tests__/` | Pruebas con el runner gratuito de Node.js. |
| `prisma/`, `src/lib/db.ts` | Esquema SQLite y cliente Prisma del scaffold; no se necesita base de datos para el motor actuarial. |

También existen `tablas-mortalidad.json`, `datos-oficiales.ts` y `datos-oficiales.json`: no se encontraron importaciones desde el motor activo. Su duplicación puede causar confusión; no se alteraron sus valores.

## CNU y mortalidad

El CNU aproxima el capital para una unidad de pensión mensual mediante:

`CNU_titular = 12 × suma_t [probabilidad de sobrevivir hasta t / (1 + tasaTecnicaCNU)^(t + 0,5)]`.

La sobrevivencia se actualiza como producto de `1 - qx(edad + t, añoBase + t)`. Se añade el valor esperado de pensiones de beneficiarios después de la muerte del titular. Ese término supone independencia de las vidas. Los porcentajes se obtienen del grupo vigente al recalcular cada año.

Selección actual de tablas:

| Persona | Tabla usada |
| --- | --- |
| Hombre no inválido | CB-H-2020 |
| Mujer no inválida, RP | B-M-2020 |
| Mujer no inválida, RV | RV-M-2020 |
| Persona con invalidez | MI-H-2020 o MI-M-2020 |
| Beneficiario eventual después del fallecimiento del titular | Selección por sexo/invalidez con modalidad RP, incluso al valorar RV del titular. Esta decisión heredada requiere validación actuarial. |

Los registros contienen edades 0–110. `getQxGeneracional()` impone qx = 1 a los 110 años. Aplica factores acumulados de mejora de 2021 a 2036 y prolonga el factor anual de 2036 después de esa fecha. Los alias planos llamados `TABLA_*_2020` en el adaptador contienen realmente qx proyectados a 2026; el motor usa la función generacional, no esos alias planos.

Se verificaron cobertura, probabilidades finitas entre 0 y 1, longitud de factores, consistencia de sus productos, qx de 2026 y continuidad 2036/2037. **Estas pruebas comprueban integridad interna, no autenticidad o vigencia normativa.** No se cotejaron los registros con una publicación original de SP/CMF ni se modificaron sus cifras.

## Errores corregidos

1. La proyección de RP pasaba `undefined` como beneficiarios: el primer año podía diferir de la pensión inicial y omitir cargas en todos los recálculos.
2. La tasa técnica del CNU también se utilizaba como retorno del saldo AFP. Ahora son parámetros independientes.
3. El CNU asociaba una lista filtrada de porcentajes con los índices de la lista original. Un hijo adulto o padre sin derecho podía desplazar los datos de otra persona. Se conservan identidad, edad, sexo, estudio e invalidez en cada resultado filtrado y se elimina la asociación por índice original, también en el CNU de sobrevivencia y aumento temporal.
4. RP de invalidez duplicaba el error, no avanzaba el año generacional y cortaba la proyección a los 81. Ahora delega en el motor corregido.
5. En el extremo del horizonte se podían proyectar retiros superiores al saldo. El retiro anual se limita a los fondos disponibles y el acumulado usa el retiro efectivo.
6. Los tipos omitían `nombre` de beneficiarios, `pensionPosterior` y fases que ya se utilizaban. También había resultados sin `expectativaVida`, inferencias demasiado estrechas de tasas y una rama imposible en el PDF. Se corrigieron para superar TypeScript.
7. Las pruebas estaban excluidas de TypeScript. Se incluyeron y se corrigieron sus datos incompletos y comprobaciones de campos opcionales. El runner original solo reportó dos archivos en este entorno; `--test-isolation=none` permitió ejecutar y contar los 42 casos originales y los nuevos.
8. La interfaz y metadatos se presentaban como SCOMP y ofertas oficiales. Se sustituyeron por simulaciones, tasas hipotéticas y referencias locales; se agregaron avisos en pantalla, API y PDF.
9. La configuración permitía compilar ignorando errores de TypeScript. Se eliminó esa excepción.
10. El gráfico reemplazaba pensiones iguales a cero o sin proyección por una caída inventada de 3,5% anual respecto de RV. Se eliminó ese relleno, se conservan los ceros y se corta la línea al terminar los datos calculados. Se usa `ComposedChart` para combinar áreas RV con la línea RP.

## Proyección y escenarios

Se conserva la firma posicional de RP: el cuarto argumento sigue siendo la tasa técnica, ahora nombrada `tasaTecnicaCNU`. El séptimo argumento opcional acepta `{ rentabilidadRealAnual, anoCalculo }`. Se mantienen `tasaInteres` como alias de descuento y año base 2026 por compatibilidad; el año se puede especificar en el motor/API.

| Escenario | Rentabilidad real anual hipotética |
| --- | --- |
| Conservador | 0% |
| Base (predeterminado) | 2% |
| Optimista | 4% |

Son supuestos constantes ilustrativos, no pronósticos. El conservador no representa la peor pérdida posible. El motor admite retornos negativos mayores que -100%; se verificó un caso de -5%.

Cada año copia los beneficiarios originales con `edadInicial + añosTranscurridos`, conserva sus atributos, recalcula el CNU con el año correspondiente y aplica:

- `retiroAnual = min(saldoInicial, saldoInicial / CNU_anual × 12)`.
- `saldoFinal = (saldoInicial - retiroAnual) × (1 + rentabilidadRealAnual)`.
- `retiroAcumulado` y `saldoAcumulado` representan el inicio del año.

`retiroAnual` y `saldoFinal` se exponen sin redondear para auditar caja; las pensiones y saldos de presentación se redondean. No se reutilizan cifras redondeadas en los recálculos. El horizonte heredado incluye años 0 a `min(45, 110 - edadInicial)`, es decir, hasta 46 filas. La proyección se detiene si se agota el saldo. No se presume que RP siempre disminuye: la trayectoria depende de los supuestos.

La salida incluye `tasaTecnicaCNU`, `rentabilidadRealAnual`, `anoCalculo` y, por fila, CNU, año calendario y beneficiarios con edades actualizadas.

### Ejemplo reproducible

Saldo $80.000.000, titular hombre de 65, cónyuge mujer de 62, porcentaje automático, descuento CNU 3,67%, año 2026, sin comisiones ni beneficios estatales. CNU inicial: 202,6132069320784. Cifras en pesos de poder adquisitivo del año base.

Antes: pensión inicial $394.841 y primera fila $455.884. Después: ambas son $394.841 en los tres escenarios.

| Escenario | Pensión mensual año 11 | Saldo al inicio del año 11 |
| --- | ---: | ---: |
| Conservador | $254.784 | $40.561.372 |
| Base | $310.581 | $49.444.086 |
| Optimista | $377.143 | $60.040.739 |

El retorno no altera el CNU ni la primera pensión; modifica el saldo posterior y las pensiones futuras. La tasa técnica sí cambia el CNU y la primera pensión.

### API local

`POST /api/pension` acepta `tipo: "retiro_programado"` o `"invalidez_rp"` con `datos.tasaTecnicaCNU`, `datos.rentabilidadRealAnual` y `datos.anoCalculo`. Todas las tasas se expresan en decimales (0,02 para 2%). Se mantienen `tasaRP` y `tasaInteres` como entradas de compatibilidad para el descuento.

`tipo: "escenarios_rp"` devuelve los tres resultados con los mismos datos y tasa técnica. `GET /api/pension` expone los supuestos de escenarios. Los errores de dominio del motor RP devuelven HTTP 400. La validación general de todas las modalidades todavía no está unificada.

## Limitaciones y pendientes actuariales

- Suma anual y descuento a mitad de año: no implementa una valorización mensual regulatoria completa, curva de tasas, gastos regulatorios ni todos los ajustes de un CNU oficial. No hay certificación actuarial.
- Se supone que titular y beneficiarios presentes siguen vivos en cada fecha de recálculo. Las probabilidades se usan para valorar el CNU; no se simulan fallecimientos ni pagos posteriores a la muerte del titular.
- La situación de estudiante e invalidez permanece constante salvo vencimiento por edad. No se modelan nuevas cargas, acreditaciones futuras, cambios matrimoniales ni dependencia entre vidas.
- Los porcentajes legales automáticos se recalculan anualmente (porcentaje de entrada 0). Un porcentaje personalizado positivo conserva su valor; requiere revisión de elegibilidad y reglas legales. El CNU no modela todos los cambios futuros de porcentajes dentro de cada suma.
- `calcularCNUIndividual()` conserva un límite anual inclusivo que puede incorporar el año de cumplimiento de 18/24; requiere revisión específica antes de usar sobrevivencia como estimación validada.
- **Las proyecciones heredadas de RP de sobrevivencia** (`calcularOpcionesSobrevivencia`, `calcularRetiroProgramadoSobrevivencia` y la rama cliente correspondiente) todavía mantienen edades/CNU o mezclan tasas. La selección de escenarios nueva se habilita para vejez e invalidez. Pendiente migrarlas a un único motor y revisar el retiro agregado por porcentajes, sin confundir pensión base y suma pagada al grupo.
- Rentabilidad real constante y retiro anual adelantado: no representa retiros mensuales, volatilidad, secuencia de retornos ni incertidumbre de longevidad. No incluye comisiones periódicas AFP, impuestos, salud, PGU, BAC o compensación de mujer dentro de la caja de la proyección.
- Los montos de la proyección son reales a poder adquisitivo constante. `UF_ACTUAL = 38.500` sigue siendo una referencia fija del motor; la interfaz usa su propio valor de UF. Pendiente unificar fecha y conversión UF/CLP, sin proyectar pesos nominales con retornos reales.
- Las tasas de RV, factores de garantía, beneficios y comisiones son parámetros locales heredados sin validación de vigencia en esta entrega. Una tasa media de referencia no permite reproducir una oferta individual de aseguradora. Las pruebas históricas heredadas no acreditan equivalencia con certificados ni ofertas oficiales.
- Hay afirmaciones regulatorias contradictorias sobre cláusulas de sobrevivencia entre funciones e interfaz. Pendiente revisión jurídica y actuarial; no se consideran resueltas porque las pruebas existentes pasen.
- Pendiente consolidar las tablas duplicadas y documentar procedencia, versión y trazabilidad de cada registro contra fuentes primarias.

## Validación técnica

Entorno: Node.js 24.22.1; dependencias gratuitas ya declaradas instaladas sin agregar paquetes al manifiesto. Prisma Client se generó localmente sin migraciones ni acceso a base de datos. El proyecto no tenía lockfile: la instalación resolvió, entre otras, Next.js 16.4.5 y Prisma 6.19.3; fijar dependencias queda pendiente para reproducibilidad entre entornos.

- `npm test`: 63 pruebas, 12 suites, todas superadas. 42 casos previos y 21 nuevos.
- `npm run typecheck`: superado, incluyendo las pruebas.
- ESLint de motor, pruebas, API y componentes modificados salvo página y selector: superado.
- `npm run lint`: 5 errores previos `react-hooks/set-state-in-effect` en página (2), selector de modalidades, carousel y `use-mobile`. Se reprodujeron los mismos cinco errores sobre una copia del commit base; no se desactivaron reglas. Pendiente refactorizar esos efectos.
- Compilación y comprobaciones de navegador/API/PDF: ver registro final al pie.

Los checks no validan la exactitud actuarial ni la vigencia legal de las estimaciones.

### Resultado final de compilación e integración

- `npm run build -- --webpack`: superado con comprobación de TypeScript habilitada, generación estática y las rutas API compiladas.
- `npm run build` (Turbopack): no completó en este entorno. Primero falló la descarga de las fuentes de Google dentro del sandbox; fuera de esa restricción, Turbopack falló con `Operation not permitted` al crear un proceso que abre un puerto para procesar CSS. Webpack compiló correctamente; el fallo de Turbopack queda como limitación del entorno, sin cambiar el bundler predeterminado del proyecto.
- Chromium/Playwright sobre la compilación de producción local: selector con tres opciones y tres curvas distintas, aviso visible, referencias RV sin etiquetas de ofertas oficiales, sin errores JavaScript y sin solicitudes a SCOMP. Para reproducibilidad se sustituyó únicamente `/api/uf` por un valor fijo en el navegador de prueba; no se verificó la disponibilidad de fuentes financieras externas.
- API HTTP real: tres escenarios con la misma pensión inicial y distintos saldos futuros; retorno negativo y año 2028; beneficiario de 62 pasa a 63 en el segundo año; año calendario pasa a 2029; fondos negativos devuelven 400; opción RP de invalidez y GET de parámetros funcionan.
- PDF descargado desde la interfaz: archivo válido de una página en el caso probado; texto extraído con `pdftotext` confirma aviso de orientación, ausencia de oferta oficial, retorno real 4,00% y descuento CNU 3,67%. El generador agrega el pie a todas las páginas; no se validó visualmente cada combinación de cláusulas ni reportes extensos.
- `git diff --check`: superado. `master` conserva el commit base. Se creó únicamente un commit local en `codex/desarrollo`, después de las verificaciones; no se ejecutó push.

### Inventario de archivos de esta entrega

| Grupo | Archivos modificados o creados |
| --- | --- |
| Motor | `src/lib/pension-calculator.ts` |
| Pruebas | `src/lib/__tests__/pension-calculator.test.ts`, `src/lib/__tests__/retiro-programado.test.ts` (nuevo), `src/lib/__tests__/tablas-mortalidad.test.ts` (nuevo) |
| API y PDF | `src/app/api/pension/route.ts`, `src/app/api/reporte/route.ts` |
| Página y metadatos | `src/app/page.tsx`, `src/app/layout.tsx` |
| Componentes de simulación | `AffiliateSidebar.tsx`, `InsuranceRankingTable.tsx`, `ModalitiesSelector.tsx`, `MultiQuotationResults.tsx`, `ScenarioSliders.tsx`, `SummaryCards.tsx`, `TrajectoryChart.tsx`, todos bajo `src/components/simulador/` |
| Comprobaciones | `package.json`, `tsconfig.json`, `next.config.ts` |
| Documentación | `README.md`, `docs/etapa-1-actuarial.md` (nuevo) |

Los archivos con cifras de mortalidad no se modificaron. Son 20 archivos en total.
