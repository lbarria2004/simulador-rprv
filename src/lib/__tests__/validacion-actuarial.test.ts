/** Casos documentales y algebraicos independientes. Fuentes: docs/fase-3-fundamentos.md. */
import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fuente from '../data/tm2020-oficial.json' with { type: 'json' };
import * as tablas from '../tablas-mortalidad-oficiales.ts';
import { getQx, calcularLx, calcularExpectativaVida } from '../tablas-mortalidad.ts';
import { proyectarCapitalTemporalMensual, crearTrayectoriaTemporal } from '../actuaria-mensual.ts';
import { determinarPorcentajes } from '../reglas-sobrevivencia.ts';
import { calcularRVAumentoTemporal, calcularRVAumentoTemporalSobrevivencia, calcularCNU, calcularCNUTemporal, calcularRVAumentoTemporalInvalidez, calcularRVSobrevivenciaGarantizada, calcularRVInmediataSobrevivencia, etiquetarResultadoActuarial } from '../pension-calculator.ts';
import type { BeneficiarioPension } from '../pension-calculator.ts';

function cerca(actual: number, esperado: number, tolerancia = 1e-11) {
  assert.ok(Math.abs(actual - esperado) < tolerancia, `${actual} vs ${esperado}`);
}
const ben = (tipo: BeneficiarioPension['tipo'], cambios: Partial<BeneficiarioPension> = {}): BeneficiarioPension => ({
  id: tipo, tipo, edad: tipo === 'hijo' ? 12 : 60, sexo: 'F', porcentajePension: 0, ...cambios
});
const uf = { valor: 45000.13, fecha: '2026-01-01', fuente: 'Fixture fechado, no UF oficial' };

describe('TM-2020: transcripción documental y ejemplo oficial', () => {
  const catalogo = { 'CB-H-2020': tablas.TABLA_CB_H_2020, 'B-M-2020': tablas.TABLA_B_M_2020,
    'RV-M-2020': tablas.TABLA_RV_M_2020, 'MI-H-2020': tablas.TABLA_MI_H_2020, 'MI-M-2020': tablas.TABLA_MI_M_2020 };
  for (const [nombre, tabla] of Object.entries(catalogo)) {
    it(`${nombre}: conserva cada qx y factor respaldado sin extender el dominio`, () => {
      const datos = fuente.qx[nombre as keyof typeof fuente.qx];
      assert.deepEqual(Object.keys(tabla), Object.keys(datos));
      const mejoras: Record<string, number[]> = fuente.mejoras[nombre.includes('-H-') ? 'M' : 'F'];
      for (const [edad, qx] of Object.entries(datos)) {
        assert.equal(tabla[+edad].qx2020, qx);
        assert.deepEqual(tabla[+edad].aa, mejoras[edad]);
      }
    });
  }
  it('lx declara raíz condicional de RV-M y usa el dominio completo de invalidez', () => {
    assert.equal(calcularLx(20, 'F'), 100000);
    cerca(calcularLx(21, 'F', false, 'retiro_programado', 2020), 100000 * (1 - tablas.TABLA_RV_M_2020[20].qx2020), 1e-8);
    assert.throws(() => calcularLx(19, 'F'), RangeError);
    assert.equal(calcularLx(0, 'F', true), 100000);
    cerca(calcularLx(1, 'F', true, 'retiro_programado', 2020), 100000 * (1 - tablas.TABLA_MI_M_2020[0].qx2020), 1e-8);
  });
  it('retiene las cuatro correcciones confirmadas en las imágenes SP y texto CMF', () => {
    assert.equal(tablas.TABLA_MI_M_2020[3].qx2020, .00160661);
    assert.equal(tablas.TABLA_MI_M_2020[96].qx2020, .194004);
    assert.equal(tablas.TABLA_CB_H_2020[103].aa[2032 - 2021], .001323);
    assert.equal(tablas.TABLA_B_M_2020[103].aa[2027 - 2021], .001519);
  });
  it('reproduce el ejemplo q65,2022 CB-H publicado en NCG 495 p.16', () => {
    const esperado = .00887369 * (1 - .020144) * (1 - .019426);
    cerca(getQx(65, 'M', false, 'retiro_programado', 2022), esperado, 1e-14);
    assert.equal(Number(esperado.toFixed(9)), .008526031);
  });
  it('prolonga AA2036 por producto; no prolonga la vigencia de la norma', () => {
    const d = tablas.TABLA_CB_H_2020[65];
    const esperado = d.qx2020 * d.aa.reduce((p, a) => p * (1 - a), 1) * (1 - d.aa2036) ** 4;
    cerca(getQx(65, 'M', false, 'renta_vitalicia', 2040), esperado, 1e-14);
  });
  it('rechaza RV-M menor de 20, pero permite B-M para una beneficiaria menor', () => {
    assert.throws(() => getQx(19, 'F', false, 'retiro_programado', 2026, 'titular'), /No existe qx/);
    assert.equal(getQx(12, 'F', false, 'renta_vitalicia', 2020, 'beneficiario'), tablas.TABLA_B_M_2020[12].qx2020);
    assert.equal(getQx(50, 'F', true, 'renta_vitalicia', 2020), tablas.TABLA_MI_M_2020[50].qx2020);
  });
});

