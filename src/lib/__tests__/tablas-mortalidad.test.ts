import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import {
  TABLA_CB_H_2020, TABLA_B_M_2020, TABLA_RV_M_2020, TABLA_MI_H_2020, TABLA_MI_M_2020,
  getQxGeneracional, type DatosMortalidadEdad
} from '../tablas-mortalidad-oficiales.ts';

describe('Integridad interna de las tablas almacenadas (no certificación de la fuente)', () => {
  for (const [nombre, tabla, sexo, invalido, modalidad] of [
    ['CB-H', TABLA_CB_H_2020, 'M', false, 'retiro_programado'],
    ['B-M', TABLA_B_M_2020, 'F', false, 'retiro_programado'],
    ['RV-M', TABLA_RV_M_2020, 'F', false, 'renta_vitalicia'],
    ['MI-H', TABLA_MI_H_2020, 'M', true, 'retiro_programado'],
    ['MI-M', TABLA_MI_M_2020, 'F', true, 'retiro_programado']
  ] as const) {
    it(`${nombre}: cobertura de edades, probabilidades y factores generacionales coherentes`, () => {
      const edades = Object.keys(tabla).map(Number);
      const minima = Math.min(...edades);
      assert.equal(minima, 0);
      for (let edad = minima; edad < 110; edad++) {
        const d: DatosMortalidadEdad = tabla[edad];
        assert.ok(d, `Falta edad ${edad}`);
        assert.equal(d.aa.length, 16);
        assert.equal(d.cumFactors.length, 16);
        let factor = 1;
        for (const [i, mejora] of d.aa.entries()) {
          assert.ok(mejora >= 0 && mejora < 1);
          factor *= 1 - mejora;
          assert.ok(Math.abs(factor - d.cumFactors[i]) < 1e-7);
        }
        for (const ano of [2020, 2026, 2036, 2050, 2100]) {
          const qx = getQxGeneracional(edad, sexo, ano, invalido, modalidad, nombre === 'B-M' ? 'beneficiario' : 'titular');
          assert.ok(Number.isFinite(qx) && qx >= 0 && qx <= 1);
        }
        const qx2026 = getQxGeneracional(edad, sexo, 2026, invalido, modalidad, nombre === 'B-M' ? 'beneficiario' : 'titular');
        assert.ok(Math.abs(qx2026 - d.qx2026) < 1e-7);
        const qx2036 = getQxGeneracional(edad, sexo, 2036, invalido, modalidad, nombre === 'B-M' ? 'beneficiario' : 'titular');
        const qx2037 = getQxGeneracional(edad, sexo, 2037, invalido, modalidad, nombre === 'B-M' ? 'beneficiario' : 'titular');
        assert.ok(Math.abs(qx2037 - qx2036 * (1 - d.aa2036)) < 1e-12);
      }
      assert.equal(getQxGeneracional(110, sexo, 2050, invalido, modalidad, nombre === 'B-M' ? 'beneficiario' : 'titular'), 1);
    });
  }
});
