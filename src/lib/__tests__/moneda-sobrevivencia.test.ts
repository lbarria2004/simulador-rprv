import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { clpAUf, ufAClp, validarReferenciaUF, UF_REFERENCIA_EJEMPLO, type ReferenciaUF } from '../moneda.ts';
import * as motor from '../pension-calculator.ts';
import { getQx } from '../tablas-mortalidad.ts';
import { TABLA_B_M_2020, TABLA_RV_M_2020 } from '../tablas-mortalidad-oficiales.ts';

const uf: ReferenciaUF = { valor: 45000.13, fecha: '2026-10-01', fuente: 'Fixture ilustrativo' };
const conyuge: motor.BeneficiarioPension = { id: 'c', tipo: 'conyuge', edad: 62, sexo: 'F', porcentajePension: 0 };
const hijo: motor.BeneficiarioPension = { id: 'h', tipo: 'hijo', edad: 17, sexo: 'M', porcentajePension: 0 };

describe('Referencia monetaria única', () => {
  it('UF y CLP son inversas sin redondeo intermedio', () => {
    for (const monto of [0, .01, 123.456789, 80000000.19, -32.5]) {
      assert.ok(Math.abs(ufAClp(clpAUf(monto, uf), uf) - monto) <= Math.max(1e-9, Math.abs(monto) * 1e-15));
    }
    assert.equal(ufAClp(2.5, uf), 2.5 * uf.valor);
  });
  it('rechaza fechas imposibles, fuentes vacías y valores UF inválidos', () => {
    for (const valor of [0, -1, NaN, Infinity]) assert.throws(() => validarReferenciaUF({ ...uf, valor }), RangeError);
    for (const fecha of ['', '2026-02-30', '2026-13-01', '2026-2-01']) assert.throws(() => validarReferenciaUF({ ...uf, fecha }), RangeError);
    assert.throws(() => validarReferenciaUF({ ...uf, fuente: '' }), RangeError);
    assert.throws(() => clpAUf(Infinity, uf), RangeError);
    assert.throws(() => ufAClp(NaN, uf), RangeError);
  });
  const fondos = 80000000;
  const grupo = [conyuge, hijo];
  const casos: Record<string, (u: ReferenciaUF) => motor.ResultadoEscenario> = {
    rp: u => motor.calcularRetiroProgramado(fondos, 65, 'M', .0367, grupo, false, {}, u),
    rv: u => motor.calcularRVInmediata(fondos, 65, 'M', .03, grupo, false, u),
    garantia: u => motor.calcularRVPeriodoGarantizado(fondos, 65, 'M', 180, .03, grupo, false, u),
    aumento: u => motor.calcularRVAumentoTemporal(fondos, 65, 'M', 36, .5, .03, grupo, false, u),
    ambas: u => motor.calcularRVConAmbasClausulas(fondos, 65, 'M', 180, 36, .5, .03, grupo, false, u),
    rpInvalidez: u => motor.calcularRetiroProgramadoInvalidez(fondos, 55, 'M', .0367, grupo, {}, u),
    rvInvalidez: u => motor.calcularRVInmediataInvalidez(fondos, 55, 'M', .03, grupo, u),
    garantiaInvalidez: u => motor.calcularRVPeriodoGarantizadoInvalidez(fondos, 55, 'M', 180, .03, grupo, u),
    aumentoInvalidez: u => motor.calcularRVAumentoTemporalInvalidez(fondos, 55, 'M', 36, .5, .03, grupo, u),
    ambasInvalidez: u => motor.calcularRVConAmbasClausulasInvalidez(fondos, 55, 'M', 180, 36, .5, .03, grupo, u),
    rpSobrevivencia: u => motor.calcularRetiroProgramadoSobrevivencia(fondos, 65, 'M', grupo, undefined, undefined, .0367, u),
    rvSobrevivencia: u => motor.calcularRVInmediataSobrevivencia(fondos, 65, 'M', grupo, undefined, undefined, .03, u),
    garantiaSobrevivencia: u => motor.calcularRVGarantizadoSobrevivencia(fondos, 65, 'M', grupo, 180, undefined, undefined, .03, u),
    aumentoSobrevivencia: u => motor.calcularRVAumentoSobrevivencia(fondos, 65, 'M', grupo, 36, 50, undefined, undefined, .03, u),
    ambasSobrevivencia: u => motor.calcularRVAmbasSobrevivencia(fondos, 65, 'M', grupo, 180, 36, 50, undefined, undefined, .03, u),
    garantiaGrupo: u => motor.calcularRVSobrevivenciaGarantizada(fondos, grupo, 180, .03, u),
    aumentoGrupo: u => motor.calcularRVAumentoTemporalSobrevivencia(fondos, grupo, 36, .5, .03, u)
  };
  for (const [nombre, calcular] of Object.entries(casos)) {
    it(`${nombre}: la UF solo cambia la representación; no modifica CLP ni CNU`, () => {
      const a = calcular(uf);
      const otra = { ...uf, valor: uf.valor * 2 };
      const b = calcular(otra);
      assert.deepEqual(a.referenciaUF, uf);
      assert.deepEqual(b.referenciaUF, otra);
      assert.equal(a.unidadMonetaria, 'CLP_REALES');
      assert.equal(a.pensionMensual, b.pensionMensual);
      assert.equal(a.cnu, b.cnu);
      assert.equal(a.pensionEnUF, clpAUf(a.pensionMensual, uf));
      assert.equal(b.pensionEnUF, a.pensionEnUF / 2);
      assert.deepEqual(a.proyeccion, b.proyeccion);
    });
  }
  it('el año actuarial predeterminado procede de la referencia UF fechada', () => {
    const futura = { ...uf, fecha: '2028-04-01' };
    const rp = motor.calcularRetiroProgramado(fondos, 65, 'M', .0367, [], false, {}, futura);
    assert.equal(rp.anoCalculo, 2028);
    assert.equal(rp.cnu, motor.calcularCNU(65, 'M', .0367, [], false, 'retiro_programado', 2028));
    const rv = motor.calcularRVInmediata(fondos, 65, 'M', .03, [], false, futura);
    assert.equal(rv.cnu, motor.calcularCNU(65, 'M', .03, [], false, 'renta_vitalicia', 2028));
  });
  it('la referencia de un cálculo no contamina al siguiente ni al supuesto inicial', () => {
    const primero = motor.calcularRVInmediata(fondos, 65, 'M', .03, [], false, uf);
    uf.valor += 1;
    assert.equal(primero.referenciaUF?.valor, 45000.13);
    uf.valor -= 1;
    const siguiente = motor.calcularRVInmediata(fondos, 65, 'M');
    assert.deepEqual(siguiente.referenciaUF, UF_REFERENCIA_EJEMPLO);
    assert.ok(Object.isFrozen(UF_REFERENCIA_EJEMPLO));
  });
  it('financiamiento y beneficios usan la misma referencia sin perder precisión UF', () => {
    const inv = motor.calcularFinanciamientoInvalidez(15000000, 1200000, 'total', true, 55, 'M', .0367, [], uf);
    assert.equal(inv.capitalNecesarioUF, clpAUf(inv.capitalNecesarioCLP, uf));
    const sob = motor.calcularFinanciamientoSobrevivencia(15000000, 1200000, true, [conyuge], .0367, uf);
    assert.equal(sob.saldoTotalFinanciamientoUF, clpAUf(sob.saldoTotalFinanciamientoCLP, uf));
    assert.equal(motor.calcularBAC(25, 0, uf).beneficioMensualPesos, Math.round(ufAClp(2.5, uf)));
    assert.equal(motor.calcularCompensacionExpectativaVidaMujer('F', 65, uf).beneficioMensualPesos, Math.round(ufAClp(.25, uf)));
  });
});

