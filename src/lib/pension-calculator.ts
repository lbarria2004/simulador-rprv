import { determinarPorcentajes, type PorcentajeBeneficiario } from './reglas-sobrevivencia.ts';
import { proyectarCapitalTemporalMensual, crearTrayectoriaTemporal, type OpcionesMensuales, type PagoTemporal } from './actuaria-mensual.ts';
import { clpAUf, ufAClp, validarReferenciaUF, UF_REFERENCIA_EJEMPLO, type ReferenciaUF } from './moneda.ts';
/**
 * Simulador de Pensiones - Sistema Chileno AFP
 * Herramienta independiente de orientación; no constituye una oferta de AFP o aseguradora.
 * Sin conexión con SCOMP. Las referencias normativas requieren validación actuarial.
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
  gradoInvalidez?: 'total' | 'parcial';
  idsHijosComunes?: string[];
  cargaFamiliarAcreditada?: boolean;
  requisitosAcreditados?: boolean;
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
  referenciaUF: ReferenciaUF;
  unidadMonetaria?: 'CLP_REALES';
  pensionBaseReparto?: number;
  nombre: string;
  pensionMensual: number;
  pensionEnUF: number;
  pensionAnual: number;
  cnu: number;
  tasaInteres: number;
  tasaTecnicaCNU?: number;
  rentabilidadRealAnual?: number;
  anoCalculo?: number;
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
    pensionPosterior?: number;
  }[];
  gradoInvalidez?: GradoInvalidez;
  ingresoBase?: number;
  porcentajeInvalidez?: number;
  pensionReferencia?: number;
  
  proyeccion?: ProyeccionAnual[];
  proyeccionMensual?: PagoTemporal[];
  metodologiaTemporal?: 'mensual_fuerza_constante_v1';
  componentesCNU?: { vitalicioAnual: number; temporalMensual: number; porcentajeAumento: number; factorGarantia: number; divisorTotal: number };
  advertencias?: string[];
  validacionActuarial?: { estado: 'estimativo'; fechaRevision: string; fuenteTablas: string; cnuVitalicio: string };
  reglasSobrevivencia?: PorcentajeBeneficiario[];
}

export interface ProyeccionAnual {
  año: number;
  edad: number;
  pensionMensual: number;
  saldoAcumulado: number;
  retiroAcumulado: number;
  mesesAumentados?: number;
  mesesGarantizados?: number;
  fase?: 'aumento' | 'normal' | 'decreciente' | 'aumentada' | 'vitalicia' | 'mixta';
}

export interface OpcionesProyeccionRP {
  /** Rentabilidad real anual hipotética, en decimal; independiente del descuento del CNU. */
  rentabilidadRealAnual?: number;
  /** Año base explícito para reproducir la mortalidad generacional. */
  anoCalculo?: number;
}

export interface ProyeccionRetiroProgramado extends ProyeccionAnual {
  anoCalendario: number;
  cnu: number;
  beneficiarios: BeneficiarioPension[];
  /** Flujos sin redondear para auditar la evolución del saldo. */
  retiroAnual: number;
  saldoFinal: number;
  pensionBaseReparto?: number;
  pensionPorBeneficiario?: ResultadoEscenario['pensionPorBeneficiario'];
}

export interface ResultadoRetiroProgramado extends ResultadoEscenario {
  tasaTecnicaCNU: number;
  rentabilidadRealAnual: number;
  anoCalculo: number;
  proyeccion: ProyeccionRetiroProgramado[];
}

/** Supuestos ilustrativos reales, constantes; no son pronósticos ni tasas ofrecidas. */
export const ESCENARIOS_RENTABILIDAD_RP = {
  conservador: { nombre: 'Conservador', rentabilidadRealAnual: 0 },
  base: { nombre: 'Base', rentabilidadRealAnual: 0.02 },
  optimista: { nombre: 'Optimista', rentabilidadRealAnual: 0.04 }
} as const;

export type EscenarioRentabilidadRP = keyof typeof ESCENARIOS_RENTABILIDAD_RP;

export const AVISO_VALIDACION_ACTUARIAL = 'CNU: aproximación documentada. Montos de pensión, aplicación de tasas, factores de garantía y derechos futuros: pendientes de validación especializada. No acredita conformidad normativa ni cobertura SIS.';

export const AVISO_SIMULACION = 'Estimación orientativa independiente, sin conexión con SCOMP. No constituye una oferta oficial de AFP o aseguradora ni garantiza rentabilidad o pensión. CNU aproximado; montos pendientes de validación especializada.';

// ==========================================
// CONSTANTES DEL SISTEMA
// ==========================================

export const EDAD_JUBILACION = {
  HOMBRE: 65,
  MUJER: 60
} as const;

export const TASAS_INTERES = {
  RETIRO_PROGRAMADO: 0.0367,
  RENTA_VITALICIA_VEJEZ: 0.0282,
  RENTA_VITALICIA_INVALIDEZ: 0.0293,
  SOBREVIVENCIA: 0.0287
} as const;



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
  CONVIVIENTE_CON_HIJOS: 0.50,
  CONVIVIENTE_SOLO_HIJOS_NO_COMUNES: 0.15,
  HIJO_INVALIDO_PARCIAL_DESDE_24: 0.11,    // Art.58 f)
  
  // Hijos
  HIJO_CON_PADRE: 0.15,           // 15% si tiene padre/madre viudo
  HIJO_HUERFANO: 0.15,            // Base hijo; incremento último inciso se calcula por separado
  
  // Madre/Padre de hijos de filiación no matrimonial
  MADRE_PADRE_SIN_OTROS_HIJOS: 0.36,  // 36% si no hay otros hijos con derecho
  MADRE_PADRE_CON_OTROS_HIJOS: 0.30,  // 30% si hay otros hijos con derecho
  
  // Padre/Madre (cuando no hay cónyuge, conviviente ni hijos)
  PADRE_MADRE_SIN_OTROS: 0.50     // Art.58 e), sujeto a art.10
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
  parcial: 0.50
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
 * Aproxima el Capital Necesario Unitario (CNU) mediante una suma anual.
 * 
 * Modelo generacional con descuento a mitad de año (no certificado como cálculo oficial):
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
  validarEntradaCNU(edad, sexo, tasaInteres, anoCalculo);
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
    for (const ben of porcentajes) {
      const pct = ben.porcentaje;
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
      const qxBen = getQx(edadBenActual, sexoBeneficiario, esInvalidoBeneficiario, 'retiro_programado', anoCalculo + t, 'beneficiario');
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
  anoCalculo: number = 2026,
  esInvalido: boolean = false,
  esHijo: boolean = false,
  esEstudiante: boolean = false
): number {
  validarEntradaCNU(edad, sexo, tasaInteres, anoCalculo);
  let cnu = 0;
  let factorSupervivencia = 1.0;
  const maxEdad = (esHijo && !esInvalido) ? (esEstudiante ? 24 : 18) : 110;
  if (edad >= maxEdad) return 0;
  
  for (let t = 0; t < (maxEdad - edad); t++) {
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, t + 0.5);
    cnu += factorSupervivencia * factorDescuento;
    const qx = getQx(edad + t, sexo, esInvalido, modalidad, anoCalculo + t, 'beneficiario');
    factorSupervivencia *= (1 - qx);
  }
  
  return cnu * 12;
}

/**
 * Calcula el Capital Necesario Unitario Temporal para un período de meses dado
 * Suma de pagos mensuales vencidos, supervivencia por fuerza constante y descuento real.
 * Fórmula, convención 30/360 y límites: docs/fase-3-fundamentos.md.
 */
export function calcularCNUTemporal(
  edad: number,
  sexo: Sexo,
  meses: number,
  tasaInteres: number,
  esInvalido: boolean = false,
  modalidad: ModalidadPension = 'renta_vitalicia',
  anoCalculo: number = 2026,
  opciones: OpcionesMensuales = {}
): number {
  return proyectarCapitalTemporalMensual(edad, sexo, meses, tasaInteres, esInvalido, modalidad, anoCalculo, opciones).cnu;
}

// ==========================================
// CÁLCULO PENSIÓN DE VEJEZ
// ==========================================

