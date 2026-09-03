/**
 * Pruebas unitarias para el motor actuarial de pensiones
 * Utiliza el test runner nativo de Node.js (Node 24)
 */

import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

import {
  calcularCNU,
  calcularCNUTemporal,
  calcularRetiroProgramado,
  calcularRVInmediata,
  calcularRVPeriodoGarantizado,
  calcularRVAumentoTemporal,
  calcularRVConAmbasClausulas,
  calcularPGU,
  calcularBAC,
  getQx,
  calcularExpectativaVida,
  PGU,
  BAC,
  TASAS_INTERES
} from '../pension-calculator.ts';

describe('Motor Actuarial de Pensiones - Sistema Chileno', () => {
  const FONDOS_TEST = 50_000_000; // $50.000.000 CLP

  describe('Tablas de Mortalidad y Actuaria Básica', () => {
    it('getQx retorna tasas de mortalidad válidas y crecientes en vejez', () => {
      const qx60H = getQx(60, 'M');
      const qx70H = getQx(70, 'M');
      const qx80H = getQx(80, 'M');

      assert.ok(qx60H > 0, 'qx a los 60 años debe ser positivo');
      assert.ok(qx70H > qx60H, 'qx debe aumentar con la edad (70 vs 60)');
      assert.ok(qx80H > qx70H, 'qx debe aumentar con la edad (80 vs 70)');
    });

    it('Mortalidad de invalidez es superior a la de no inválidos', () => {
      const qxNoInvalido = getQx(50, 'M', false);
      const qxInvalido = getQx(50, 'M', true);

      assert.ok(qxInvalido > qxNoInvalido, 'Invalidez debe tener mayor mortalidad que condición normal');
    });

    it('Expectativa de vida es coherente con el sistema chileno', () => {
      const expHombre65 = calcularExpectativaVida(65, 'M');
      const expMujer60 = calcularExpectativaVida(60, 'F');

      assert.ok(expHombre65 >= 15 && expHombre65 <= 25, `Exp hombre 65 (${expHombre65}) fuera de rango razonable`);
      assert.ok(expMujer60 >= 20 && expMujer60 <= 35, `Exp mujer 60 (${expMujer60}) fuera de rango razonable`);
    });
  });

  describe('Capital Necesario Unitario (CNU)', () => {
    it('CNU disminuye si aumenta la tasa de interés de descuento', () => {
      const cnuTasaBaja = calcularCNU(65, 'M', 0.02);
      const cnuTasaAlta = calcularCNU(65, 'M', 0.04);

      assert.ok(cnuTasaBaja > cnuTasaAlta, 'A mayor tasa de descuento, menor debe ser el CNU');
    });

    it('CNU de mujer de 60 años es mayor al de hombre de 65 años (mayor longevidad)', () => {
      const cnuHombre65 = calcularCNU(65, 'M', 0.03);
      const cnuMujer60 = calcularCNU(60, 'F', 0.03);

      assert.ok(cnuMujer60 > cnuHombre65, 'CNU de mujer 60 debe ser mayor que el de hombre 65');
    });

    it('CNU Temporal aumenta con la cantidad de meses', () => {
      const cnuTemp12 = calcularCNUTemporal(65, 'M', 12, 0.03);
      const cnuTemp36 = calcularCNUTemporal(65, 'M', 36, 0.03);

      assert.ok(cnuTemp36 > cnuTemp12, 'CNU temporal de 36 meses debe ser mayor que el de 12 meses');
    });
  });

  describe('Modalidades de Pensión de Vejez', () => {
    it('Retiro Programado calcula pensión y proyecciones válidas', () => {
      const resRP = calcularRetiroProgramado(FONDOS_TEST, 65, 'M', TASAS_INTERES.RETIRO_PROGRAMADO);

      assert.ok(resRP.pensionMensual > 0, 'Pensión mensual debe ser mayor que 0');
      assert.ok(resRP.pensionEnUF > 0, 'Pensión en UF debe ser mayor que 0');
      assert.ok(Array.isArray(resRP.proyeccion) && resRP.proyeccion.length > 0, 'Debe incluir proyección anual');
    });

    it('Renta Vitalicia Inmediata NO aplica descuento arbitrario de 3%', () => {
      const resRV = calcularRVInmediata(FONDOS_TEST, 65, 'M', TASAS_INTERES.RENTA_VITALICIA_VEJEZ);
      const cnu = calcularCNU(65, 'M', TASAS_INTERES.RENTA_VITALICIA_VEJEZ);
      const pensionExactaSinCortes = FONDOS_TEST / cnu;

      assert.equal(resRV.pensionMensual, Math.round(pensionExactaSinCortes));
    });

    it('RV con Periodo Garantizado reduce la pensión mensual respecto a RV Inmediata simple', () => {
      const resSimple = calcularRVInmediata(FONDOS_TEST, 65, 'M');
      const resGarantizada = calcularRVPeriodoGarantizado(FONDOS_TEST, 65, 'M', 120);

      assert.ok(resGarantizada.pensionMensual < resSimple.pensionMensual, 'Garantía debe reducir pensión base');
      assert.equal(resGarantizada.periodoGarantizado, 120);
    });

    it('RV con Aumento Temporal respeta equivalencia actuarial', () => {
      const mesesAumento = 36; // 3 años
      const porcentajeAumento = 0.30; // 30% más durante el aumento
      const resAumento = calcularRVAumentoTemporal(FONDOS_TEST, 65, 'M', mesesAumento, porcentajeAumento);

      assert.ok(resAumento.aumentoTemporal, 'Debe incluir desglose de aumento temporal');
      const { pensionAumentada, pensionFinal } = resAumento.aumentoTemporal;

      // La pensión aumentada debe ser 30% superior a la final (con tolerancia de redondeo de 1 peso)
      const diferencia = Math.abs(pensionAumentada - Math.round(pensionFinal * 1.30));
      assert.ok(diferencia <= 1, `Diferencia de redondeo excesiva: ${diferencia}`);

      // La pensión base ajustada final debe ser menor que la RV simple para compensar el sobrepago
      const resSimple = calcularRVInmediata(FONDOS_TEST, 65, 'M');
      assert.ok(pensionFinal < resSimple.pensionMensual, 'Pensión final debe compensar el período aumentado');
      assert.ok(pensionAumentada > resSimple.pensionMensual, 'Pensión aumentada debe superar la RV simple');
    });

    it('RV con Ambas Cláusulas (Garantizada + Aumento) calcula coherentemente', () => {
      const resAmbas = calcularRVConAmbasClausulas(FONDOS_TEST, 65, 'M', 120, 24, 0.50);

      assert.equal(resAmbas.periodoGarantizado, 120);
      assert.ok(resAmbas.aumentoTemporal);
      assert.ok(resAmbas.pensionMensual > 0);
    });
  });

  describe('Beneficios Estatales Complementarios', () => {
    it('PGU entrega el monto base completo cuando la pensión está bajo el umbral legal', () => {
      const pgu = calcularPGU(300_000, 65);
      assert.equal(pgu.aplica, true);
      assert.equal(pgu.montoMensual, PGU.MONTO_BASE);
    });

    it('BAC calcula 0,1 UF por año con tope de 2,5 UF', () => {
      const bac10Anos = calcularBAC(10);
      const bac35Anos = calcularBAC(35);

      assert.equal(bac10Anos.beneficioUF, 1.0);
      // Con 35 años sobrepasa el tope de 2.5 UF
      assert.equal(bac35Anos.beneficioUF, BAC.TOPE_MENSUAL_UF);
    });
  });

  describe('Casos Reales SCOMP (Certificados de Ofertas Oficiales)', () => {
    it('Caso 1: Juan Zamora (Hombre 65 años, Cónyuge 62 años, Saldo 1.035,47 UF)', () => {
      const saldoUF = 1035.47;
      const uf = 40850.06;
      const saldoPesos = saldoUF * uf;
      const beneficiarios = [{ tipo: 'conyuge' as const, edad: 62, sexo: 'F' as const, porcentajePension: 0.60 }];

      // Retiro Programado
      const resRP = calcularRetiroProgramado(saldoPesos, 65, 'M', 0.0358, beneficiarios);
      const pensionRPUF = resRP.pensionMensual / uf;

      // PlanVital SCOMP: 4,97 UF
      assert.ok(Math.abs(pensionRPUF - 4.97) < 0.1, `Pensión RP (${pensionRPUF.toFixed(2)} UF) muy desviada de 4.97 UF`);

      // RV Simple con tasa observada de aseguradoras líderes (~3.15%)
      const saldoNetoRV = (saldoUF - 15.53) * uf; // Menos comisión asesor 1.5%
      const resRV = calcularRVInmediata(saldoNetoRV, 65, 'M', 0.0315, beneficiarios);
      const pensionRVUF = resRV.pensionMensual / uf;

      // Confuturo SCOMP: 4,68 UF / 4 Life: 4,67 UF
      assert.ok(Math.abs(pensionRVUF - 4.67) < 0.1, `Pensión RV (${pensionRVUF.toFixed(2)} UF) muy desviada de 4.67 UF`);
    });

    it('Caso 2: Mónica Spuler (Mujer 64 años, Cónyuge 70 años, Saldo 2.177,40 UF)', () => {
      const saldoUF = 2177.40;
      const uf = 40844.79;
      const beneficiarios = [{ tipo: 'conyuge' as const, edad: 70, sexo: 'M' as const, porcentajePension: 0.60 }];

      // RV Simple con tasa observada de aseguradoras líderes (~3.08% en SCOMP 4 Life / Confuturo)
      const saldoNetoRV = (saldoUF - 32.66) * uf; // Menos comisión asesor 1.5%
      const resRV = calcularRVInmediata(saldoNetoRV, 64, 'F', 0.0308, beneficiarios);
      const pensionRVUF = resRV.pensionMensual / uf;

      // SCOMP 4 Life: 9,59 UF / Confuturo: 9,55 UF / Penta: 9,50 UF
      assert.ok(Math.abs(pensionRVUF - 9.59) < 0.1, `Pensión RV (${pensionRVUF.toFixed(2)} UF) muy desviada de 9.59 UF`);
    });
  });
});