describe('CNU y flujo de sobrevivencia', () => {
  it('la tabla depende del rol femenino y no de la modalidad RP/RV', () => {
    assert.equal(getQx(65, 'F', false, 'retiro_programado', 2020), TABLA_RV_M_2020[65].qx2020);
    assert.equal(getQx(65, 'F', false, 'renta_vitalicia', 2020, 'beneficiario'), TABLA_B_M_2020[65].qx2020);
  });
  for (const [edad, estudiante, limite] of [[17, false, 18], [23, true, 24]] as const) {
    it(`el hijo ${edad} aporta un único año y deja de generar flujo a los ${limite}`, () => {
      assert.equal(motor.calcularCNUIndividual(edad, 'M', .03, 'retiro_programado', 2026, false, true, estudiante), 12 / Math.sqrt(1.03));
      const r = motor.calcularRetiroProgramadoSobrevivencia(1000000, 65, 'M', [{ ...hijo, edad, esEstudiante: estudiante, porcentajePension: .15 }], undefined, undefined, .03, uf);
      assert.equal(r.proyeccion[0].retiroAnual, 1000000);
      assert.equal(r.proyeccion[0].saldoFinal, 0);
    });
  }
  it('actualiza edades, derechos y año; retira el agregado y conserva la identidad de caja', () => {
    const grupo = [Object.freeze({ ...conyuge }), Object.freeze({ ...hijo })];
    const copia = structuredClone(grupo);
    const r = motor.calcularRetiroProgramadoSobrevivencia(80000000, 65, 'M', grupo, undefined, undefined, .0367, uf,
      { rentabilidadRealAnual: -.03, anoCalculo: 2028 });
    let saldo = 80000000;
    let acumulado = 0;
    for (const [i, fila] of r.proyeccion.entries()) {
      assert.equal(fila.anoCalendario, 2028 + i);
      assert.deepEqual(fila.beneficiarios, grupo.map(b => ({ ...b, edad: b.edad + i })));
      assert.equal(fila.cnu, motor.calcularCNUSobrevivencia(fila.beneficiarios, .0367, 'retiro_programado', 2028 + i).cnuTotal);
      assert.equal(fila.pensionMensual, fila.pensionPorBeneficiario!.reduce((t, b) => t + b.pensionMensual, 0));
      assert.equal(fila.retiroAcumulado, Math.round(acumulado));
      assert.ok(fila.retiroAnual <= saldo);
      assert.ok(Math.abs(fila.saldoFinal - (saldo - fila.retiroAnual) * .97) < 1e-6);
      saldo = fila.saldoFinal; acumulado += fila.retiroAnual;
    }
    assert.equal(r.proyeccion[0].pensionPorBeneficiario![0].porcentaje, .5);
    assert.equal(r.proyeccion[1].pensionPorBeneficiario![0].porcentaje, .6);
    assert.deepEqual(grupo, copia);
    assert.equal(r.pensionMensual, r.proyeccion[0].pensionMensual);
    assert.deepEqual(motor.calcularOpcionesSobrevivencia(80000000, 65, 'M', grupo, undefined, undefined, .0367, .03, uf,
      { rentabilidadRealAnual: -.03, anoCalculo: 2028 })[0], r);
  });
  it('el retorno real no cambia CNU ni pagos iniciales, sí los saldos siguientes', () => {
    const valores = [0, .02, .04].map(retorno => motor.calcularRetiroProgramadoSobrevivencia(80000000, 65, 'M', [conyuge], undefined, undefined, .0367, uf, { rentabilidadRealAnual: retorno }));
    assert.equal(new Set(valores.map(r => r.cnu)).size, 1);
    assert.equal(new Set(valores.map(r => r.pensionMensual)).size, 1);
    assert.ok(valores[0].proyeccion[1].saldoAcumulado < valores[1].proyeccion[1].saldoAcumulado);
    assert.ok(valores[1].proyeccion[1].saldoAcumulado < valores[2].proyeccion[1].saldoAcumulado);
  });
  it('sin beneficiarios con derecho no se inventan pagos ni retornos', () => {
    const r = motor.calcularRetiroProgramadoSobrevivencia(1000000, 65, 'M', [{ ...hijo, edad: 25, porcentajePension: .15 }], undefined, undefined, .03, uf);
    assert.equal(r.pensionMensual, 0);
    assert.equal(r.proyeccion[0].retiroAnual, 0);
    assert.equal(r.proyeccion[0].saldoFinal, 1000000);
  });
  it('conserva beneficiario inválido al filtrar un hijo adulto y no depende del orden', () => {
    const invalido = { ...hijo, id: 'i', edad: 35, esInvalido: true };
    const fuera = { ...hijo, edad: 30 };
    const a = motor.calcularRetiroProgramadoSobrevivencia(80000000, 65, 'M', [fuera, invalido, conyuge], undefined, undefined, .03, uf);
    const b = motor.calcularRetiroProgramadoSobrevivencia(80000000, 65, 'M', [conyuge, invalido, fuera], undefined, undefined, .03, uf);
    assert.equal(a.cnu, b.cnu);
    assert.equal(a.pensionMensual, b.pensionMensual);
    assert.equal(a.proyeccion[1].beneficiarios[1].esInvalido, true);
  });
  it('distingue porcentajes de referencia y participación en el total familiar', () => {
    const grupo = [conyuge, ...Array.from({ length: 4 }, (_, i) => ({ ...hijo, id: String(i), edad: 10 + i }))];
    const porcentajes = motor.calcularPorcentajesBeneficiarios(grupo);
    assert.ok(Math.abs(porcentajes.reduce((t, b) => t + b.participacionFamiliar, 0) - 1) < 1e-14);
    assert.equal(porcentajes[0].porcentajeLegal, .5);
    assert.equal(porcentajes[0].porcentaje, .5);
    assert.ok(Math.abs(porcentajes[0].participacionFamiliar - .5 / 1.1) < 1e-14);
  });
  it('rechaza entradas inválidas y tasas que no tienen sentido financiero', () => {
    for (const opciones of [{ anoCalculo: 2026.5 }, { rentabilidadRealAnual: -1 }, { rentabilidadRealAnual: Infinity }]) {
      assert.throws(() => motor.calcularRetiroProgramadoSobrevivencia(1000, 65, 'M', [conyuge], undefined, undefined, .03, uf, opciones), RangeError);
    }
  });
});
