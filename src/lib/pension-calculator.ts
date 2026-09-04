/**
 * Simulador de Pensiones - Sistema Chileno AFP
 * Basado en normativa oficial de Superintendencia de Pensiones y CMF
 * Fórmulas según Nota Técnica N°5 del Compendio de Pensiones
 * 
 * Referencias:
 * - https://www.spensiones.cl/portal/institucional/594/w3-article-10594.html
 * - https://cmfchile.cl/institucional/legislacion_normativa/
 * - https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9922.html (Sobrevivencia)
 * - https://www.spensiones.cl/portal/institucional/594/w3-propertyvalue-9923.html (Invalidez)
 * - https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-3262.html (Anexo 7 - Capitales Necesarios)
 * 
 * Tipos de Pensión:
 * - Vejez: Edad legal (H:65, M:60) o anticipada
 * - Invalidez: Total (70%), Total 2/3 (50%), Parcial (35%)
 * - Sobrevivencia: Porcentajes según parentesco (Art. 58 DL 3500)
 * 
 * Cláusulas Adicionales:
 * - Período Garantizado: meses garantizados de pago
 * - Aumento Temporal de Pensión: incremento temporal por un período
 */

import {
  TABLA_CB_H_2020,
  TABLA_B_M_2020,
  TABLA_MI_H_2020,
  TABLA_MI_M_2020,
  TABLA_RV_M_2020,
  TASAS_RENTA_VITALICIA,
  TASAS_INTERES_TECNICAS,
  getQx,
  calcularLx,
  calcularExpectativaVida
} from './tablas-mortalidad.ts';

// ==========================================
// TIPOS E INTERFACES
// ==========================================

export type Sexo = 'M' | 'F';
export type TipoPension = 'vejez' | 'invalidez' | 'sobrevivencia';
export type ModalidadPension = 'retiro_programado' | 'renta_vitalicia';
export type GradoInvalidez = 'total' | 'total_2_3' | 'parcial';
export type AFP = 'PLANVITAL' | 'HABITAT' | 'CAPITAL' | 'CUPRUM' | 'MODELO' | 'PROVIDA' | 'UNO';

export type MesesGarantizados = number;
export type MesesAumento = number;

export const VALORES_GARANTIZADOS_REF = [0, 60, 120, 180, 240, 300, 360] as const;
export const VALORES_AUMENTO_REF = [12, 24, 36, 48, 60, 72, 84, 96, 108, 120] as const;

export interface ClausulaPeriodoGarantizado {
  meses: MesesGarantizados;
}

export interface ClausulaAumentoTemporal {
  meses: MesesAumento;
  porcentaje: number;
}

export type TipoBeneficiario = 
  | 'conyuge' 
  | 'conviviente' 
  | 'hijo' 
  | 'madre_padre_hijos_nm' 
  | 'padre' 
  | 'madre';

export interface BeneficiarioPension {
  id?: string;
  nombre?: string;
  tipo: TipoBeneficiario;
  fechaNacimiento?: string;
  edad: number;
  sexo: Sexo;
  porcentajePension: number;
  esEstudiante?: boolean; // Para hijos estudiantes entre 18 y 24 años
  esInvalido?: boolean;   // Para beneficiarios calificados con invalidez
}

export interface DatosAfiliado {
  sexo: Sexo;
  edad: number;
  fondosAcumulados: number;
  anosCotizados: number;
  beneficiarios?: BeneficiarioPension[];
  ingresoBase?: number;
  cubiertoSIS?: boolean;
}

export interface DatosEscenarioRV {
  periodoGarantizado?: ClausulaPeriodoGarantizado;
  aumentoTemporal?: ClausulaAumentoTemporal;
  ambasClausulas?: {
    periodoGarantizado: ClausulaPeriodoGarantizado;
    aumentoTemporal: ClausulaAumentoTemporal;
  };
}

export interface ResultadoEscenario {
  nombre: string;
  pensionMensual: number;
  pensionEnUF: number;
  pensionAnual: number;
  cnu: number;
  tasaInteres: number;
  expectativaVida: number;
  periodoGarantizado?: number;
  aumentoTemporal?: {
    meses: number;
    porcentaje: number;
    pensionAumentada: number;
    pensionFinal: number;
  };
  pensionPorBeneficiario?: {
    tipo: string;
    porcentaje: number;
    pensionMensual: number;
  }[];
  gradoInvalidez?: GradoInvalidez;
  ingresoBase?: number;
  porcentajeInvalidez?: number;
  pensionReferencia?: number;
  
  proyeccion?: ProyeccionAnual[];
  advertencias?: string[];
}

export interface ProyeccionAnual {
  año: number;
  edad: number;
  pensionMensual: number;
  saldoAcumulado: number;
  retiroAcumulado: number;
  fase?: 'aumento' | 'normal' | 'decreciente';
}

// ==========================================
// CONSTANTES DEL SISTEMA
// ==========================================

export const EDAD_JUBILACION = {
  HOMBRE: 65,
  MUJER: 60
} as const;

export const TASAS_INTERES = {
  RETIRO_PROGRAMADO: 0.0341,
  RENTA_VITALICIA_VEJEZ: 0.0279,
  RENTA_VITALICIA_INVALIDEZ: 0.0296,
  SOBREVIVENCIA: 0.0279
} as const;

export const UF_ACTUAL = 38500;

export const FACTORES_PERIODO_GARANTIZADO: Record<number, number> = {
  0: 1.000, 60: 0.985, 120: 0.970, 180: 0.950, 240: 0.925, 300: 0.900, 360: 0.875
};

/**
 * Calcula el factor de ajuste para cualquier período garantizado
 */
export function calcularFactorGarantizado(meses: number): number {
  if (FACTORES_PERIODO_GARANTIZADO[meses] !== undefined) {
    return FACTORES_PERIODO_GARANTIZADO[meses];
  }
  
  if (meses <= 0) return 1.0;
  if (meses >= 360) return 0.875;
  
  const mesesKeys = Object.keys(FACTORES_PERIODO_GARANTIZADO).map(Number).sort((a, b) => a - b);
  let lower = 0, upper = 360;
  
  for (let i = 0; i < mesesKeys.length; i++) {
    if (mesesKeys[i] <= meses) lower = mesesKeys[i];
    if (mesesKeys[i] >= meses && upper === 360) upper = mesesKeys[i];
  }
  
  if (lower === upper) return FACTORES_PERIODO_GARANTIZADO[lower];
  
  const factorLower = FACTORES_PERIODO_GARANTIZADO[lower];
  const factorUpper = FACTORES_PERIODO_GARANTIZADO[upper];
  const ratio = (meses - lower) / (upper - lower);
  
  return factorLower + (factorUpper - factorLower) * ratio;
}

// ==========================================
// PORCENTAJES DE PENSIÓN DE SOBREVIVENCIA
// Según Art. 58 DL 3500 y normativa SUSESO
// ==========================================

export const PORCENTAJES_SOBREVIVENCIA = {
  // Cónyuge o Conviviente Civil
  CONYUGE_SIN_HIJOS: 0.60,        // 60% si no hay hijos con derecho
  CONYUGE_CON_HIJOS: 0.50,        // 50% si hay hijos con derecho a pensión
  CONVIVIENTE_SIN_HIJOS: 0.60,    // 60% si no hay hijos con derecho
  CONVIVIENTE_CON_HIJOS: 0.50,    // 50% si hay hijos con derecho a pensión
  
  // Hijos
  HIJO_CON_PADRE: 0.15,           // 15% si tiene padre/madre viudo
  HIJO_HUERFANO: 0.11,            // 11% si es huérfano de padre y madre
  
  // Madre/Padre de hijos de filiación no matrimonial
  MADRE_PADRE_SIN_OTROS_HIJOS: 0.36,  // 36% si no hay otros hijos con derecho
  MADRE_PADRE_CON_OTROS_HIJOS: 0.30,  // 30% si hay otros hijos con derecho
  
  // Padre/Madre (cuando no hay cónyuge, conviviente ni hijos)
  PADRE_MADRE_SIN_OTROS: 0.15     // 15% cada uno (padre o madre)
} as const;

// ==========================================
// TIPOS DE BENEFICIARIO EXTENDIDOS
// ==========================================

export type TipoBeneficiarioExtendido = 
  | 'conyuge' 
  | 'conviviente' 
  | 'hijo' 
  | 'hijo_huerfano'  // Huérfano de padre y madre
  | 'padre' 
  | 'madre'
  | 'madre_no_matrimonial'  // Madre de hijo de filiación no matrimonial
  | 'padre_no_matrimonial'; // Padre de hijo de filiación no matrimonial

// ==========================================
// PORCENTAJES DE PENSIÓN DE INVALIDEZ
// Según grado de invalidez
// ==========================================

export const PORCENTAJES_INVALIDEZ: Record<GradoInvalidez, number> = {
  total: 0.70,
  total_2_3: 0.50,
  parcial: 0.35
} as const;

// PGU (Pensión Garantizada Universal)
// Actualizado según valor vigente 2025 y Ley 21.419
export const PGU = {
  MONTO_BASE: 231732,        // Valor actualizado enero 2025
  UMBRAL_INFERIOR: 729764,   // Pensión base hasta la cual se recibe el 100% de la PGU
  TOPE_INGRESO: 1158355,     // Límite superior sobre el cual la PGU se extingue
  FECHA_ACTUALIZACION: 'Enero 2025'
} as const;

// ==========================================
// BENEFICIO POR AÑOS COTIZADOS (BAC)
// Según Norma de Carácter General N° 350, de 12 de septiembre de 2025
// ==========================================

export const BAC = {
  UF_POR_ANO: 0.1,        // 0,1 UF por cada año cotizado
  TOPE_MENSUAL_UF: 2.5,   // Tope máximo mensual de 2,5 UF
  FECHA_INICIO: '2026-01-01', // El beneficio se devenga desde 1 de enero de 2026
  FECHA_CORTE: '2025-07-31'   // Cotizaciones hasta el 31 de julio de 2025
} as const;

// ==========================================
// TABLAS DE MORTALIDAD Y FUNCIONES ACTUARIALES
// Fuente única consolidada: src/lib/tablas-mortalidad.ts
// ==========================================

export {
  TABLA_CB_H_2020,
  TABLA_B_M_2020,
  TABLA_MI_H_2020,
  TABLA_MI_M_2020,
  TABLA_RV_M_2020,
  TASAS_RENTA_VITALICIA,
  TASAS_INTERES_TECNICAS,
  getQx,
  calcularLx,
  calcularExpectativaVida
};

/**
 * Calcula el Capital Necesario Unitario (CNU) - Versión oficial del Sistema de Pensiones
 * 
 * FÓRMULA OFICIAL GENERACIONAL (Nota Técnica N°5 SP y NCG Conjunta SP N° 2.164 / CMF N° 2.272):
 * CNU = Σ [ _t p_x ] × [ 1 / (1+i)^(t+0.5) ] × 12
 * Donde _t p_x = Π_{k=0}^{t-1} [ 1 - q(x+k, año + k) ]
 */
