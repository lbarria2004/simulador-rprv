// Producción local. Regresiones del contrato multimodalidad con datos ficticios.
import assert from 'node:assert/strict';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { datosPiloto, grupoPiloto } from '../src/lib/__tests__/piloto-fixtures.ts';
import { calcularComparacionEscenarios, escenariosIniciales } from '../src/lib/escenarios.ts';

const base = 'http://127.0.0.1:3000';
const datos = datosPiloto(), simples = escenariosIniciales().escenarios;
const clausulas = [
  { id: 'g', nombre: 'Garantía ficticia', modalidad: 'rv_garantizada', mesesGarantizados: 180 },
  { id: 'a', nombre: 'Aumento ficticio', modalidad: 'rv_aumento_temporal', mesesAumento: 36, porcentajeAumento: 50 },
  { id: 'c', nombre: 'Combinada ficticia', modalidad: 'rv_combinada', mesesGarantizados: 180, mesesAumento: 36, porcentajeAumento: 50 }
];
let peticiones = 0;
const enviar = async (ruta, body, raw = false) => {
  peticiones++;
  return fetch(base + ruta, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: raw ? body : JSON.stringify(body) });
};
async function rechazar(escenarios, status, extra = {}, cambioDatos = {}, extrasRaiz = {}) {
  for (const ruta of ['/api/pension', '/api/reporte']) {
    const body = { ...(ruta === '/api/pension' ? { tipo: 'comparacion_escenarios' } : {}), datos: { ...datos, ...cambioDatos }, escenarios: escenarios.map(e => ({ ...e, ...extra })), ...extrasRaiz };
    const r = await enviar(ruta, body);
    assert.equal(r.status, status, `${ruta} ${JSON.stringify(body)}`);
    assert.equal(r.headers.get('cache-control'), 'no-store');
    assert.match(r.headers.get('content-type'), /application\/json/);
    const error = await r.json();
    assert.equal(error.success, false);
    assert.ok(!('resultado' in error) && !('cotizaciones' in error) && !('pensionMensual' in error));
  }
}

const metadata = await (await fetch(base + '/api/pension')).json(); peticiones++;
assert.equal(metadata.modalidades.length, 5);
assert.equal(metadata.modalidades.filter(m => m.calculable).length, 2);
for (const escenarios of [simples, [simples[0]], [simples[1]], [...simples, { ...simples[1], id: 'rv-b', nombre: 'RV B' }]]) {
  const r = await enviar('/api/pension', { tipo: 'comparacion_escenarios', datos, escenarios });
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const body = await r.json(), esperado = calcularComparacionEscenarios({ tipo: 'comparacion_escenarios', datos, escenarios });
  assert.deepEqual(body.resultado, esperado.piloto);
  assert.deepEqual(body.cotizaciones, esperado.cotizaciones);
}
for (const config of clausulas) {
  await rechazar([config], 403);
  await rechazar([...simples, config], 403);
  await rechazar([config], 403, { calculable: true });
  await rechazar([config], 403, { activa: false });
  // Renombrar una cláusula a simple conservando parámetros no autoriza a ignorarlos.
  await rechazar([{ ...config, modalidad: 'renta_vitalicia_simple' }], 403);
}
for (const campo of ['tasaEspecialRV', 'esTasaEspecial', 'tasaComercial', 'aseguradora', 'factorGarantia', 'pensionMensual', 'validacionActuarial', 'calculable', 'modoExperto', 'rut', 'resultados']) await rechazar(simples, 403, { [campo]: true });
for (const escenarios of [[], [simples[0], simples[0]], Array.from({ length: 13 }, (_, i) => ({ ...simples[0], id: `e-${i}` })), [{ ...simples[0], nombre: '<script>alert(1)</script>' }], [{ ...clausulas[0], mesesGarantizados: -1 }], [{ ...clausulas[1], mesesAumento: 121 }], [{ ...clausulas[1], porcentajeAumento: '50' }], [{ ...clausulas[1], porcentajeAumento: 1.111 }]]) await rechazar(escenarios, 400);
for (const modalidad of ['tasa_especial', '__proto__', 'constructor', 'ambas', ['retiro_programado']]) await rechazar([{ ...simples[0], modalidad }], 403);
for (const extra of [{ resultados: [{ pensionMensual: 9999999 }] }, { modoExperto: true }, { seleccionados: ['rp-base'] }, { perfil: 'comercial' }]) await rechazar(simples, 403, {}, {}, extra);
for (const cambio of [{ cubiertoSIS: true }, { mesesGarantizados: 180 }, { tasaComercial: .04 }, { beneficiarios: [{ ...grupoPiloto()[0], porcentajePension: .8 }] }]) await rechazar(simples, 403, {}, cambio);
for (const cambio of [{ datosFicticios: false }, { tasaRV: '0.04' }, { fondos: null }, { fechaValoracion: '2026-11-12' }]) await rechazar(simples, 400, {}, cambio);

for (const ruta of ['/api/pension', '/api/reporte']) {
  for (const body of ['{', 'null', '[]']) assert.equal((await enviar(ruta, body, true)).status, 400);
  const prefijo = ruta === '/api/pension' ? '"tipo":"comparacion_escenarios",' : '';
  const raw = `{${prefijo}"datos":${JSON.stringify(datos)},"escenarios":[${JSON.stringify(simples[0]).replace('"id":', '"__proto__":{"calculable":true},"id":')}]}`;
  assert.equal((await enviar(ruta, raw, true)).status, 403);
}
for (const d of [datos, datosPiloto({ beneficiarios: grupoPiloto() }), datosPiloto({ fondos: 0 })]) {
  const r = await enviar('/api/pension', { tipo: 'comparacion_escenarios', datos: d, escenarios: simples });
  assert.equal(r.status, 200);
  const { resultado } = await r.json();
  if (d.beneficiarios.length || !d.fondos) assert.deepEqual(resultado.proyecciones.puntos, []);
  const pdf = await enviar('/api/reporte', { datos: d, escenarios: simples });
  assert.equal(pdf.status, 200);
  assert.equal(pdf.headers.get('cache-control'), 'no-store');
  const doc = await PDFDocument.load(await pdf.arrayBuffer());
  let todo = '';
  for (const page of doc.getPages()) {
    const contents = page.node.Contents();
    const texto = (contents instanceof PDFArray ? contents.asArray().map(c => doc.context.lookup(c)) : [contents]).flatMap(s => s instanceof PDFRawStream ? [...Buffer.from(decodePDFRawStream(s).decode()).toString('latin1').matchAll(/<([a-f0-9]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')) : []).join('\n');
    assert.ok(texto.includes('Sin certificación normativa') && texto.includes('No es oferta comercial'));
    todo += texto;
  }
  assert.ok(todo.includes('Escenarios seleccionados'));
  for (const monto of Object.values(resultado.comparacion)) assert.ok(todo.includes(`$${monto.pensionMensual.toLocaleString('es-CL')}`));
  if (d.beneficiarios.length || !d.fondos) assert.ok(!todo.includes('Pensión mensual RP'));
}
console.log(JSON.stringify({ resultado: 'HTTP de escenarios aprobado', peticiones, clausulas_sin_importes_ni_pdf: true, politica_piloto_compartida: true, solo_datos_ficticios: true }));
