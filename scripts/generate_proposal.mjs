// Ejemplo reproducible: requiere la app local iniciada, Node.js 24 y dependencias del proyecto.
import fs from 'node:fs/promises';
import { calcularRetiroProgramado, calcularRVInmediata } from '../src/lib/pension-calculator.ts';
import { UF_REFERENCIA_EJEMPLO, validarReferenciaUF } from '../src/lib/moneda.ts';

const [valor, fecha, salida = '/tmp/estudio-rprv.pdf'] = process.argv.slice(2);
const referenciaUF = validarReferenciaUF(valor === undefined ? UF_REFERENCIA_EJEMPLO : {
  valor: Number(valor), fecha, fuente: 'Configuración manual del ejemplo'
});
const resultados = [
  calcularRetiroProgramado(80000000, 65, 'M', undefined, [], false, {}, referenciaUF),
  calcularRVInmediata(80000000, 65, 'M', undefined, [], false, referenciaUF)
];
const respuesta = await fetch('http://127.0.0.1:3000/api/reporte', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({
  afiliado: { nombre: 'Ejemplo ilustrativo', edad: 65, sexo: 'M', fondosAcumulados: 80000000, anosCotizados: 25 },
  parametros: { referenciaUF, tasaRP: .0367, tasaRV: .0282, afpSeleccionada: 'PLANVITAL' }, resultados, beneficiarios: []
}) });
if (!respuesta.ok) throw new Error(await respuesta.text());
await fs.writeFile(salida, Buffer.from(await respuesta.arrayBuffer()));
console.log(`PDF orientativo guardado en ${salida}`);