export function calcularCNU(
  edad: number,
  sexo: Sexo,
  tasaInteres: number,
  beneficiarios?: BeneficiarioPension[],
  esInvalido: boolean = false,
  modalidad: ModalidadPension = 'retiro_programado',
  anoCalculo: number = 2026
): number {
  let cnu = 0;
  const maxEdad = 110;
  
  // CNU del titular con proyección generacional dinámica
  let factorSupervivencia = 1.0;
  for (let t = 0; t <= (maxEdad - edad); t++) {
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, t + 0.5);
    cnu += factorSupervivencia * factorDescuento;
    const qx = getQx(edad + t, sexo, esInvalido, modalidad, anoCalculo + t);
    factorSupervivencia *= (1 - qx);
  }
  
  // Agregar CNU de beneficiarios (para vejez con cargas)
  if (beneficiarios && beneficiarios.length > 0) {
    const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
    for (let i = 0; i < beneficiarios.length; i++) {
      const ben = beneficiarios[i];
      const pInfo = porcentajes[i];
      const pct = pInfo ? pInfo.porcentaje : (ben.porcentajePension || 0.60);
      if (pct <= 0) continue;

      const cnuBen = calcularCNUSobrevivenciaBeneficiario(
        edad, sexo, tasaInteres,
        ben.edad, ben.sexo, pct, esInvalido,
        modalidad, anoCalculo,
        ben.tipo === 'hijo',
        ben.esEstudiante || false,
        ben.esInvalido || false
      );
      cnu += cnuBen;
    }
  }
  
  return cnu * 12;
}

/**
 * Calcula el CNU de sobrevivencia para un beneficiario específico
 * (Capital necesario para pagar pensión al beneficiario cuando fallezca el titular)
 */
function calcularCNUSobrevivenciaBeneficiario(
  edadTitular: number,
  sexoTitular: Sexo,
  tasaInteres: number,
  edadBeneficiario: number,
  sexoBeneficiario: Sexo,
  porcentaje: number,
  esInvalidoTitular: boolean = false,
  modalidad: ModalidadPension = 'retiro_programado',
  anoCalculo: number = 2026,
  esHijo: boolean = false,
  esEstudianteHijo: boolean = false,
  esInvalidoBeneficiario: boolean = false
): number {
  let edadTopeBeneficiario = 110;
  if (esHijo && !esInvalidoBeneficiario) {
    edadTopeBeneficiario = esEstudianteHijo ? 24 : 18;
  }

  // Si el hijo ya cumplió o superó la edad tope legal, no genera pensión de sobrevivencia
  if (edadBeneficiario >= edadTopeBeneficiario) {
    return 0;
  }

  let cnu = 0;
  const maxEdad = Math.max(110 - edadTitular, edadTopeBeneficiario - edadBeneficiario);
  
  let probTitularVivo = 1.0;
  let probBeneficiarioVivo = 1.0;

  for (let t = 0; t <= maxEdad; t++) {
    const edadBenActual = edadBeneficiario + t;
    if (edadBenActual >= edadTopeBeneficiario) {
      break;
    }

    const probTitularFallecido = 1.0 - probTitularVivo;
    const probConjunta = probTitularFallecido * probBeneficiarioVivo;
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, t + 0.5);
    
    cnu += probConjunta * factorDescuento * porcentaje;

    if (edadTitular + t < 110) {
      const qxTitular = getQx(edadTitular + t, sexoTitular, esInvalidoTitular, modalidad, anoCalculo + t);
      probTitularVivo *= (1 - qxTitular);
    } else {
      probTitularVivo = 0;
    }

    if (edadBenActual < 110) {
      const qxBen = getQx(edadBenActual, sexoBeneficiario, esInvalidoBeneficiario, 'retiro_programado', anoCalculo + t);
      probBeneficiarioVivo *= (1 - qxBen);
    } else {
      probBeneficiarioVivo = 0;
    }
  }
  
  return cnu;
}

/**
 * Calcula el CNU individual para un beneficiario de sobrevivencia
 * (Cuando el causante YA falleció - pensión de sobrevivencia)
 * 
 * Fórmula: CNU = Σ [ _t p_x ] × [ 1 / (1+i)^(t+0.5) ] × 12
 */
export function calcularCNUIndividual(
  edad: number,
  sexo: Sexo,
  tasaInteres: number,
  modalidad: ModalidadPension = 'retiro_programado',
  anoCalculo: number = 2026
): number {
  let cnu = 0;
  let factorSupervivencia = 1.0;
  
  for (let t = 0; t <= (110 - edad); t++) {
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, t + 0.5);
    cnu += factorSupervivencia * factorDescuento;
    const qx = getQx(edad + t, sexo, false, modalidad, anoCalculo + t);
    factorSupervivencia *= (1 - qx);
  }
  
  return cnu * 12;
}

/**
 * Calcula el Capital Necesario Unitario Temporal para un período de meses dado
 * Se utiliza para calcular el costo actuarial exacto del aumento temporal de pensión
 * Fórmula: CNU_temp = Σ_{t=0}^{m-1} [ _t p_x ] × [ 1 / (1+i)^(t+0.5) ] × 12
 */
export function calcularCNUTemporal(
  edad: number,
  sexo: Sexo,
  meses: number,
  tasaInteres: number,
  esInvalido: boolean = false,
  modalidad: ModalidadPension = 'renta_vitalicia',
  anoCalculo: number = 2026
): number {
  const anos = Math.ceil(meses / 12);
  let cnuTemporal = 0;
  let factorSupervivencia = 1.0;

  for (let t = 0; t < anos; t++) {
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, t + 0.5);
    cnuTemporal += factorSupervivencia * factorDescuento;
    const qx = getQx(edad + t, sexo, esInvalido, modalidad, anoCalculo + t);
    factorSupervivencia *= (1 - qx);
  }

  return cnuTemporal * 12;
}

// ==========================================
// CÁLCULO PENSIÓN DE VEJEZ
// ==========================================

export function calcularRetiroProgramado(
  fondos: number,
  edad: number,
  sexo: Sexo,
  tasaInteres: number = TASAS_INTERES.RETIRO_PROGRAMADO,
  beneficiarios?: BeneficiarioPension[],
  esInvalido: boolean = false
): ResultadoEscenario {
  const cnu = calcularCNU(edad, sexo, tasaInteres, beneficiarios, esInvalido, 'retiro_programado');
  const pensionMensual = fondos / cnu;
  const expectativaVida = calcularExpectativaVida(edad, sexo, esInvalido, 'retiro_programado');
  
  const proyeccion: ProyeccionAnual[] = [];
  let saldo = fondos;
  let retiroAcumulado = 0;
  
  for (let año = 0; año <= Math.min(45, 110 - edad); año++) {
    const edadActual = edad + año;
    const cnuAnual = calcularCNU(edadActual, sexo, tasaInteres, undefined, esInvalido, 'retiro_programado', 2026 + año);
    const pensionAnual = saldo / cnuAnual * 12;
    const pensionMes = pensionAnual / 12;
    
    proyeccion.push({
      año: año + 1,
      edad: edadActual,
      pensionMensual: Math.round(pensionMes),
      saldoAcumulado: Math.round(saldo),
      retiroAcumulado: Math.round(retiroAcumulado),
      fase: 'decreciente'
    });
    
    saldo = Math.max(0, (saldo - pensionAnual) * (1 + tasaInteres));
    retiroAcumulado += pensionAnual;
    
    if (saldo <= 0) break;
  }
  
  return {
    nombre: esInvalido ? 'Retiro Programado (Invalidez MI-2020)' : 'Retiro Programado',
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: pensionMensual / UF_ACTUAL,
    pensionAnual: pensionMensual * 12,
    cnu,
    tasaInteres,
    expectativaVida,
    proyeccion
  };
}

export function calcularRVInmediata(
  fondos: number,
  edad: number,
  sexo: Sexo,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_VEJEZ,
  beneficiarios?: BeneficiarioPension[],
  esInvalido: boolean = false
): ResultadoEscenario {
  const cnu = calcularCNU(edad, sexo, tasaInteres, beneficiarios, esInvalido, 'renta_vitalicia');
  const pensionMensual = fondos / cnu;
  const expectativaVida = calcularExpectativaVida(edad, sexo, esInvalido, 'renta_vitalicia');
  
  return {
    nombre: esInvalido ? 'Renta Vitalicia Invalidez (MI-2020)' : 'Renta Vitalicia Inmediata',
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: pensionMensual / UF_ACTUAL,
    pensionAnual: pensionMensual * 12,
    cnu,
    tasaInteres,
    expectativaVida
  };
}

export function calcularRVPeriodoGarantizado(
  fondos: number,
  edad: number,
  sexo: Sexo,
  mesesGarantizados: number,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_VEJEZ,
  beneficiarios?: BeneficiarioPension[],
  esInvalido: boolean = false
): ResultadoEscenario {
  const rvBase = calcularRVInmediata(fondos, edad, sexo, tasaInteres, beneficiarios, esInvalido);
  const factorAjuste = calcularFactorGarantizado(mesesGarantizados);
  const pensionAjustada = rvBase.pensionMensual * factorAjuste;
  
  const anosGarantizados = Math.floor(mesesGarantizados / 12);
  const mesesRestantes = mesesGarantizados % 12;
  let nombreMeses = '';
  if (anosGarantizados > 0 && mesesRestantes > 0) {
    nombreMeses = `${anosGarantizados}a ${mesesRestantes}m`;
  } else if (anosGarantizados > 0) {
    nombreMeses = `${anosGarantizados} ${anosGarantizados === 1 ? 'año' : 'años'}`;
  } else {
    nombreMeses = `${mesesGarantizados} meses`;
  }
  
  return {
    nombre: `RV con Garantía ${nombreMeses}`,
    pensionMensual: Math.round(pensionAjustada),
    pensionEnUF: pensionAjustada / UF_ACTUAL,
    pensionAnual: pensionAjustada * 12,
    cnu: rvBase.cnu,
    tasaInteres,
    expectativaVida: rvBase.expectativaVida,
    periodoGarantizado: mesesGarantizados,
    advertencias: [
      `Período garantizado: ${nombreMeses} (${mesesGarantizados} meses)`,
      `Si fallece antes, beneficiarios reciben el 100% de la pensión`,
      `Factor aplicado: ${(factorAjuste * 100).toFixed(1)}%`
    ]
  };
}

