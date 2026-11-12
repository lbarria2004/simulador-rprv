import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument, PDFArray, PDFRawStream, decodePDFRawStream } from 'pdf-lib';
import { CATALOGO_MODALIDADES, MAX_ESCENARIOS, calcularComparacionEscenarios, escenariosIniciales, leerSolicitudEscenarios, validarConfiguracionEscenario, validarListaEscenarios } from '../escenarios.ts';
import { calcularPiloto, ErrorPiloto } from '../piloto.ts';
import { generarReportePilotoPDF } from '../reporte-piloto.ts';
import { datosPiloto, grupoPiloto } from './piloto-fixtures.ts';

const simples = () => escenariosIniciales().escenarios;
const clausulas = [
  { id: 'g', nombre: 'Garantía A', modalidad: 'rv_garantizada', mesesGarantizados: 180 },
  { id: 'a', nombre: 'Aumento A', modalidad: 'rv_aumento_temporal', mesesAumento: 36, porcentajeAumento: 50 },
  { id: 'c', nombre: 'Combinada A', modalidad: 'rv_combinada', mesesGarantizados: 180, mesesAumento: 36, porcentajeAumento: 50 }
];
const solicitud = (escenarios: unknown = simples(), datos: unknown = datosPiloto()) => ({ tipo: 'comparacion_escenarios', datos, escenarios });
const prohibido = (fn: () => unknown) => assert.throws(fn, e => e instanceof ErrorPiloto && e.status === 403);

async function textoPDF(bytes: Uint8Array) {
  const pdf = await PDFDocument.load(bytes);
  return pdf.getPages().map(p => {
    const c = p.node.Contents();
    return (c instanceof PDFArray ? c.asArray().map(x => pdf.context.lookup(x)) : [c]).flatMap(f => f instanceof PDFRawStream ? [...Buffer.from(decodePDFRawStream(f).decode()).toString('latin1').matchAll(/<([a-f0-9]+)>/gi)].map(m => Buffer.from(m[1], 'hex').toString('latin1')) : []).join('\n');
  });
}

describe('Constructor: configuraciones sin autorización implícita de cálculo', () => {
  it('ofrece cinco modalidades y solo dos aproximaciones calculables', () => {
    assert.equal(CATALOGO_MODALIDADES.length, 5);
    assert.deepEqual(CATALOGO_MODALIDADES.filter(m => m.calculable).map(m => m.id), simples().map(e => e.modalidad));
    assert.ok(CATALOGO_MODALIDADES.every(m => m.motivo.length > 30));
  });
  for (const config of clausulas) {
    it(`permite preparar ${config.modalidad} sin invocar cálculo`, () => {
      const copia = structuredClone(config);
      assert.deepEqual(validarConfiguracionEscenario(config), config);
      assert.deepEqual(config, copia);
    });
    it(`bloquea ${config.modalidad}, incluso mezclada con modalidades simples y en el PDF`, async () => {
      for (const escenarios of [[config], [...simples(), config]]) {
        prohibido(() => calcularComparacionEscenarios(solicitud(escenarios)));
        await assert.rejects(generarReportePilotoPDF({ datos: datosPiloto(), escenarios }), e => e instanceof ErrorPiloto && e.status === 403 && e.codigo === 'CLAUSULA_NO_VALIDADA');
      }
    });
  }
  it('valida extremos técnicos sin atribuirles aprobación normativa', () => {
    for (const mesesGarantizados of [1, 360]) assert.equal(validarConfiguracionEscenario({ ...clausulas[0], mesesGarantizados }).mesesGarantizados, mesesGarantizados);
    for (const mesesAumento of [1, 120]) for (const porcentajeAumento of [.01, 100]) assert.equal(validarConfiguracionEscenario({ ...clausulas[1], mesesAumento, porcentajeAumento }).porcentajeAumento, porcentajeAumento);
  });
  it('rechaza vacíos, decimales ocultos, tipos coercibles y parámetros incompletos', () => {
    for (const mesesGarantizados of [0, -1, 361, 1.5, '', '180', null, NaN, Infinity, undefined]) assert.throws(() => validarConfiguracionEscenario({ ...clausulas[0], mesesGarantizados }), ErrorPiloto);
    for (const mesesAumento of [0, 121, 1.5, '36', undefined]) assert.throws(() => validarConfiguracionEscenario({ ...clausulas[1], mesesAumento }), ErrorPiloto);
    for (const porcentajeAumento of [0, -.01, 100.01, 50.001, NaN, '50', undefined]) assert.throws(() => validarConfiguracionEscenario({ ...clausulas[1], porcentajeAumento }), ErrorPiloto);
  });
  it('no convierte parámetros de cláusulas en una modalidad simple, aunque valgan cero', () => {
    for (const config of simples()) for (const campo of ['mesesGarantizados', 'mesesAumento', 'porcentajeAumento']) prohibido(() => validarConfiguracionEscenario({ ...config, [campo]: 0 }));
    prohibido(() => validarConfiguracionEscenario({ ...clausulas[0], mesesAumento: 36 }));
  });
  for (const campo of ['calculable', 'validacionActuarial', 'activa', 'esPersonalizada', 'tasaEspecialRV', 'esTasaEspecial', 'tasaComercial', 'aseguradora', 'tasaRV', 'factorGarantia', 'pensionMensual', 'resultado', 'nombrePersona', 'rut', '__proto__', 'constructor']) {
    it(`no acepta ${campo} como permiso ni dato contractual`, () => {
      const config = { ...simples()[0], [campo]: true };
      prohibido(() => calcularComparacionEscenarios(solicitud([config])));
      prohibido(() => leerSolicitudEscenarios({ datos: datosPiloto(), escenarios: [config] }, true));
    });
  }
  it('rechaza nombres vacíos, marcado, saltos, correo y caracteres incompatibles con PDF', () => {
    for (const nombre of ['', ' ', 'x'.repeat(61), '<script>', 'Caso\nA', 'Ficticio' + '@' + 'ejemplo.test', '🙂']) assert.throws(() => validarConfiguracionEscenario({ ...simples()[0], nombre }), ErrorPiloto);
    assert.equal(validarConfiguracionEscenario({ ...simples()[0], nombre: '  Escenario Ñ (A-1)  ' }).nombre, 'Escenario Ñ (A-1)');
  });
  it('cierra el catálogo y limita el número de escenarios e identificadores únicos', () => {
    for (const modalidad of ['tasa_especial', '__proto__', '', null, ['retiro_programado']]) prohibido(() => validarConfiguracionEscenario({ ...simples()[0], modalidad }));
    for (const entrada of [null, {}, [], [null], [simples()[0], simples()[0]], Array(MAX_ESCENARIOS + 1).fill(simples()[0])]) assert.throws(() => validarListaEscenarios(entrada), ErrorPiloto);
    for (const id of ['', 'a/b', 'a'.repeat(41), null]) assert.throws(() => validarConfiguracionEscenario({ ...simples()[0], id }), ErrorPiloto);
  });
  it('no acepta wrappers alternativos, pre-cálculos ni selecciones por flags', () => {
    for (const extra of [{ resultados: [] }, { seleccionados: ['rp-base'] }, { perfil: 'experto' }, { modoExperto: true }, { tasaComercial: .04 }]) prohibido(() => calcularComparacionEscenarios({ ...solicitud(), ...extra }));
    prohibido(() => calcularComparacionEscenarios({ ...solicitud(), tipo: 'ambas' }));
    prohibido(() => leerSolicitudEscenarios(solicitud(), true));
  });
});

