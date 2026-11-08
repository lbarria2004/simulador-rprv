# Piloto interno: resultados y condiciones de uso

Verificación: **2026-11-08**. Base conservada: `a1e8b1fbd060f1bf0cf18b94d36b795a53b99399`, rama local `codex/desarrollo`. Antes de editar se comprobaron rama, último commit y cambios pendientes con `git status`; se retomaron los archivos existentes sin reiniciar el proyecto. `master` permaneció en `d1c619ec335eba88c85871b443d288e72ab89df9`. No se publicó en GitHub, no se emplearon tokens personales ni se añadieron dependencias.

## Resultado y alcance

El piloto permite al asesor ensayar **exclusivamente datos ficticios** de vejez ordinaria hipotética con ahorro propio. Compara RP simple y RV inmediata teórica, sin compañías ni ofertas. Ningún monto final se clasifica como verificado normativamente: la fórmula local es una aproximación documentada y la aplicación individual queda pendiente de validación especializada.

Se conservan las fórmulas, tasas predeterminadas, tablas, conversiones y regresiones del motor anterior. Las restricciones y comprobaciones adicionales se aplican mediante `src/lib/piloto.ts`, compartido por API y PDF y consumido por pantalla. No se introdujeron fórmulas actuariales nuevas. La [matriz de 27 componentes](fase-4-matriz-trazabilidad.md) conserva su carácter de auditoría histórica; el [fundamento del piloto](piloto-decisiones.md) explica la decisión para cada grupo de componentes.

| Componentes de la matriz | Tratamiento en el piloto |
| --- | --- |
| M01–M09 | Se conservan las tablas y el CNU local. Se advierten diferencias del Anexo 7, falta de cuota mortuoria y límites de edad/precisión; se omite expectativa de vida individual. |
| M10–M11, M22 | Solo curvas RP sin beneficiarios, con saldo positivo e identidades financieras comprobadas. Con beneficiarios se entrega únicamente la situación inicial. No se proyectan eventos familiares. |
| M12–M14 | Dos descuentos reales explícitos y retornos hipotéticos separados de 0%, 2% y 4%. No se seleccionan circulares automáticamente ni se atribuye vigencia normativa a la tasa RV. |
| M15–M20 | Sin tasas comerciales, garantías, aumentos, combinaciones ni otros ajustes contractuales. El rechazo también se aplica a solicitudes HTTP directas. |
| M21 | Sin beneficiarios, o un cónyuge adulto y hasta cuatro hijos comunes no inválidos. Vínculos explícitos y estudios declarados para hijos de 18–23 años; sin porcentajes manuales ni acreditación de derechos. |
| M23, M25 | Sin invalidez, causante fallecido, SIS, PGU/BAC/BEV, comisiones ni pensiones líquidas. |
| M24, M26–M27 | Una misma referencia UF/fecha/fuente; sin alias de tablas ni resultados comerciales expuestos. El servidor recalcula el PDF; no acepta importes suministrados como resultados. |

Estos controles delimitan el uso de la aproximación, **no validan actuarialmente sus montos**. La RV no es una cotización ni una renta asegurada. Los gráficos RP son trayectorias condicionadas a supervivencia y supuestos constantes; verificar su caja no demuestra equivalencia con una AFP.

## Pantalla, API e informe

- Pantalla con identificador anónimo, edad y sexo declarados, ahorro AFP en CLP, UF manual con fuente y fecha, dos descuentos y tres escenarios. La fecha de valoración coincide con la fecha UF. Avisos, restricciones y fuentes permanecen visibles.
- El cálculo requiere confirmar uso de datos ficticios. Editar cualquier dato oculta resultados y gráficos anteriores y deshabilita el PDF hasta recalcular. Un error HTTP no produce estimaciones de respaldo.
- Se dibujan únicamente seis curvas RP calculadas: pensión y saldo inicial anual para los tres escenarios, con tabla de datos. No se dibuja una línea RV inventada ni saldo de aseguradora. Con saldo cero o beneficiarios no se habilitan curvas.
- `POST /api/pension` solo acepta `{ tipo: "comparacion_piloto", datos: DatosPiloto }`. `POST /api/reporte` solo acepta `{ datos: DatosPiloto }`; recalcula el resultado tras validar exactamente la misma política. GET de pensión informa perfil, fuentes y restricciones. `/api/tasas-rv` responde 403.
- Se rechazan campos desconocidos y cuerpos históricos, incluso resultados precalculados, cláusulas y supuestos modos expertos. Datos inválidos responden 400, funciones restringidas 403 y resultados fuera del dominio comprobable 422. Las respuestas satisfactorias de cálculo/PDF usan `Cache-Control: no-store`.
- El PDF incluye supuestos, referencia UF, fecha de valoración, tasas, comparación inicial, metodología resumida, restricciones y enlaces de fuentes. Solo incorpora curvas cuando la política las habilita. Cada página identifica datos ficticios, uso interno, ausencia de certificación y ausencia de oferta comercial.
- La UF admite hasta dos decimales para evitar representar una referencia distinta entre medios. Esto es una restricción operativa del ejercicio; el valor y la fuente manuales no se autentican contra SII. No se consulta automáticamente un servicio UF.