export function calcularRVAumentoTemporal(
  fondos: number,
  edad: number,
  sexo: Sexo,
  mesesAumento: number,
  porcentajeAumento: number,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_VEJEZ,
  beneficiarios?: BeneficiarioPension[],
  esInvalido: boolean = false
): ResultadoEscenario {
  const porcentajeNormalizado = porcentajeAumento > 1 ? porcentajeAumento / 100 : porcentajeAumento;
  const cnuVitalicio = calcularCNU(edad, sexo, tasaInteres, beneficiarios, esInvalido, 'renta_vitalicia');
  const cnuTemporal = calcularCNUTemporal(edad, sexo, mesesAumento, tasaInteres, esInvalido, 'renta_vitalicia');
  
  // Equivalencia actuarial:
  // Fondos = PensionBase * CNU_vitalicio + (porcentaje * PensionBase) * CNU_temporal
  const pensionBaseAjustada = fondos / (cnuVitalicio + porcentajeNormalizado * cnuTemporal);
  const pensionAumentadaFinal = pensionBaseAjustada * (1 + porcentajeNormalizado);
  const expectativaVida = calcularExpectativaVida(edad, sexo, esInvalido, 'renta_vitalicia');
  
  const anosAumento = Math.floor(mesesAumento / 12);
  const mesesRestantes = mesesAumento % 12;
  let nombrePeriodo = '';
  if (anosAumento > 0 && mesesRestantes > 0) {
    nombrePeriodo = `${anosAumento}a ${mesesRestantes}m`;
  } else if (anosAumento > 0) {
    nombrePeriodo = `${anosAumento} ${anosAumento === 1 ? 'año' : 'años'}`;
  } else {
    nombrePeriodo = `${mesesAumento} meses`;
  }
  
  const proyeccion: ProyeccionAnual[] = [];
  const anosAumentoInt = Math.ceil(mesesAumento / 12);
  
  for (let año = 0; año < 30; año++) {
    const edadActual = edad + año;
    const enPeriodoAumento = año < anosAumentoInt;
    
    proyeccion.push({
      año: año + 1,
      edad: edadActual,
      pensionMensual: enPeriodoAumento 
        ? Math.round(pensionAumentadaFinal) 
        : Math.round(pensionBaseAjustada),
      saldoAcumulado: 0,
      retiroAcumulado: 0,
      fase: enPeriodoAumento ? 'aumento' : 'normal'
    });
  }
  
  return {
    nombre: `RV Aumento Temporal +${(porcentajeNormalizado * 100).toFixed(0)}% (${nombrePeriodo})`,
    pensionMensual: Math.round(pensionAumentadaFinal),
    pensionEnUF: pensionAumentadaFinal / UF_ACTUAL,
    pensionAnual: pensionAumentadaFinal * 12,
    cnu: cnuVitalicio,
    tasaInteres,
    expectativaVida,
    aumentoTemporal: {
      meses: mesesAumento,
      porcentaje: porcentajeAumento,
      pensionAumentada: Math.round(pensionAumentadaFinal),
      pensionFinal: Math.round(pensionBaseAjustada)
    },
    proyeccion,
    advertencias: [
      `Aumento ${(porcentajeNormalizado * 100).toFixed(0)}% durante ${nombrePeriodo}`,
      `Pensión inicial: ${formatearPesos(pensionAumentadaFinal)}`,
      `Pensión desde año ${anosAumentoInt + 1}: ${formatearPesos(pensionBaseAjustada)}`
    ]
  };
}

export function calcularRVConAmbasClausulas(
  fondos: number,
  edad: number,
  sexo: Sexo,
  mesesGarantizados: number,
  mesesAumento: number,
  porcentajeAumento: number,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_VEJEZ,
  beneficiarios?: BeneficiarioPension[],
  esInvalido: boolean = false
): ResultadoEscenario {
  const porcentajeNormalizado = porcentajeAumento > 1 ? porcentajeAumento / 100 : porcentajeAumento;
  const cnuVitalicio = calcularCNU(edad, sexo, tasaInteres, beneficiarios, esInvalido, 'renta_vitalicia');
  const factorGarantizado = calcularFactorGarantizado(mesesGarantizados);
  const cnuEfectivoGarantizado = cnuVitalicio / (factorGarantizado > 0 ? factorGarantizado : 1);
  const cnuTemporal = calcularCNUTemporal(edad, sexo, mesesAumento, tasaInteres, esInvalido, 'renta_vitalicia');
  
  const pensionBaseFinal = fondos / (cnuEfectivoGarantizado + porcentajeNormalizado * cnuTemporal);
  const pensionAumentadaFinal = pensionBaseFinal * (1 + porcentajeNormalizado);
  const expectativaVida = calcularExpectativaVida(edad, sexo, esInvalido, 'renta_vitalicia');
  
  const anosGarantia = Math.floor(mesesGarantizados / 12);
  const anosAumento = Math.floor(mesesAumento / 12);
  
  const proyeccion: ProyeccionAnual[] = [];
  const anosAumentoInt = Math.ceil(mesesAumento / 12);
  
  for (let año = 0; año < 30; año++) {
    const edadActual = edad + año;
    const enPeriodoAumento = año < anosAumentoInt;
    
    proyeccion.push({
      año: año + 1,
      edad: edadActual,
      pensionMensual: enPeriodoAumento 
        ? Math.round(pensionAumentadaFinal)
        : Math.round(pensionBaseFinal),
      saldoAcumulado: 0,
      retiroAcumulado: 0,
      fase: enPeriodoAumento ? 'aumento' : 'normal'
    });
  }
  
  return {
    nombre: `RV +${(porcentajeNormalizado * 100).toFixed(0)}% x ${anosAumento}a + Garantía ${anosGarantia}a`,
    pensionMensual: Math.round(pensionAumentadaFinal),
    pensionEnUF: pensionAumentadaFinal / UF_ACTUAL,
    pensionAnual: pensionAumentadaFinal * 12,
    cnu: cnuVitalicio,
    tasaInteres,
    expectativaVida,
    periodoGarantizado: mesesGarantizados,
    aumentoTemporal: {
      meses: mesesAumento,
      porcentaje: porcentajeAumento,
      pensionAumentada: Math.round(pensionAumentadaFinal),
      pensionFinal: Math.round(pensionBaseFinal)
    },
    proyeccion,
    advertencias: [
      `Aumento ${(porcentajeAumento > 1 ? porcentajeAumento : porcentajeAumento * 100).toFixed(0)}% por ${anosAumento} años`,
      `Garantía ${anosGarantia} años`,
      `Pensión aumento: ${formatearPesos(pensionAumentadaFinal)}`,
      `Pensión final: ${formatearPesos(pensionBaseFinal)}`
    ]
  };
}

// ==========================================
// CÁLCULO PENSIÓN DE INVALIDEZ
// ==========================================

/**
 * Calcula la pensión de invalidez según DL 3500 y normas de SUSESO
 * 
 * Grados:
 * - Total: 70% del ingreso base
 * - Total 2/3: 50% del ingreso base  
 * - Parcial: 35% del ingreso base
 */
export function calcularPensionInvalidez(
  fondos: number,
  edad: number,
  sexo: Sexo,
  gradoInvalidez: GradoInvalidez,
  ingresoBase: number,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
  beneficiarios?: BeneficiarioPension[],
  cubiertoSIS: boolean = true
): ResultadoEscenario {
  const porcentaje = PORCENTAJES_INVALIDEZ[gradoInvalidez];
  const pensionReferencia = ingresoBase * porcentaje;
  
  // CNU con tabla de inválidos
  const cnu = calcularCNU(edad, sexo, tasaInteres, beneficiarios, true);
  const expectativaVida = calcularExpectativaVida(edad, sexo, true);
  
  let pensionMensual: number;
  let capitalSIS = 0;
  
  if (cubiertoSIS) {
    // Capital necesario para financiar la pensión de referencia
    const capitalNecesario = pensionReferencia * cnu;
    
    if (fondos >= capitalNecesario) {
      // Los fondos alcanzan
      pensionMensual = fondos / cnu;
    } else {
      // El SIS complementa la diferencia
      capitalSIS = capitalNecesario - fondos;
      pensionMensual = pensionReferencia;
    }
  } else {
    // Sin cobertura SIS
    pensionMensual = fondos / cnu;
  }
  
  // Proyección
  const proyeccion: ProyeccionAnual[] = [];
  const maxAnos = Math.min(45, 81 - edad);
  
  for (let año = 0; año < maxAnos; año++) {
    const edadActual = edad + año;
    
    proyeccion.push({
      año: año + 1,
      edad: edadActual,
      pensionMensual: Math.round(pensionMensual),
      saldoAcumulado: 0,
      retiroAcumulado: Math.round(pensionMensual * 12 * (año + 1)),
      fase: 'normal'
    });
  }
  
  const gradoLabels: Record<GradoInvalidez, string> = {
    total: 'Total (70%)',
    total_2_3: 'Total 2/3 (50%)',
    parcial: 'Parcial (35%)'
  };
  
  const advertencias = [
    `Grado de invalidez: ${gradoLabels[gradoInvalidez]}`,
    `Ingreso base: ${formatearPesos(ingresoBase)}`,
    `Pensión de referencia: ${formatearPesos(pensionReferencia)}`
  ];
  
  if (capitalSIS > 0) {
    advertencias.push(`Aporte SIS: ${formatearPesos(capitalSIS)}`);
  }
  
  return {
    nombre: `Pensión Invalidez ${gradoLabels[gradoInvalidez]}`,
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: pensionMensual / UF_ACTUAL,
    pensionAnual: pensionMensual * 12,
    cnu,
    tasaInteres,
    expectativaVida,
    gradoInvalidez,
    ingresoBase,
    porcentajeInvalidez: porcentaje,
    pensionReferencia,
    proyeccion,
    advertencias
  };
}

/**
 * Calcula Retiro Programado para pensionado por invalidez
 */
export function calcularRetiroProgramadoInvalidez(
  fondos: number,
  edad: number,
  sexo: Sexo,
  tasaInteres: number = TASAS_INTERES.RETIRO_PROGRAMADO,
  beneficiarios?: BeneficiarioPension[]
): ResultadoEscenario {
  const cnu = calcularCNU(edad, sexo, tasaInteres, beneficiarios, true);
  const pensionMensual = fondos / cnu;
  const expectativaVida = calcularExpectativaVida(edad, sexo, true);
  
  const proyeccion: ProyeccionAnual[] = [];
  let saldo = fondos;
  let retiroAcumulado = 0;
  const maxAnos = Math.min(45, 81 - edad);
  
  for (let año = 0; año <= maxAnos; año++) {
    const edadActual = edad + año;
    const cnuAnual = calcularCNU(edadActual, sexo, tasaInteres, undefined, true);
    const pensionAnual = saldo / cnuAnual * 12;
    const pensionMes = pensionAnual / 12;
    
    proyeccion.push({
      año: año + 1,
      edad: edadActual,
      pensionMensual: Math.round(pensionMes),
      saldoAcumulado: Math.round(saldo),
      retiroAcumulado: Math.round(retiroAcumulado),
      fase: 'decreciente'
    });
    
    saldo = Math.max(0, (saldo - pensionAnual) * (1 + tasaInteres));
    retiroAcumulado += pensionAnual;
    
    if (saldo <= 0) break;
  }
  
  return {
    nombre: 'Retiro Programado (Invalidez)',
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: pensionMensual / UF_ACTUAL,
    pensionAnual: pensionMensual * 12,
    cnu,
    tasaInteres,
    expectativaVida,
    proyeccion,
    advertencias: ['Usa tabla de mortalidad de inválidos (I-H/I-M-2020)', 'Pensión decrece en el tiempo']
  };
}

// ==========================================
// RENTA VITALICIA PARA INVALIDEZ
// ==========================================

/**
 * Calcula RV Inmediata para pensionado por invalidez
 * Usa tabla de mortalidad de inválidos y tasa de invalidez
 */
export function calcularRVInmediataInvalidez(
  fondos: number,
  edad: number,
  sexo: Sexo,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
  beneficiarios?: BeneficiarioPension[]
): ResultadoEscenario {
  // CNU con tabla de inválidos
  const cnu = calcularCNU(edad, sexo, tasaInteres, beneficiarios, true);
  const pensionMensual = fondos / cnu;
  const expectativaVida = calcularExpectativaVida(edad, sexo, true);
  
  return {
    nombre: 'RV Inmediata (Invalidez)',
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: pensionMensual / UF_ACTUAL,
    pensionAnual: pensionMensual * 12,
    cnu,
    tasaInteres,
    expectativaVida,
    advertencias: [
      'Usa tabla de mortalidad de inválidos (I-H/I-M-2020)',
      'Tasa de interés para invalidez: ' + (tasaInteres * 100).toFixed(2) + '%',
      'Pensión fija de por vida'
    ]
  };
}

/**
 * Calcula RV con Período Garantizado para invalidez
 */