describe('Escenarios: motor y política del piloto preservados', () => {
  it('reutiliza exactamente los montos del piloto y conserva orden, etiquetas y entradas', () => {
    const escenarios = [simples()[1], { ...simples()[0], id: 'rp-b', nombre: 'RP B' }, simples()[0]];
    const body = solicitud(escenarios), copia = structuredClone(body);
    const r = calcularComparacionEscenarios(body), base = calcularPiloto(body.datos);
    assert.deepEqual(r.piloto, base);
    assert.deepEqual(r.cotizaciones.map(e => e.config), escenarios);
    assert.deepEqual(r.cotizaciones.map(e => e.monto), [base.comparacion.rv, base.comparacion.rp, base.comparacion.rp]);
    assert.deepEqual(body, copia);
    assert.notEqual(r.cotizaciones[0].config, escenarios[0]);
  });
  it('no permite al constructor eludir confirmación, fecha, familia, cláusulas en datos ni SIS', () => {
    for (const cambio of [{ datosFicticios: false }, { mesesGarantizados: 180 }, { cubiertoSIS: true }, { tasaComercial: .04 }, { beneficiarios: [{ ...grupoPiloto()[0], porcentajePension: .9 }] }, { fechaValoracion: '2026-11-12' }]) assert.throws(() => calcularComparacionEscenarios(solicitud(simples(), { ...datosPiloto(), ...cambio })), RangeError);
    const r = calcularComparacionEscenarios(solicitud(simples(), datosPiloto({ beneficiarios: grupoPiloto() })));
    assert.deepEqual(r.piloto.proyecciones.puntos, []);
    assert.equal(r.piloto.proyecciones.disponibles, false);
  });
  it('PDF recalculado solo para la selección, sin un RP inventado cuando se selecciona RV', async () => {
    const config = { ...simples()[1], nombre: 'Escenario RV ficticio' };
    const d = datosPiloto(), r = calcularPiloto(d);
    const paginas = await textoPDF(await generarReportePilotoPDF({ datos: d, escenarios: [config] }));
    const texto = paginas.join('\n');
    assert.ok(texto.includes(config.nombre));
    assert.ok(texto.includes(`$${r.comparacion.rv.pensionMensual.toLocaleString('es-CL')}`));
    assert.ok(!texto.includes(`$${r.comparacion.rp.pensionMensual.toLocaleString('es-CL')}`));
    assert.ok(!texto.includes('Pensión mensual RP'));
    assert.ok(texto.replace(/\s+/g, ' ').includes('Tasas comerciales: no disponibles'));
    for (const p of paginas) assert.ok(p.includes('Sin certificación normativa') && p.includes('No es oferta comercial'));
    await assert.rejects(generarReportePilotoPDF({ datos: d, escenarios: [config], resultados: [] }), ErrorPiloto);
  });
  it('PDF admite doce etiquetas largas, pagina las filas y mantiene los avisos', async () => {
    const escenarios = Array.from({ length: MAX_ESCENARIOS }, (_, i) => ({ ...simples()[0], id: `e${i}`, nombre: `ESCENARIO-${i}-` + 'W'.repeat(46) }));
    const paginas = await textoPDF(await generarReportePilotoPDF({ datos: datosPiloto(), escenarios }));
    const texto = paginas.join('\n').replace(/\s/g, '');
    for (const e of escenarios) assert.ok(texto.includes(e.nombre));
    for (const p of paginas) assert.ok(p.includes('Sin certificación normativa') && p.includes('Valoración 2026-11-08'));
  });
});
