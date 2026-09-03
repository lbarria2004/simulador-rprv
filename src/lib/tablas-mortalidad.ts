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
  RETIRO_PROGRAMADO: 0.0381,
  RENTA_VITALICIA_VEJEZ: 0.0305,
  RENTA_VITALICIA_INVALIDEZ: 0.0295,
  FACTOR_AJUSTE_FEMENINO: 0.0015,
} as const;

export const TASAS_RENTA_VITALICIA = {
  fecha_actualizacion: '2026-03-01',
  media_mercado: {
    vejez: 0.0305,
    vejez_anticipada: 0.0298,
    invalidez_total: 0.0295,
    invalidez_parcial: 0.0260,
    sobrevivencia: 0.0290,
    media: 0.0305
  },
  companias: {
    '4LIFE': { vejez: 0.0308, vejez_anticipada: 0.0303, invalidez_total: 0.0303, invalidez_parcial: 0, sobrevivencia: 0.0301, media: 0.0308 },
    'AUGUSTAR': { vejez: 0.0299, vejez_anticipada: 0.0296, invalidez_total: 0, invalidez_parcial: 0, sobrevivencia: 0.0309, media: 0.0299 },
    'BICE': { vejez: 0.0315, vejez_anticipada: 0.0290, invalidez_total: 0.0285, invalidez_parcial: 0.0265, sobrevivencia: 0.0280, media: 0.0305 },
    'CN_LIFE': { vejez: 0.0287, vejez_anticipada: 0.0287, invalidez_total: 0.0304, invalidez_parcial: 0, sobrevivencia: 0.0309, media: 0.0296 },
    'CONFUTURO': { vejez: 0.0305, vejez_anticipada: 0.0295, invalidez_total: 0.0298, invalidez_parcial: 0.0246, sobrevivencia: 0.0293, media: 0.0301 },
    'CONSORCIO_NACIONAL': { vejez: 0.0308, vejez_anticipada: 0.0290, invalidez_total: 0.0309, invalidez_parcial: 0.0250, sobrevivencia: 0.0295, media: 0.0300 },
    'EUROAMERICA': { vejez: 0.0292, vejez_anticipada: 0.0300, invalidez_total: 0.0296, invalidez_parcial: 0.0282, sobrevivencia: 0.0282, media: 0.0293 },
    'METLIFE': { vejez: 0.0310, vejez_anticipada: 0.0285, invalidez_total: 0.0296, invalidez_parcial: 0.0205, sobrevivencia: 0.0290, media: 0.0300 },
    'PENTA': { vejez: 0.0298, vejez_anticipada: 0.0291, invalidez_total: 0.0296, invalidez_parcial: 0.0282, sobrevivencia: 0.0290, media: 0.0295 },
    'RENTA_NACIONAL': { vejez: 0.0292, vejez_anticipada: 0.0301, invalidez_total: 0.0287, invalidez_parcial: 0.0281, sobrevivencia: 0.0284, media: 0.0290 }
  },
  bice_vida: 0.0315,
  metlife: 0.0310,
  consorcio: 0.0308,
  confuturo: 0.0305,
  security: 0.0300,
  principal: 0.0298,
  penta: 0.0298,
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