export function calcularRVPeriodoGarantizadoInvalidez(
  fondos: number,
  edad: number,
  sexo: Sexo,
  mesesGarantizados: number,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
  beneficiarios?: BeneficiarioPension[]
): ResultadoEscenario {
  const rvBase = calcularRVInmediataInvalidez(fondos, edad, sexo, tasaInteres, beneficiarios);
  const factorAjuste = calcularFactorGarantizado(mesesGarantizados);
  const pensionAjustada = rvBase.pensionMensual * factorAjuste;
  
  const anosGarantizados = Math.floor(mesesGarantizados / 12);
  const mesesRestantes = mesesGarantizados % 12;
  let nombreMeses = '';
  if (anosGarantizados > 0 && mesesRestantes > 0) {
    nombreMeses = `${anosGarantizados}a ${mesesRestantes}m`;
  } else if (anosGarantizados > 0) {
    nombreMeses = `${anosGarantizados} ${anosGarantizados === 1 ? 'año' : 'años'}`;
  } else {
    nombreMeses = `${mesesGarantizados} meses`;
  }
  
  return {
    nombre: `RV Invalidez Garantía ${nombreMeses}`,
    pensionMensual: Math.round(pensionAjustada),
    pensionEnUF: pensionAjustada / UF_ACTUAL,
    pensionAnual: pensionAjustada * 12,
    cnu: rvBase.cnu,
    tasaInteres,
    expectativaVida: rvBase.expectativaVida,
    periodoGarantizado: mesesGarantizados,
    advertencias: [
      `Período garantizado: ${nombreMeses} (${mesesGarantizados} meses)`,
      `Si fallece antes, beneficiarios reciben el 100% de la pensión`,
      `Factor aplicado: ${(factorAjuste * 100).toFixed(1)}%`,
      'Usa tabla de mortalidad de inválidos (I-H/I-M-2020)'
    ]
  };
}

/**
 * Calcula RV con Aumento Temporal para invalidez
 */
export function calcularRVAumentoTemporalInvalidez(
  fondos: number,
  edad: number,
  sexo: Sexo,
  mesesAumento: number,
  porcentajeAumento: number,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
  beneficiarios?: BeneficiarioPension[]
): ResultadoEscenario {
  const porcentajeNormalizado = porcentajeAumento > 1 ? porcentajeAumento / 100 : porcentajeAumento;
  const rvBase = calcularRVInmediataInvalidez(fondos, edad, sexo, tasaInteres, beneficiarios);
  const pensionVitalicia = rvBase.pensionMensual;
  const pensionAumentada = pensionVitalicia * (1 + porcentajeNormalizado);
  const incrementoMensual = pensionVitalicia * porcentajeNormalizado;
  
  let costoAumento = 0;
  for (let mes = 1; mes <= mesesAumento; mes++) {
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, mes / 12);
    costoAumento += incrementoMensual * factorDescuento;
  }
  
  const factorAjuste = 1 - (costoAumento / (fondos * 0.97));
  const pensionBaseAjustada = pensionVitalicia * Math.max(factorAjuste, 0.5);
  const pensionAumentadaFinal = pensionBaseAjustada * (1 + porcentajeNormalizado);
  
  const anosAumento = Math.floor(mesesAumento / 12);
  const mesesRestantes = mesesAumento % 12;
  let nombrePeriodo = '';
  if (anosAumento > 0 && mesesRestantes > 0) {
    nombrePeriodo = `${anosAumento}a ${mesesRestantes}m`;
  } else if (anosAumento > 0) {
    nombrePeriodo = `${anosAumento} ${anosAumento === 1 ? 'año' : 'años'}`;
  } else {
    nombrePeriodo = `${mesesAumento} meses`;
  }
  
  const proyeccion: ProyeccionAnual[] = [];
  const anosAumentoInt = Math.ceil(mesesAumento / 12);
  const maxAnos = Math.min(30, 81 - edad);
  
  for (let año = 0; año < maxAnos; año++) {
    const edadActual = edad + año;
    const enPeriodoAumento = año < anosAumentoInt;
    
    proyeccion.push({
      año: año + 1,
      edad: edadActual,
      pensionMensual: enPeriodoAumento 
        ? Math.round(pensionAumentadaFinal)
        : Math.round(pensionBaseAjustada),
      saldoAcumulado: 0,
      retiroAcumulado: 0,
      fase: enPeriodoAumento ? 'aumento' : 'normal'
    });
  }
  
  return {
    nombre: `RV Invalidez +${porcentajeAumento > 1 ? porcentajeAumento : porcentajeAumento * 100}% x ${nombrePeriodo}`,
    pensionMensual: Math.round(pensionAumentadaFinal),
    pensionEnUF: pensionAumentadaFinal / UF_ACTUAL,
    pensionAnual: pensionAumentadaFinal * 12,
    cnu: rvBase.cnu,
    tasaInteres,
    expectativaVida: rvBase.expectativaVida,
    aumentoTemporal: {
      meses: mesesAumento,
      porcentaje: porcentajeAumento,
      pensionAumentada: Math.round(pensionAumentadaFinal),
      pensionFinal: Math.round(pensionBaseAjustada)
    },
    proyeccion,
    advertencias: [
      `Aumento del ${(porcentajeAumento > 1 ? porcentajeAumento : porcentajeAumento * 100).toFixed(0)}% por ${nombrePeriodo}`,
      `Pensión durante aumento: ${formatearPesos(pensionAumentadaFinal)}`,
      `Pensión después del período: ${formatearPesos(pensionBaseAjustada)}`,
      'Usa tabla de mortalidad de inválidos (I-H/I-M-2020)'
    ]
  };
}

/**
 * Calcula RV con ambas cláusulas para invalidez
 */
export function calcularRVConAmbasClausulasInvalidez(
  fondos: number,
  edad: number,
  sexo: Sexo,
  mesesGarantizados: number,
  mesesAumento: number,
  porcentajeAumento: number,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
  beneficiarios?: BeneficiarioPension[]
): ResultadoEscenario {
  const porcentajeNormalizado = porcentajeAumento > 1 ? porcentajeAumento / 100 : porcentajeAumento;
  const rvBase = calcularRVInmediataInvalidez(fondos, edad, sexo, tasaInteres, beneficiarios);
  const factorGarantizado = calcularFactorGarantizado(mesesGarantizados);
  const pensionBase = rvBase.pensionMensual * factorGarantizado;
  const pensionAumentada = pensionBase * (1 + porcentajeNormalizado);
  const incrementoMensual = pensionBase * porcentajeNormalizado;
  
  let costoAumento = 0;
  for (let mes = 1; mes <= mesesAumento; mes++) {
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, mes / 12);
    costoAumento += incrementoMensual * factorDescuento;
  }
  
  const factorAjusteTotal = Math.max(factorGarantizado - (costoAumento / (fondos * 0.97)), 0.45);
  const pensionBaseFinal = rvBase.pensionMensual * factorAjusteTotal;
  const pensionAumentadaFinal = pensionBaseFinal * (1 + porcentajeNormalizado);
  
  const anosGarantia = Math.floor(mesesGarantizados / 12);
  const anosAumento = Math.floor(mesesAumento / 12);
  
  const proyeccion: ProyeccionAnual[] = [];
  const anosAumentoInt = Math.ceil(mesesAumento / 12);
  const maxAnos = Math.min(30, 81 - edad);
  
  for (let año = 0; año < maxAnos; año++) {
    const edadActual = edad + año;
    const enPeriodoAumento = año < anosAumentoInt;
    
    proyeccion.push({
      año: año + 1,
      edad: edadActual,
      pensionMensual: enPeriodoAumento 
        ? Math.round(pensionAumentadaFinal)
        : Math.round(pensionBaseFinal),
      saldoAcumulado: 0,
      retiroAcumulado: 0,
      fase: enPeriodoAumento ? 'aumento' : 'normal'
    });
  }
  
  return {
    nombre: `RV Invalidez +${(porcentajeNormalizado * 100).toFixed(0)}% x ${anosAumento}a + Garantía ${anosGarantia}a`,
    pensionMensual: Math.round(pensionAumentadaFinal),
    pensionEnUF: pensionAumentadaFinal / UF_ACTUAL,
    pensionAnual: pensionAumentadaFinal * 12,
    cnu: rvBase.cnu,
    tasaInteres,
    expectativaVida: rvBase.expectativaVida,
    periodoGarantizado: mesesGarantizados,
    aumentoTemporal: {
      meses: mesesAumento,
      porcentaje: porcentajeAumento,
      pensionAumentada: Math.round(pensionAumentadaFinal),
      pensionFinal: Math.round(pensionBaseFinal)
    },
    proyeccion,
    advertencias: [
      `Aumento ${(porcentajeAumento > 1 ? porcentajeAumento : porcentajeAumento * 100).toFixed(0)}% por ${anosAumento} años`,
      `Garantía ${anosGarantia} años`,
      `Pensión aumento: ${formatearPesos(pensionAumentadaFinal)}`,
      `Pensión final: ${formatearPesos(pensionBaseFinal)}`,
      'Usa tabla de mortalidad de inválidos (I-H/I-M-2020)'
    ]
  };
}

// ==========================================
// CÁLCULO PENSIÓN DE SOBREVIVENCIA
// ==========================================

/**
 * Calcula los porcentajes de pensión para cada beneficiario
 * según el Art. 58 del DL 3500 con prorrateo cuando excede 100%
 * 
 * PROCEDIMIENTO DE PRORRATEO:
 * 1. Calcular porcentaje teórico de cada beneficiario
 * 2. Sumar todos los porcentajes
 * 3. Si supera 100%, aplicar factor de ajuste = 100 / suma_total
 * 4. Cada beneficiario recibe: porcentaje_original × factor_ajuste
 */
