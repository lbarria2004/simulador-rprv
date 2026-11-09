# Instalación y demostración controlada del piloto

Referencia funcional preservada: `2dae5e018f55557bd8a0bad5c85939ec4fb475bd`. El cierre añade documentación, controles de empaquetado y fijación de dependencias; no amplía las modalidades. Consultar `version-piloto.json`, el [cierre](cierre.md), la [matriz actuarial](../fase-4-matriz-trazabilidad.md) y el [checklist](seguridad-y-privacidad.md).

## Requisitos y alcance de reproducibilidad

- Linux x64 con glibc, Node **24.22.1**, npm **11.9.0**, Python 3 para verificar el paquete. `.nvmrc` registra Node. Otras plataformas no están verificadas en este cierre.
- Red durante la instalación desde npm público, generación del cliente Prisma si necesita su motor y compilación de las fuentes Google de la plantilla. No se necesitan cuentas de AFP, aseguradoras, SCOMP, tokens ni servicios de pago.
- Para navegador: Python con Playwright y Chromium. El script usa `/usr/bin/chromium`. La inspección adicional del PDF puede hacerse con PyMuPDF; no es requisito para generarlo.
- No se distribuyen `node_modules`, compilados, cachés, `.git`, `.env`, credenciales ni bases de datos. La generación del archivo comprimido es determinista para la misma revisión y versión de Python/zlib. Los binarios de producción no se declaran reproducibles byte a byte.

## Verificar y extraer el paquete

Usar los nombres exactos entregados en el informe de cierre. En el directorio de los tres archivos:

```bash
sha256sum -c simulador-rprv-piloto-2dae5e0-cierre-REVISION.sha256
tar -tzf simulador-rprv-piloto-2dae5e0-cierre-REVISION.tar.gz
tar -xzf simulador-rprv-piloto-2dae5e0-cierre-REVISION.tar.gz
cd simulador-rprv-piloto
python scripts/paquete-piloto.py verificar ../simulador-rprv-piloto-2dae5e0-cierre-REVISION.tar.gz
```

`REVISION` se reemplaza por los siete caracteres del commit de cierre, no por el commit funcional base. Comprobar el SHA-256 con el recibido por un canal confiable antes de extraer; un checksum suministrado junto con un archivo no acredita por sí solo autoría. El verificador no extrae archivos ni necesita Git. `INVENTARIO.json` enumera cada archivo fuente con tamaño y SHA-256; el checksum exterior cubre todo el comprimido y la copia del inventario.

## Instalar sin datos privados

```bash
node --version
npm --version
npm ci --legacy-peer-deps --ignore-scripts --no-audit --no-fund
npm run db:generate
```

El lockfile fija el árbol de dependencias. `--legacy-peer-deps` conserva la resolución heredada ante conflictos de pares opcionales; no debe omitirse ni interpretarse como aprobación de seguridad. `--ignore-scripts` evita ejecutar automáticamente scripts de dependencias durante la instalación; Prisma se genera de manera explícita. Revisar dependencias antes de un despliegue más amplio. No ejecutar `npm update` ni regenerar el lockfile para reproducir esta entrega.

**No crear `.env`, no configurar `DATABASE_URL`, no ejecutar migraciones ni `db:push`.** El motor y las rutas piloto no requieren base de datos. El esquema Prisma histórico se conserva para compilar tipos y no habilita expedientes. No introducir nombres, RUT, correos ni documentos de clientes.

## Ejecutar verificaciones

```bash
npm test
python scripts/pruebas-paquete-piloto.py
npm run lint
NEXT_TELEMETRY_DISABLED=1 npm run build -- --webpack
npm run typecheck
node scripts/auditar-tm2020.mjs
npm run start
```

Con el servidor de producción local activo, en otra terminal del mismo directorio:

```bash
node scripts/verificar-piloto-http.mjs
python scripts/verificar-piloto-navegador.py --salida /tmp/piloto-demostracion
```

El runner nativo de Node requiere Node 24. La advertencia `MODULE_TYPELESS_PACKAGE_JSON` es conocida y no significa una prueba fallida. Los scripts HTTP anteriores al piloto no corresponden al contrato restringido. Los tests y las evidencias usan casos ficticios y fechas dentro del soporte congelado al **08-11-2026**; el cierre del 09-11-2026 no amplía la revisión de fuentes ni el rango de fechas.

## Despliegue de demostración, sin exposición pública

La demostración comprobada es el servidor de producción Next.js **local**, no `next dev`. Tras compilar, `npm run start` escucha únicamente en `127.0.0.1:3000`. Abrir `http://127.0.0.1:3000` en el mismo equipo. Detener con Ctrl+C. No se ejecutó un despliegue remoto en este cierre.

Para una futura demostración en un host interno Linux autorizado, copiar únicamente el paquete verificado, instalar como usuario sin privilegios y ejecutar los mismos comandos. Mantener el puerto sin acceso entrante de red. Acceder exclusivamente mediante un túnel SSH autenticado con llave administrada fuera del paquete:

```bash
ssh -N -L 3000:127.0.0.1:3000 usuario-demo@HOST_INTERNO
```

`usuario-demo` y `HOST_INTERNO` son marcadores, no cuentas configuradas. No cambiar el enlace a `0.0.0.0`, abrir el puerto ni activar una vista pública. No incluir llaves en el repositorio o archivo comprimido. Si se requiere acceso multiusuario, un proxy o un servicio persistente, primero completar los controles pendientes del checklist; la aplicación no implementa autenticación.

Usar identificadores como `PILOTO-001`, saldo de ejemplo y referencia UF **ficticia**, no una cotización atribuida a SII. Confirmar la casilla obligatoria. Comparar RP/RV inicial y tres retornos; agregar cónyuge/hijos comunes solo para ver la situación inicial sin curvas. Cambiar un dato y verificar que el resultado anterior desaparezca. Revisar advertencias en cada página del PDF. Nunca entregar el informe como oferta comercial ni recomendación definitiva.

## Regenerar el paquete desde el repositorio

Se necesita el repositorio original con la revisión de cierre y un árbol limpio; el paquete entregado no contiene historial Git:

```bash
git status --short --branch
python scripts/paquete-piloto.py crear --ref HEAD --salida /tmp/piloto-paquete-a
python scripts/paquete-piloto.py crear --ref HEAD --salida /tmp/piloto-paquete-b
```

Comparar con `cmp` los dos `.tar.gz` y los inventarios de igual nombre. El generador lee únicamente objetos versionados de la revisión indicada, aplica lista de inclusión, controles de contenido y hashes de las capturas/PDF ficticios aprobados. Nunca copia el directorio de trabajo completo. Rechaza enlaces y binarios nuevos o alterados. El inventario distingue commit funcional, revisión del paquete y árbol Git; no incorpora autores ni mensajes del historial.