El contrato histórico de API/PDF se restringe deliberadamente. Sus funciones de biblioteca y pruebas siguen conservadas. Los scripts antiguos `verificar-integracion.mjs`, `verificar-presentacion.py` y `generate_proposal.mjs` documentan versiones anteriores; para esta versión se usan los scripts del piloto indicados abajo.

## Verificaciones ejecutadas

| Comprobación | Resultado |
| --- | --- |
| `npm test` | **195 pruebas aprobadas**, 22 suites, cero fallidas, omitidas o canceladas. Incluye las 150 regresiones previas y 45 comprobaciones nuevas; seis pruebas del PDF nuevo están incluidas en el total. |
| `npm run typecheck` | Aprobado, también después de compilar producción. |
| `npm run build -- --webpack` | Compilación de producción aprobada, generación de páginas y rutas API completas. Se usó webpack por la limitación de apertura de puertos del sandbox con Turbopack; no se deshabilitó la comprobación de tipos. |
| `npm run lint` | Aprobado, sin errores ni advertencias de ESLint. |
| `node scripts/verificar-piloto-http.mjs` | **79 solicitudes HTTP** aprobadas contra producción local: cálculos, moneda, rechazo de modalidades/campos, familias, errores JSON y PDF real. |
| `python scripts/verificar-piloto-navegador.py --salida docs/piloto/capturas` | **9 escenarios de navegador** aprobados en Chromium, escritorio 1440 px y móvil 390 px, configuración regional es-CL; sin errores JavaScript, solicitudes externas ni solicitudes SCOMP. |
| PDF y capturas | Inspección visual de las páginas y vistas; extracción de texto real y comprobación de márgenes con PyMuPDF en casos simple, familiar, saldo cero e identificadores/fuente de longitud máxima. Tres páginas en ejemplos normales; cuatro con grupo y textos máximos. Sin texto fuera de los márgenes inspeccionados. |
| Conservación y formato | `git diff --check` sin errores; motor `pension-calculator.ts`, `moneda.ts`, tablas y datos actuariales sin cambios. |

No se suman las solicitudes HTTP o escenarios de navegador al total del runner de pruebas: son métricas distintas. Se verificó consistencia interna y de presentación, sin un caso oficial completo que certifique el monto final del CNU.

Las pruebas nuevas cubren política compartida, invariancia CLP al cambiar UF, representación de UF, independencia entre retorno y descuento, edades y vínculos permitidos, estudios, bloqueo familiar, cero saldo, caja/calendario/horizonte de curvas, rechazo de resultados ajenos y contenido/paginación del PDF. El navegador comprueba además desaparición de resultados obsoletos, descarga desde entradas actuales, rechazo de estudios no declarados, fallo del servidor y ausencia de desborde móvil.

## Defectos corregidos y distinción del estado previo

1. **Trabajo piloto pendiente al reanudar:** TypeScript detectó la posición vertical del PDF posiblemente sin inicializar; se inicializó y mantuvo la apertura explícita de página antes de dibujar. La clase de error usa campos y constructor compatibles con el runner nativo de TypeScript.
2. **Política y referencias:** se rechazaron coerciones de listas a texto en enumeraciones; se acotó precisión UF para no mostrar una referencia redondeada diferente de la usada. El aviso histórico de 3,67% usa tolerancia numérica mínima: el valor de un campo porcentual dividido por 100 puede diferir en bits del literal equivalente. No se modificó la tasa ni la pensión.
3. **Presentación:** se incluyeron los valores originales de campos en la firma de entradas: borrar un saldo previamente cero debe invalidar la comparación. Se ajustaron saltos de línea y paginación de textos máximos del PDF. Se muestran porcentajes iniciales sin artefactos de precisión binaria.
4. **Errores de lint heredados:** tres efectos que actualizaban estado sincrónicamente en `use-mobile.ts`, `carousel.tsx` y `ModalitiesSelector.tsx` infringían las reglas de React existentes. Se usó suscripción mediante `useSyncExternalStore` en los dos primeros y estado derivado en el selector histórico. No se suprimieron reglas ni cambiaron fórmulas.
5. **Defectos de las pruebas durante esta fase:** se corrigió un tipo de unión de identificadores en una aserción, la comparación de texto PDF partido en líneas y un selector de alerta que también coincidía con el anunciador de rutas de Next.js. Tras corregirlos se ejecutaron las verificaciones pertinentes hasta aprobarlas.

Permanece el aviso informativo heredado de Node sobre `MODULE_TYPELESS_PACKAGE_JSON`; no provoca fallos. No se cambió el tipo global de módulos del proyecto para ocultarlo.

## Evidencias guardadas