describe('Capital temporal mensual: equivalencia financiera y períodos exactos', () => {
  for (const meses of [0, 1, 11, 12]) {
    it(`${meses} meses: coincide con suma geométrica vencida usando q65,2020 oficial`, () => {
      const q = .00887369, i = .03;
      const razon = ((1 - q) / (1 + i)) ** (1 / 12);
      const esperado = meses ? razon * (1 - razon ** meses) / (1 - razon) : 0;
      const resultado = proyectarCapitalTemporalMensual(65, 'M', meses, i, false, 'renta_vitalicia', 2020);
      cerca(resultado.cnu, esperado);
      assert.equal(resultado.pagos.length, meses);
      if (meses === 12) cerca(resultado.pagos[11].supervivencia, 1 - q);
    });
  }
  it('mes 13 cambia edad, año generacional y descuento, sin cobrar 24 meses', () => {
    const doce = calcularCNUTemporal(65, 'M', 12, .03, false, 'renta_vitalicia', 2020);
    const trece = calcularCNUTemporal(65, 'M', 13, .03, false, 'renta_vitalicia', 2020);
    const q66 = tablas.TABLA_CB_H_2020[66].qx2020 * (1 - tablas.TABLA_CB_H_2020[66].aa[0]);
    const flujo13 = (1 - .00887369) * (1 - q66) ** (1 / 12) * 1.03 ** (-13 / 12);
    cerca(trece - doce, flujo13);
    assert.ok(trece - doce < 1);
  });
  it('fracciona en enero y cumpleaños con fecha y edad fraccionaria explícitas', () => {
    const r = proyectarCapitalTemporalMensual(65 + 11.5 / 12, 'M', 1, 0, false, 'retiro_programado', 2020, { fechaCalculo: '2020-12-16' });
    const q65 = tablas.TABLA_CB_H_2020[65].qx2020;
    const q66 = getQx(66, 'M', false, 'retiro_programado', 2021);
    cerca(r.pagos[0].supervivencia, (1 - q65) ** (1 / 24) * (1 - q66) ** (1 / 24));
  });
  it('usa rol beneficiario B-M y limita exactamente el derecho del estudiante', () => {
    const r = proyectarCapitalTemporalMensual(23, 'F', 60, 0, false, 'renta_vitalicia', 2020, { rol: 'beneficiario', edadLimite: 24 });
    assert.equal(r.pagos.length, 12);
    cerca(r.pagos[11].supervivencia, 1 - tablas.TABLA_B_M_2020[23].qx2020);
    assert.equal(proyectarCapitalTemporalMensual(24, 'F', 60, .03, false, 'renta_vitalicia', 2020, { rol: 'beneficiario', edadLimite: 24 }).cnu, 0);
  });
  it('mantiene probabilidades decrecientes y ordena capitales por tasa real', () => {
    const negativo = proyectarCapitalTemporalMensual(65, 'M', 120, -.02).cnu;
    const cero = proyectarCapitalTemporalMensual(65, 'M', 120, 0);
    const positivo = proyectarCapitalTemporalMensual(65, 'M', 120, .04).cnu;
    assert.ok(negativo > cero.cnu && cero.cnu > positivo);
    cero.pagos.forEach((p, indice) => assert.ok(p.supervivencia > 0 && p.supervivencia <= (cero.pagos[indice - 1]?.supervivencia ?? 1)));
  });
  it('un aumento de 13 meses produce un segundo año mixto con un solo mes aumentado', () => {
    const r = crearTrayectoriaTemporal(100, 200, 13, 65, 3);
    assert.equal(r.mensual[12].pensionMensual, 200);
    assert.equal(r.mensual[13].pensionMensual, 100);
    assert.equal(r.anual[1].pensionMensual, Math.round(1300 / 12));
    assert.equal(r.anual[1].mesesAumentados, 1);
    assert.equal(r.anual[1].fase, 'mixta');
  });
  it('el capital aportado financia vitalicia anual más complemento mensual, sin otro factor 12', () => {
    const fondos = 80000000;
    const r = calcularRVAumentoTemporal(fondos, 65, 'M', 13, .5, .03, [], false, uf);
    const divisor = calcularCNU(65, 'M', .03, [], false, 'renta_vitalicia', 2026) + .5 * calcularCNUTemporal(65, 'M', 13, .03, false, 'renta_vitalicia', 2026, { fechaCalculo: uf.fecha });
    cerca(r.cnu, divisor);
    assert.ok(Math.abs(r.aumentoTemporal!.pensionFinal - fondos / divisor) <= 1);
    assert.equal(r.proyeccionMensual?.filter(p => p.fase === 'aumento').length, 13);
    assert.equal(r.metodologiaTemporal, 'mensual_fuerza_constante_v1');
  });
  it('invalidez y sobrevivencia usan la misma duración mensual', () => {
    const invalidez = calcularRVAumentoTemporalInvalidez(80000000, 65, 'M', 13, .5, .03, [], uf);
    const sobrev = calcularRVAumentoTemporalSobrevivencia(80000000, [ben('conyuge')], 13, .5, .03, uf);
    for (const r of [invalidez, sobrev]) {
      assert.equal(r.proyeccionMensual?.filter(p => p.fase === 'aumento').length, 13);
      assert.equal(r.proyeccion?.[1].mesesAumentados, 1);
      cerca(r.pensionEnUF, r.pensionMensual / uf.valor);
    }
  });
  it('cero meses entrega como primer pago la base sin aumento en las tres contingencias', () => {
    const vejez = calcularRVAumentoTemporal(80000000, 65, 'M', 0, .5, .03, [], false, uf);
    const invalidez = calcularRVAumentoTemporalInvalidez(80000000, 65, 'M', 0, .5, .03, [], uf);
    const sobrev = calcularRVAumentoTemporalSobrevivencia(80000000, [ben('conyuge')], 0, .5, .03, uf);
    for (const r of [vejez, invalidez, sobrev]) {
      assert.equal(r.pensionMensual, r.aumentoTemporal!.pensionFinal);
      assert.equal(r.proyeccionMensual?.[0].fase, 'normal');
      assert.equal(r.proyeccionMensual?.filter(p => p.fase === 'aumento').length, 0);
      assert.equal(r.componentesCNU?.temporalMensual, 0);
    }
  });
  it('rechaza aumentos negativos, no finitos o ausentes', () => {
    for (const p of [-.5, NaN, Infinity, undefined as unknown as number]) assert.throws(() => calcularRVAumentoTemporal(80000000, 65, 'M', 13, p, .03, [], false, uf), RangeError);
  });
  it('garantía de 13 meses registra un año mixto y mantiene el monto constante', () => {
    const r = calcularRVSobrevivenciaGarantizada(80000000, [ben('conyuge')], 13, .03, uf);
    assert.equal(r.proyeccion?.[0].mesesGarantizados, 12);
    assert.equal(r.proyeccion?.[1].mesesGarantizados, 1);
    assert.equal(r.proyeccion?.[1].fase, 'mixta');
    assert.equal(r.proyeccion?.[2].mesesGarantizados, 0);
    assert.equal(r.proyeccion?.[0].pensionMensual, r.proyeccion?.[2].pensionMensual);
  });
  it('expectativa de beneficiario conserva edad cero y tabla de invalidez', () => {
    const b = ben('hijo', { edad: 0, esInvalido: true, gradoInvalidez: 'total' });
    const r = calcularRVInmediataSobrevivencia(80000000, 65, 'M', [b], undefined, undefined, .03, uf);
    assert.equal(r.expectativaVida, calcularExpectativaVida(0, 'F', true, 'retiro_programado', 2026, 'beneficiario'));
  });
  it('rechaza períodos fraccionarios, tasas y fechas incoherentes', () => {
    for (const m of [-1, 1.5, NaN, 1321]) assert.throws(() => calcularCNUTemporal(65, 'M', m, .03), RangeError);
    for (const i of [-1, NaN, Infinity]) assert.throws(() => calcularCNUTemporal(65, 'M', 12, i), RangeError);
    for (const fechaCalculo of ['2026-02-30', '2025-01-01']) assert.throws(() => proyectarCapitalTemporalMensual(65, 'M', 12, .03, false, 'renta_vitalicia', 2026, { fechaCalculo }), RangeError);
  });
});

