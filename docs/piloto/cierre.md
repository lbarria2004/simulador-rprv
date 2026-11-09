# Cierre y preservación del piloto RP/RV

Fecha de cierre: **09-11-2026**. Referencia funcional: **`2dae5e018f55557bd8a0bad5c85939ec4fb475bd`**, rama `codex/desarrollo`, etiqueta exclusivamente local **`piloto-rprv-2dae5e0`**. La [identidad de versión](../../version-piloto.json) registra esta referencia y los hashes de las evidencias ficticias aprobadas. El commit adicional de cierre se identifica mediante `git log -1` y el campo `revision_paquete` del inventario entregado; no reemplaza la referencia funcional.

Antes de editar se comprobó árbol limpio, rama y commit. `master` y `origin/master` local permanecen en `d1c619ec335eba88c85871b443d288e72ab89df9`. No se hizo push, no se creó PR ni se publicó la etiqueta o una demostración. No se utilizaron tokens personales ni se conectó con SCOMP.

## Cambios acotados del cierre

- Identidad de versión, etiqueta local y guías de instalación, demostración privada, seguridad y futura PR.
- Archivo de dependencias fijadas y `.nvmrc`; sin actualizaciones de versiones instaladas ni nuevas dependencias declaradas. El lockfile incluye 962 entradas, también variantes opcionales para otras plataformas; esas plataformas no se declaran verificadas. La resolución conserva el tratamiento heredado de pares mediante `--legacy-peer-deps`.
- Generador y verificador deterministas del paquete, con inventario y pruebas de exclusión, contenido e integridad.
- Eliminación del nombre personal en los metadatos HTML para cumplir la exclusión de datos personales del paquete. Sin cambios en los cálculos ni en la experiencia funcional.
- Exclusión de cachés Python y entregables generados del seguimiento Git.

El árbol preinstalado carecía de lockfile versionado y sus metadatos locales eran incompletos. El primer lockfile obtenido sin red dejó entradas opcionales sin versión; una instalación aislada lo rechazó. Se reconstruyó desde versiones instaladas, completó con metadatos públicos npm y agregó URLs e integridades del registro para cada dependencia. No se cambió una versión existente para resolver este problema de empaquetado. La instalación se verificó fuera del repositorio, sin usar las dependencias instaladas del proyecto original como sustituto de una descarga.

## Funcionalidades preservadas

| Habilitado únicamente con datos ficticios | Condiciones |
| --- | --- |
| RP simple y RV inmediata teórica | Vejez ordinaria hipotética, ahorro propio, montos brutos; sin compañía ni oferta. |
| UF configurable y fecha de valoración | Una referencia manual CLP/UF con fecha y fuente compartidas; no autenticada contra SII. |
| Descuentos y escenarios | Dos descuentos reales configurables; retornos AFP hipotéticos 0%, 2% y 4%, separados del CNU. |
| Curvas y tabla RP | Solo sin beneficiarios, saldo positivo y caja/calendario/horizonte comprobados. Sin trayectoria RV inventada. |
| Beneficiarios de grupo simple | Un cónyuge adulto y hasta cuatro hijos comunes no inválidos, vínculos explícitos; solo comparación inicial. Estudios declarados cuando corresponda. |
| PDF estimativo | Recalculado en servidor desde datos validados; fuentes, fecha, supuestos, límites y avisos en todas las páginas. |

| Bloqueado o fuera de alcance | Motivo |
| --- | --- |
| Garantías, aumentos temporales, combinaciones y otras cláusulas | Factores/contratos pendientes de validación especializada, M16–M20. |
| Proyecciones familiares futuras | Fallecimientos, pérdida de requisitos y acrecimientos no liquidados íntegramente, M07/M11/M21/M22. |
| Grupos complejos, porcentajes manuales, invalidez, causante fallecido y SIS | Requisitos y capitales especializados fuera del perfil; la exclusión no niega derechos legales. |
| PGU, BAC, BEV, comisiones y pensión líquida | No se validan elegibilidad ni liquidaciones, M25. |
| Ofertas, tasas comerciales y atribución a compañías | RV exclusivamente teórica; endpoint de tasas comerciales responde 403. |
| Resultados precalculados y modos expertos por HTTP | Contrato cerrado y compartido por cálculo y PDF. |
| Datos reales, expedientes, acceso público y certificación normativa | No autorizados ni implementados como operación del piloto. |

La clasificación de los 27 componentes sigue en la [matriz](../fase-4-matriz-trazabilidad.md), aplicada por las [decisiones del piloto](../piloto-decisiones.md). La revisión actuarial permanece en **08-11-2026**. El cierre no amplía la ventana de valoración ni acredita normativa posterior.

## Verificaciones de cierre

