import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  AVISO_SIMULACION,
  calcularCNU,
  calcularCNUIndividual,
  calcularCNUSobrevivencia,
  calcularEscenariosRetiroProgramado,
  calcularPorcentajesBeneficiarios,
  calcularRetiroProgramado,
  calcularRetiroProgramadoInvalidez,
  ESCENARIOS_RENTABILIDAD_RP,
  type BeneficiarioPension
} from '../pension-calculator.ts';

const fondos = 80_000_000;
const tasaTecnica = 0.0367;
const conyuge: BeneficiarioPension = {
  id: 'conyuge', nombre: 'Ejemplo', tipo: 'conyuge', edad: 62, sexo: 'F', porcentajePension: 0
};
const hijo: BeneficiarioPension = {
  id: 'hijo', tipo: 'hijo', edad: 17, sexo: 'M', porcentajePension: 0
};

describe('Proyección orientativa de Retiro Programado', () => {
  it('la primera fila coincide con la pensión inicial al incluir cónyuge', () => {
    const rp = calcularRetiroProgramado(fondos, 65, 'M', tasaTecnica, [conyuge]);
    assert.equal(rp.pensionMensual, rp.proyeccion[0].pensionMensual);
    assert.equal(rp.cnu, rp.proyeccion[0].cnu);
    assert.ok(rp.cnu > calcularCNU(65, 'M', tasaTecnica));
  });

  it('envejece al grupo y avanza el año generacional sin mutar las entradas', () => {
    const grupo = [Object.freeze({ ...conyuge, fechaNacimiento: '1964-01-01' }), Object.freeze({ ...hijo })];
    Object.freeze(grupo);
    const copia = structuredClone(grupo);
    const rp = calcularRetiroProgramado(fondos, 65, 'M', tasaTecnica, grupo, false, { anoCalculo: 2028 });
    for (const [indice, fila] of rp.proyeccion.entries()) {
      assert.equal(fila.anoCalendario, 2028 + indice);
      assert.deepEqual(fila.beneficiarios, grupo.map(ben => ({ ...ben, edad: ben.edad + indice })));
    }
    assert.deepEqual(grupo, copia);
    assert.equal(rp.proyeccion[1].cnu, calcularCNU(66, 'M', tasaTecnica,
      grupo.map(ben => ({ ...ben, edad: ben.edad + 1 })), false, 'retiro_programado', 2029));
    assert.notEqual(rp.proyeccion[1].cnu, calcularCNU(66, 'M', tasaTecnica, grupo, false, 'retiro_programado', 2028));
  });

  for (const [edadHijo, estudiante, limite] of [[17, false, 18], [23, true, 24]] as const) {
    it(`al cumplir ${limite} años el hijo pierde derecho y el cónyuge automático pasa a 60%`, () => {
      const grupo = [conyuge, { ...hijo, edad: edadHijo, esEstudiante: estudiante }];
      const rp = calcularRetiroProgramado(fondos, 65, 'M', tasaTecnica, grupo);
      const porcentajesInicio = calcularPorcentajesBeneficiarios(rp.proyeccion[0].beneficiarios);
      const porcentajesSiguiente = calcularPorcentajesBeneficiarios(rp.proyeccion[1].beneficiarios);
      assert.equal(porcentajesInicio[0].porcentaje, 0.5);
      assert.equal(porcentajesSiguiente.length, 1);
      assert.equal(porcentajesSiguiente[0].porcentaje, 0.6);
      assert.equal(rp.proyeccion[1].cnu, calcularCNU(66, 'M', tasaTecnica,
        [{ ...conyuge, edad: 63 }], false, 'retiro_programado', 2027));
    });
  }

  it('el hijo con invalidez conserva datos y derecho después de los 24 años', () => {
    const grupo = [conyuge, { ...hijo, edad: 23, esEstudiante: true, esInvalido: true }];
    const rp = calcularRetiroProgramado(fondos, 65, 'M', tasaTecnica, grupo);
    const ben = calcularPorcentajesBeneficiarios(rp.proyeccion[2].beneficiarios);
    assert.equal(ben.length, 2);
    assert.equal(ben[1].edad, 25);
    assert.equal(ben[1].esInvalido, true);
  });

  it('el CNU no depende del orden al excluir hijos adultos y padres sin derecho', () => {
    const excluido = { ...hijo, edad: 30 };
    const padre: BeneficiarioPension = { tipo: 'padre', edad: 90, sexo: 'M', porcentajePension: 0 };
    const esperado = calcularCNU(65, 'M', tasaTecnica, [conyuge]);
    for (const grupo of [[excluido, conyuge, padre], [padre, conyuge, excluido], [conyuge, excluido, padre]]) {
      assert.equal(calcularCNU(65, 'M', tasaTecnica, grupo), esperado);
    }
  });

  it('sobrevivencia conserva la tabla de invalidez y el estudiante tras filtrar otro beneficiario', () => {
    for (const beneficiario of [{ ...hijo, edad: 35, esInvalido: true }, { ...hijo, edad: 22, esEstudiante: true }]) {
      const excluido = { ...hijo, edad: 30 };
      const grupo = [excluido, beneficiario];
      const { cnuTotal } = calcularCNUSobrevivencia(grupo, tasaTecnica);
      const pct = calcularPorcentajesBeneficiarios(grupo)[0].porcentaje;
      const esperado = calcularCNUIndividual(beneficiario.edad, beneficiario.sexo, tasaTecnica,
        'retiro_programado', 2026, !!beneficiario.esInvalido, true, !!beneficiario.esEstudiante);
      assert.equal(cnuTotal, esperado * pct);
    }
  });

  it('los tres retornos comparten CNU y pensión inicial pero ordenan saldos y pensiones futuras', () => {
    const escenarios = calcularEscenariosRetiroProgramado(fondos, 65, 'M', tasaTecnica, [conyuge]);
    const { conservador, base, optimista } = escenarios;
    for (const clave of Object.keys(escenarios) as (keyof typeof escenarios)[]) {
      const rp = escenarios[clave];
      assert.equal(rp.rentabilidadRealAnual, ESCENARIOS_RENTABILIDAD_RP[clave].rentabilidadRealAnual);
      assert.equal(rp.cnu, base.cnu);
      assert.equal(rp.pensionMensual, base.pensionMensual);
      assert.equal(rp.tasaTecnicaCNU, tasaTecnica);
      assert.equal(rp.tasaInteres, tasaTecnica);
      assert.ok(rp.advertencias?.includes(AVISO_SIMULACION));
    }
    assert.ok(conservador.proyeccion[10].saldoFinal < base.proyeccion[10].saldoFinal);
    assert.ok(base.proyeccion[10].saldoFinal < optimista.proyeccion[10].saldoFinal);
    assert.ok(conservador.proyeccion[10].pensionMensual < base.proyeccion[10].pensionMensual);
    assert.ok(base.proyeccion[10].pensionMensual < optimista.proyeccion[10].pensionMensual);
  });

  it('cambiar el descuento del CNU altera la pensión sin cambiar el supuesto de retorno', () => {
    const bajo = calcularRetiroProgramado(fondos, 65, 'M', 0.02);
    const alto = calcularRetiroProgramado(fondos, 65, 'M', 0.04);
    assert.ok(bajo.cnu > alto.cnu);
    assert.ok(bajo.pensionMensual < alto.pensionMensual);
    assert.equal(bajo.rentabilidadRealAnual, alto.rentabilidadRealAnual);
  });

  for (const retorno of [-0.05, 0, 0.02, 0.04]) {
    it(`con retorno ${retorno} conserva la identidad de caja sin retirar más que el saldo`, () => {
      const rp = calcularRetiroProgramado(fondos, 65, 'M', tasaTecnica, [conyuge], false,
        { rentabilidadRealAnual: retorno });
      let saldo = fondos;
      let retirado = 0;
      for (const fila of rp.proyeccion) {
        assert.equal(fila.saldoAcumulado, Math.round(saldo));
        assert.equal(fila.retiroAcumulado, Math.round(retirado));
        assert.equal(fila.retiroAnual, Math.min(saldo, saldo / fila.cnu * 12));
        assert.ok(fila.retiroAnual >= 0 && fila.retiroAnual <= saldo);
        assert.equal(fila.saldoFinal, (saldo - fila.retiroAnual) * (1 + retorno));
        retirado += fila.retiroAnual;
        saldo = fila.saldoFinal;
      }
    });
  }

  it('saldo cero y edad terminal entregan resultados finitos y retiros financiables', () => {
    const cero = calcularRetiroProgramado(0, 65, 'M');
    assert.equal(cero.pensionMensual, 0);
    assert.equal(cero.proyeccion.length, 1);
    const terminal = calcularRetiroProgramado(fondos, 110, 'M');
    assert.equal(terminal.proyeccion.length, 1);
    assert.equal(terminal.proyeccion[0].retiroAnual, fondos);
    assert.equal(terminal.proyeccion[0].saldoFinal, 0);
    assert.equal(terminal.pensionMensual, terminal.proyeccion[0].pensionMensual);
  });

  it('invalidez usa la misma proyección corregida y no se interrumpe arbitrariamente a los 81', () => {
    const opciones = { anoCalculo: 2029, rentabilidadRealAnual: -0.01 };
    const general = calcularRetiroProgramado(fondos, 80, 'M', tasaTecnica, [conyuge], true, opciones);
    const invalidez = calcularRetiroProgramadoInvalidez(fondos, 80, 'M', tasaTecnica, [conyuge], opciones);
    assert.deepEqual(invalidez, general);
    assert.ok(invalidez.proyeccion.some(fila => fila.edad > 81));
  });

  it('rechaza entradas fuera de dominio y valores no finitos', () => {
    for (const saldo of [-1, NaN, Infinity]) {
      assert.throws(() => calcularRetiroProgramado(saldo, 65, 'M'), RangeError);
    }
    for (const edad of [-1, 65.5, 111, NaN]) {
      assert.throws(() => calcularRetiroProgramado(fondos, edad, 'M'), RangeError);
    }
    for (const tasa of [-1, -2, NaN, Infinity]) {
      assert.throws(() => calcularRetiroProgramado(fondos, 65, 'M', tasa), RangeError);
      assert.throws(() => calcularRetiroProgramado(fondos, 65, 'M', tasaTecnica, [], false,
        { rentabilidadRealAnual: tasa }), RangeError);
    }
    for (const ano of [2019, 2026.5, NaN, Infinity]) {
      assert.throws(() => calcularRetiroProgramado(fondos, 65, 'M', tasaTecnica, [], false,
        { anoCalculo: ano }), RangeError);
    }
    assert.throws(() => calcularRetiroProgramado(fondos, 65, 'M', tasaTecnica,
      [{ ...conyuge, edad: NaN }]), RangeError);
    assert.throws(() => calcularRetiroProgramado(fondos, 65, 'M', tasaTecnica,
      [{ ...conyuge, porcentajePension: 60 }]), RangeError);
  });
});
