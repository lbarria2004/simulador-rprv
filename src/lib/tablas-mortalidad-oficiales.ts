/** Datos cotejados con NCG SP 306 / CMF 495. Ver docs/fase-3-fundamentos.md.
 * La coincidencia de la transcripción no certifica el cálculo de pensiones.
 */
import fuente from './data/tm2020-oficial.json' with { type: 'json' };

export interface DatosMortalidadEdad {
  qx2020: number;
  qx2026: number;
  aa: number[];
  cumFactors: number[];
  aa2036: number;
}

export const FUENTE_TM2020 = fuente.fuentes;

function construirTabla(qx: Record<string, number>, mejoras: Record<string, number[]>): Record<number, DatosMortalidadEdad> {
  return Object.fromEntries(Object.entries(qx).map(([edad, probabilidad]) => {
    const aa = [...mejoras[edad]];
    let acumulado = 1;
    const cumFactors = aa.map(factor => (acumulado *= 1 - factor));
    return [Number(edad), { qx2020: probabilidad, qx2026: probabilidad * cumFactors[5], aa, cumFactors, aa2036: aa[15] }];
  }));
}

export const TABLA_CB_H_2020 = construirTabla(fuente.qx['CB-H-2020'], fuente.mejoras.M);
export const TABLA_MI_H_2020 = construirTabla(fuente.qx['MI-H-2020'], fuente.mejoras.M);
export const TABLA_RV_M_2020 = construirTabla(fuente.qx['RV-M-2020'], fuente.mejoras.F);
export const TABLA_B_M_2020 = construirTabla(fuente.qx['B-M-2020'], fuente.mejoras.F);
export const TABLA_MI_M_2020 = construirTabla(fuente.qx['MI-M-2020'], fuente.mejoras.F);

export const TABLA_CB_H_2026: Record<number, number> = Object.fromEntries(
  Object.entries(TABLA_CB_H_2020).map(([edad, d]) => [Number(edad), d.qx2026])
);

export const TABLA_B_M_2026: Record<number, number> = Object.fromEntries(
  Object.entries(TABLA_B_M_2020).map(([edad, d]) => [Number(edad), d.qx2026])
);

export const TABLA_RV_M_2026: Record<number, number> = Object.fromEntries(
  Object.entries(TABLA_RV_M_2020).map(([edad, d]) => [Number(edad), d.qx2026])
);

export const TABLA_MI_H_2026: Record<number, number> = Object.fromEntries(
  Object.entries(TABLA_MI_H_2020).map(([edad, d]) => [Number(edad), d.qx2026])
);

export const TABLA_MI_M_2026: Record<number, number> = Object.fromEntries(
  Object.entries(TABLA_MI_M_2020).map(([edad, d]) => [Number(edad), d.qx2026])
);

/**
 * Proyección generacional local; ver fuentes y limitaciones en docs/fase-3-fundamentos.md
 * q(x, t) = q(x, 2020) × Π_{s=2021}^{min(t, 2036)} (1 - AA_{x, s}) × (1 - AA_{x, 2036})^(max(0, t - 2036))
 */
export function getQxGeneracional(
  edad: number,
  sexo: 'M' | 'F',
  anoCalendario: number = 2026,
  esInvalido: boolean = false,
  modalidad: 'retiro_programado' | 'renta_vitalicia' = 'retiro_programado',
  rol: 'titular' | 'beneficiario' = 'titular'
): number {
  if (!Number.isInteger(edad) || edad < 0 || edad > 110) throw new RangeError('Mortalidad requiere edad entera entre 0 y 110');
  if (!Number.isInteger(anoCalendario) || anoCalendario < 2020) throw new RangeError('Mortalidad requiere año entero desde 2020');
  if (!['M', 'F'].includes(sexo) || !['titular', 'beneficiario'].includes(rol)) throw new RangeError('Sexo o rol de mortalidad inválido');
  const edadCapped = edad;
  if (edadCapped >= 110) return 1.0;

  let table: Record<number, DatosMortalidadEdad>;
  if (esInvalido) {
    table = sexo === 'M' ? TABLA_MI_H_2020 : TABLA_MI_M_2020;
  } else if (sexo === 'F' && rol === 'titular') {
    table = TABLA_RV_M_2020;
  } else if (sexo === 'F') {
    table = TABLA_B_M_2020;
  } else {
    table = TABLA_CB_H_2020;
  }

  const d = table[edadCapped];
  if (!d) throw new RangeError('No existe qx respaldado para esa edad y rol (RV-M inicia a los 20 años)');

  if (anoCalendario <= 2020) {
    return d.qx2020;
  }
  if (anoCalendario <= 2036) {
    const idx = anoCalendario - 2021;
    return d.qx2020 * d.cumFactors[idx];
  }
  // Para años posteriores a 2036, los factores se mantienen constantes en el valor de 2036
  const factor2036 = d.cumFactors[15];
  const anosExtra = anoCalendario - 2036;
  return d.qx2020 * factor2036 * Math.pow(1 - d.aa2036, anosExtra);
}