export function calcularPorcentajesBeneficiarios(
  beneficiarios: BeneficiarioPension[]
): { tipo: string; porcentaje: number; porcentajeOriginal: number; edad: number; sexo: Sexo; factorProrrateo: number }[] {
  const resultados: { tipo: string; porcentaje: number; porcentajeOriginal: number; edad: number; sexo: Sexo; factorProrrateo: number }[] = [];
  
  // Un hijo tiene derecho si es < 18, o < 24 si es estudiante, o inválido de cualquier edad
  const tieneHijosConDerecho = beneficiarios.some(
    b => b.tipo === 'hijo' && (b.edad < 18 || (b.edad < 24 && b.esEstudiante) || b.esInvalido)
  );
  const tieneConyugeOConviviente = beneficiarios.some(
    b => b.tipo === 'conyuge' || b.tipo === 'conviviente'
  );
  const tieneMadrePadreNM = beneficiarios.some(
    b => b.tipo === 'madre_padre_hijos_nm'
  );
  const tieneOtrosBeneficiarios = tieneConyugeOConviviente || tieneHijosConDerecho || tieneMadrePadreNM;
  
  for (const ben of beneficiarios) {
    let porcentajeOriginal = ben.porcentajePension;
    
    // Si el usuario no forzó porcentaje personalizado (> 0), calcular el legal según D.L. 3.500
    if (!porcentajeOriginal || porcentajeOriginal === 0) {
      switch (ben.tipo) {
        case 'conyuge':
          porcentajeOriginal = tieneHijosConDerecho 
            ? PORCENTAJES_SOBREVIVENCIA.CONYUGE_CON_HIJOS 
            : PORCENTAJES_SOBREVIVENCIA.CONYUGE_SIN_HIJOS;
          break;
          
        case 'conviviente':
          porcentajeOriginal = tieneHijosConDerecho 
            ? PORCENTAJES_SOBREVIVENCIA.CONVIVIENTE_CON_HIJOS 
            : PORCENTAJES_SOBREVIVENCIA.CONVIVIENTE_SIN_HIJOS;
          break;
          
        case 'madre_padre_hijos_nm':
          porcentajeOriginal = tieneHijosConDerecho
            ? PORCENTAJES_SOBREVIVENCIA.MADRE_PADRE_CON_OTROS_HIJOS
            : PORCENTAJES_SOBREVIVENCIA.MADRE_PADRE_SIN_OTROS_HIJOS;
          break;

        case 'hijo': {
          const tieneDerecho = ben.edad < 18 || (ben.edad < 24 && ben.esEstudiante) || ben.esInvalido;
          if (!tieneDerecho) {
            porcentajeOriginal = 0;
          } else {
            // Huérfano absoluto: no concurre con cónyuge, conviviente ni madre/padre no matrimonial
            const esHuerfanoAbsoluto = !tieneConyugeOConviviente && !tieneMadrePadreNM;
            porcentajeOriginal = esHuerfanoAbsoluto 
              ? PORCENTAJES_SOBREVIVENCIA.HIJO_HUERFANO 
              : PORCENTAJES_SOBREVIVENCIA.HIJO_CON_PADRE;
          }
          break;
        }
          
        case 'padre':
        case 'madre':
          // Sólo tienen derecho si no existen cónyuge, conviviente civil, madre/padre no mat., ni hijos con derecho
          if (!tieneOtrosBeneficiarios) {
            porcentajeOriginal = PORCENTAJES_SOBREVIVENCIA.PADRE_MADRE_SIN_OTROS;
          } else {
            porcentajeOriginal = 0;
          }
          break;
      }
    }
    
    if (porcentajeOriginal > 0) {
      resultados.push({
        tipo: ben.tipo,
        porcentaje: porcentajeOriginal,
        porcentajeOriginal,
        edad: ben.edad,
        sexo: ben.sexo,
        factorProrrateo: 1.0
      });
    }
  }
  
  // APLICAR PRORRATEO LEGAL (Art. 58 DL 3500) SI LA SUMA SUPERA EL 100%
  const sumaPorcentajes = resultados.reduce((sum, r) => sum + r.porcentajeOriginal, 0);
  
  if (sumaPorcentajes > 1.0) {
    const factorProrrateo = 1.0 / sumaPorcentajes;
    for (const r of resultados) {
      r.porcentaje = Number((r.porcentajeOriginal * factorProrrateo).toFixed(4));
      r.factorProrrateo = factorProrrateo;
    }
  }
  
  return resultados;
}

/**
 * Calcula el CNU total para pensión de sobrevivencia
 * 
 * FÓRMULA OFICIAL (Anexo 7 - Compendio de Pensiones):
 * CNU_total = Σ (CNU_beneficiario × porcentaje)
 * 
 * Cada CNU_beneficiario se calcula con la fórmula estándar
 * usando la edad y sexo del beneficiario
 */
export function calcularCNUSobrevivencia(
  beneficiarios: BeneficiarioPension[],
  tasaInteres: number
): { cnuTotal: number; detallePorBeneficiario: { tipo: string; cnu: number; porcentaje: number }[] } {
  const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
  let cnuTotal = 0;
  const detallePorBeneficiario: { tipo: string; cnu: number; porcentaje: number }[] = [];
  
  // Si no hay beneficiarios válidos, retornar valores por defecto
  if (porcentajes.length === 0) {
    return { cnuTotal: 0, detallePorBeneficiario: [] };
  }
  
  for (const ben of porcentajes) {
    // CNU individual del beneficiario
    const cnuIndividual = calcularCNUIndividual(ben.edad, ben.sexo, tasaInteres);
    
    // Aporte al CNU total ponderado por porcentaje
    cnuTotal += cnuIndividual * ben.porcentaje;
    
    detallePorBeneficiario.push({
      tipo: ben.tipo,
      cnu: cnuIndividual,
      porcentaje: ben.porcentaje
    });
  }
  
  return { cnuTotal, detallePorBeneficiario };
}

/**
 * Calcula la pensión de sobrevivencia
 * 
 * Según DL 3500:
 * 1. Se determina la pensión de referencia del causante
 * 2. Se calculan los porcentajes por beneficiario
 * 3. Se calcula el CNU total de todos los beneficiarios
 * 4. La pensión se distribuye según porcentajes
 */
export function calcularPensionSobrevivencia(
  fondosCausante: number,
  edadCausante: number,
  sexoCausante: Sexo,
  beneficiarios: BeneficiarioPension[],
  pensionReferenciaCausante?: number,
  ingresoBaseCausante?: number,
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA,
  cubiertoSIS: boolean = true
): ResultadoEscenario {
  // 1. Calcular pensión de referencia del causante
  let pensionReferencia: number;
  
  if (pensionReferenciaCausante && pensionReferenciaCausante > 0) {
    pensionReferencia = pensionReferenciaCausante;
  } else if (cubiertoSIS && ingresoBaseCausante && ingresoBaseCausante > 0) {
    pensionReferencia = ingresoBaseCausante * 0.70;
  } else {
    const cnuCausante = calcularCNU(edadCausante, sexoCausante, tasaInteres);
    pensionReferencia = fondosCausante / cnuCausante;
  }
  
  // 2. Calcular porcentajes por beneficiario (YA INCLUYE PRORRATEO si excede 100%)
  const porcentajesBeneficiarios = calcularPorcentajesBeneficiarios(beneficiarios);
  
  // 3. Calcular CNU total de sobrevivencia
  const { cnuTotal, detallePorBeneficiario } = calcularCNUSobrevivencia(beneficiarios, tasaInteres);
  
  // 4. Distribuir pensión por beneficiario usando porcentajes YA AJUSTADOS
  const pensionPorBeneficiario: { tipo: string; porcentaje: number; pensionMensual: number }[] = [];
  
  for (const ben of porcentajesBeneficiarios) {
    // El porcentaje YA incluye el prorrateo si corresponde
    const pensionBeneficiario = pensionReferencia * ben.porcentaje;
    
    pensionPorBeneficiario.push({
      tipo: ben.tipo,
      porcentaje: ben.porcentaje,
      pensionMensual: Math.round(pensionBeneficiario)
    });
  }
  
  // Expectativa de vida promedio
  const expectativaVidaPromedio = porcentajesBeneficiarios.length > 0
    ? porcentajesBeneficiarios.reduce(
        (sum, ben) => sum + calcularExpectativaVida(ben.edad, ben.sexo), 0
      ) / porcentajesBeneficiarios.length
    : 0;
  
  const tipoLabels: Record<string, string> = {
    conyuge: 'Cónyuge',
    conviviente: 'Conviviente',
    hijo: 'Hijo/a',
    padre: 'Padre',
    madre: 'Madre'
  };
  
  // Calcular porcentaje total (ya ajustado por prorrateo en calcularPorcentajesBeneficiarios)
  const porcentajeTotal = porcentajesBeneficiarios.reduce((sum, b) => sum + b.porcentaje, 0);
  const porcentajeOriginalTotal = porcentajesBeneficiarios.reduce((sum, b) => sum + b.porcentajeOriginal, 0);
  const factorProrrateo = porcentajesBeneficiarios[0]?.factorProrrateo ?? 1.0;
  
  // Generar advertencias con información de prorrateo
  const advertencias: string[] = [
    `Pensión de referencia: ${formatearPesos(pensionReferencia)}`,
  ];
  
  // Si hubo prorrateo, mostrar información
  if (porcentajeOriginalTotal > 1.0) {
    advertencias.push(`⚠️ PRORRATEO APLICADO:`);
    advertencias.push(`   Total original: ${(porcentajeOriginalTotal * 100).toFixed(0)}% > 100%`);
    advertencias.push(`   Factor de ajuste: ${(factorProrrateo * 100).toFixed(2)}%`);
  }
  
  advertencias.push(`Total porcentajes ajustado: ${(porcentajeTotal * 100).toFixed(1)}%`);
  
  // Agregar detalle por beneficiario
  pensionPorBeneficiario.forEach(b => {
    advertencias.push(
      `${tipoLabels[b.tipo] || b.tipo}: ${(b.porcentaje * 100).toFixed(1)}% = ${formatearPesos(b.pensionMensual)}`
    );
  });
  
  return {
    nombre: 'Pensión de Sobrevivencia',
    pensionMensual: Math.round(pensionReferencia * porcentajeTotal),
    pensionEnUF: pensionReferencia * porcentajeTotal / UF_ACTUAL,
    pensionAnual: pensionReferencia * porcentajeTotal * 12,
    cnu: cnuTotal,
    tasaInteres,
    expectativaVida: expectativaVidaPromedio,
    pensionPorBeneficiario,
    pensionReferencia,
    advertencias
  };
}

/**
 * Calcula las opciones de pensión de sobrevivencia: RP y RV
 */
