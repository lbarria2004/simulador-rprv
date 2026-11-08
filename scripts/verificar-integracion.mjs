// Ejecutar con la app local iniciada: node scripts/verificar-integracion.mjs
import assert from 'node:assert/strict';
const base = 'http://127.0.0.1:3000';
const uf = { valor: 45000.13, fecha: '2026-10-01', fuente: 'Fixture de integración local' };
const datos = { fondos: 80000000, edad: 65, sexo: 'M', tasaTecnicaCNU: .0367, referenciaUF: uf,
  beneficiarios: [{ id: 'c', tipo: 'conyuge', edad: 62, sexo: 'F', porcentajePension: 0 }, { id: 'h', tipo: 'hijo', edad: 17, sexo: 'M', porcentajePension: 0 }] };
async function post(tipo, cambios = {}) {
  return fetch(`${base}/api/pension`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ tipo, datos: { ...datos, ...cambios } }) });
}
for (const tipo of ['retiro_programado', 'inmediata', 'invalidez_rp', 'sobrevivencia_rp', 'sobrevivencia_rv_inmediata']) {
  const respuesta = await post(tipo, { rentabilidadRealAnual: -.02 });
  assert.ok(respuesta.ok, await respuesta.clone().text());
  const { resultado } = await respuesta.json();
  assert.deepEqual(resultado.referenciaUF, uf);
  assert.equal(resultado.pensionEnUF, resultado.pensionMensual / uf.valor);
  if (tipo === 'sobrevivencia_rp') {
    assert.equal(resultado.rentabilidadRealAnual, -.02);
    assert.equal(resultado.pensionMensual, resultado.pensionPorBeneficiario.reduce((s, b) => s + b.pensionMensual, 0));
    assert.equal(resultado.proyeccion[1].beneficiarios[0].edad, 63);
    assert.equal(resultado.proyeccion[1].pensionPorBeneficiario.length, 1);
  }
}
const opcionesResponse = await post('sobrevivencia_opciones', { rentabilidadRealAnual: .04 });
assert.ok(opcionesResponse.ok);
const opciones = (await opcionesResponse.json()).resultados;
assert.equal(opciones[0].rentabilidadRealAnual, .04);
for (const r of opciones) assert.deepEqual(r.referenciaUF, uf);
for (const cambios of [{ referenciaUF: { ...uf, valor: 0 } }, { referenciaUF: { ...uf, fecha: '2026-02-30' } }, { unidadMonetaria: 'UF' }, { uf: 38500 }]) {
  assert.equal((await post('retiro_programado', cambios)).status, 400);
}
const resultado = (await (await post('retiro_programado')).json()).resultado;
const reporte = { afiliado: { nombre: 'Prueba integración', edad: 65, sexo: 'M', fondosAcumulados: datos.fondos, anosCotizados: 25 },
  parametros: { referenciaUF: uf, tasaRP: .0367, tasaRV: .03 }, resultados: [resultado], beneficiarios: datos.beneficiarios };
async function pdf(body) { return fetch(`${base}/api/reporte`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }); }
const documento = await pdf(reporte);
assert.ok(documento.ok, await documento.clone().text());
assert.equal(Buffer.from(await documento.arrayBuffer()).subarray(0, 4).toString(), '%PDF');
assert.equal((await pdf({ ...reporte, parametros: { ...reporte.parametros, referenciaUF: { ...uf, valor: 40000 } } })).status, 400);
assert.equal((await pdf({ ...reporte, parametros: { ...reporte.parametros, usarProyeccionUF: true } })).status, 400);
console.log('Integración HTTP superada: 5 modalidades, opciones de sobrevivencia, UF fechada, flujos, errores 400 y PDF.');
