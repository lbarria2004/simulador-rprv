// Requiere producción local en 127.0.0.1:3000. Solo fixtures y datos ficticios.
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { datosPiloto, grupoPiloto } from '../src/lib/__tests__/piloto-fixtures.ts';
import { calcularPiloto } from '../src/lib/piloto.ts';

const base = 'http://127.0.0.1:3000';
let peticiones = 0;
async function enviar(ruta, cuerpo) {
  peticiones++;
  return fetch(`${base}${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(cuerpo) });
}
async function documentoTexto(bytes) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map(p => {
    const c = p.node.Contents();
    return (c instanceof PDFArray ? c.asArray().map(x => pdf.context.lookup(x)) : [c]).flatMap(f => f instanceof PDFRawStream ? [...Buffer.from(decodePDFRawStream(f).decode()).toString('latin1').matchAll(/<([a-f0-9]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')) : []).join('\n');
  });
}
const metadata = await (await fetch(`${base}/api/pension`)).json(); peticiones++;
assert.equal(metadata.perfil, 'piloto_interno_v1');
assert.deepEqual(metadata.tiposHabilitados, ['comparacion_piloto']);
assert.equal(metadata.restricciones.length, 5);
assert.match(metadata.aviso, /sin certificación normativa/);
assert.equal((await fetch(`${base}/api/tasas-rv`)).status, 403); peticiones++;

let inicial;
for (const cambios of [{}, { sexo: 'F', edad: 60 }, { escenarioRP: 'optimista' }, { beneficiarios: grupoPiloto() }, { fondos: 0 }]) {
  const datos = datosPiloto(cambios);
  const respuesta = await enviar('/api/pension', { tipo: 'comparacion_piloto', datos });
  assert.equal(respuesta.status, 200, await respuesta.clone().text());
  assert.equal(respuesta.headers.get('cache-control'), 'no-store');
  const { success, resultado } = await respuesta.json(); assert.equal(success, true);
  const esperado = calcularPiloto(datos);
  assert.deepEqual(resultado, esperado);
  for (const r of Object.values(resultado.comparacion)) {
    assert.equal(r.clasificacion, 'aproximacion_documentada');
    assert.equal(r.validacionIndividual, 'pendiente_validacion_especializada');
    assert.equal(r.pensionEnUF, r.pensionMensual / datos.referenciaUF.valor);
    assert.equal('proyeccion' in r, false);
    assert.equal('periodoGarantizado' in r, false);
    assert.equal('capitalSIS' in r, false);
  }
  assert.deepEqual(resultado.escenarios.map(e => e.rentabilidadRealAnual), [0, .02, .04]);
  if (datos.beneficiarios.length || datos.fondos === 0) {
    assert.equal(resultado.proyecciones.disponibles, false);
    assert.deepEqual(resultado.proyecciones.puntos, []);
  }
  if (!Object.keys(cambios).length) inicial = resultado;
}
const datos = datosPiloto();
const doble = (await (await enviar('/api/pension', { tipo: 'comparacion_piloto', datos: { ...datos, referenciaUF: { ...datos.referenciaUF, valor: datos.referenciaUF.valor * 2 } } })).json()).resultado;
assert.equal(inicial.comparacion.rp.pensionMensual, doble.comparacion.rp.pensionMensual);
assert.equal(inicial.comparacion.rp.pensionEnUF, doble.comparacion.rp.pensionEnUF * 2);
assert.deepEqual(inicial.proyecciones, doble.proyecciones);

for (const tipo of ['retiro_programado', 'inmediata', 'invalidez', 'invalidez_rp', 'invalidez_rv_inmediata', 'sobrevivencia', 'sobrevivencia_opciones', 'sobrevivencia_rp', 'periodo_garantizado', 'aumento_temporal', 'ambas', 'sobrevivencia_rv_garantizado', 'sobrevivencia_rv_aumento', 'sobrevivencia_rv_ambas']) {
  const respuesta = await enviar('/api/pension', { tipo, datos });
  assert.equal(respuesta.status, 403, tipo);
  assert.equal((await respuesta.json()).success, false);
}
for (const campo of ['mesesGarantizados', 'mesesAumento', 'porcentajeAumento', 'esInvalido', 'cubiertoSIS', 'ingresoBase', 'incluirPGU', 'incluirBAC', 'incluirBonoMujer', 'comision', 'modoExperto', 'resultados', 'pensionMensual']) {
  const rechazado = { ...datos, [campo]: true };
  for (const ruta of ['/api/pension', '/api/reporte']) {
    const r = await enviar(ruta, ruta === '/api/pension' ? { tipo: 'comparacion_piloto', datos: rechazado } : { datos: rechazado });
    assert.equal(r.status, 403, `${ruta} ${campo}`);
  }
}
for (const cambio of [{ datosFicticios: false }, { fondos: null }, { fondos: '80000000' }, { tasaRV: -.01 }, { fechaValoracion: '2026-01-01' }, { referenciaUF: { ...datos.referenciaUF, fecha: '2026-02-30' } }, { escenarioRP: ['base'] }]) {
  for (const ruta of ['/api/pension', '/api/reporte']) {
    const d = { ...datos, ...cambio };
    assert.equal((await enviar(ruta, ruta === '/api/pension' ? { tipo: 'comparacion_piloto', datos: d } : { datos: d })).status, 400, `${ruta} ${JSON.stringify(cambio)}`);
  }
}
for (const beneficiarios of [[grupoPiloto()[1]], [{ ...grupoPiloto()[0], porcentajePension: .8 }], [{ ...grupoPiloto()[0], esInvalido: true }], [grupoPiloto()[0], { ...grupoPiloto()[0], id: 'c2' }]]) {
  for (const ruta of ['/api/pension', '/api/reporte']) {
    const d = { ...datos, beneficiarios };
    assert.equal((await enviar(ruta, ruta === '/api/pension' ? { tipo: 'comparacion_piloto', datos: d } : { datos: d })).status, 403);
  }
}
for (const extra of [{ resultados: [{ pensionMensual: 9999999 }] }, { parametros: { incluirPGU: true } }, { perfil: 'experto' }, { tipo: 'ambas' }]) {
  assert.equal((await enviar('/api/reporte', { datos, ...extra })).status, 403);
}
for (const ruta of ['/api/pension', '/api/reporte']) {
  peticiones++;
  const r = await fetch(`${base}${ruta}`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: '{' });
  assert.equal(r.status, 400);
}
for (const [nombre, d] of [['simple', datos], ['familia', datosPiloto({ beneficiarios: grupoPiloto() })], ['cero', datosPiloto({ fondos: 0 })]]) {
  const r = await enviar('/api/reporte', { datos: d });
  assert.equal(r.status, 200, await r.clone().text());
  assert.equal(r.headers.get('content-type'), 'application/pdf');
  assert.equal(r.headers.get('cache-control'), 'no-store');
  const bytes = new Uint8Array(await r.arrayBuffer());
  assert.equal(Buffer.from(bytes.subarray(0, 4)).toString(), '%PDF');
  const paginas = await documentoTexto(bytes);
  assert.ok(paginas.length >= 3);
  for (const p of paginas) {
    assert.ok(p.includes('Sin certificación normativa'));
    assert.ok(p.includes('No es oferta comercial'));
    assert.ok(p.includes(d.fechaValoracion));
  }
  const texto = paginas.join('\n');
  if (nombre !== 'simple') {
    assert.ok(texto.includes('Gráficos no habilitados'));
    assert.ok(!texto.includes('Pensión mensual RP'));
  }
  await fs.mkdir('/tmp/piloto-http', { recursive: true });
  await fs.writeFile(`/tmp/piloto-http/${nombre}.pdf`, bytes);
}
console.log(JSON.stringify({ resultado: 'Integración HTTP del piloto aprobada', peticiones, rechazo_clausulas_y_bypass: true, solo_estimaciones: true, familia_sin_curvas: true, pdf_recalculado: true, uf_consistente: true }));