export function calcularOpcionesSobrevivencia(
  fondosCausante: number,
  edadCausante: number,
  sexoCausante: Sexo,
  beneficiarios: BeneficiarioPension[],
  pensionReferenciaCausante?: number,
  ingresoBaseCausante?: number,
  tasaRP: number = TASAS_INTERES.RETIRO_PROGRAMADO,
  tasaRV: number = TASAS_INTERES.SOBREVIVENCIA
): ResultadoEscenario[] {
  const resultados: ResultadoEscenario[] = [];
  
  // Validar que existan beneficiarios
  const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
  
  if (porcentajes.length === 0) {
    // Retornar resultado con error si no hay beneficiarios
    resultados.push({
      nombre: 'Error: Sin Beneficiarios',
      pensionMensual: 0,
      pensionEnUF: 0,
      pensionAnual: 0,
      cnu: 0,
      tasaInteres: tasaRP,
      expectativaVida: 0,
      advertencias: ['⚠️ DEBE AGREGAR AL MENOS UN BENEFICIARIO', 'Los beneficiarios son requeridos para pensión de sobrevivencia']
    });
    return resultados;
  }
  
  // Calcular pensión de referencia
  let pensionReferencia: number;
  
  if (pensionReferenciaCausante && pensionReferenciaCausante > 0) {
    pensionReferencia = pensionReferenciaCausante;
  } else if (ingresoBaseCausante && ingresoBaseCausante > 0) {
    pensionReferencia = ingresoBaseCausante * 0.70;
  } else {
    const cnuCausante = calcularCNU(edadCausante, sexoCausante, tasaRP);
    pensionReferencia = fondosCausante / cnuCausante;
  }
  
  // Porcentajes - YA incluyen prorrateo aplicado en calcularPorcentajesBeneficiarios
  const porcentajeTotal = porcentajes.reduce((sum, b) => sum + b.porcentaje, 0);
  const porcentajeOriginalTotal = porcentajes.reduce((sum, b) => sum + b.porcentajeOriginal, 0);
  const factorProrrateo = porcentajes[0]?.factorProrrateo ?? 1.0;
  
  // Construir advertencias base
  const advertenciasBase: string[] = [];
  if (porcentajeOriginalTotal > 1.0) {
    advertenciasBase.push(`⚠️ PRORRATEO: ${(porcentajeOriginalTotal * 100).toFixed(0)}% → ${(porcentajeTotal * 100).toFixed(1)}%`);
    advertenciasBase.push(`Factor: ${(factorProrrateo * 100).toFixed(2)}%`);
  }
  
  // 1. RETIRO PROGRAMADO DE SOBREVIVENCIA
  const { cnuTotal: cnuRP } = calcularCNUSobrevivencia(beneficiarios, tasaRP);
  
  // Validar que el CNU sea válido
  if (cnuRP <= 0) {
    resultados.push({
      nombre: 'Error en CNU',
      pensionMensual: 0,
      pensionEnUF: 0,
      pensionAnual: 0,
      cnu: 0,
      tasaInteres: tasaRP,
      expectativaVida: 0,
      advertencias: ['⚠️ Error en el cálculo del CNU', 'Verifique los datos de los beneficiarios']
    });
    return resultados;
  }
  
  const pensionRP = fondosCausante / cnuRP;
  
  // Usar porcentajes YA ajustados (no aplicar factorAjuste adicional)
  const pensionPorBenRP = porcentajes.map(b => ({
    tipo: b.tipo,
    porcentaje: b.porcentaje, // Ya incluye prorrateo
    pensionMensual: Math.round(pensionRP * b.porcentaje)
  }));
  
  // Proyección RP Sobrevivencia
  const proyeccionRP: ProyeccionAnual[] = [];
  let saldoRP = fondosCausante;
  
  for (let año = 0; año <= 30; año++) {
    const { cnuTotal: cnuAnual } = calcularCNUSobrevivencia(beneficiarios, tasaRP);
    if (cnuAnual <= 0) break;
    
    const pensionAnual = saldoRP / cnuAnual * 12;
    
    proyeccionRP.push({
      año: año + 1,
      edad: edadCausante + año,
      pensionMensual: Math.round(pensionAnual / 12),
      saldoAcumulado: Math.round(saldoRP),
      retiroAcumulado: 0,
      fase: 'decreciente'
    });
    
    saldoRP = Math.max(0, (saldoRP - pensionAnual) * (1 + tasaRP));
    if (saldoRP <= 0) break;
  }
  
  resultados.push({
    nombre: 'Retiro Programado Sobrevivencia',
    pensionMensual: Math.round(pensionRP),
    pensionEnUF: pensionRP / UF_ACTUAL,
    pensionAnual: pensionRP * 12,
    cnu: cnuRP,
    tasaInteres: tasaRP,
    expectativaVida: calcularExpectativaVida(porcentajes[0]?.edad || 60, porcentajes[0]?.sexo || 'F'),
    pensionPorBeneficiario: pensionPorBenRP,
    pensionReferencia,
    proyeccion: proyeccionRP,
    advertencias: [...advertenciasBase, 'Pensión decrece en el tiempo', 'Distribución según Art. 58 DL 3500']
  });
  
  // 2. RENTA VITALICIA DE SOBREVIVENCIA
  const { cnuTotal: cnuRV } = calcularCNUSobrevivencia(beneficiarios, tasaRV);
  
  if (cnuRV <= 0) {
    resultados.push({
      nombre: 'Error en CNU RV',
      pensionMensual: 0,
      pensionEnUF: 0,
      pensionAnual: 0,
      cnu: 0,
      tasaInteres: tasaRV,
      expectativaVida: 0,
      advertencias: ['⚠️ Error en el cálculo del CNU para RV']
    });
    return resultados;
  }
  
  const primaSeguro = fondosCausante * 0.03;
  const pensionRV = (fondosCausante - primaSeguro) / cnuRV;
  
  // Usar porcentajes YA ajustados (no aplicar factorAjuste adicional)
  const pensionPorBenRV = porcentajes.map(b => ({
    tipo: b.tipo,
    porcentaje: b.porcentaje, // Ya incluye prorrateo
    pensionMensual: Math.round(pensionRV * b.porcentaje)
  }));
  
  resultados.push({
    nombre: 'Renta Vitalicia Sobrevivencia',
    pensionMensual: Math.round(pensionRV),
    pensionEnUF: pensionRV / UF_ACTUAL,
    pensionAnual: pensionRV * 12,
    cnu: cnuRV,
    tasaInteres: tasaRV,
    expectativaVida: calcularExpectativaVida(porcentajes[0]?.edad || 60, porcentajes[0]?.sexo || 'F'),
    pensionPorBeneficiario: pensionPorBenRV,
    pensionReferencia,
    advertencias: [...advertenciasBase, 'Pensión fija de por vida', 'Distribución según Art. 58 DL 3500']
  });
  
  return resultados;
}

// ==========================================
// RENTA VITALICIA PARA SOBREVIVENCIA
// ==========================================

/**
 * Calcula RV Inmediata para Sobrevivencia
 */
export function calcularRVInmediataSobrevivencia(
  fondosCausante: number,
  edadCausante: number,
  sexoCausante: Sexo,
  beneficiarios: BeneficiarioPension[],
  pensionReferenciaCausante?: number,
  ingresoBaseCausante?: number,
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA
): ResultadoEscenario {
  const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
  
  if (porcentajes.length === 0) {
    return {
      nombre: 'Error: Sin Beneficiarios',
      pensionMensual: 0,
      pensionEnUF: 0,
      pensionAnual: 0,
      cnu: 0,
      tasaInteres,
      expectativaVida: 0,
      advertencias: ['⚠️ DEBE AGREGAR AL MENOS UN BENEFICIARIO']
    };
  }

  // Calcular pensión de referencia
  let pensionReferencia: number;
  if (pensionReferenciaCausante && pensionReferenciaCausante > 0) {
    pensionReferencia = pensionReferenciaCausante;
  } else if (ingresoBaseCausante && ingresoBaseCausante > 0) {
    pensionReferencia = ingresoBaseCausante * 0.70;
  } else {
    const cnuCausante = calcularCNU(edadCausante, sexoCausante, tasaInteres);
    pensionReferencia = fondosCausante / cnuCausante;
  }

  const { cnuTotal } = calcularCNUSobrevivencia(beneficiarios, tasaInteres);
  const primaSeguro = fondosCausante * 0.03;
  const pensionMensual = (fondosCausante - primaSeguro) / cnuTotal;

  // Los porcentajes YA incluyen el prorrateo aplicado en calcularPorcentajesBeneficiarios
  // No aplicar doble ajuste
  const porcentajeTotal = porcentajes.reduce((sum, b) => sum + b.porcentaje, 0);
  const porcentajeOriginalTotal = porcentajes.reduce((sum, b) => sum + b.porcentajeOriginal, 0);
  const factorProrrateo = porcentajes[0]?.factorProrrateo ?? 1.0;

  // Usar porcentajes ya ajustados (b.porcentaje ya tiene aplicado el prorrateo)
  const pensionPorBen = porcentajes.map(b => ({
    tipo: b.tipo,
    porcentaje: b.porcentaje, // Ya ajustado
    pensionMensual: Math.round(pensionMensual * b.porcentaje)
  }));

  // Generar advertencias con info de prorrateo
  const advertencias: string[] = [];
  if (porcentajeOriginalTotal > 1.0) {
    advertencias.push(`⚠️ PRORRATEO APLICADO`);
    advertencias.push(`Original: ${(porcentajeOriginalTotal * 100).toFixed(0)}% → Ajustado: ${(porcentajeTotal * 100).toFixed(1)}%`);
    advertencias.push(`Factor: ${(factorProrrateo * 100).toFixed(2)}%`);
  }
  advertencias.push('Pensión fija de por vida');
  advertencias.push('Distribución según Art. 58 DL 3500');

  return {
    nombre: 'RV Inmediata Sobrevivencia',
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: pensionMensual / UF_ACTUAL,
    pensionAnual: pensionMensual * 12,
    cnu: cnuTotal,
    tasaInteres,
    expectativaVida: calcularExpectativaVida(porcentajes[0]?.edad || 60, porcentajes[0]?.sexo || 'F'),
    pensionPorBeneficiario: pensionPorBen,
    pensionReferencia,
    advertencias
  };
}

/**
 * Calcula RV con Período Garantizado para Sobrevivencia
 */
export function calcularRVGarantizadoSobrevivencia(
  fondosCausante: number,
  edadCausante: number,
  sexoCausante: Sexo,
  beneficiarios: BeneficiarioPension[],
  mesesGarantizados: number,
  pensionReferenciaCausante?: number,
  ingresoBaseCausante?: number,
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA
): ResultadoEscenario {
  const rvBase = calcularRVInmediataSobrevivencia(
    fondosCausante, edadCausante, sexoCausante, beneficiarios,
    pensionReferenciaCausante, ingresoBaseCausante, tasaInteres
  );

  if (rvBase.pensionMensual === 0) return rvBase;

  const factorAjuste = calcularFactorGarantizado(mesesGarantizados);
  const pensionAjustada = rvBase.pensionMensual * factorAjuste;

  const anosGarantizados = Math.floor(mesesGarantizados / 12);
  const mesesRestantes = mesesGarantizados % 12;
  let nombreMeses = '';
  if (anosGarantizados > 0 && mesesRestantes > 0) {
    nombreMeses = `${anosGarantizados}a ${mesesRestantes}m`;
  } else if (anosGarantizados > 0) {
    nombreMeses = `${anosGarantizados} años`;
  } else {
    nombreMeses = `${mesesGarantizados} meses`;
  }

  // Ajustar pensión por beneficiario
  const pensionPorBenAjustado = rvBase.pensionPorBeneficiario?.map(b => ({
    ...b,
    pensionMensual: Math.round(pensionAjustada * b.porcentaje)
  }));

  return {
    ...rvBase,
    nombre: `RV Sobrevivencia Garantía ${nombreMeses}`,
    pensionMensual: Math.round(pensionAjustada),
    pensionEnUF: pensionAjustada / UF_ACTUAL,
    pensionAnual: pensionAjustada * 12,
    periodoGarantizado: mesesGarantizados,
    pensionPorBeneficiario: pensionPorBenAjustado,
    advertencias: [
      // Mantener advertencias de prorrateo si las hay
      ...(rvBase.advertencias?.filter(a => a.includes('PRORRATEO') || a.includes('Original:') || a.includes('Factor:')) || []),
      `Período garantizado: ${nombreMeses}`,
      `Factor aplicado: ${(factorAjuste * 100).toFixed(1)}%`,
      'Distribución según Art. 58 DL 3500'
    ]
  };
}

/**
 * Calcula RV con Aumento Temporal para Sobrevivencia
 */
