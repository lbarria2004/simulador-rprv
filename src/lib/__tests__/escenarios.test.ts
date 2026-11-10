import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { CATALOGO_MODALIDADES, MAX_ESCENARIOS, escenarioInicial, validarEscenario, validarListaEscenarios, compararEscenarios } from '../escenarios.ts';
import { calcularPiloto, ErrorPiloto } from '../piloto.ts';
import { generarReportePilotoPDF } from '../reporte-piloto.ts';
import { datosPiloto, grupoPiloto } from './piloto-fixtures.ts';

const rp = () => escenarioInicial('rp', 'retiro_programado', 'RP referencia');
const rv = () => escenarioInicial('rv', 'rv_inmediata', 'RV referencia');
const restringido = (codigo: string, status = 403) => (e: unknown) => e instanceof ErrorPiloto && e.codigo === codigo && e.status === status;

describe('Constructor multimodalidad con la política del piloto', () => {
  it('ofrece cinco modalidades y solo dos estimaciones, sin datos comerciales', () => {
    assert.equal(CATALOGO_MODALIDADES.length, 5);
    assert.deepEqual(CATALOGO_MODALIDADES.filter(m => m.calculable).map(m => m.id), ['retiro_programado', 'rv_inmediata']);
    assert.ok(CATALOGO_MODALIDADES.every(m => m.componentes && m.motivo));
  });
  for (const m of CATALOGO_MODALIDADES) it(`permite guardar configuración ${m.id} sin habilitar fórmulas`, () => {
    const e = escenarioInicial('esc', m.id, 'Configuración ficticia');
    assert.deepEqual(validarEscenario(e), e);
    if (!m.calculable) assert.throws(() => compararEscenarios({ datos: datosPiloto(), escenarios: [e] }), restringido('MODALIDAD_PENDIENTE'));
  });
  it('delega las estimaciones simples sin alterar importes ni entradas', () => {
    const datos = datosPiloto(), entradas = [rp(), rv()];
    const copia = structuredClone({ datos, escenarios: entradas });
    const r = compararEscenarios(copia), original = calcularPiloto(datos);
    for (const [i, id] of ['rp', 'rv'].entries()) {
      const base = original.comparacion[id as 'rp' | 'rv'];
      assert.equal(r.resultados[i].pensionMensual, base.pensionMensual);
      assert.equal(r.resultados[i].cnu, base.cnu);
      assert.equal(r.resultados[i].pensionEnUF, base.pensionEnUF);
      assert.equal(r.resultados[i].validacionIndividual, 'pendiente_validacion_especializada');
      assert.equal('proyeccion' in r.resultados[i], false);
    }
    assert.deepEqual(copia, { datos, escenarios: entradas });
  });
  it('separa tasa base, descuento de sensibilidad y retorno AFP', () => {
    const d = datosPiloto(), e = { ...rp(), supuestoTasa: 'sensibilidad', tasaSensibilidad: .05, escenarioRP: 'optimista' };
    const r = compararEscenarios({ datos: d, escenarios: [e] }).resultados[0];
    const esperado = calcularPiloto({ ...d, tasaTecnicaCNU: .05, escenarioRP: 'optimista' });
    assert.equal(r.tasaTecnicaBase, .0367); assert.equal(r.tasaDescuento, .05);
    assert.equal(r.supuestoTasa, 'sensibilidad'); assert.equal(r.pensionMensual, esperado.comparacion.rp.pensionMensual);
    const otra = compararEscenarios({ datos: d, escenarios: [{ ...e, escenarioRP: 'conservador' }] }).resultados[0];
    assert.equal(r.pensionMensual, otra.pensionMensual);
  });
  it('cambiar sensibilidad RV no modifica la referencia técnica ni se presenta como oferta', () => {
    const r = compararEscenarios({ datos: datosPiloto(), escenarios: [{ ...rv(), supuestoTasa: 'sensibilidad', tasaSensibilidad: .04 }] });
    assert.equal(r.resultados[0].tasaTecnicaBase, .0282);
    assert.equal(r.resultados[0].tasaDescuento, .04);
    assert.equal(r.resultados[0].escenarioRP, null);
    assert.match(r.aviso, /No es una oferta/);
  });
  it('mantiene invariancia monetaria y no expone proyecciones familiares', () => {
    const d = datosPiloto({ beneficiarios: grupoPiloto() });
    const r = compararEscenarios({ datos: d, escenarios: [rp(), rv()] });
    const doble = compararEscenarios({ datos: { ...d, referenciaUF: { ...d.referenciaUF, valor: d.referenciaUF.valor * 2 } }, escenarios: [rp(), rv()] });
    r.resultados.forEach((e, i) => {
      assert.equal(e.pensionMensual, doble.resultados[i].pensionMensual);
      assert.equal(e.pensionEnUF, doble.resultados[i].pensionEnUF * 2);
      assert.equal('proyecciones' in e, false);
    });
  });
  it('rechaza un lote mixto antes de devolver resultados parciales', () => {
    assert.throws(() => compararEscenarios({ datos: datosPiloto(), escenarios: [rp(), escenarioInicial('g', 'rv_combinada', 'Bloqueada')] }), restringido('MODALIDAD_PENDIENTE'));
  });
  for (const campo of ['calculable', 'oferta', 'tasaComercial', 'tasaEspecialRV', 'esTasaEspecial', 'modoExperto', 'resultados', 'factorGarantizado', 'nombreAfiliado', '__proto__']) {
    it(`no acepta la bandera o campo manipulado ${campo}`, () => {
      const e = JSON.parse(JSON.stringify(rp()).replace(/}$/, `,"${campo}":true}`));
      assert.throws(() => validarEscenario(e), restringido('FUNCION_RESTRINGIDA'));
    });
  }
  for (const cambio of [
    { mesesGarantizados: 1 }, { mesesAumento: 1 }, { porcentajeAumento: 20 },
  ]) it(`una modalidad simple no oculta ${Object.keys(cambio)[0]}`, () => {
    assert.throws(() => validarEscenario({ ...rp(), ...cambio }), restringido('FUNCION_RESTRINGIDA'));
  });
  for (const cambio of [
    { nombre: '' }, { nombre: '<img src=x onerror=alert(1)>' }, { nombre: 'x'.repeat(61) },
    { mesesGarantizados: '0' }, { porcentajeAumento: NaN }, { escenarioRP: ['base'] },
    { supuestoTasa: ['referencia'] }, { supuestoTasa: 'sensibilidad', tasaSensibilidad: null },
    { supuestoTasa: 'sensibilidad', tasaSensibilidad: .11 }, { tasaSensibilidad: .02 },
  ]) it(`valida estrictamente ${JSON.stringify(cambio)}`, () => {
    assert.throws(() => validarEscenario({ ...rp(), ...cambio }), ErrorPiloto);
  });
  it('aplica rangos operativos a cláusulas sin afirmar admisibilidad legal', () => {
    const e = escenarioInicial('g', 'rv_combinada', 'Combinada');
    for (const cambio of [{ mesesGarantizados: 0 }, { mesesGarantizados: 601 }, { mesesGarantizados: 1.5 }, { mesesAumento: 0 }, { porcentajeAumento: 0 }, { porcentajeAumento: 101 }]) {
      assert.throws(() => validarEscenario({ ...e, ...cambio }), ErrorPiloto);
    }
    assert.equal(validarEscenario({ ...e, mesesGarantizados: 600, mesesAumento: 600, porcentajeAumento: 100 }).mesesAumento, 600);
  });
  it('limita listas, nombres e identificadores duplicados', () => {
    assert.throws(() => validarListaEscenarios([]), ErrorPiloto);
    assert.throws(() => validarListaEscenarios([rp(), rp()]), ErrorPiloto);
    assert.throws(() => validarListaEscenarios([rp(), { ...rv(), nombre: 'rp REFERENCIA' }]), ErrorPiloto);
    assert.throws(() => validarListaEscenarios([rp(), { ...rv(), nombre: 'RP  referencia' }]), ErrorPiloto);
    const lista = Array.from({ length: MAX_ESCENARIOS }, (_, i) => ({ ...rp(), id: `i${i}`, nombre: `Escenario ${i}` }));
    assert.equal(validarListaEscenarios(lista).length, MAX_ESCENARIOS);
    assert.throws(() => validarListaEscenarios([...lista, rv()]), ErrorPiloto);
  });
  it('rechaza alias históricos, retorno AFP sobre RV y datos no ficticios', () => {
    assert.throws(() => validarEscenario({ ...rv(), modalidad: 'renta_vitalicia_simple' }), restringido('FUNCION_RESTRINGIDA'));
    assert.throws(() => validarEscenario({ ...rv(), escenarioRP: 'optimista' }), ErrorPiloto);
    assert.throws(() => compararEscenarios({ datos: datosPiloto({ datosFicticios: false as true }), escenarios: [rp()] }), ErrorPiloto);
  });
  it('la lista nueva no puede utilizar el PDF como vía de cálculo de cláusulas', async () => {
    await assert.rejects(generarReportePilotoPDF({ datos: datosPiloto(), escenarios: [escenarioInicial('g', 'rv_garantizada', 'Garantía')] }), restringido('FUNCION_RESTRINGIDA'));
    await assert.rejects(generarReportePilotoPDF({ datos: { ...datosPiloto(), modalidad: 'rv_combinada' } }), restringido('FUNCION_RESTRINGIDA'));
  });
});