- [Inicio de escritorio](piloto/capturas/01-inicio-escritorio.png).
- [Comparación y curvas calculadas](piloto/capturas/02-comparacion-escritorio.png).
- [Familia: comparación inicial sin curvas](piloto/capturas/03-familia-restringida.png).
- [Vista móvil del formulario](piloto/capturas/04-inicio-movil.png) y [comparación móvil](piloto/capturas/05-comparacion-movil.png).
- [PDF ficticio sin beneficiarios](piloto/capturas/informe-piloto-ficticio.pdf) y [PDF ficticio familiar](piloto/capturas/informe-familia-ficticia.pdf).
- [Resumen automatizado del navegador](piloto/capturas/resumen.json).

Las capturas recorren diferentes estados de prueba: la comparación inicial usa la referencia del formulario y los PDF descargados usan la referencia modificada de 50.000,25 CLP/UF al 01-10-2026. Son valores ficticios expresamente introducidos, no cotizaciones oficiales. La descarga se coteja con las entradas vigentes de ese estado, no con una captura anterior.

## Archivos del cambio

| Área | Archivos |
| --- | --- |
| Política y PDF nuevos | `src/lib/piloto.ts`, `src/lib/reporte-piloto.ts` |
| API restringida | `src/app/api/pension/route.ts`, `src/app/api/reporte/route.ts`, `src/app/api/tasas-rv/route.ts` |
| Pantalla y gráficos | `src/app/page.tsx`, `src/app/globals.css`, `src/app/layout.tsx`, `src/components/piloto/ProjectionCharts.tsx` |
| Correcciones de lint | `src/hooks/use-mobile.ts`, `src/components/ui/carousel.tsx`, `src/components/simulador/ModalitiesSelector.tsx` |
| Pruebas y fixtures nuevos | `src/lib/__tests__/piloto-fixtures.ts`, `src/lib/__tests__/piloto.test.ts`, `src/lib/__tests__/reporte-piloto.test.ts` |
| Verificación HTTP y navegador | `scripts/verificar-piloto-http.mjs`, `scripts/verificar-piloto-navegador.py` |
| Ejecución local | `package.json`: `dev` y `start` escuchan exclusivamente en 127.0.0.1. Sin cambios de dependencias ni lockfile. |
| Documentación y evidencias | `README.md`, `docs/piloto-decisiones.md`, `docs/piloto-resultados.md` y los ocho archivos de `docs/piloto/capturas/` enlazados arriba |

## Limitaciones pendientes y recomendación de piloto

**Revisión actuarial prioritaria:** CNU vitalicio anual con descuento a mitad de período, corrección 11/24 y casos completos del Anexo 7 pendientes, CNCM ausente, edad entera declarada y capital familiar aproximado. No existen casos oficiales integrales de referencia que permitan certificar la pensión. La validación de datos TM-2020 no certifica todas las fórmulas que los utilizan.

**Tasas y fechas:** revisión documental congelada al 08-11-2026; la valoración se limita a 01-07-2023–08-11-2026. El valor inicial RP 3,67% tiene el antecedente de Circular 2425 desde octubre de 2026, pero el programa no selecciona la circular por fecha. La RV 2,82% es hipótesis financiera configurable, sin tarifa comercial acreditada. Proyecciones mantienen descuentos y retornos constantes, sin afirmar vigencia futura. Ampliar fechas requiere revisar fuentes y política.

**Familias:** los porcentajes actuales son referencias bajo requisitos declarados; no se verifica documentación ni se liquida un derecho. Fallecimientos, pérdida de requisitos, mayoría de edad y acrecimientos futuros continúan bloqueados como proyecciones de cliente, aunque existan funciones históricas en la biblioteca. Garantías, aumentos y combinaciones requieren una metodología verificable antes de rehabilitarse.

**Operación:** no hay autenticación, control de acceso para varios usuarios ni almacenamiento de expedientes. La casilla de datos ficticios es una declaración; no detecta por sí sola datos personales reales. El enlace local y `noindex` no sustituyen controles de acceso. No se ha autorizado publicación ni uso con clientes reales.

Recomendación: realizar una sesión interna local con identificadores como `PILOTO-001`, saldos y UF ficticios, sin nombres ni RUT; comprobar primero el caso sin beneficiarios y luego cónyuge/hijos comunes. Revisar entradas, clasificación y advertencias antes de descargar. Registrar observaciones de legibilidad y consistencia; no recomendar una modalidad solo por la mayor pensión inicial. Mantener los montos como aproximaciones de orientación interna hasta contar con revisión especializada y casos oficiales completos. **No entregar estos PDF como propuestas, ofertas ni certificaciones.**

Para reproducir, con Node 24 y dependencias instaladas:

```bash
npm test
npm run typecheck
npm run lint
npm run build -- --webpack
npm run start
# En otra terminal, sin publicar el servidor:
node scripts/verificar-piloto-http.mjs
python scripts/verificar-piloto-navegador.py --salida /tmp/piloto-evidencias
```

El navegador requiere Python/Playwright y Chromium; la inspección adicional de PDF utilizó PyMuPDF disponibles en el entorno. No son dependencias de pago ni se requieren para ejecutar el motor o generar informes.