export function calcularRVAumentoSobrevivencia(
  fondosCausante: number,
  edadCausante: number,
  sexoCausante: Sexo,
  beneficiarios: BeneficiarioPension[],
  mesesAumento: number,
  porcentajeAumento: number,
  pensionReferenciaCausante?: number,
  ingresoBaseCausante?: number,
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA
): ResultadoEscenario {
  const porcentajeNormalizado = porcentajeAumento > 1 ? porcentajeAumento / 100 : porcentajeAumento;
  const rvBase = calcularRVInmediataSobrevivencia(
    fondosCausante, edadCausante, sexoCausante, beneficiarios,
    pensionReferenciaCausante, ingresoBaseCausante, tasaInteres
  );

  if (rvBase.pensionMensual === 0) return rvBase;

  const pensionVitalicia = rvBase.pensionMensual;
  const pensionAumentada = pensionVitalicia * (1 + porcentajeNormalizado);
  const incrementoMensual = pensionVitalicia * porcentajeNormalizado;

  let costoAumento = 0;
  for (let mes = 1; mes <= mesesAumento; mes++) {
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, mes / 12);
    costoAumento += incrementoMensual * factorDescuento;
  }

  const factorAjuste = 1 - (costoAumento / (fondosCausante * 0.97));
  const pensionBaseAjustada = pensionVitalicia * Math.max(factorAjuste, 0.5);
  const pensionAumentadaFinal = pensionBaseAjustada * (1 + porcentajeNormalizado);

  const anosAumento = Math.floor(mesesAumento / 12);
  const mesesRestantes = mesesAumento % 12;
  let nombrePeriodo = anosAumento > 0 && mesesRestantes > 0 
    ? `${anosAumento}a ${mesesRestantes}m`
    : anosAumento > 0 ? `${anosAumento} años` : `${mesesAumento} meses`;

  return {
    nombre: `RV Sobrevivencia +${porcentajeAumento > 1 ? porcentajeAumento : porcentajeAumento * 100}% x ${nombrePeriodo}`,
    pensionMensual: Math.round(pensionAumentadaFinal),
    pensionEnUF: pensionAumentadaFinal / UF_ACTUAL,
    pensionAnual: pensionAumentadaFinal * 12,
    cnu: rvBase.cnu,
    tasaInteres,
    expectativaVida: rvBase.expectativaVida,
    aumentoTemporal: {
      meses: mesesAumento,
      porcentaje: porcentajeAumento,
      pensionAumentada: Math.round(pensionAumentadaFinal),
      pensionFinal: Math.round(pensionBaseAjustada)
    },
    pensionPorBeneficiario: rvBase.pensionPorBeneficiario?.map(b => ({
      ...b,
      pensionMensual: Math.round(pensionAumentadaFinal * b.porcentaje)
    })),
    pensionReferencia: rvBase.pensionReferencia,
    advertencias: [
      // Mantener advertencias de prorrateo si las hay
      ...(rvBase.advertencias?.filter(a => a.includes('PRORRATEO') || a.includes('Original:') || a.includes('Factor:')) || []),
      `Aumento del ${(porcentajeAumento > 1 ? porcentajeAumento : porcentajeAumento * 100).toFixed(0)}% por ${nombrePeriodo}`,
      `Pensión durante aumento: ${formatearPesos(pensionAumentadaFinal)}`,
      `Pensión después: ${formatearPesos(pensionBaseAjustada)}`,
      'Distribución según Art. 58 DL 3500'
    ]
  };
}

/**
 * Calcula RV con Ambas Cláusulas para Sobrevivencia
 */
export function calcularRVAmbasSobrevivencia(
  fondosCausante: number,
  edadCausante: number,
  sexoCausante: Sexo,
  beneficiarios: BeneficiarioPension[],
  mesesGarantizados: number,
  mesesAumento: number,
  porcentajeAumento: number,
  pensionReferenciaCausante?: number,
  ingresoBaseCausante?: number,
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA
): ResultadoEscenario {
  const porcentajeNormalizado = porcentajeAumento > 1 ? porcentajeAumento / 100 : porcentajeAumento;
  const rvBase = calcularRVInmediataSobrevivencia(
    fondosCausante, edadCausante, sexoCausante, beneficiarios,
    pensionReferenciaCausante, ingresoBaseCausante, tasaInteres
  );

  if (rvBase.pensionMensual === 0) return rvBase;

  const factorGarantizado = calcularFactorGarantizado(mesesGarantizados);
  const pensionBase = rvBase.pensionMensual * factorGarantizado;
  const incrementoMensual = pensionBase * porcentajeNormalizado;

  let costoAumento = 0;
  for (let mes = 1; mes <= mesesAumento; mes++) {
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, mes / 12);
    costoAumento += incrementoMensual * factorDescuento;
  }

  const factorAjusteTotal = Math.max(factorGarantizado - (costoAumento / (fondosCausante * 0.97)), 0.45);
  const pensionBaseFinal = rvBase.pensionMensual * factorAjusteTotal;
  const pensionAumentadaFinal = pensionBaseFinal * (1 + porcentajeNormalizado);

  const anosGarantia = Math.floor(mesesGarantizados / 12);
  const anosAumento = Math.floor(mesesAumento / 12);

  return {
    nombre: `RV Sobrevivencia +${(porcentajeNormalizado * 100).toFixed(0)}% x ${anosAumento}a + Garantía ${anosGarantia}a`,
    pensionMensual: Math.round(pensionAumentadaFinal),
    pensionEnUF: pensionAumentadaFinal / UF_ACTUAL,
    pensionAnual: pensionAumentadaFinal * 12,
    cnu: rvBase.cnu,
    tasaInteres,
    expectativaVida: rvBase.expectativaVida,
    periodoGarantizado: mesesGarantizados,
    aumentoTemporal: {
      meses: mesesAumento,
      porcentaje: porcentajeAumento,
      pensionAumentada: Math.round(pensionAumentadaFinal),
      pensionFinal: Math.round(pensionBaseFinal)
    },
    pensionPorBeneficiario: rvBase.pensionPorBeneficiario?.map(b => ({
      ...b,
      pensionMensual: Math.round(pensionAumentadaFinal * b.porcentaje)
    })),
    pensionReferencia: rvBase.pensionReferencia,
    advertencias: [
      // Mantener advertencias de prorrateo si las hay
      ...(rvBase.advertencias?.filter(a => a.includes('PRORRATEO') || a.includes('Original:') || a.includes('Factor:')) || []),
      `Aumento ${porcentajeAumento}% por ${anosAumento} años`,
      `Garantía ${anosGarantia} años`,
      `Pensión aumento: ${formatearPesos(pensionAumentadaFinal)}`,
      `Pensión final: ${formatearPesos(pensionBaseFinal)}`,
      'Distribución según Art. 58 DL 3500'
    ]
  };
}

/**
 * Calcula Retiro Programado para Sobrevivencia (individual)
 */
export function calcularRetiroProgramadoSobrevivencia(
  fondosCausante: number,
  edadCausante: number,
  sexoCausante: Sexo,
  beneficiarios: BeneficiarioPension[],
  pensionReferenciaCausante?: number,
  ingresoBaseCausante?: number,
  tasaInteres: number = TASAS_INTERES.RETIRO_PROGRAMADO
): ResultadoEscenario {
  const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
  
  if (porcentajes.length === 0) {
    return {
      nombre: 'Error: Sin Beneficiarios',
      pensionMensual: 0,
      pensionEnUF: 0,
      pensionAnual: 0,
      cnu: 0,
      tasaInteres,
      expectativaVida: 0,
      advertencias: ['⚠️ DEBE AGREGAR AL MENOS UN BENEFICIARIO']
    };
  }

  // Calcular pensión de referencia
  let pensionReferencia: number;
  if (pensionReferenciaCausante && pensionReferenciaCausante > 0) {
    pensionReferencia = pensionReferenciaCausante;
  } else if (ingresoBaseCausante && ingresoBaseCausante > 0) {
    pensionReferencia = ingresoBaseCausante * 0.70;
  } else {
    const cnuCausante = calcularCNU(edadCausante, sexoCausante, tasaInteres);
    pensionReferencia = fondosCausante / cnuCausante;
  }

  const { cnuTotal } = calcularCNUSobrevivencia(beneficiarios, tasaInteres);
  const pensionMensual = fondosCausante / cnuTotal;

  // Los porcentajes YA incluyen el prorrateo aplicado en calcularPorcentajesBeneficiarios
  const porcentajeTotal = porcentajes.reduce((sum, b) => sum + b.porcentaje, 0);
  const porcentajeOriginalTotal = porcentajes.reduce((sum, b) => sum + b.porcentajeOriginal, 0);
  const factorProrrateo = porcentajes[0]?.factorProrrateo ?? 1.0;

  // Usar porcentajes ya ajustados (no aplicar doble factorAjuste)
  const pensionPorBen = porcentajes.map(b => ({
    tipo: b.tipo,
    porcentaje: b.porcentaje, // Ya incluye prorrateo
    pensionMensual: Math.round(pensionMensual * b.porcentaje)
  }));

  // Generar advertencias con info de prorrateo
  const advertencias: string[] = [];
  if (porcentajeOriginalTotal > 1.0) {
    advertencias.push(`⚠️ PRORRATEO APLICADO`);
    advertencias.push(`Original: ${(porcentajeOriginalTotal * 100).toFixed(0)}% → Ajustado: ${(porcentajeTotal * 100).toFixed(1)}%`);
    advertencias.push(`Factor: ${(factorProrrateo * 100).toFixed(2)}%`);
  }
  advertencias.push('Pensión decrece en el tiempo');
  advertencias.push('Distribución según Art. 58 DL 3500');

  // Proyección
  const proyeccion: ProyeccionAnual[] = [];
  let saldo = fondosCausante;
  for (let año = 0; año <= 30; año++) {
    const { cnuTotal: cnuAnual } = calcularCNUSobrevivencia(beneficiarios, tasaInteres);
    if (cnuAnual <= 0) break;
    
    const pensionAnual = saldo / cnuAnual * 12;
    proyeccion.push({
      año: año + 1,
      edad: edadCausante + año,
      pensionMensual: Math.round(pensionAnual / 12),
      saldoAcumulado: Math.round(saldo),
      retiroAcumulado: 0,
      fase: 'decreciente'
    });
    
    saldo = Math.max(0, (saldo - pensionAnual) * (1 + tasaInteres));
    if (saldo <= 0) break;
  }

  return {
    nombre: 'Retiro Programado Sobrevivencia',
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: pensionMensual / UF_ACTUAL,
    pensionAnual: pensionMensual * 12,
    cnu: cnuTotal,
    tasaInteres,
    expectativaVida: calcularExpectativaVida(porcentajes[0]?.edad || 60, porcentajes[0]?.sexo || 'F'),
    pensionPorBeneficiario: pensionPorBen,
    pensionReferencia,
    proyeccion,
    advertencias
  };
}

// ==========================================
// FUNCIONES AUXILIARES
// ==========================================

export function formatearPesos(monto: number): string {
  return '$' + Math.round(monto).toLocaleString('es-CL');
}

export function formatearUF(valor: number): string {
  return valor.toFixed(2) + ' UF';
}

// ==========================================
// PENSIÓN GARANTIZADA UNIVERSAL (PGU)
// ==========================================

export interface ResultadoPGU {
  aplica: boolean;
  montoMensual: number;
  montoAnual: number;
  pensionBase: number;
  factorDescuento: number;
  explicacion: string;
}

/**
 * Calcula la Pensión Garantizada Universal (PGU)
 * 
 * Requisitos:
 * - Tener 65 años o más
 * - Tener pensión menor al tope de ingresos (10,54 UF mensuales)
 * - Residencia en Chile por al menos 20 años
 * 
 * Fórmula: PGU = Monto Base × (1 - Pensión/Tope)
 */
