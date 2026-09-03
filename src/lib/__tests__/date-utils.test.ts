import { describe, it } from 'node:test';
import assert from 'node:assert';
import { calcularEdadDesdeFecha, calcularFechaDesdeEdad } from '../date-utils.ts';

describe('Utilidades de Fecha y Cálculo de Edad Actuarial', () => {
  it('Calcula correctamente la edad para una persona nacida en 1961', () => {
    // Si la referencia es 2026-09-03
    const ref = new Date('2026-09-03T12:00:00');
    
    // Nacido el 15 de febrero de 1961 -> 65 años
    const edad1 = calcularEdadDesdeFecha('1961-02-15', ref);
    assert.strictEqual(edad1, 65);

    // Nacido el 20 de octubre de 1961 (aún no cumple en septiembre 2026) -> 64 años
    const edad2 = calcularEdadDesdeFecha('1961-10-20', ref);
    assert.strictEqual(edad2, 64);
  });

  it('calcularFechaDesdeEdad genera una fecha consistente con la edad solicitada', () => {
    const ref = new Date('2026-09-03T12:00:00');
    const fecha = calcularFechaDesdeEdad(65, ref);
    assert.ok(fecha.startsWith('1961-'));
    
    const edadCalculada = calcularEdadDesdeFecha(fecha, ref);
    assert.strictEqual(edadCalculada, 65);
  });

  it('Maneja fechas vacías o inválidas sin lanzar excepciones', () => {
    assert.strictEqual(calcularEdadDesdeFecha(''), 0);
    assert.strictEqual(calcularEdadDesdeFecha('fecha-invalida'), 0);
  });
});