| Comprobación | Resultado |
| --- | --- |
| `npm test` | 195 pruebas del simulador aprobadas, 22 suites. Incluye política compartida, moneda, beneficiarios, restricciones y texto PDF. |
| `python scripts/pruebas-paquete-piloto.py` | Ocho pruebas aprobadas: inclusión/exclusión, patrones de secretos/datos, binarios autorizados, determinismo e integridad. |
| TypeScript, lint, build webpack | Aprobados, sin suprimir reglas ni comprobación de tipos. |
| Integración HTTP de producción local | 79 solicitudes aprobadas; no se aceptan funciones bloqueadas ni resultados ajenos para el PDF. |
| Chromium escritorio/móvil | Nueve escenarios aprobados, sin errores JS ni solicitudes externas/SCOMP; casos ficticios, avisos, cambios de datos, errores y descarga coherente. |
| Instalación y paquete | Instalación aislada desde el lockfile, generación explícita de Prisma y verificaciones desde fuentes extraídas; inventario comprobado y dos comprimidos de la misma revisión idénticos. |
| Conservación | Rama `codex/desarrollo`, referencia del piloto preservada, motor/tablas/política actuarial sin cambios y `master` intacta. |

Las ocho pruebas del paquete se suman a las 195 del simulador: **203 pruebas**, con HTTP y navegador informados por separado. Sigue el aviso informativo de Node sobre módulos sin tipo explícito. No se considera un fallo. La compilación usa webpack, alternativa ya comprobada ante las restricciones de Turbopack en este entorno.

## Inventario y verificación del entregable

Se entregan tres archivos externos al repositorio: `.tar.gz`, `.inventario.json` y `.sha256`. El comprimido contiene `simulador-rprv-piloto/`, con código `src/`, pruebas y scripts, documentación y matriz, fuentes/datos actuariales locales, cinco capturas y dos PDF ficticios aprobados, configuraciones de compilación, esquema Prisma histórico, `package.json`, lockfile, `.nvmrc` y `version-piloto.json`.

`INVENTARIO.json` también va dentro del comprimido y enumera rutas, tamaños y SHA-256 de **147 archivos fuente**: el comprimido contiene 148 archivos contando ese inventario. No se incluye a sí mismo en su lista para evitar una referencia circular; el checksum externo cubre el comprimido completo. Registra el commit funcional, la revisión del paquete, su árbol Git y las exclusiones. La versión final del entregable debe indicar `tipo_revision: commit`; durante la verificación previa al commit se permite un árbol Git preparado.

Excluidos: `.git` y autores/historial, credenciales, `.npmrc`, `.env*`, llaves, dependencias instaladas, compilados/cachés, bases/cargas de usuario y archivos personales. Los dos JSON de búsquedas históricas de beneficios en la raíz y el directorio `download` no forman parte del paquete: no los necesita el piloto ni contienen código activo. Permanecen conservados en el repositorio. No se borraron modificaciones previas ni fuentes históricas.

La lista de inclusión y la búsqueda de patrones conocidos no constituyen un detector universal de secretos o datos personales. Se revisaron textos y evidencias ficticias admitidas; los binarios nuevos o alterados se rechazan por hash. Cualquier distribución posterior requiere revisar de nuevo los cambios. El archivo no lleva dependencias de pago ni datos reales habilitados.

## Recomendación y pasos posteriores

Conservar la entrega como demostración interna local con datos ficticios. No entregar sus PDF como ofertas ni certificaciones. Siguen pendientes CNU completo del Anexo 7, CNCM, tratamiento de edades/eventos familiares y selección normativa de tasas por fecha. Las pruebas verifican fórmulas locales y controles, no conformidad normativa.

La aplicación no ofrece autenticación. No abrirla a red pública ni usar datos reales: completar antes el [checklist de seguridad y privacidad](seguridad-y-privacidad.md), con revisión especializada e independiente según el alcance. No se hizo una auditoría integral de vulnerabilidades ni se probó infraestructura remota.

La [guía de instalación y demostración](instalacion-y-demostracion.md) contiene los comandos para reproducir. Los [pasos exactos para una PR posterior](publicacion-posterior.md) y el [título/cuerpo preparado](pull-request-propuesta.md) quedan listos para una futura autorización, sin ejecutar publicación, creación de PR o merge.

Archivos del cierre: `.gitignore`, `.nvmrc`, `README.md`, `package-lock.json`, `version-piloto.json`, `src/app/layout.tsx`, `scripts/paquete-piloto.py`, `scripts/pruebas-paquete-piloto.py` y los cinco documentos `docs/piloto/{cierre,instalacion-y-demostracion,seguridad-y-privacidad,publicacion-posterior,pull-request-propuesta}.md`. Las evidencias funcionales originales se conservan en [capturas y PDF](capturas/).
