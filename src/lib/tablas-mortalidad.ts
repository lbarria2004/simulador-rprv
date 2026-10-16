/**
 * TABLAS DE MORTALIDAD OFICIALES TM-2020 (SP / CMF)
 * Fuente: Superintendencia de Pensiones (SP) y Comisión para el Mercado Financiero (CMF)
 * Normativa: NCG Conjunta SP N° 2.164 y CMF N° 2.272 (D.L. 3.500, Compendio Libro III)
 * 
 * Este módulo unifica las tablas oficiales de mortalidad con factores dinámicos
 * de mejoramiento generacional AA(x, t) de 2021 a 2036*, calibradas para el año 2026.
 */

import {
  TABLA_CB_H_2020 as TABLA_CB_H_OFICIAL,
  TABLA_B_M_2020 as TABLA_B_M_OFICIAL,
  TABLA_RV_M_2020 as TABLA_RV_M_OFICIAL,
  TABLA_MI_H_2020 as TABLA_MI_H_OFICIAL,
  TABLA_MI_M_2020 as TABLA_MI_M_OFICIAL,
  TABLA_CB_H_2026,
  TABLA_B_M_2026,
  TABLA_RV_M_2026,
  TABLA_MI_H_2026,
  TABLA_MI_M_2026,
  getQxGeneracional,
  type DatosMortalidadEdad
} from './tablas-mortalidad-oficiales.ts';

export {
  TABLA_CB_H_OFICIAL,
  TABLA_B_M_OFICIAL,
  TABLA_RV_M_OFICIAL,
  TABLA_MI_H_OFICIAL,
  TABLA_MI_M_OFICIAL,
  TABLA_CB_H_2026,
  TABLA_B_M_2026,
  TABLA_RV_M_2026,
  TABLA_MI_H_2026,
  TABLA_MI_M_2026,
  getQxGeneracional,
  type DatosMortalidadEdad
};

// Mapas planos Record<number, number> proyectados al año de cálculo vigente (2026)
// Para retrocompatibilidad exacta con el resto del sistema
export const TABLA_CB_H_2020: Record<number, number> = TABLA_CB_H_2026;
export const TABLA_B_M_2020: Record<number, number> = TABLA_B_M_2026;
export const TABLA_RV_M_2020: Record<number, number> = TABLA_RV_M_2026;
export const TABLA_MI_H_2020: Record<number, number> = TABLA_MI_H_2026;
export const TABLA_MI_M_2020: Record<number, number> = TABLA_MI_M_2026;

// ==========================================
// TASAS DE INTERÉS TÉCNICAS Y DE MERCADO
// ==========================================

export const TASAS_INTERES_TECNICAS = {
  RETIRO_PROGRAMADO: 0.0367,
  RENTA_VITALICIA_VEJEZ: 0.0282,
  RENTA_VITALICIA_INVALIDEZ: 0.0293,
  FACTOR_AJUSTE_FEMENINO: 0.0015,
} as const;

