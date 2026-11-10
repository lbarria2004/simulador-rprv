// Producción local; fixtures ficticios. No crea PR, ofertas ni datos de clientes.
import assert from 'node:assert/strict';
import { escenarioInicial, CATALOGO_MODALIDADES, compararEscenarios } from '../src/lib/escenarios.ts';
import { datosPiloto } from '../src/lib/__tests__/piloto-fixtures.ts';
const base = 'http://127.0.0.1:3000';
const datos = datosPiloto();
const rp = escenarioInicial('rp', 'retiro_programado', 'RP referencia');
const rv = escenarioInicial('rv', 'rv_inmediata', 'RV referencia');
let peticiones = 0;
async function post(ruta, body, status) {
  peticiones++;
  const r = await fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
  assert.equal(r.status, status, `${ruta}: ${await r.clone().text()}`);
  if (status !== 200 || ruta !== '/api/reporte') {
    const j = await r.json();
    if (status !== 200) { assert.equal(j.success, false); assert.equal('resultado' in j, false); }
    return j;
  }
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  assert.match(Buffer.from(await r.arrayBuffer()).toString('latin1'), /^%PDF/);
}
const meta = await (await fetch(base + '/api/escenarios')).json(); peticiones++;
assert.deepEqual(meta.catalogo, CATALOGO_MODALIDADES);
assert.equal(meta.maxEscenarios, 12);
assert.equal(meta.catalogo.filter(m => m.calculable).length, 2);
for (const escenarios of [[rp, rv], [{ ...rv, supuestoTasa: 'sensibilidad', tasaSensibilidad: .035 }], [{ ...rp, escenarioRP: 'optimista' }]]) {
  const body = { datos, escenarios };
  const j = await post('/api/escenarios', body, 200);
  assert.deepEqual(j.resultado, compararEscenarios(body));
}
for (const modalidad of ['rv_garantizada', 'rv_aumento', 'rv_combinada']) {
  const e = escenarioInicial('bloqueada', modalidad, 'Configuración pendiente');
  for (const escenarios of [[e], [rp, e]]) await post('/api/escenarios', { datos, escenarios }, 403);
  await post('/api/reporte', { datos, escenarios: [e] }, 403);
  await post('/api/pension', { tipo: modalidad, datos }, 403);
}
for (const campo of ['calculable', 'tasaComercial', 'tasaEspecialRV', 'esTasaEspecial', 'modoExperto', 'factorGarantizado', 'resultados', 'pensionMensual', 'nombreAfiliado', '__proto__']) {
  const e = JSON.parse(JSON.stringify(rv).replace(/}$/, `,"${campo}":true}`));
  await post('/api/escenarios', { datos, escenarios: [e] }, 403);
}
for (const cambio of [{ mesesGarantizados: 120 }, { mesesAumento: 36 }, { porcentajeAumento: 25 }]) {
  await post('/api/escenarios', { datos, escenarios: [{ ...rv, ...cambio }] }, 403);
}
for (const escenarios of [[], [rp, rp], [{ ...rv, nombre: rp.nombre }, rp], [{ ...rv, modalidad: ['rv_inmediata'] }],
  [{ ...rv, nombre: '<script>alert(1)</script>' }], [{ ...rv, supuestoTasa: 'sensibilidad', tasaSensibilidad: null }],
  [{ ...rv, supuestoTasa: 'sensibilidad', tasaSensibilidad: .5 }], [{ ...rp, mesesAumento: '0' }],
  Array.from({ length: 13 }, (_, i) => ({ ...rp, id: `e${i}`, nombre: `Escenario ${i}` }))]) {
  const status = Array.isArray(escenarios[0]?.modalidad) ? 403 : 400;
  await post('/api/escenarios', { datos, escenarios }, status);
}
await post('/api/escenarios', { datos: { ...datos, datosFicticios: false }, escenarios: [rp] }, 400);
await post('/api/escenarios', { datos: { ...datos, referenciaUF: { ...datos.referenciaUF, valor: 45000.123 } }, escenarios: [rp] }, 400);
for (const extra of [{ modoExperto: true }, { resultados: [] }, { perfil: 'experto' }]) await post('/api/escenarios', { datos, escenarios: [rp], ...extra }, 403);
await post('/api/reporte', { datos, resultados: compararEscenarios({ datos, escenarios: [rv] }).resultados }, 403);
await post('/api/reporte', { datos }, 200);
peticiones++;
assert.equal((await fetch(base + '/api/escenarios', { method: 'POST', body: '{', headers: { 'Content-Type': 'application/json' } })).status, 400);
console.log(JSON.stringify({ resultado: 'Escenarios HTTP aprobados', peticiones, clausulasSinPensiones: true, pdfSinBypass: true }));
