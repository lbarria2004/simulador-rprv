// Solo lectura: node scripts/auditar-tm2020.mjs [referencia Git local]
import fs from 'node:fs';
import { execFileSync } from 'node:child_process';
import { stripTypeScriptTypes } from 'node:module';
import * as actuales from '../src/lib/tablas-mortalidad-oficiales.ts';
const fuente = JSON.parse(fs.readFileSync(new URL('../src/lib/data/tm2020-oficial.json', import.meta.url), 'utf8'));
const referencia = process.argv[2];
let tablas = actuales;
if (referencia) {
  const codigo = execFileSync('git', ['show', `${referencia}:src/lib/tablas-mortalidad-oficiales.ts`], { encoding: 'utf8' });
  tablas = await import(`data:text/javascript;base64,${Buffer.from(stripTypeScriptTypes(codigo)).toString('base64')}`);
}
const resultados = {};
for (const [nombre, qx] of Object.entries(fuente.qx)) {
  const tabla = tablas[`TABLA_${nombre.replaceAll('-', '_')}`];
  const sexo = nombre.includes('-H-') ? 'M' : 'F';
  const diferencias = [];
  for (const [edad, valor] of Object.entries(qx)) if (tabla[edad]?.qx2020 !== valor) diferencias.push({ campo: 'qx2020', edad: +edad, local: tabla[edad]?.qx2020, oficial: valor });
  for (const [edad, fila] of Object.entries(fuente.mejoras[sexo])) {
    if (!tabla[edad]) continue;
    fila.forEach((valor, indice) => {
      if (tabla[edad].aa[indice] !== valor) diferencias.push({ campo: 'aa', edad: +edad, ano: 2021 + indice, local: tabla[edad].aa[indice], oficial: valor });
    });
  }
  resultados[nombre] = { qxComparados: Object.keys(qx).length, factoresComparados: Object.keys(tabla).length * 16,
    edadesSinRespaldo: Object.keys(tabla).map(Number).filter(edad => !(edad in qx)), diferencias };
}
console.log(JSON.stringify({ referencia: referencia ?? 'árbol de trabajo', fuente: fuente.fuentes, resultados }, null, 2));

if (!referencia && Object.values(resultados).some(r => r.diferencias.length || r.edadesSinRespaldo.length)) process.exitCode = 1;