export const TASAS_RENTA_VITALICIA = {
  fecha_actualizacion: '2026-09-01',
  media_mercado: {
    vejez: 0.0282,
    vejez_anticipada: 0.0284,
    invalidez_total: 0.0293,
    invalidez_parcial: 0.0256,
    sobrevivencia: 0.0287,
    media: 0.0284
  },
  companias: {
    '4LIFE': { vejez: 0.0293, vejez_anticipada: 0.0270, invalidez_total: 0.0288, invalidez_parcial: 0.0245, sobrevivencia: 0.0283, media: 0.0293 },
    'AUGUSTAR': { vejez: 0.0294, vejez_anticipada: 0.0294, invalidez_total: 0.0000, invalidez_parcial: 0.0000, sobrevivencia: 0.0292, media: 0.0294 },
    'BICE': { vejez: 0.0262, vejez_anticipada: 0.0270, invalidez_total: 0.0274, invalidez_parcial: 0.0268, sobrevivencia: 0.0265, media: 0.0265 },
    'CN_LIFE': { vejez: 0.0286, vejez_anticipada: 0.0000, invalidez_total: 0.0311, invalidez_parcial: 0.0000, sobrevivencia: 0.0292, media: 0.0299 },
    'CONFUTURO': { vejez: 0.0294, vejez_anticipada: 0.0292, invalidez_total: 0.0300, invalidez_parcial: 0.0272, sobrevivencia: 0.0286, media: 0.0294 },
    'CONSORCIO_NACIONAL': { vejez: 0.0279, vejez_anticipada: 0.0287, invalidez_total: 0.0298, invalidez_parcial: 0.0246, sobrevivencia: 0.0288, media: 0.0283 },
    'EUROAMERICA': { vejez: 0.0299, vejez_anticipada: 0.0299, invalidez_total: 0.0302, invalidez_parcial: 0.0000, sobrevivencia: 0.0295, media: 0.0299 },
    'METLIFE': { vejez: 0.0273, vejez_anticipada: 0.0280, invalidez_total: 0.0295, invalidez_parcial: 0.0202, sobrevivencia: 0.0292, media: 0.0280 },
    'PENTA': { vejez: 0.0291, vejez_anticipada: 0.0285, invalidez_total: 0.0291, invalidez_parcial: 0.0255, sobrevivencia: 0.0285, media: 0.0290 },
    'RENTA_NACIONAL': { vejez: 0.0293, vejez_anticipada: 0.0286, invalidez_total: 0.0296, invalidez_parcial: 0.0261, sobrevivencia: 0.0287, media: 0.0290 }
  },
  euroamerica: 0.0299,
  confuturo: 0.0294,
  augustar: 0.0294,
  four_life: 0.0293,
  renta_nacional: 0.0293,
  penta: 0.0291,
  cn_life: 0.0286,
  consorcio: 0.0279,
  metlife: 0.0273,
  bice_vida: 0.0262,
  spot_rate_10y: 0.0285,
  spot_rate_20y: 0.0303
} as const;

/**
 * Obtiene la tasa de mortalidad qx según sexo, tipo de pensión y modalidad
 * con aplicación del modelo generacional dinámico por año calendario.
 */
export function getTasaMortalidad(
  edad: number,
  sexo: 'M' | 'F',
  tipoPension: 'vejez' | 'invalidez' | 'sobrevivencia',
  modalidad: 'retiro_programado' | 'renta_vitalicia' = 'retiro_programado',
  anoCalendario: number = 2026
): number {
  return getQxGeneracional(
    edad,
    sexo,
    anoCalendario,
    tipoPension === 'invalidez',
    modalidad
  );
}

/**
 * Obtiene la probabilidad anual de muerte qx (alias compatible)
 */
export function getQx(
  edad: number,
  sexo: 'M' | 'F',
  esInvalido: boolean = false,
  modalidad: 'retiro_programado' | 'renta_vitalicia' = 'retiro_programado',
  anoCalendario: number = 2026
): number {
  return getQxGeneracional(edad, sexo, anoCalendario, esInvalido, modalidad);
}

/**
 * Calcula sobrevivientes lx a una edad dada (raíz de cohorte 100.000)
 */
export function calcularLx(
  edadObjetivo: number,
  sexo: 'M' | 'F',
  esInvalido: boolean = false,
  modalidad: 'retiro_programado' | 'renta_vitalicia' = 'retiro_programado',
  anoInicio: number = 2026
): number {
  let lx = 100000;
  const edadMinima = esInvalido ? 18 : 0;
  
  for (let edad = edadMinima; edad < edadObjetivo; edad++) {
    const ano = anoInicio + (edad - edadMinima);
    lx = lx * (1 - getQx(edad, sexo, esInvalido, modalidad, ano));
  }
  return lx;
}

/**
 * Calcula la expectativa de vida abreviada mediante el modelo generacional oficial
 */
export function calcularExpectativaVida(
  edad: number,
  sexo: 'M' | 'F',
  esInvalido: boolean = false,
  modalidad: 'retiro_programado' | 'renta_vitalicia' = 'retiro_programado',
  anoInicio: number = 2026
): number {
  let expectativa = 0;
  let probSupervivencia = 1;
  const maxEdad = 110;
  
  for (let t = 1; t <= (maxEdad - edad); t++) {
    const ano = anoInicio + t - 1;
    probSupervivencia *= (1 - getQx(edad + t - 1, sexo, esInvalido, modalidad, ano));
    expectativa += probSupervivencia;
  }
  
  return Math.round(expectativa * 10) / 10;
}
