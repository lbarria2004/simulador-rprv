# Simulador RP / RV — orientación previsional en Chile

Herramienta independiente para comparar estimaciones de Retiro Programado y Renta Vitalicia. **Sin conexión con SCOMP. No constituye oferta oficial de AFP o aseguradora ni garantiza pensiones o rentabilidad.**

Stack: Next.js, React, TypeScript y tablas de mortalidad locales. No requiere servicios de pago para ejecutar el motor.

## Versión actual: piloto interno con datos ficticios

**Cierre preservado:** referencia funcional `2dae5e0`, etiqueta local `piloto-rprv-2dae5e0`. Consultar el [informe final de cierre](docs/piloto/cierre.md), la [instalación y demostración privada](docs/piloto/instalacion-y-demostracion.md), el [checklist de seguridad](docs/piloto/seguridad-y-privacidad.md) y los [pasos de una PR futura, aún no publicada](docs/piloto/publicacion-posterior.md). La identidad está en `version-piloto.json`; el paquete usa fuentes versionadas, inventario SHA-256 y dependencias fijadas.

El cálculo en pantalla, API y PDF está restringido a **RP simple y RV inmediata teórica**, con una política compartida y resultados estimativos pendientes de validación especializada. El constructor permite preparar y comparar las cinco modalidades, incluidas cláusulas pendientes, sin valorarlas. El cálculo de cláusulas, las ofertas comerciales, los beneficios y las proyecciones familiares futuras permanecen deshabilitados. Con beneficiarios se muestra solo la comparación inicial; las curvas RP requieren ahorro positivo, ausencia de beneficiarios y comprobación financiera.

La ampliación en `codex/escenarios-multimodalidad`, desde `318f57f`, incorpora escenarios editables y duplicables, selección y comparación responsive. Consultar el [informe del constructor y pruebas](docs/escenarios-resultados.md) y los [requisitos pendientes por modalidad](docs/escenarios-validacion-pendiente.md). Con producción local: `node scripts/verificar-escenarios-http.mjs` y `python scripts/verificar-escenarios-navegador.py`.

Consultar el [informe del piloto, verificaciones y limitaciones](docs/piloto-resultados.md), las [decisiones basadas en la matriz de 27 componentes](docs/piloto-decisiones.md) y las [capturas y PDF ficticios](docs/piloto/capturas/). `npm run dev` y `npm run start` escuchan en `127.0.0.1`; no hay autenticación ni autorización para uso con datos personales reales.

Verificación de esta versión: `npm test`, `npm run typecheck`, `npm run lint`, `npm run build -- --webpack`. Con producción local iniciada: `node scripts/verificar-piloto-http.mjs` y `python scripts/verificar-piloto-navegador.py`. Las secciones siguientes conservan el historial de fases; sus modalidades y contratos HTTP anteriores no están habilitados en el piloto.

## Desarrollo local

```bash
# Trabajar en la rama local del constructor
git switch codex/escenarios-multimodalidad
npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund
npm run db:generate
npm test
npm run typecheck
npm run dev
```

Node.js 24 permite ejecutar las pruebas TypeScript con el runner nativo. `db:generate` genera tipos de Prisma; no ejecuta migraciones ni modifica la base de datos. El cálculo de pensiones no necesita conexión a una base de datos. La app se sirve en `http://localhost:3000`.

`npm run lint` ejecuta ESLint y `npm run build` comprueba la compilación de producción. Las fuentes de Google de la plantilla necesitan red durante la compilación. El estado de estas comprobaciones y los fallos heredados se documentan en el informe de etapa.

## Primera etapa

- Beneficiarios y edades conservados en los recálculos anuales de RP de vejez e invalidez.
- Tasa técnica del CNU separada de rentabilidad real hipotética del fondo AFP.
- Escenarios conservador (0%), base (2%) y optimista (4%), seleccionables en pantalla y disponibles en el motor y API.
- Pruebas de regresión, integridad interna de tablas, auditoría de flujos y comprobación de TypeScript incluyendo tests.

Consultar [revisión, resultados y limitaciones actuariales](docs/etapa-1-actuarial.md) antes de interpretar una estimación. El informe de fase 2 actualiza el estado de sobrevivencia y la validación contra fuentes primarias.

Los cambios de esta etapa se mantienen en `codex/desarrollo`; no se deben publicar ni integrar en `master` sin una instrucción posterior.

## Fase 2: moneda y sobrevivencia

La UF es ahora una referencia configurable `{ valor, fecha, fuente }` que comparten motor, API, gráfico y PDF. Los fondos canónicos y las proyecciones se expresan en CLP reales de esa fecha. El supuesto inicial es ilustrativo; la consulta remota se ejecuta solo cuando se solicita actualizar la UF.

RP de sobrevivencia comparte un motor único, actualiza beneficiarios y distingue la pensión base de reparto del total pagado. La selección de tablas se corrigió por rol y la frontera anual de hijos se documentó antes de modificarla.

Consultar [fundamentos previos y fuentes](docs/fase-2-fundamentos.md) e [informe de resultados, migración monetaria y límites pendientes](docs/fase-2-resultados.md). Este informe actualiza los pendientes y ejemplos de la primera etapa; no acredita equivalencia con cálculos oficiales.

Con la app local iniciada, `node scripts/verificar-integracion.mjs` ejecuta regresiones HTTP. `node scripts/generate_proposal.mjs 45000.13 2026-10-01 /tmp/estudio.pdf` genera un ejemplo con referencia explícita. El valor del ejemplo no corresponde a una cotización oficial.

## Fase 3: validación documental y períodos mensuales

Las tablas TM-2020 se cotejaron con los originales SP/CMF: se corrigieron cuatro discrepancias y se retiraron edades RV-M sin respaldo. Los aumentos temporales usan exactamente los meses solicitados con una hipótesis mensual documentada; el CNU vitalicio sigue siendo una aproximación anual. Porcentajes legales, incrementos, ajustes manuales y participación familiar se informan por separado.

Consultar [fundamentos y fuentes](docs/fase-3-fundamentos.md) e [informe de verificaciones y limitaciones](docs/fase-3-resultados.md). No se afirma conformidad normativa. `node scripts/auditar-tm2020.mjs` verifica la transcripción local y `node scripts/auditar-tm2020.mjs d1c7ef3` reproduce las diferencias de esta fase. Las tasas y garantías siguen siendo supuestos sin vigencia primaria acreditada; los escenarios de pantalla se presentan sin atribución a compañías.

## Auditoría final de trazabilidad

La [matriz por componente y caso del Anexo 7](docs/fase-4-matriz-trazabilidad.md) y el [informe de riesgos y recomendaciones para clientes](docs/fase-4-riesgos-y-resultados.md) actualizan las conclusiones de fase 3. Se documentó la Circular SP 2425: el 3,67% tiene respaldo desde 01-10-2026; su aplicación a otras fechas no es automática ni certificada. Los montos finales siguen siendo aproximaciones o pendientes de validación especializada.

Esta fase corrige únicamente defectos demostrados y mensajes de certeza sin respaldo; conserva tasas, tablas y metodología del CNU vitalicio. Consultar el [fundamento de cada corrección](docs/fase-4-cambios-fundamentados.md). Con la app local iniciada, las comprobaciones HTTP siguen disponibles en `node scripts/verificar-integracion.mjs`; la auditoría de pantalla está en `python scripts/verificar-presentacion.py` y requiere Python/Playwright/Chromium ya instalados.