export function calcularPGU(
  pensionMensual: number,
  edad: number,
  anosResidenciaChile: number = 20
): ResultadoPGU {
  // Verificar requisitos de edad
  if (edad < 65) {
    return {
      aplica: false,
      montoMensual: 0,
      montoAnual: 0,
      pensionBase: pensionMensual,
      factorDescuento: 0,
      explicacion: 'No cumple el requisito de edad (65 años o más)'
    };
  }

  // Verificar requisito de residencia
  if (anosResidenciaChile < 20) {
    return {
      aplica: false,
      montoMensual: 0,
      montoAnual: 0,
      pensionBase: pensionMensual,
      factorDescuento: 0,
      explicacion: `No cumple el requisito de residencia (20 años en Chile). Tiene ${anosResidenciaChile} años.`
    };
  }

  // Verificar tope de pensión
  if (pensionMensual >= PGU.TOPE_INGRESO) {
    return {
      aplica: false,
      montoMensual: 0,
      montoAnual: 0,
      pensionBase: pensionMensual,
      factorDescuento: 1,
      explicacion: `La pensión ($${pensionMensual.toLocaleString('es-CL')}) supera el tope de $${PGU.TOPE_INGRESO.toLocaleString('es-CL')}`
    };
  }

  // Si la pensión base es inferior o igual al umbral inferior, recibe el 100% de la PGU
  if (pensionMensual <= PGU.UMBRAL_INFERIOR) {
    return {
      aplica: true,
      montoMensual: PGU.MONTO_BASE,
      montoAnual: PGU.MONTO_BASE * 12,
      pensionBase: pensionMensual,
      factorDescuento: 0,
      explicacion: `Pensión inferior a $${PGU.UMBRAL_INFERIOR.toLocaleString('es-CL')}, recibe 100% PGU: $${PGU.MONTO_BASE.toLocaleString('es-CL')}`
    };
  }

  // Tramo decreciente entre umbral inferior y tope
  const factor = (PGU.TOPE_INGRESO - pensionMensual) / (PGU.TOPE_INGRESO - PGU.UMBRAL_INFERIOR);
  const montoPGU = Math.round(PGU.MONTO_BASE * factor);

  return {
    aplica: true,
    montoMensual: montoPGU,
    montoAnual: montoPGU * 12,
    pensionBase: pensionMensual,
    factorDescuento: 1 - factor,
    explicacion: `Pensión en tramo decreciente. PGU = $${PGU.MONTO_BASE.toLocaleString('es-CL')} × [(${PGU.TOPE_INGRESO.toLocaleString('es-CL')} - ${pensionMensual.toLocaleString('es-CL')}) / (${PGU.TOPE_INGRESO.toLocaleString('es-CL')} - ${PGU.UMBRAL_INFERIOR.toLocaleString('es-CL')})] = $${montoPGU.toLocaleString('es-CL')}`
  };
}

// ==========================================
// BENEFICIO POR AÑOS COTIZADOS (BAC)
// ==========================================

export interface ResultadoBAC {
  aplica: boolean;
  anosCotizados: number;
  mesesAdicionales: number;
  beneficioUF: number;
  beneficioMensualPesos: number;
  beneficioAnualPesos: number;
  topeAplicado: boolean;
  explicacion: string;
}

/**
 * Calcula el Beneficio por Años Cotizados (BAC)
 * 
 * Fórmula: BAC = años cotizados × 0,1 UF
 * Tope máximo: 2,5 UF mensuales
 * 
 * El beneficio se devenga desde el 1 de enero de 2026
 * Se contabilizan cotizaciones hasta el 31 de julio de 2025
 */
export function calcularBAC(
  anosCotizados: number,
  mesesAdicionales: number = 0,
  valorUF: number = UF_ACTUAL
): ResultadoBAC {
  // Calcular años totales con fracción
  const anosFraccion = mesesAdicionales / 12;
  const anosTotales = anosCotizados + anosFraccion;
  
  // Calcular beneficio en UF
  let beneficioUF = anosTotales * BAC.UF_POR_ANO;
  let topeAplicado = false;
  
  // Aplicar tope máximo
  if (beneficioUF > BAC.TOPE_MENSUAL_UF) {
    beneficioUF = BAC.TOPE_MENSUAL_UF;
    topeAplicado = true;
  }
  
  // Convertir a pesos
  const beneficioMensualPesos = Math.round(beneficioUF * valorUF);
  const beneficioAnualPesos = beneficioMensualPesos * 12;
  
  // Generar explicación
  let explicacion = '';
  if (anosTotales > 0) {
    explicacion = `BAC = ${anosTotales.toFixed(2)} años × 0,1 UF = ${beneficioUF.toFixed(2)} UF`;
    if (topeAplicado) {
      explicacion += ' (tope máximo aplicado: 2,5 UF)';
    }
    explicacion += ` = $${beneficioMensualPesos.toLocaleString('es-CL')}/mes`;
  } else {
    explicacion = 'No tiene años cotizados registrados';
  }
  
  return {
    aplica: anosTotales > 0,
    anosCotizados,
    mesesAdicionales,
    beneficioUF: Math.round(beneficioUF * 100) / 100,
    beneficioMensualPesos,
    beneficioAnualPesos,
    topeAplicado,
    explicacion
  };
}

/**
 * Calcula los beneficios adicionales completos (PGU + BAC)
 */
export function calcularBeneficiosAdicionales(
  pensionMensual: number, 
  edad: number, 
  sexo: Sexo, 
  anosCotizados: number,
  mesesAdicionales: number = 0,
  anosResidenciaChile: number = 20
): {
  pgu?: ResultadoPGU;
  bac?: ResultadoBAC;
  totalBeneficios: number;
  pensionTotal: number;
  detalles: string[];
} {
  const detalles: string[] = [];
  let totalBeneficios = 0;
  
  // Calcular PGU
  const pgu = calcularPGU(pensionMensual, edad, anosResidenciaChile);
  if (pgu.aplica) {
    totalBeneficios += pgu.montoMensual;
    detalles.push(`PGU: $${pgu.montoMensual.toLocaleString('es-CL')}/mes`);
  }
  
  // Calcular BAC
  const bac = calcularBAC(anosCotizados, mesesAdicionales);
  if (bac.aplica) {
    totalBeneficios += bac.beneficioMensualPesos;
    detalles.push(`BAC: ${bac.beneficioUF.toFixed(2)} UF ($${bac.beneficioMensualPesos.toLocaleString('es-CL')}/mes)`);
    if (bac.topeAplicado) {
      detalles.push(`BAC: Tope máximo de 2,5 UF aplicado`);
    }
  }
  
  const pensionTotal = pensionMensual + totalBeneficios;
  
  return {
    pgu: pgu.aplica ? pgu : undefined,
    bac: bac.aplica ? bac : undefined,
    totalBeneficios,
    pensionTotal,
    detalles
  };
}

// ==========================================
// MÓDULO ACTUARIAL DE PENSIÓN DE INVALIDEZ
// Según D.L. 3.500 y Compendio de Normas SP
// ==========================================

/**
 * Calcula la Pensión de Referencia de Invalidez según el D.L. 3.500
 * - Invalidez Total (≥66,6%): 70% del Ingreso Base
 * - Invalidez Parcial (50% a 66,5%): 50% del Ingreso Base
 */
export function calcularPensionReferenciaInvalidez(
  ingresoBaseCLP: number,
  grado: 'total' | 'parcial' = 'total'
): number {
  const porcentaje = grado === 'parcial' ? 0.50 : 0.70;
  return Math.round(Math.max(0, ingresoBaseCLP) * porcentaje);
}

/**
 * Calcula el Capital Necesario (CN) actuarial para financiar la Pensión de Referencia de Invalidez
 * aplicando las tablas generacionales oficiales de invalidez (MI-H-2020 / MI-M-2020)
 * y contemplando a los beneficiarios legales de sobrevivencia.
 * 
 * FÓRMULA (Anexo 7 Compendio SP):
 * CN = Pensión_Referencia × CNU_MI(edad, sexo, tasa, beneficiarios)
 */
export function calcularCapitalNecesarioInvalidez(
  pensionReferenciaCLP: number,
  edad: number,
  sexo: Sexo,
  tasaInteres: number = 0.0358,
  beneficiarios: BeneficiarioPension[] = []
): number {
  if (pensionReferenciaCLP <= 0) return 0;
  const cnuInvalidez = calcularCNU(edad, sexo, tasaInteres, beneficiarios, true, 'retiro_programado');
  return Math.round(pensionReferenciaCLP * cnuInvalidez);
}

/**
 * Calcula el Aporte Adicional financiado por la Aseguradora del Seguro de Invalidez y Sobrevivencia (SIS)
 * - Si el afiliado está cubierto por el SIS: AA = max(0, Capital Necesario - Saldo Acumulado)
 * - Si el afiliado NO está cubierto: AA = 0 (se financia solo con saldo propio)
 */
export function calcularAporteAdicionalSIS(
  capitalNecesarioCLP: number,
  saldoAcumuladoCLP: number,
  cubiertoSIS: boolean = true
): number {
  if (!cubiertoSIS) return 0;
  return Math.max(0, Math.round(capitalNecesarioCLP - saldoAcumuladoCLP));
}

export interface DesgloseFinanciamientoInvalidez {
  pensionReferenciaCLP: number;
  pensionReferenciaUF: number;
  capitalNecesarioCLP: number;
  capitalNecesarioUF: number;
  aporteAdicionalSISCLP: number;
  aporteAdicionalSISUF: number;
  saldoPropioCLP: number;
  saldoPropioUF: number;
  saldoTotalFinanciamientoCLP: number;
  saldoTotalFinanciamientoUF: number;
  cubiertoSIS: boolean;
  grado: 'total' | 'parcial';
  porcentajeReferencia: number;
}

/**
 * Calcula el financiamiento integral de la Pensión de Invalidez bajo normativa SP / CMF
 */
export function calcularFinanciamientoInvalidez(
  saldoPropioCLP: number,
  ingresoBaseCLP: number,
  grado: 'total' | 'parcial' = 'total',
  cubiertoSIS: boolean = true,
  edad: number = 55,
  sexo: Sexo = 'M',
  tasaInteres: number = 0.0358,
  beneficiarios: BeneficiarioPension[] = [],
  valorUF: number = 40876.41
): DesgloseFinanciamientoInvalidez {
  const porcentajeReferencia = grado === 'parcial' ? 0.50 : 0.70;
  const pensionReferenciaCLP = calcularPensionReferenciaInvalidez(ingresoBaseCLP, grado);
  const pensionReferenciaUF = valorUF > 0 ? Number((pensionReferenciaCLP / valorUF).toFixed(2)) : 0;

  const capitalNecesarioCLP = calcularCapitalNecesarioInvalidez(
    pensionReferenciaCLP,
    edad,
    sexo,
    tasaInteres,
    beneficiarios
  );
  const capitalNecesarioUF = valorUF > 0 ? Number((capitalNecesarioCLP / valorUF).toFixed(2)) : 0;

  const aporteAdicionalSISCLP = calcularAporteAdicionalSIS(
    capitalNecesarioCLP,
    saldoPropioCLP,
    cubiertoSIS
  );
  const aporteAdicionalSISUF = valorUF > 0 ? Number((aporteAdicionalSISCLP / valorUF).toFixed(2)) : 0;

  const saldoPropioUF = valorUF > 0 ? Number((saldoPropioCLP / valorUF).toFixed(2)) : 0;
  const saldoTotalFinanciamientoCLP = cubiertoSIS 
    ? Math.max(saldoPropioCLP, capitalNecesarioCLP) 
    : saldoPropioCLP;
  const saldoTotalFinanciamientoUF = valorUF > 0 ? Number((saldoTotalFinanciamientoCLP / valorUF).toFixed(2)) : 0;

  return {
    pensionReferenciaCLP,
    pensionReferenciaUF,
    capitalNecesarioCLP,
    capitalNecesarioUF,
    aporteAdicionalSISCLP,
    aporteAdicionalSISUF,
    saldoPropioCLP,
    saldoPropioUF,
    saldoTotalFinanciamientoCLP,
    saldoTotalFinanciamientoUF,
    cubiertoSIS,
    grado,
    porcentajeReferencia
  };
}