export function calcularRetiroProgramado(
  fondos: number,
  edad: number,
  sexo: Sexo,
  tasaTecnicaCNU: number = TASAS_INTERES.RETIRO_PROGRAMADO,
  beneficiarios?: BeneficiarioPension[],
  esInvalido: boolean = false,
  opciones: OpcionesProyeccionRP = {},
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoRetiroProgramado {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const {
    rentabilidadRealAnual = ESCENARIOS_RENTABILIDAD_RP.base.rentabilidadRealAnual,
    anoCalculo = Number(referenciaUF.fecha.slice(0, 4))
  } = opciones;
  if (!Number.isFinite(fondos) || fondos < 0) throw new RangeError('Fondos deben ser finitos y no negativos');
  if (!Number.isInteger(edad) || edad < 0 || edad > 110) throw new RangeError('Edad debe ser entera entre 0 y 110');
  if (sexo !== 'M' && sexo !== 'F') throw new RangeError('Sexo debe ser M o F');
  for (const tasa of [tasaTecnicaCNU, rentabilidadRealAnual]) {
    if (!Number.isFinite(tasa) || tasa <= -1) throw new RangeError('Las tasas deben ser finitas y mayores que -1');
  }
  if (!Number.isInteger(anoCalculo) || anoCalculo < 2020 || anoCalculo > 9999) {
    throw new RangeError('Año de cálculo debe ser entero entre 2020 y 9999');
  }
  for (const ben of beneficiarios ?? []) {
    if (!Number.isInteger(ben.edad) || ben.edad < 0 || ben.edad > 110) {
      throw new RangeError('Edad de beneficiario debe ser entera entre 0 y 110');
    }
    if (ben.sexo !== 'M' && ben.sexo !== 'F') throw new RangeError('Sexo de beneficiario debe ser M o F');
    if (!Number.isFinite(ben.porcentajePension) || ben.porcentajePension < 0 || ben.porcentajePension > 1) {
      throw new RangeError('Porcentaje de beneficiario debe estar entre 0 y 1');
    }
  }
  const cnu = calcularCNU(edad, sexo, tasaTecnicaCNU, beneficiarios, esInvalido, 'retiro_programado', anoCalculo);
  const pensionMensual = Math.min(fondos / cnu, fondos / 12);
  const expectativaVida = calcularExpectativaVida(edad, sexo, esInvalido, 'retiro_programado', anoCalculo);
  
  const proyeccion: ProyeccionRetiroProgramado[] = [];
  let saldo = fondos;
  let retiroAcumulado = 0;
  
  for (let año = 0; año <= Math.min(45, 110 - edad); año++) {
    const edadActual = edad + año;
    // Copiar desde el estado inicial evita mutar entradas o acumular incrementos de edad.
    const beneficiariosActuales = (beneficiarios ?? []).map(ben => ({ ...ben, edad: ben.edad + año })).filter(ben => ben.edad <= 110);
    const cnuAnual = calcularCNU(edadActual, sexo, tasaTecnicaCNU, beneficiariosActuales, esInvalido, 'retiro_programado', anoCalculo + año);
    if (!Number.isFinite(cnuAnual) || cnuAnual <= 0) throw new RangeError('CNU fuera del dominio numérico de la proyección');
    const pensionAnual = Math.min(saldo, saldo / cnuAnual * 12);
    const pensionMes = pensionAnual / 12;
    // Convención simplificada: retiro anual al inicio, retorno real sobre el remanente.
    const saldoFinal = Math.max(0, (saldo - pensionAnual) * (1 + rentabilidadRealAnual));
    if (!Number.isFinite(saldoFinal)) throw new RangeError('Saldo fuera del dominio numérico de la proyección');
    
    proyeccion.push({
      año: año + 1,
      edad: edadActual,
      pensionMensual: Math.round(pensionMes),
      saldoAcumulado: Math.round(saldo),
      retiroAcumulado: Math.round(retiroAcumulado),
      fase: 'normal',
      anoCalendario: anoCalculo + año,
      cnu: cnuAnual,
      beneficiarios: beneficiariosActuales,
      retiroAnual: pensionAnual,
      saldoFinal
    });
    
    saldo = saldoFinal;
    retiroAcumulado += pensionAnual;
    
    if (saldo <= 0) break;
  }
  
  return {
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    reglasSobrevivencia: determinarPorcentajes(beneficiarios ?? []),
    nombre: esInvalido ? 'Retiro Programado (Invalidez MI-2020)' : 'Retiro Programado',
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: clpAUf(Math.round(pensionMensual), referenciaUF),
    pensionAnual: pensionMensual * 12,
    cnu,
    tasaInteres: tasaTecnicaCNU, // Alias histórico: representa solo el descuento del CNU.
    tasaTecnicaCNU,
    rentabilidadRealAnual,
    anoCalculo,
    expectativaVida,
    proyeccion,
    advertencias: [AVISO_SIMULACION, 'Rentabilidad real hipotética constante. CNU aproximado, recálculo anual y retiros limitados al saldo disponible.']
  };
}

/** Mismos datos y tasa técnica; solo cambia la rentabilidad real del fondo. */
export function calcularEscenariosRetiroProgramado(
  fondos: number,
  edad: number,
  sexo: Sexo,
  tasaTecnicaCNU: number = TASAS_INTERES.RETIRO_PROGRAMADO,
  beneficiarios?: BeneficiarioPension[],
  esInvalido: boolean = false,
  anoCalculo: number | undefined = undefined,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): Record<EscenarioRentabilidadRP, ResultadoRetiroProgramado> {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const calcular = (escenario: EscenarioRentabilidadRP) => calcularRetiroProgramado(
    fondos, edad, sexo, tasaTecnicaCNU, beneficiarios, esInvalido,
    { ...ESCENARIOS_RENTABILIDAD_RP[escenario], anoCalculo }, referenciaUF
  );
  return { conservador: calcular('conservador'), base: calcular('base'), optimista: calcular('optimista') };
}

export function calcularRVInmediata(
  fondos: number,
  edad: number,
  sexo: Sexo,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_VEJEZ,
  beneficiarios?: BeneficiarioPension[],
  esInvalido: boolean = false,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const cnu = calcularCNU(edad, sexo, tasaInteres, beneficiarios, esInvalido, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)));
  const pensionMensual = fondos / cnu;
  const expectativaVida = calcularExpectativaVida(edad, sexo, esInvalido, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)));
  
  return {
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: esInvalido ? 'Renta Vitalicia Invalidez (MI-2020)' : 'Renta Vitalicia Inmediata',
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: clpAUf(Math.round(pensionMensual), referenciaUF),
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
  esInvalido: boolean = false,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const rvBase = calcularRVInmediata(fondos, edad, sexo, tasaInteres, beneficiarios, esInvalido, referenciaUF);
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
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: `RV con Garantía ${nombreMeses}`,
    pensionMensual: Math.round(pensionAjustada),
    pensionEnUF: clpAUf(Math.round(pensionAjustada), referenciaUF),
    pensionAnual: pensionAjustada * 12,
    cnu: rvBase.cnu / factorAjuste,
    tasaInteres,
    expectativaVida: rvBase.expectativaVida,
    periodoGarantizado: mesesGarantizados,
    advertencias: [
      `Período garantizado: ${nombreMeses} (${mesesGarantizados} meses)`,
      `Si fallece antes, beneficiarios reciben el 100% de la pensión`,
      `Factor ilustrativo aplicado: ${(factorAjuste * 100).toFixed(1)}%`
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
  esInvalido: boolean = false,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const porcentajeNormalizado = normalizarAumento(porcentajeAumento);
  const cnuVitalicio = calcularCNU(edad, sexo, tasaInteres, beneficiarios, esInvalido, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)));
  const cnuTemporal = calcularCNUTemporal(edad, sexo, mesesAumento, tasaInteres, esInvalido, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)), { fechaCalculo: referenciaUF.fecha });
  
  // Equivalencia actuarial:
  // Fondos = PensionBase * CNU_vitalicio + (porcentaje * PensionBase) * CNU_temporal
  const pensionBaseAjustada = fondos / (cnuVitalicio + porcentajeNormalizado * cnuTemporal);
  const pensionAumentadaFinal = pensionBaseAjustada * (1 + (mesesAumento > 0 ? porcentajeNormalizado : 0));
  const expectativaVida = calcularExpectativaVida(edad, sexo, esInvalido, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)));
  
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
  
  const trayectoria = crearTrayectoriaTemporal(pensionBaseAjustada, pensionAumentadaFinal, mesesAumento, edad, 30);
  const proyeccion = trayectoria.anual;

  return {
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: `RV Aumento Temporal +${(porcentajeNormalizado * 100).toFixed(0)}% (${nombrePeriodo})`,
    pensionMensual: Math.round(pensionAumentadaFinal),
    pensionEnUF: clpAUf(Math.round(pensionAumentadaFinal), referenciaUF),
    pensionAnual: pensionAumentadaFinal * 12,
    cnu: cnuVitalicio + porcentajeNormalizado * cnuTemporal,
    componentesCNU: { vitalicioAnual: cnuVitalicio, temporalMensual: cnuTemporal, porcentajeAumento: porcentajeNormalizado, factorGarantia: 1, divisorTotal: cnuVitalicio + porcentajeNormalizado * cnuTemporal },
    tasaInteres,
    expectativaVida,
    aumentoTemporal: {
      meses: mesesAumento,
      porcentaje: porcentajeAumento,
      pensionAumentada: Math.round(pensionAumentadaFinal),
      pensionFinal: Math.round(pensionBaseAjustada)
    },
    proyeccion,
    proyeccionMensual: trayectoria.mensual,
    metodologiaTemporal: 'mensual_fuerza_constante_v1',
    advertencias: [
      `Aumento ${(porcentajeNormalizado * 100).toFixed(0)}% durante ${nombrePeriodo}`,
      `Pensión inicial: ${formatearPesos(pensionAumentadaFinal)}`,
      `Pensión desde mes ${mesesAumento + 1}: ${formatearPesos(pensionBaseAjustada)}`
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
  esInvalido: boolean = false,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const porcentajeNormalizado = normalizarAumento(porcentajeAumento);
  const cnuVitalicio = calcularCNU(edad, sexo, tasaInteres, beneficiarios, esInvalido, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)));
  const factorGarantizado = calcularFactorGarantizado(mesesGarantizados);
  const cnuEfectivoGarantizado = cnuVitalicio / (factorGarantizado > 0 ? factorGarantizado : 1);
  const cnuTemporal = calcularCNUTemporal(edad, sexo, mesesAumento, tasaInteres, esInvalido, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)), { fechaCalculo: referenciaUF.fecha });
  
  const pensionBaseFinal = fondos / (cnuEfectivoGarantizado + porcentajeNormalizado * cnuTemporal);
  const pensionAumentadaFinal = pensionBaseFinal * (1 + (mesesAumento > 0 ? porcentajeNormalizado : 0));
  const expectativaVida = calcularExpectativaVida(edad, sexo, esInvalido, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)));
  
  const anosGarantia = Math.floor(mesesGarantizados / 12);
  const anosAumento = Math.floor(mesesAumento / 12);
  
  const trayectoria = crearTrayectoriaTemporal(pensionBaseFinal, pensionAumentadaFinal, mesesAumento, edad, 30);
  const proyeccion = trayectoria.anual;

  return {
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: `RV +${(porcentajeNormalizado * 100).toFixed(0)}% x ${anosAumento}a + Garantía ${anosGarantia}a`,
    pensionMensual: Math.round(pensionAumentadaFinal),
    pensionEnUF: clpAUf(Math.round(pensionAumentadaFinal), referenciaUF),
    pensionAnual: pensionAumentadaFinal * 12,
    cnu: cnuEfectivoGarantizado + porcentajeNormalizado * cnuTemporal,
    componentesCNU: { vitalicioAnual: cnuVitalicio, temporalMensual: cnuTemporal, porcentajeAumento: porcentajeNormalizado, factorGarantia: factorGarantizado, divisorTotal: cnuEfectivoGarantizado + porcentajeNormalizado * cnuTemporal },
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
    proyeccionMensual: trayectoria.mensual,
    metodologiaTemporal: 'mensual_fuerza_constante_v1',
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
 * - Parcial: 50% del ingreso base (art.56, sujeto a requisitos)
 */
export function calcularPensionInvalidez(
  fondos: number,
  edad: number,
  sexo: Sexo,
  gradoInvalidez: GradoInvalidez,
  ingresoBase: number,
  tasaInteres: number = TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
  beneficiarios?: BeneficiarioPension[],
  cubiertoSIS: boolean = true,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const porcentaje = PORCENTAJES_INVALIDEZ[gradoInvalidez];
  const pensionReferencia = ingresoBase * porcentaje;
  
  // CNU con tabla de inválidos
  const cnu = calcularCNU(edad, sexo, tasaInteres, beneficiarios, true, undefined, Number(referenciaUF.fecha.slice(0, 4)));
  const expectativaVida = calcularExpectativaVida(edad, sexo, true, undefined, Number(referenciaUF.fecha.slice(0, 4)));
  
  let pensionMensual: number;
  let capitalSIS = 0;
  
  if (cubiertoSIS) {
    // Capital estimativo: no acredita cobertura ni obligación de aporte SIS
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
    total_2_3: 'Convención heredada (50%, sin categoría legal acreditada)',
    parcial: 'Parcial (50%)'
  };
  
  const advertencias = [
    `Grado de invalidez: ${gradoLabels[gradoInvalidez]}`,
    `Ingreso base: ${formatearPesos(ingresoBase)}`,
    `Pensión de referencia: ${formatearPesos(pensionReferencia)}`
  ];
  
  if (gradoInvalidez === 'total_2_3') advertencias.push('Convención heredada: total_2_3 no acredita una categoría legal de invalidez. Requiere revisión del dictamen.');

  if (capitalSIS > 0) {
    advertencias.push(`Aporte SIS: ${formatearPesos(capitalSIS)}`);
  }
  
  return {
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: `Pensión Invalidez ${gradoLabels[gradoInvalidez]}`,
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: clpAUf(Math.round(pensionMensual), referenciaUF),
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
  beneficiarios?: BeneficiarioPension[],
  opciones: OpcionesProyeccionRP = {},
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoRetiroProgramado {
  referenciaUF = validarReferenciaUF(referenciaUF);
  return calcularRetiroProgramado(fondos, edad, sexo, tasaInteres, beneficiarios, true, opciones, referenciaUF);
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
  beneficiarios?: BeneficiarioPension[],
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  // CNU con tabla de inválidos
  const cnu = calcularCNU(edad, sexo, tasaInteres, beneficiarios, true, undefined, Number(referenciaUF.fecha.slice(0, 4)));
  const pensionMensual = fondos / cnu;
  const expectativaVida = calcularExpectativaVida(edad, sexo, true, undefined, Number(referenciaUF.fecha.slice(0, 4)));
  
  return {
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: 'RV Inmediata (Invalidez)',
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: clpAUf(Math.round(pensionMensual), referenciaUF),
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
  beneficiarios?: BeneficiarioPension[],
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const rvBase = calcularRVInmediataInvalidez(fondos, edad, sexo, tasaInteres, beneficiarios, referenciaUF);
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
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: `RV Invalidez Garantía ${nombreMeses}`,
    pensionMensual: Math.round(pensionAjustada),
    pensionEnUF: clpAUf(Math.round(pensionAjustada), referenciaUF),
    pensionAnual: pensionAjustada * 12,
    cnu: rvBase.cnu / factorAjuste,
    tasaInteres,
    expectativaVida: rvBase.expectativaVida,
    periodoGarantizado: mesesGarantizados,
    advertencias: [
      `Período garantizado: ${nombreMeses} (${mesesGarantizados} meses)`,
      `Si fallece antes, beneficiarios reciben el 100% de la pensión`,
      `Factor ilustrativo aplicado: ${(factorAjuste * 100).toFixed(1)}%`,
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
  beneficiarios?: BeneficiarioPension[],
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  return calcularRVAumentoTemporal(fondos, edad, sexo, mesesAumento, porcentajeAumento, tasaInteres, beneficiarios, true, referenciaUF);
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
  beneficiarios?: BeneficiarioPension[],
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  return calcularRVConAmbasClausulas(fondos, edad, sexo, mesesGarantizados, mesesAumento, porcentajeAumento, tasaInteres, beneficiarios, true, referenciaUF);
}

// ==========================================
// CÁLCULO PENSIÓN DE SOBREVIVENCIA
// ==========================================

/** Porcentajes documentados sobre la base del causante y participación familiar separada.
 * No aplica un tope global del 100%; ver docs/fase-3-fundamentos.md.
 */
export function calcularPorcentajesBeneficiarios(beneficiarios: BeneficiarioPension[]): PorcentajeBeneficiario[] {
  return determinarPorcentajes(beneficiarios);
}

/**
 * Calcula el CNU total para pensión de sobrevivencia
 * 
 * Modelo familiar simplificado, inspirado en el Anexo 7; no reproduce todos sus términos:
 * CNU_total = Σ (CNU_beneficiario × porcentaje)
 * 
 * Cada CNU_beneficiario se calcula con la fórmula estándar
 * usando la edad y sexo del beneficiario
 */
export function calcularCNUSobrevivencia(
  beneficiarios: BeneficiarioPension[],
  tasaInteres: number,
  modalidad: ModalidadPension = 'retiro_programado',
  anoCalculo: number = 2026
): { cnuTotal: number; detallePorBeneficiario: { tipo: string; cnu: number; porcentaje: number }[] } {
  const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
  let cnuTotal = 0;
  const detallePorBeneficiario: { tipo: string; cnu: number; porcentaje: number }[] = [];
  
  // Si no hay beneficiarios válidos, retornar valores por defecto
  if (porcentajes.length === 0) {
    return { cnuTotal: 0, detallePorBeneficiario: [] };
  }
  
  for (let i = 0; i < porcentajes.length; i++) {
    const ben = porcentajes[i];
    const benOrig = ben;
    const esHijo = ben.tipo === 'hijo';
    const esEstudiante = !!benOrig.esEstudiante;
    const esInvalido = !!benOrig.esInvalido;

    // CNU individual del beneficiario con truncamiento si es hijo no inválido
    const cnuIndividual = calcularCNUIndividual(
      ben.edad,
      ben.sexo,
      tasaInteres,
      modalidad,
      anoCalculo,
      esInvalido,
      esHijo,
      esEstudiante
    );
    
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
  cubiertoSIS: boolean = true,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  // 1. Calcular pensión de referencia del causante
  let pensionReferencia: number;
  
  if (pensionReferenciaCausante && pensionReferenciaCausante > 0) {
    pensionReferencia = pensionReferenciaCausante;
  } else if (cubiertoSIS && ingresoBaseCausante && ingresoBaseCausante > 0) {
    pensionReferencia = ingresoBaseCausante * 0.70;
  } else {
    const cnuCausante = calcularCNU(edadCausante, sexoCausante, tasaInteres, undefined, undefined, undefined, Number(referenciaUF.fecha.slice(0, 4)));
    pensionReferencia = fondosCausante / cnuCausante;
  }
  
  // 2. Porcentajes sobre la base de referencia, sin normalización global
  const porcentajesBeneficiarios = calcularPorcentajesBeneficiarios(beneficiarios);
  
  // 3. Calcular CNU total de sobrevivencia
  const { cnuTotal, detallePorBeneficiario } = calcularCNUSobrevivencia(beneficiarios, tasaInteres, undefined, Number(referenciaUF.fecha.slice(0, 4)));
  
  // 4. Aplicar porcentajes a la base de referencia
  const pensionPorBeneficiario: { tipo: string; porcentaje: number; pensionMensual: number }[] = [];
  
  for (const ben of porcentajesBeneficiarios) {
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
        (sum, ben) => sum + calcularExpectativaVida(ben.edad, ben.sexo, !!ben.esInvalido, undefined, Number(referenciaUF.fecha.slice(0, 4)), 'beneficiario'), 0
      ) / porcentajesBeneficiarios.length
    : 0;
  
  const tipoLabels: Record<string, string> = {
    conyuge: 'Cónyuge',
    conviviente: 'Conviviente',
    hijo: 'Hijo/a',
    padre: 'Padre',
    madre: 'Madre'
  };
  
  const porcentajeTotal = porcentajesBeneficiarios.reduce((sum, b) => sum + b.porcentaje, 0);
  const advertencias = [
    `Pensión de referencia: ${formatearPesos(pensionReferencia)}`,
    `Suma de porcentajes sobre la base: ${(porcentajeTotal * 100).toFixed(1)}%. No es participación en el total familiar.`,
    ...porcentajesBeneficiarios.flatMap(b => b.advertenciasRegla)
  ];

  // Agregar detalle por beneficiario
  pensionPorBeneficiario.forEach(b => {
    advertencias.push(
      `${tipoLabels[b.tipo] || b.tipo}: ${(b.porcentaje * 100).toFixed(1)}% = ${formatearPesos(b.pensionMensual)}`
    );
  });
  
  return {
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: 'Pensión de Sobrevivencia',
    pensionMensual: Math.round(pensionReferencia * porcentajeTotal),
    pensionEnUF: clpAUf(Math.round(pensionReferencia * porcentajeTotal), referenciaUF),
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
  tasaRV: number = TASAS_INTERES.SOBREVIVENCIA,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO,
  opciones: OpcionesProyeccionRP = {}
): ResultadoEscenario[] {
  return [
    calcularRetiroProgramadoSobrevivencia(fondosCausante, edadCausante, sexoCausante, beneficiarios, pensionReferenciaCausante, ingresoBaseCausante, tasaRP, referenciaUF, opciones),
    calcularRVInmediataSobrevivencia(fondosCausante, edadCausante, sexoCausante, beneficiarios, pensionReferenciaCausante, ingresoBaseCausante, tasaRV, referenciaUF)
  ];
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
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
  
  if (porcentajes.length === 0) {
    return presentarTotalSobrevivencia({
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
      nombre: 'Error: Sin Beneficiarios',
      pensionMensual: 0,
      pensionEnUF: clpAUf(0, referenciaUF),
      pensionAnual: 0,
      cnu: 0,
      tasaInteres,
      expectativaVida: 0,
      advertencias: ['⚠️ DEBE AGREGAR AL MENOS UN BENEFICIARIO']
    });
  }

  // Calcular pensión de referencia
  let pensionReferencia: number;
  if (pensionReferenciaCausante && pensionReferenciaCausante > 0) {
    pensionReferencia = pensionReferenciaCausante;
  } else if (ingresoBaseCausante && ingresoBaseCausante > 0) {
    pensionReferencia = ingresoBaseCausante * 0.70;
  } else {
    const cnuCausante = calcularCNU(edadCausante, sexoCausante, tasaInteres, undefined, undefined, undefined, Number(referenciaUF.fecha.slice(0, 4)));
    pensionReferencia = fondosCausante / cnuCausante;
  }

  const { cnuTotal } = calcularCNUSobrevivencia(beneficiarios, tasaInteres, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)));
  const pensionMensual = fondosCausante / cnuTotal;

  const pensionPorBen = porcentajes.map(b => ({
    tipo: b.tipo, porcentaje: b.porcentaje,
    pensionMensual: Math.round(pensionMensual * b.porcentaje)
  }));
  const advertencias = [
    'Pensión financiable estimativa; verificar derechos y acrecimientos futuros.',
    'Porcentajes del Art.58 sobre la base, sin normalización global al 100%.',
    ...porcentajes.flatMap(b => b.advertenciasRegla)
  ];

  return presentarTotalSobrevivencia({
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: 'RV Inmediata Sobrevivencia',
    pensionBaseReparto: pensionMensual,
    pensionMensual: Math.round(pensionMensual),
    pensionEnUF: clpAUf(Math.round(pensionMensual), referenciaUF),
    pensionAnual: pensionMensual * 12,
    cnu: cnuTotal,
    tasaInteres,
    expectativaVida: calcularExpectativaVida(porcentajes[0]?.edad ?? 60, porcentajes[0]?.sexo ?? 'F', !!porcentajes[0]?.esInvalido, undefined, Number(referenciaUF.fecha.slice(0, 4)), 'beneficiario'),
    pensionPorBeneficiario: pensionPorBen,
    pensionReferencia,
    advertencias
  });
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
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const rvBase = calcularRVInmediataSobrevivencia(
    fondosCausante, edadCausante, sexoCausante, beneficiarios,
    pensionReferenciaCausante, ingresoBaseCausante, tasaInteres, referenciaUF
  );

  if ((rvBase.pensionBaseReparto ?? rvBase.pensionMensual) === 0) return rvBase;

  const factorAjuste = calcularFactorGarantizado(mesesGarantizados);
  const pensionAjustada = (rvBase.pensionBaseReparto ?? rvBase.pensionMensual) * factorAjuste;

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

  return presentarTotalSobrevivencia({
    ...rvBase,
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: `RV Sobrevivencia Garantía ${nombreMeses}`,
    pensionBaseReparto: pensionAjustada,
    cnu: rvBase.cnu / factorAjuste,
    pensionMensual: Math.round(pensionAjustada),
    pensionEnUF: clpAUf(Math.round(pensionAjustada), referenciaUF),
    pensionAnual: pensionAjustada * 12,
    periodoGarantizado: mesesGarantizados,
    pensionPorBeneficiario: pensionPorBenAjustado,
    advertencias: [
      ...(rvBase.advertencias ?? []),
      `Período garantizado: ${nombreMeses}`,
      `Factor ilustrativo aplicado: ${(factorAjuste * 100).toFixed(1)}%`,
      'Distribución según Art. 58 DL 3500'
    ]
  });
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
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  return calcularRVAumentoTemporalSobrevivencia(fondosCausante, beneficiarios, mesesAumento, porcentajeAumento, tasaInteres, referenciaUF);
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
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  return calcularRVAumentoTemporalSobrevivencia(fondosCausante, beneficiarios, mesesAumento, porcentajeAumento, tasaInteres, referenciaUF, mesesGarantizados);
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
  tasaInteres: number = TASAS_INTERES.RETIRO_PROGRAMADO,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO,
  opciones: OpcionesProyeccionRP = {}
): ResultadoRetiroProgramado {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const { rentabilidadRealAnual = ESCENARIOS_RENTABILIDAD_RP.base.rentabilidadRealAnual, anoCalculo = Number(referenciaUF.fecha.slice(0, 4)) } = opciones;
  if (!Number.isFinite(fondosCausante) || fondosCausante < 0) throw new RangeError('Fondos deben ser finitos y no negativos');
  if (![tasaInteres, rentabilidadRealAnual].every(tasa => Number.isFinite(tasa) && tasa > -1)) throw new RangeError('Tasas inválidas');
  if (!Number.isInteger(anoCalculo) || anoCalculo < 2020 || anoCalculo > 9999) throw new RangeError('Año de cálculo inválido');
  for (const ben of beneficiarios) {
    if (!Number.isInteger(ben.edad) || ben.edad < 0 || ben.edad > 110 || !['M', 'F'].includes(ben.sexo)
      || !Number.isFinite(ben.porcentajePension) || ben.porcentajePension < 0 || ben.porcentajePension > 1) throw new RangeError('Beneficiario inválido');
  }
  const proyeccion: ProyeccionRetiroProgramado[] = [];
  let saldo = fondosCausante;
  let retiroAcumulado = 0;
  // Base de reparto B y pago agregado G son magnitudes diferentes. Ver fundamento de fase 2.
  for (let ano = 0; ano <= 45; ano++) {
    const grupo = beneficiarios.map(ben => ({ ...ben, edad: ben.edad + ano })).filter(ben => ben.edad <= 110);
    const porcentajes = calcularPorcentajesBeneficiarios(grupo);
    const suma = porcentajes.reduce((total, ben) => total + ben.porcentaje, 0);
    const { cnuTotal } = calcularCNUSobrevivencia(grupo, tasaInteres, 'retiro_programado', anoCalculo + ano);
    if (!Number.isFinite(cnuTotal)) throw new RangeError('CNU fuera del dominio numérico');
    const base = cnuTotal > 0 && suma > 0 ? Math.min(saldo / cnuTotal, saldo / (12 * suma)) : 0;
    const pagos = porcentajes.map(ben => ({
      id: ben.id, tipo: ben.tipo, porcentaje: ben.porcentaje, pensionMensual: Math.round(base * ben.porcentaje)
    }));
    const retiroAnual = Math.min(saldo, base * suma * 12);
    const saldoFinal = cnuTotal > 0 ? (saldo - retiroAnual) * (1 + rentabilidadRealAnual) : saldo;
    if (!Number.isFinite(saldoFinal)) throw new RangeError('Saldo fuera del dominio numérico');
    proyeccion.push({
      año: ano + 1, edad: Math.min(...(beneficiarios.length ? beneficiarios.map(ben => ben.edad) : [edadCausante])) + ano,
      anoCalendario: anoCalculo + ano, cnu: cnuTotal, beneficiarios: grupo,
      pensionMensual: pagos.reduce((total, pago) => total + pago.pensionMensual, 0),
      pensionBaseReparto: base, pensionPorBeneficiario: pagos,
      saldoAcumulado: Math.round(saldo), retiroAcumulado: Math.round(retiroAcumulado),
      retiroAnual, saldoFinal, fase: 'normal'
    });
    saldo = saldoFinal;
    retiroAcumulado += retiroAnual;
    if (saldo <= 0 || cnuTotal <= 0) break;
  }
  const inicial = proyeccion[0];
  return {
    nombre: 'Retiro Programado Sobrevivencia (total del grupo)',
    reglasSobrevivencia: determinarPorcentajes(beneficiarios),
    referenciaUF, unidadMonetaria: 'CLP_REALES',
    pensionMensual: inicial.pensionMensual, pensionEnUF: clpAUf(inicial.pensionMensual, referenciaUF),
    pensionAnual: inicial.retiroAnual, pensionBaseReparto: inicial.pensionBaseReparto,
    cnu: inicial.cnu, tasaInteres, tasaTecnicaCNU: tasaInteres, rentabilidadRealAnual, anoCalculo,
    expectativaVida: 0, pensionPorBeneficiario: inicial.pensionPorBeneficiario,
    pensionReferencia: pensionReferenciaCausante ?? (ingresoBaseCausante !== undefined ? ingresoBaseCausante * 0.7 : undefined),
    proyeccion, advertencias: [AVISO_SIMULACION, 'Pensión principal: suma pagada al grupo. Modelo anual aproximado; no calcula un pago al causante fallecido.']
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
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoBAC {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const valorUF = referenciaUF.valor;
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
  const beneficioMensualPesos = Math.round(ufAClp(beneficioUF, referenciaUF));
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

// ==========================================
// COMPENSACIÓN POR EXPECTATIVA DE VIDA PARA MUJERES (CEV)
// Ley de Reforma Previsional / Seguro Social Previsional
// ==========================================

export interface ResultadoCompensacionMujer {
  aplica: boolean;
  beneficioUF: number;
  beneficioMensualPesos: number;
  explicacion: string;
}

/**
 * Calcula la Compensación por Diferencias de Expectativa de Vida (CEV) para Mujeres
 * Beneficio previsional legal que compensa la menor pensión derivada de las tablas
 * de mortalidad diferenciadas por sexo (mayor expectativa de vida en mujeres).
 * 
 * - Monto mínimo legal garantizado: 0,25 UF mensuales.
 * - Aplica a pensionadas mujeres de Vejez o Invalidez (sin cobertura SIS).
 * - En Sobrevivencia no aplica al causante fallecido.
 */
export function calcularCompensacionExpectativaVidaMujer(
  sexo: Sexo,
  edad: number,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO,
  tipoPension: 'vejez' | 'invalidez' | 'sobrevivencia' = 'vejez',
  cubiertoSIS: boolean = false
): ResultadoCompensacionMujer {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const valorUF = referenciaUF.valor;
  if (sexo !== 'F' || tipoPension === 'sobrevivencia' || (tipoPension === 'invalidez' && cubiertoSIS)) {
    return {
      aplica: false,
      beneficioUF: 0,
      beneficioMensualPesos: 0,
      explicacion: 'No aplica (beneficio exclusivo para mujeres pensionadas de vejez o invalidez no cubierta por SIS)'
    };
  }

  // Base mínima legal garantizada por el Seguro Social Previsional: 0,25 UF mensuales
  const beneficioUF = 0.25;
  const beneficioMensualPesos = Math.round(ufAClp(beneficioUF, referenciaUF));

  return {
    aplica: true,
    beneficioUF,
    beneficioMensualPesos,
    explicacion: `Compensación por Expectativa de Vida (Mujer) = ${beneficioUF.toFixed(2)} UF = $${beneficioMensualPesos.toLocaleString('es-CL')}/mes`
  };
}

/**
 * Calcula los beneficios adicionales completos (PGU + BAC + Compensación Mujer)
 */
export function calcularBeneficiosAdicionales(
  pensionMensual: number, 
  edad: number, 
  sexo: Sexo, 
  anosCotizados: number,
  mesesAdicionales: number = 0,
  anosResidenciaChile: number = 20,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO,
  tipoPension: 'vejez' | 'invalidez' | 'sobrevivencia' = 'vejez',
  cubiertoSIS: boolean = false
): {
  pgu?: ResultadoPGU;
  bac?: ResultadoBAC;
  bonoMujer?: ResultadoCompensacionMujer;
  totalBeneficios: number;
  pensionTotal: number;
  detalles: string[];
} {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const valorUF = referenciaUF.valor;
  const detalles: string[] = [];
  let totalBeneficios = 0;
  
  // Calcular PGU
  const pgu = calcularPGU(pensionMensual, edad, anosResidenciaChile);
  if (pgu.aplica) {
    totalBeneficios += pgu.montoMensual;
    detalles.push(`PGU: $${pgu.montoMensual.toLocaleString('es-CL')}/mes`);
  }
  
  // Calcular BAC
  const bac = calcularBAC(anosCotizados, mesesAdicionales, referenciaUF);
  if (bac.aplica) {
    totalBeneficios += bac.beneficioMensualPesos;
    detalles.push(`BAC: ${bac.beneficioUF.toFixed(2)} UF ($${bac.beneficioMensualPesos.toLocaleString('es-CL')}/mes)`);
    if (bac.topeAplicado) {
      detalles.push(`BAC: Tope máximo de 2,5 UF aplicado`);
    }
  }

  // Calcular Compensación Expectativa de Vida Mujer
  const bonoMujer = calcularCompensacionExpectativaVidaMujer(sexo, edad, referenciaUF, tipoPension, cubiertoSIS);
  if (bonoMujer.aplica) {
    totalBeneficios += bonoMujer.beneficioMensualPesos;
    detalles.push(`Bono Expectativa Vida (Mujer): ${bonoMujer.beneficioUF.toFixed(2)} UF ($${bonoMujer.beneficioMensualPesos.toLocaleString('es-CL')}/mes)`);
  }
  
  const pensionTotal = pensionMensual + totalBeneficios;
  
  return {
    pgu: pgu.aplica ? pgu : undefined,
    bac: bac.aplica ? bac : undefined,
    bonoMujer: bonoMujer.aplica ? bonoMujer : undefined,
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
 * aplicando la transcripción local de tablas de invalidez (MI-H-2020 / MI-M-2020)
 * y contemplando a los beneficiarios legales de sobrevivencia.
 * 
 * Relación estimativa de capital (CNU local aproximado; comparación en matriz de fase 4):
 * CN = Pensión_Referencia × CNU_MI(edad, sexo, tasa, beneficiarios)
 */
export function calcularCapitalNecesarioInvalidez(
  pensionReferenciaCLP: number,
  edad: number,
  sexo: Sexo,
  tasaInteres: number = 0.0367,
  beneficiarios: BeneficiarioPension[] = [],
  anoCalculo: number = 2026
): number {
  if (pensionReferenciaCLP <= 0) return 0;
  const cnuInvalidez = calcularCNU(edad, sexo, tasaInteres, beneficiarios, true, 'retiro_programado', anoCalculo);
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
 * Estima financiamiento de invalidez; no reproduce íntegramente el cálculo reglamentario.
 */
export function calcularFinanciamientoInvalidez(
  saldoPropioCLP: number,
  ingresoBaseCLP: number,
  grado: 'total' | 'parcial' = 'total',
  cubiertoSIS: boolean = true,
  edad: number = 55,
  sexo: Sexo = 'M',
  tasaInteres: number = 0.0367,
  beneficiarios: BeneficiarioPension[] = [],
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): DesgloseFinanciamientoInvalidez {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const valorUF = referenciaUF.valor;
  const porcentajeReferencia = grado === 'parcial' ? 0.50 : 0.70;
  const pensionReferenciaCLP = calcularPensionReferenciaInvalidez(ingresoBaseCLP, grado);
  const pensionReferenciaUF = clpAUf(pensionReferenciaCLP, referenciaUF);

  const capitalNecesarioCLP = calcularCapitalNecesarioInvalidez(
    pensionReferenciaCLP,
    edad,
    sexo,
    tasaInteres,
    beneficiarios, Number(referenciaUF.fecha.slice(0, 4))
  );
  const capitalNecesarioUF = clpAUf(capitalNecesarioCLP, referenciaUF);

  const aporteAdicionalSISCLP = calcularAporteAdicionalSIS(
    capitalNecesarioCLP,
    saldoPropioCLP,
    cubiertoSIS
  );
  const aporteAdicionalSISUF = clpAUf(aporteAdicionalSISCLP, referenciaUF);

  const saldoPropioUF = clpAUf(saldoPropioCLP, referenciaUF);
  const saldoTotalFinanciamientoCLP = cubiertoSIS 
    ? Math.max(saldoPropioCLP, capitalNecesarioCLP) 
    : saldoPropioCLP;
  const saldoTotalFinanciamientoUF = clpAUf(saldoTotalFinanciamientoCLP, referenciaUF);

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

// ==========================================
// MÓDULO ACTUARIAL DE PENSIÓN DE SOBREVIVENCIA
// Según D.L. 3.500 Art. 5, 54, 58 al 60 y Compendio SP
// ==========================================

/**
 * Calcula la Pensión de Referencia del Causante según D.L. 3.500 Art. 58
 * Equivale al 70% del Ingreso Base del afiliado fallecido
 */
export function calcularPensionReferenciaCausante(ingresoBaseCausanteCLP: number): number {
  return Math.round(Math.max(0, ingresoBaseCausanteCLP) * 0.70);
}

/**
 * Calcula el Capital Necesario (CN) actuarial de sobrevivencia
 * Relación estimativa de capital; no implementación íntegra del Anexo 7:
 * CN_sob = Σ [ Pensión_Referencia_Beneficiario_i × CNU_sob_i ] = Pensión_Ref_Causante × CNU_sob_total
 */
export function calcularCapitalNecesarioSobrevivencia(
  pensionReferenciaCausanteCLP: number,
  beneficiarios: BeneficiarioPension[],
  tasaInteres: number = 0.0367,
  anoCalculo: number = 2026
): number {
  if (pensionReferenciaCausanteCLP <= 0 || beneficiarios.length === 0) return 0;
  const { cnuTotal } = calcularCNUSobrevivencia(beneficiarios, tasaInteres, 'retiro_programado', anoCalculo);
  return Math.round(pensionReferenciaCausanteCLP * cnuTotal);
}

/**
 * Calcula el Aporte Adicional financiado por la Aseguradora del SIS en caso de sobrevivencia
 * Si el causante estaba cubierto por el SIS: AA = max(0, CN_sob - Saldo_Causante)
 * Si el causante no estaba cubierto: AA = 0
 */
export function calcularAporteAdicionalSISSobrevivencia(
  capitalNecesarioCLP: number,
  saldoAcumuladoCLP: number,
  cubiertoSIS: boolean = true
): number {
  if (!cubiertoSIS) return 0;
  return Math.max(0, Math.round(capitalNecesarioCLP - saldoAcumuladoCLP));
}

export interface DesgloseBeneficiarioSobrevivencia {
  tipo: string;
  nombre?: string;
  edad: number;
  sexo: Sexo;
  porcentaje: number;
  porcentajeOriginal: number;
  pensionReferenciaCLP: number;
  pensionReferenciaUF: number;
}

export interface DesgloseFinanciamientoSobrevivencia {
  pensionReferenciaCausanteCLP: number;
  pensionReferenciaCausanteUF: number;
  capitalNecesarioCLP: number;
  capitalNecesarioUF: number;
  aporteAdicionalSISCLP: number;
  aporteAdicionalSISUF: number;
  saldoPropioCLP: number;
  saldoPropioUF: number;
  saldoTotalFinanciamientoCLP: number;
  saldoTotalFinanciamientoUF: number;
  cubiertoSIS: boolean;
  cnuTotalSobrevivencia: number;
  beneficiarios: DesgloseBeneficiarioSobrevivencia[];
  sumaPorcentajesOriginales: number;
  factorProrrateo: number;
}

/**
 * Calcula el financiamiento integral de la Pensión de Sobrevivencia
 */
export function calcularFinanciamientoSobrevivencia(
  saldoPropioCLP: number,
  ingresoBaseCausanteCLP: number,
  cubiertoSIS: boolean = true,
  beneficiarios: BeneficiarioPension[] = [],
  tasaInteres: number = 0.0367,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): DesgloseFinanciamientoSobrevivencia {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const valorUF = referenciaUF.valor;
  const pensionReferenciaCausanteCLP = calcularPensionReferenciaCausante(ingresoBaseCausanteCLP);
  const pensionReferenciaCausanteUF = clpAUf(pensionReferenciaCausanteCLP, referenciaUF);

  const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
  const { cnuTotal } = calcularCNUSobrevivencia(beneficiarios, tasaInteres, 'retiro_programado', Number(referenciaUF.fecha.slice(0, 4)));

  const capitalNecesarioCLP = Math.round(pensionReferenciaCausanteCLP * cnuTotal);
  const capitalNecesarioUF = clpAUf(capitalNecesarioCLP, referenciaUF);

  const aporteAdicionalSISCLP = calcularAporteAdicionalSISSobrevivencia(
    capitalNecesarioCLP,
    saldoPropioCLP,
    cubiertoSIS
  );
  const aporteAdicionalSISUF = clpAUf(aporteAdicionalSISCLP, referenciaUF);

  const saldoPropioUF = clpAUf(saldoPropioCLP, referenciaUF);
  const saldoTotalFinanciamientoCLP = cubiertoSIS 
    ? Math.max(saldoPropioCLP, capitalNecesarioCLP) 
    : saldoPropioCLP;
  const saldoTotalFinanciamientoUF = clpAUf(saldoTotalFinanciamientoCLP, referenciaUF);

  const sumaPorcentajesOriginales = porcentajes.reduce((sum, b) => sum + b.porcentajeOriginal, 0);
  const factorProrrateo = porcentajes[0]?.factorProrrateo ?? 1.0;

  const desgloseBeneficiarios: DesgloseBeneficiarioSobrevivencia[] = porcentajes.map(b => {
    const pRefCLP = Math.round(pensionReferenciaCausanteCLP * b.porcentaje);
    const pRefUF = clpAUf(pRefCLP, referenciaUF);
    return {
      tipo: b.tipo,
      nombre: b.nombre || (b.tipo === 'conyuge' ? 'Cónyuge Sobreviviente' : b.tipo === 'hijo' ? 'Hijo/a' : 'Beneficiario'),
      edad: b.edad,
      sexo: b.sexo,
      porcentaje: b.porcentaje,
      porcentajeOriginal: b.porcentajeOriginal,
      pensionReferenciaCLP: pRefCLP,
      pensionReferenciaUF: pRefUF
    };
  });

  return {
    pensionReferenciaCausanteCLP,
    pensionReferenciaCausanteUF,
    capitalNecesarioCLP,
    capitalNecesarioUF,
    aporteAdicionalSISCLP,
    aporteAdicionalSISUF,
    saldoPropioCLP,
    saldoPropioUF,
    saldoTotalFinanciamientoCLP,
    saldoTotalFinanciamientoUF,
    cubiertoSIS,
    cnuTotalSobrevivencia: cnuTotal,
    beneficiarios: desgloseBeneficiarios,
    sumaPorcentajesOriginales,
    factorProrrateo
  };
}

/**
 * Calcula Renta Vitalicia Inmediata de Sobrevivencia con Aumento Temporal (Período Aumentado)
 * Valorización estimativa de un aumento; su admisibilidad contractual requiere revisión separada.
 * 
 * FÓRMULA DE EQUIVALENCIA ACTUARIAL:
 * Fondos = P_vitalicia × CNU_sob_vitalicio + (porcentajeAumento × P_vitalicia) × CNU_sob_temporal(m)
 * P_vitalicia = Fondos / [ CNU_sob_vitalicio + porcentajeAumento × CNU_sob_temporal(m) ]
 * P_aumentada = P_vitalicia × (1 + porcentajeAumento)
 */
export function calcularRVAumentoTemporalSobrevivencia(
  fondosCausante: number,
  beneficiarios: BeneficiarioPension[],
  mesesAumento: number,
  porcentajeAumento: number,
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO,
  mesesGarantizados: number = 0
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const valorUF = referenciaUF.valor;
  const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
  const porcentajeNormalizado = normalizarAumento(porcentajeAumento);

  if (porcentajes.length === 0) {
    return presentarTotalSobrevivencia({
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
      nombre: 'Error: Sin Beneficiarios',
      pensionMensual: 0,
      pensionEnUF: clpAUf(0, referenciaUF),
      pensionAnual: 0,
      cnu: 0,
      tasaInteres,
      expectativaVida: 0,
      advertencias: ['⚠️ Debe incorporar al menos un beneficiario legal para cotizar sobrevivencia']
    });
  }

  // CNU Vitalicio de Sobrevivencia
  const { cnuTotal: cnuVitalicio } = calcularCNUSobrevivencia(beneficiarios, tasaInteres, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)));

  // CNU Temporal de Sobrevivencia para los beneficiarios durante los meses de aumento
  let cnuTemporalSobrevivencia = 0;
  for (let i = 0; i < porcentajes.length; i++) {
    const ben = porcentajes[i];
    const benOrig = ben;
    const esInvalido = !!benOrig.esInvalido;
    const cnuTempInd = calcularCNUTemporal(
      ben.edad,
      ben.sexo,
      mesesAumento,
      tasaInteres,
      esInvalido,
      'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)),
      { rol: 'beneficiario', fechaCalculo: referenciaUF.fecha, edadLimite: ben.tipo === 'hijo' && !ben.esInvalido ? (ben.esEstudiante ? 24 : 18) : 110 }
    );
    cnuTemporalSobrevivencia += cnuTempInd * ben.porcentaje;
  }

  // Divisor actuarial ponderado
  const divisor = cnuVitalicio / calcularFactorGarantizado(mesesGarantizados) + porcentajeNormalizado * cnuTemporalSobrevivencia;
  const pensionBaseMensual = divisor > 0 ? fondosCausante / divisor : 0;
  const pensionAumentadaMensual = pensionBaseMensual * (1 + (mesesAumento > 0 ? porcentajeNormalizado : 0));

  // Desglose por beneficiario para ambas fases (aumentada y posterior)
  const pensionPorBen = porcentajes.map(b => ({
    tipo: b.tipo,
    porcentaje: b.porcentaje,
    pensionMensual: Math.round(pensionAumentadaMensual * b.porcentaje),
    pensionPosterior: Math.round(pensionBaseMensual * b.porcentaje)
  }));

  const anosAumento = Math.floor(mesesAumento / 12);
  const mesesRestantes = mesesAumento % 12;
  const nombrePeriodo = (anosAumento > 0 && mesesRestantes > 0)
    ? `${anosAumento}a ${mesesRestantes}m`
    : (anosAumento > 0 ? `${anosAumento} ${anosAumento === 1 ? 'año' : 'años'}` : `${mesesAumento} meses`);

  const pct = Math.round(porcentajeNormalizado * 100);

  // Proyección anual
  const trayectoria = crearTrayectoriaTemporal(pensionBaseMensual, pensionAumentadaMensual, mesesAumento, (porcentajes[0]?.edad ?? 60), 25);
  const proyeccion = trayectoria.anual;

  return presentarTotalSobrevivencia({
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: `RV Sobrevivencia con Período Aumentado (+${pct}% por ${nombrePeriodo})`,
    pensionBaseReparto: pensionAumentadaMensual,
    pensionMensual: Math.round(pensionAumentadaMensual),
    pensionEnUF: clpAUf(Math.round(pensionAumentadaMensual), referenciaUF),
    pensionAnual: Math.round(pensionAumentadaMensual * 12),
    cnu: divisor,
    componentesCNU: { vitalicioAnual: cnuVitalicio, temporalMensual: cnuTemporalSobrevivencia, porcentajeAumento: porcentajeNormalizado, factorGarantia: calcularFactorGarantizado(mesesGarantizados), divisorTotal: divisor },
    tasaInteres,
    expectativaVida: calcularExpectativaVida(porcentajes[0]?.edad ?? 60, porcentajes[0]?.sexo ?? 'F', !!porcentajes[0]?.esInvalido, undefined, Number(referenciaUF.fecha.slice(0, 4)), 'beneficiario'),
    periodoGarantizado: mesesGarantizados || undefined,
    aumentoTemporal: {
      meses: mesesAumento,
      porcentaje: porcentajeAumento,
      pensionAumentada: Math.round(pensionAumentadaMensual),
      pensionFinal: Math.round(pensionBaseMensual)
    },
    pensionPorBeneficiario: pensionPorBen,
    proyeccion,
    proyeccionMensual: trayectoria.mensual,
    metodologiaTemporal: 'mensual_fuerza_constante_v1',
    advertencias: [
      `Fase Aumentada (+${pct}%): ${Math.round(pensionAumentadaMensual).toLocaleString('es-CL')} / mes durante ${nombrePeriodo} (${mesesAumento} meses)`,
      `Fase Vitalicia Posterior: ${Math.round(pensionBaseMensual).toLocaleString('es-CL')} / mes; revisar vigencia de derechos`,
      `Distribución a beneficiarios según Art. 58 D.L. 3.500`,
      `Art.58 define porcentajes de referencia. La admisibilidad de la cláusula bajo Art.61 bis requiere revisión profesional.`
    ]
  });
}

/**
 * Calcula la Renta Vitalicia de Sobrevivencia con Período Garantizado de Pago
 * Factor ilustrativo de garantía. No se verificó aquí la admisibilidad contractual ni acrecimientos.
 */
export function calcularRVSobrevivenciaGarantizada(
  fondos: number,
  beneficiarios: BeneficiarioPension[],
  mesesGarantizados: number = 180,
  tasaInteres: number = TASAS_INTERES.SOBREVIVENCIA,
  referenciaUF: ReferenciaUF = UF_REFERENCIA_EJEMPLO
): ResultadoEscenario {
  referenciaUF = validarReferenciaUF(referenciaUF);
  const valorUF = referenciaUF.valor;
  const { cnuTotal } = calcularCNUSobrevivencia(beneficiarios, tasaInteres, 'renta_vitalicia', Number(referenciaUF.fecha.slice(0, 4)));
  const factorAjuste = calcularFactorGarantizado(mesesGarantizados);
  const pensionBaseMensual = cnuTotal > 0 ? fondos / cnuTotal : 0;
  const pensionGarantizadaMensual = pensionBaseMensual * factorAjuste;
  
  const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
  const pensionPorBen = porcentajes.map(b => ({
    tipo: b.tipo,
    porcentaje: b.porcentaje,
    pensionMensual: Math.round(pensionGarantizadaMensual * b.porcentaje)
  }));
  
  const anosGarantizados = Math.floor(mesesGarantizados / 12);
  const mesesRestantes = mesesGarantizados % 12;
  const nombrePeriodo = (anosGarantizados > 0 && mesesRestantes > 0)
    ? `${anosGarantizados}a ${mesesRestantes}m`
    : (anosGarantizados > 0 ? `${anosGarantizados} ${anosGarantizados === 1 ? 'año' : 'años'}` : `${mesesGarantizados} meses`);

  const proyeccion: ProyeccionAnual[] = [];
  for (let ano = 1; ano <= 25; ano++) {
    const mesesCubiertos = Math.max(0, Math.min(12, mesesGarantizados - (ano - 1) * 12));
    proyeccion.push({
      año: ano,
      edad: (porcentajes[0]?.edad ?? 60) + ano - 1,
      pensionMensual: Math.round(pensionGarantizadaMensual),
      saldoAcumulado: 0,
      retiroAcumulado: 0,
      mesesGarantizados: mesesCubiertos,
      fase: mesesCubiertos > 0 && mesesCubiertos < 12 ? 'mixta' : 'normal'
    });
  }

  const ufVal = valorUF;

  return presentarTotalSobrevivencia({
    referenciaUF,
    unidadMonetaria: 'CLP_REALES',
    nombre: `RV Sobrevivencia con Período Garantizado (${nombrePeriodo})`,
    pensionBaseReparto: pensionGarantizadaMensual,
    pensionMensual: Math.round(pensionGarantizadaMensual),
    pensionEnUF: clpAUf(Math.round(pensionGarantizadaMensual), referenciaUF),
    pensionAnual: Math.round(pensionGarantizadaMensual * 12),
    cnu: factorAjuste > 0 ? cnuTotal / factorAjuste : cnuTotal,
    tasaInteres,
    expectativaVida: calcularExpectativaVida(porcentajes[0]?.edad ?? 60, porcentajes[0]?.sexo ?? 'F', !!porcentajes[0]?.esInvalido, undefined, Number(referenciaUF.fecha.slice(0, 4)), 'beneficiario'),
    periodoGarantizado: mesesGarantizados,
    pensionPorBeneficiario: pensionPorBen,
    proyeccion,
    advertencias: [
      `Período Garantizado de Pago: ${nombrePeriodo} (${mesesGarantizados} meses)`,
      `Si un beneficiario fallece durante la garantía, su cuota acrece a los demás o herederos designados`,
      `Al término de los ${nombrePeriodo}, se mantiene la pensión vitalicia bajo alícuotas del Art. 58 DL 3500`,
      `Factor ilustrativo de garantía; fuente porcentajes: Art.58. Admisibilidad de cláusulas sujeta a revisión CMF/SP.`
    ]
  });
}



/** Presentación agregada: no cambia el CNU ponderado ni las cuotas individuales.
 * Fundamentación: docs/fase-2-fundamentos.md, B (base) frente a G (grupo).
 */
function presentarTotalSobrevivencia(base: ResultadoEscenario): ResultadoEscenario {
  const suma = (base.pensionPorBeneficiario ?? []).reduce((t, b) => t + b.porcentaje, 0);
  const total = (base.pensionPorBeneficiario ?? []).reduce((t, b) => t + b.pensionMensual, 0);
  return {
    ...base, pensionBaseReparto: base.pensionBaseReparto ?? base.pensionMensual,
    pensionMensual: total, pensionAnual: base.pensionAnual * suma,
    pensionEnUF: clpAUf(total, base.referenciaUF),
    aumentoTemporal: base.aumentoTemporal && {
      ...base.aumentoTemporal, pensionAumentada: total,
      pensionFinal: (base.pensionPorBeneficiario ?? []).reduce((t, b) => t + (b.pensionPosterior ?? Math.round(base.aumentoTemporal!.pensionFinal * b.porcentaje)), 0)
    },
    proyeccion: base.proyeccion?.map(fila => ({ ...fila, pensionMensual: Math.round(fila.pensionMensual * suma) })),
    proyeccionMensual: base.proyeccionMensual?.map(fila => ({ ...fila, pensionMensual: fila.pensionMensual * suma }))
  };
}

function normalizarAumento(porcentaje: number): number {
  if (!Number.isFinite(porcentaje) || porcentaje < 0) throw new RangeError('Aumento debe ser finito y no negativo');
  return porcentaje > 1 ? porcentaje / 100 : porcentaje;
}

function validarEntradaCNU(edad: number, sexo: Sexo, tasa: number, ano: number): void {
  if (!Number.isInteger(edad) || edad < 0 || edad > 110 || !['M', 'F'].includes(sexo)) throw new RangeError('CNU anual requiere edad entera válida y sexo M/F');
  if (!Number.isFinite(tasa) || tasa <= -1 || !Number.isInteger(ano) || ano < 2020) throw new RangeError('Tasa o año CNU inválidos');
}

/** Adjunta procedencia y separa regla documentada de acreditación personal. */
export function etiquetarResultadoActuarial(resultado: ResultadoEscenario, beneficiarios: BeneficiarioPension[] = []): ResultadoEscenario {
  const reglas = determinarPorcentajes(beneficiarios);
  const limites = ['Tasas de descuento y garantías ilustrativas; sin vigencia regulatoria ni conformidad contractual acreditadas.'];
  if (resultado.nombre.startsWith('RV') && beneficiarios.some(b => b.tipo === 'hijo')) limites.push('La trayectoria de RV mantiene cuotas iniciales; cambios de derecho, invalidez parcial y acrecimientos futuros requieren revisión. El CNU temporal limita el derecho por edad, pero la trayectoria no es una liquidación legal futura.');
  return { ...resultado, reglasSobrevivencia: reglas,
    validacionActuarial: { estado: 'estimativo', fechaRevision: '2026-11-08',
      fuenteTablas: 'https://www.cmfchile.cl/normativa/ncg_495_2023.pdf', cnuVitalicio: 'aproximacion_anual_no_certificada' },
    advertencias: [...new Set([AVISO_SIMULACION, AVISO_VALIDACION_ACTUARIAL, ...limites, ...(resultado.advertencias ?? []), ...reglas.flatMap(b => b.advertenciasRegla)])]
  };
}