describe('Art.58: porcentaje legal, vínculos y participación familiar distintos', () => {
  it('cónyuge 60% sin hijos comunes y 50% con hijos comunes elegibles', () => {
    assert.equal(determinarPorcentajes([ben('conyuge')])[0].porcentajeLegal, .6);
    assert.equal(determinarPorcentajes([ben('conyuge', { idsHijosComunes: [] }), ben('hijo')])[0].porcentajeLegal, .6);
    assert.equal(determinarPorcentajes([ben('conyuge', { idsHijosComunes: ['hijo'] }), ben('hijo')])[0].porcentajeLegal, .5);
  });
  it('conviviente civil 60/50/15 según concurrencia y vínculos comunes', () => {
    assert.equal(determinarPorcentajes([ben('conviviente')])[0].porcentajeLegal, .6);
    assert.equal(determinarPorcentajes([ben('conviviente', { idsHijosComunes: ['hijo'] }), ben('hijo')])[0].porcentajeLegal, .5);
    assert.equal(determinarPorcentajes([ben('conviviente', { idsHijosComunes: [] }), ben('hijo')])[0].porcentajeLegal, .15);
  });
  it('madre/padre de hijos no matrimoniales 36/30; hijo común exceptuado de incremento', () => {
    assert.equal(determinarPorcentajes([ben('madre_padre_hijos_nm')])[0].porcentajeLegal, .36);
    const r = determinarPorcentajes([ben('madre_padre_hijos_nm', { idsHijosComunes: ['hijo'] }), ben('hijo')]);
    assert.equal(r[0].porcentajeLegal, .3);
    assert.equal(r[1].incrementoLegal, 0);
    assert.equal(r[1].porcentaje, .15);
  });
  it('hijos 15%; 11% solo por invalidez parcial desde 24, no por orfandad', () => {
    for (const [edad, grado, pct] of [[23, 'parcial', .15], [24, 'parcial', .11], [24, 'total', .15]] as const) {
      const r = determinarPorcentajes([ben('conyuge'), ben('hijo', { edad, esInvalido: true, gradoInvalidez: grado })]);
      assert.equal(r[1].porcentajeLegal, pct);
    }
    assert.equal(determinarPorcentajes([ben('hijo')])[0].porcentajeLegal, .15);
  });
  it('sin cónyuge reparte 50 puntos adicionales: un hijo 65%, dos hijos 40% cada uno', () => {
    const solo = determinarPorcentajes([ben('hijo')])[0];
    assert.equal(solo.incrementoLegal, .5);
    assert.equal(solo.porcentaje, .65);
    const dos = determinarPorcentajes([ben('hijo'), ben('hijo', { id: 'h2' })]);
    dos.forEach(b => { assert.equal(b.incrementoLegal, .25); assert.equal(b.porcentaje, .4); });
  });
  it('padres 50% sujeto a carga familiar y ausencia de otros beneficiarios', () => {
    assert.equal(determinarPorcentajes([ben('padre', { cargaFamiliarAcreditada: true })])[0].porcentajeLegal, .5);
    assert.equal(determinarPorcentajes([ben('padre', { cargaFamiliarAcreditada: false })]).length, 0);
    assert.equal(determinarPorcentajes([ben('padre'), ben('conyuge')]).length, 1);
    assert.equal(determinarPorcentajes([ben('padre')])[0].estadoRegla, 'requiere_datos');
  });
  it('divide entre adultos de la misma categoría, no entre todas las categorías', () => {
    const r = determinarPorcentajes([ben('conyuge', { id: 'c1' }), ben('conyuge', { id: 'c2' })]);
    r.forEach(b => assert.equal(b.porcentajeLegal, .3));
  });
  it('suma 110% sobre la base y 100% de participación familiar sin rebajar porcentajes', () => {
    const hijos = Array.from({ length: 4 }, (_, i) => ben('hijo', { id: `h${i}` }));
    const r = determinarPorcentajes([ben('conyuge', { idsHijosComunes: hijos.map(h => h.id!) }), ...hijos]);
    cerca(r.reduce((s, b) => s + b.porcentaje, 0), 1.1);
    cerca(r.reduce((s, b) => s + b.participacionFamiliar, 0), 1);
    assert.equal(r[0].porcentaje, .5);
    assert.equal(r[1].porcentaje, .15);
    assert.equal(r[0].factorProrrateo, 1);
  });
  it('porcentaje manual no cambia el porcentaje legal y los vínculos omitidos generan aviso', () => {
    const r = determinarPorcentajes([ben('conyuge', { porcentajePension: .7 }), ben('hijo')]);
    assert.equal(r[0].porcentajeLegal, .5);
    assert.equal(r[0].porcentaje, .7);
    assert.equal(r[0].estadoRegla, 'personalizada');
    assert.ok(r[0].advertenciasRegla.some(a => a.includes('hijos comunes')));
  });
  it('rechaza datos malformados en vez de seleccionar una tabla o regla por descarte', () => {
    for (const cambios of [{ edad: -1 }, { porcentajePension: NaN }, { idsHijosComunes: 'hijo' as unknown as string[] }]) {
      assert.throws(() => determinarPorcentajes([ben('conyuge', cambios)]), RangeError);
    }
  });
  it('etiqueta resultados como estimativos y conserva la procedencia de los supuestos', () => {
    const r = etiquetarResultadoActuarial(calcularRVAumentoTemporal(80000000, 65, 'M', 13, .5, .03, [], false, uf));
    assert.equal(r.validacionActuarial?.estado, 'estimativo');
    assert.match(r.validacionActuarial!.fuenteTablas, /ncg_495_2023/);
    assert.ok(r.advertencias?.some(a => a.includes('No constituye una oferta oficial')));
  });
});
