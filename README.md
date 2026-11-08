# Simulador RP / RV — orientación previsional en Chile

Herramienta independiente para comparar estimaciones de Retiro Programado y Renta Vitalicia. **Sin conexión con SCOMP. No constituye oferta oficial de AFP o aseguradora ni garantiza pensiones o rentabilidad.**

Stack: Next.js, React, TypeScript y tablas de mortalidad locales. No requiere servicios de pago para ejecutar el motor.

## Desarrollo local

```bash
# Trabajar exclusivamente en la rama de desarrollo preparada
git switch codex/desarrollo
npm install
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
