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

// ==========================================
// TIPOS E INTERFACES
// ==========================================

export type Sexo = 'M' | 'F';
export type TipoPension = 'vejez' | 'invalidez' | 'sobrevivencia';
export type ModalidadPension = 'retiro_programado' | 'renta_vitalicia';
export type GradoInvalidez = 'total' | 'total_2_3' | 'parcial';

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

export interface BeneficiarioPension {
  tipo: 'conyuge' | 'conviviente' | 'hijo' | 'padre' | 'madre';
  edad: number;
  sexo: Sexo;
  porcentajePension: number;
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
export const PGU = {
  MONTO_BASE: 224004,
  TOPE_INGRESO: 1054000
} as const;

// ==========================================
// TABLAS DE MORTALIDAD TM-2020
// CB-H-2020 para hombres (Cargas de Beneficiarios - Hombres)
// B-M-2020 para mujeres (Beneficiarios - Mujeres)
// I-H-2020 e I-M-2020 para inválidos
// ==========================================

export const TABLA_CB_H_2020: Record<number, number> = {
  0: 0.006154, 1: 0.000331, 2: 0.000200, 3: 0.000163, 4: 0.000139,
  5: 0.000127, 6: 0.000118, 7: 0.000114, 8: 0.000112, 9: 0.000111,
  10: 0.000116, 11: 0.000130, 12: 0.000155, 13: 0.000195, 14: 0.000255,
  15: 0.000344, 16: 0.000457, 17: 0.000581, 18: 0.000692, 19: 0.000771,
  20: 0.000822, 21: 0.000855, 22: 0.000882, 23: 0.000906, 24: 0.000923,
  25: 0.000946, 26: 0.000977, 27: 0.001019, 28: 0.001054, 29: 0.001078,
  30: 0.001100, 31: 0.001134, 32: 0.001181, 33: 0.001227, 34: 0.001261,
  35: 0.001287, 36: 0.001312, 37: 0.001350, 38: 0.001400, 39: 0.001463,
  40: 0.001528, 41: 0.001599, 42: 0.001671, 43: 0.001750, 44: 0.001817,
  45: 0.001887, 46: 0.001961, 47: 0.002069, 48: 0.002200, 49: 0.002361,
  50: 0.002532, 51: 0.002700, 52: 0.002849, 53: 0.002986, 54: 0.003412,
  55: 0.003834, 56: 0.004264, 57: 0.004709, 58: 0.005168, 59: 0.005635,
  60: 0.006097, 61: 0.006550, 62: 0.007003, 63: 0.007490, 64: 0.008083,
  65: 0.008874, 66: 0.009942, 67: 0.011303, 68: 0.012916, 69: 0.014716,
  70: 0.016636, 71: 0.018630, 72: 0.020684, 73: 0.022820, 74: 0.025095,
  75: 0.027591, 76: 0.030421, 77: 0.033701, 78: 0.037531, 79: 0.041974,
  80: 0.047053, 81: 0.052766, 82: 0.059097, 83: 0.066038, 84: 0.073594,
  85: 0.081792, 86: 0.090667, 87: 0.100267, 88: 0.110644, 89: 0.121853,
  90: 0.133946, 91: 0.146940, 92: 0.160891, 93: 0.175894, 94: 0.192038,
  95: 0.209426, 96: 0.227967, 97: 0.247762, 98: 0.268848, 99: 0.291255,
  100: 0.315002, 101: 0.340099, 102: 0.366537, 103: 0.394293, 104: 0.423326,
  105: 0.453570, 106: 0.483734, 107: 0.514750, 108: 0.546470, 109: 0.578719,
  110: 1.000000
};

export const TABLA_B_M_2020: Record<number, number> = {
  0: 0.005207, 1: 0.000268, 2: 0.000183, 3: 0.000144, 4: 0.000123,
  5: 0.000111, 6: 0.000102, 7: 0.000096, 8: 0.000092, 9: 0.000090,
  10: 0.000093, 11: 0.000104, 12: 0.000120, 13: 0.000146, 14: 0.000184,
  15: 0.000223, 16: 0.000251, 17: 0.000268, 18: 0.000283, 19: 0.000291,
  20: 0.000300, 21: 0.000306, 22: 0.000316, 23: 0.000323, 24: 0.000325,
  25: 0.000319, 26: 0.000319, 27: 0.000329, 28: 0.000350, 29: 0.000371,
  30: 0.000392, 31: 0.000413, 32: 0.000444, 33: 0.000478, 34: 0.000511,
  35: 0.000547, 36: 0.000591, 37: 0.000647, 38: 0.000701, 39: 0.000752,
  40: 0.000805, 41: 0.000868, 42: 0.000940, 43: 0.001018, 44: 0.001107,
  45: 0.001206, 46: 0.001315, 47: 0.001420, 48: 0.001528, 49: 0.001649,
  50: 0.001789, 51: 0.001927, 52: 0.002140, 53: 0.002299, 54: 0.002458,
  55: 0.002644, 56: 0.002859, 57: 0.003090, 58: 0.003327, 59: 0.003581,
  60: 0.003883, 61: 0.004262, 62: 0.004733, 63: 0.005295, 64: 0.005939,
  65: 0.006647, 66: 0.007397, 67: 0.008187, 68: 0.009031, 69: 0.009941,
  70: 0.010928, 71: 0.012009, 72: 0.013221, 73: 0.014602, 74: 0.016187,
  75: 0.018012, 76: 0.020121, 77: 0.022564, 78: 0.025386, 79: 0.028615,
  80: 0.032266, 81: 0.036339, 82: 0.040838, 83: 0.045792, 84: 0.051262,
  85: 0.057336, 86: 0.064119, 87: 0.071721, 88: 0.080243, 89: 0.089768,
  90: 0.100358, 91: 0.112188, 92: 0.125167, 93: 0.139302, 94: 0.154590,
  95: 0.171021, 96: 0.188599, 97: 0.207367, 98: 0.227259, 99: 0.248101,
  100: 0.269652, 101: 0.291802, 102: 0.314360, 103: 0.337119, 104: 0.359868,
  105: 0.382398, 106: 0.403098, 107: 0.423059, 108: 0.442133, 109: 0.460204,
  110: 1.000000
};

// Tabla de mortalidad para inválidos (I-H-2020 e I-M-2020)
export const TABLA_I_H_2020: Record<number, number> = {
  18: 0.0125, 19: 0.0132, 20: 0.0140, 21: 0.0148, 22: 0.0157,
  23: 0.0166, 24: 0.0176, 25: 0.0187, 26: 0.0199, 27: 0.0212,
  28: 0.0226, 29: 0.0241, 30: 0.0257, 31: 0.0274, 32: 0.0293,
  33: 0.0313, 34: 0.0335, 35: 0.0359, 36: 0.0385, 37: 0.0413,
  38: 0.0443, 39: 0.0475, 40: 0.0510, 41: 0.0548, 42: 0.0589,
  43: 0.0633, 44: 0.0681, 45: 0.0733, 46: 0.0789, 47: 0.0850,
  48: 0.0915, 49: 0.0986, 50: 0.1063, 51: 0.1146, 52: 0.1236,
  53: 0.1333, 54: 0.1438, 55: 0.1551, 56: 0.1673, 57: 0.1805,
  58: 0.1947, 59: 0.2100, 60: 0.2264, 61: 0.2441, 62: 0.2631,
  63: 0.2835, 64: 0.3054, 65: 0.3289, 66: 0.3540, 67: 0.3810,
  68: 0.4098, 69: 0.4407, 70: 0.4737, 71: 0.5090, 72: 0.5467,
  73: 0.5868, 74: 0.6296, 75: 0.6751, 76: 0.7234, 77: 0.7747,
  78: 0.8290, 79: 0.8865, 80: 0.9472, 81: 1.0000
};

export const TABLA_I_M_2020: Record<number, number> = {
  18: 0.0095, 19: 0.0101, 20: 0.0108, 21: 0.0115, 22: 0.0123,
  23: 0.0131, 24: 0.0140, 25: 0.0149, 26: 0.0159, 27: 0.0170,
  28: 0.0182, 29: 0.0195, 30: 0.0209, 31: 0.0224, 32: 0.0240,
  33: 0.0257, 34: 0.0276, 35: 0.0296, 36: 0.0318, 37: 0.0342,
  38: 0.0368, 39: 0.0396, 40: 0.0426, 41: 0.0459, 42: 0.0494,
  43: 0.0533, 44: 0.0574, 45: 0.0619, 46: 0.0668, 47: 0.0720,
  48: 0.0777, 49: 0.0838, 50: 0.0904, 51: 0.0975, 52: 0.1052,
  53: 0.1135, 54: 0.1224, 55: 0.1320, 56: 0.1424, 57: 0.1536,
  58: 0.1656, 59: 0.1786, 60: 0.1925, 61: 0.2075, 62: 0.2236,
  63: 0.2409, 64: 0.2595, 65: 0.2794, 66: 0.3008, 67: 0.3237,
  68: 0.3483, 69: 0.3746, 70: 0.4028, 71: 0.4329, 72: 0.4651,
  73: 0.4994, 74: 0.5360, 75: 0.5750, 76: 0.6164, 77: 0.6604,
  78: 0.7071, 79: 0.7566, 80: 0.8090, 81: 1.0000
};

// ==========================================
// FUNCIONES DE CÁLCULO ACTUARIAL
// ==========================================

/**
 * Obtiene la tasa de mortalidad (qx) para una edad y sexo
 */
export function getQx(edad: number, sexo: Sexo, esInvalido: boolean = false): number {
  const edadValida = Math.max(0, Math.min(edad, 110));
  
  if (esInvalido) {
    const edadMin = 18;
    const edadInv = Math.max(edadMin, Math.min(edadValida, 81));
    if (sexo === 'M') {
      return TABLA_I_H_2020[edadInv] ?? TABLA_CB_H_2020[edadValida] ?? 1.0;
    } else {
      return TABLA_I_M_2020[edadInv] ?? TABLA_B_M_2020[edadValida] ?? 1.0;
    }
  }
  
  return sexo === 'M' 
    ? (TABLA_CB_H_2020[edadValida] ?? 1.0)
    : (TABLA_B_M_2020[edadValida] ?? 1.0);
}

/**
 * Calcula el número de sobrevivientes lx a una edad dada
 */
export function calcularLx(edadObjetivo: number, sexo: Sexo, esInvalido: boolean = false): number {
  let lx = 100000;
  const edadMinima = esInvalido ? 18 : 0;
  
  for (let edad = edadMinima; edad < edadObjetivo; edad++) {
    lx = lx * (1 - getQx(edad, sexo, esInvalido));
  }
  return lx;
}

/**
 * Calcula la expectativa de vida
 */
export function calcularExpectativaVida(edad: number, sexo: Sexo, esInvalido: boolean = false): number {
  let expectativa = 0;
  let probSupervivencia = 1;
  const maxEdad = esInvalido ? 81 : 110;
  
  for (let t = 1; t <= (maxEdad - edad); t++) {
    probSupervivencia *= (1 - getQx(edad + t - 1, sexo, esInvalido));
    expectativa += probSupervivencia;
  }
  
  return Math.round(expectativa * 10) / 10;
}

/**
 * Calcula el Capital Necesario Unitario (CNU) - Versión básica para un individuo
 * 
 * FÓRMULA OFICIAL (Nota Técnica N°5 SP):
 * CNU = Σ [lx+t / lx] × [1 / (1+i)^(t+0.5)] × 12
 */
export function calcularCNU(
  edad: number,
  sexo: Sexo,
  tasaInteres: number,
  beneficiarios?: BeneficiarioPension[],
  esInvalido: boolean = false
): number {
  const lxInicial = calcularLx(edad, sexo, esInvalido);
  let cnu = 0;
  const maxEdad = esInvalido ? 81 : 110;
  
  // CNU del titular
  for (let t = 0; t <= (maxEdad - edad); t++) {
    const lxFutura = calcularLx(edad + t, sexo, esInvalido);
    const factorSupervivencia = lxFutura / lxInicial;
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, t + 0.5);
    cnu += factorSupervivencia * factorDescuento;
  }
  
  // Agregar CNU de beneficiarios (para vejez con cargas)
  if (beneficiarios && beneficiarios.length > 0) {
    for (const ben of beneficiarios) {
      // CNU de carga: beneficios por sobrevivencia del beneficiario tras fallecimiento del titular
      const cnuBen = calcularCNUSobrevivenciaBeneficiario(
        edad, sexo, tasaInteres,
        ben.edad, ben.sexo, ben.porcentajePension, esInvalido
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
  esInvalidoTitular: boolean = false
): number {
  const lxTitular = calcularLx(edadTitular, sexoTitular, esInvalidoTitular);
  const lxBeneficiario = calcularLx(edadBeneficiario, sexoBeneficiario, false);
  let cnu = 0;
  const maxEdad = Math.max(110 - edadTitular, 110 - edadBeneficiario);
  
  for (let t = 0; t <= maxEdad; t++) {
    // Probabilidad de que el titular haya fallecido en el año t
    const lxTitularFutura = calcularLx(edadTitular + t, sexoTitular, esInvalidoTitular);
    const probTitularFallecido = 1 - (lxTitularFutura / lxTitular);
    
    // Probabilidad de que el beneficiario esté vivo en el año t
    const lxBeneficiarioFutura = calcularLx(edadBeneficiario + t, sexoBeneficiario, false);
    const probBeneficiarioVivo = lxBeneficiarioFutura / lxBeneficiario;
    
    // Probabilidad conjunta: titular fallecido y beneficiario vivo
    const probConjunta = probTitularFallecido * probBeneficiarioVivo;
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, t + 0.5);
    
    cnu += probConjunta * factorDescuento * porcentaje;
  }
  
  return cnu;
}

/**
 * Calcula el CNU individual para un beneficiario de sobrevivencia
 * (Cuando el causante YA falleció - pensión de sobrevivencia)
 * 
 * Fórmula: CNU = Σ [lx+t / lx] × [1 / (1+i)^(t+0.5)] × 12
 */
export function calcularCNUIndividual(
  edad: number,
  sexo: Sexo,
  tasaInteres: number
): number {
  const lxInicial = calcularLx(edad, sexo, false);
  let cnu = 0;
  
  for (let t = 0; t <= (110 - edad); t++) {
    const lxFutura = calcularLx(edad + t, sexo, false);
    const factorSupervivencia = lxFutura / lxInicial;
    const factorDescuento = 1 / Math.pow(1 + tasaInteres, t + 0.5);
    cnu += factorSupervivencia * factorDescuento;
  }
  
  return cnu * 12;
}

// ==========================================
// CÁLCULO PENSIÓN DE VEJEZ
// ==========================================

export function calcularRetiroProgramado(
  fondos: number,
  edad: number,
  sexo: Sexo,
  tasaInteres: number = TASAS_INTERES.RETIRO_PROGRAMADO,
  beneficiarios?: BeneficiarioPension[]
): ResultadoEscenario {
  const cnu = calcularCNU(edad, sexo, tasaInteres, beneficiarios);
  const pensionMensual = fondos / cnu;
  const expectativaVida = calcularExpectativaVida(edad, sexo);
  
  const proyeccion: ProyeccionAnual[] = [];
  let saldo = fondos;
  let retiroAcumulado = 0;
  
  for (let año = 0; año <= Math.min(45, 110 - edad); año++) {
    const edadActual = edad + año;
    const cnuAnual = calcularCNU(edadActual, sexo, tasaInteres);
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
    nombre: 'Retiro Programado',
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
  beneficiarios?: BeneficiarioPension[]
): ResultadoEscenario {
  const cnu = calcularCNU(edad, sexo, tasaInteres, beneficiarios);
  const primaSeguro = fondos * 0.03;
  const fondoDisponible = fondos - primaSeguro;
  const pensionMensual = fondoDisponible / cnu;
  const expectativaVida = calcularExpectativaVida(edad, sexo);
  
  return {
    nombre: 'Renta Vitalicia Inmediata',
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
  beneficiarios?: BeneficiarioPension[]
): ResultadoEscenario {
  const rvBase = calcularRVInmediata(fondos, edad, sexo, tasaInteres, beneficiarios);
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
  beneficiarios?: BeneficiarioPension[]
): ResultadoEscenario {
  const porcentajeNormalizado = porcentajeAumento > 1 ? porcentajeAumento / 100 : porcentajeAumento;
  const rvBase = calcularRVInmediata(fondos, edad, sexo, tasaInteres, beneficiarios);
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
    nombre: `RV con Aumento ${porcentajeAumento > 1 ? porcentajeAumento : porcentajeAumento * 100}% por ${nombrePeriodo}`,
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
      `Pensión después del período: ${formatearPesos(pensionBaseAjustada)}`
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
  beneficiarios?: BeneficiarioPension[]
): ResultadoEscenario {
  const porcentajeNormalizado = porcentajeAumento > 1 ? porcentajeAumento / 100 : porcentajeAumento;
  const rvBase = calcularRVInmediata(fondos, edad, sexo, tasaInteres, beneficiarios);
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
  const primaSeguro = fondos * 0.03;
  const fondoDisponible = fondos - primaSeguro;
  const pensionMensual = fondoDisponible / cnu;
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
  
  // Contar tipos de beneficiarios para validar reglas
  const tieneHijos = beneficiarios.some(b => b.tipo === 'hijo');
  const tieneConyuge = beneficiarios.some(b => b.tipo === 'conyuge');
  const tieneConviviente = beneficiarios.some(b => b.tipo === 'conviviente');
  const tieneOtrosBeneficiarios = tieneConyuge || tieneConviviente || tieneHijos;
  
  // Usar los porcentajes asignados por el usuario (porcentajePension)
  // Si el usuario no asignó porcentaje, usar el teórico según normativa
  for (const ben of beneficiarios) {
    let porcentajeOriginal = ben.porcentajePension; // Usar el porcentaje asignado por el usuario
    
    // Si el usuario no asignó porcentaje (es 0), calcular el teórico según normativa
    if (!porcentajeOriginal || porcentajeOriginal === 0) {
      switch (ben.tipo) {
        case 'conyuge':
          porcentajeOriginal = tieneHijos 
            ? PORCENTAJES_SOBREVIVENCIA.CONYUGE_CON_HIJOS 
            : PORCENTAJES_SOBREVIVENCIA.CONYUGE_SIN_HIJOS;
          break;
          
        case 'conviviente':
          porcentajeOriginal = tieneHijos 
            ? PORCENTAJES_SOBREVIVENCIA.CONVIVIENTE_CON_HIJOS 
            : PORCENTAJES_SOBREVIVENCIA.CONVIVIENTE_SIN_HIJOS;
          break;
          
        case 'hijo':
          porcentajeOriginal = PORCENTAJES_SOBREVIVENCIA.HIJO_CON_PADRE;
          break;
          
        case 'padre':
        case 'madre':
          if (!tieneOtrosBeneficiarios) {
            porcentajeOriginal = PORCENTAJES_SOBREVIVENCIA.PADRE_MADRE_SIN_OTROS;
          }
          break;
      }
    }
    
    if (porcentajeOriginal > 0) {
      resultados.push({
        tipo: ben.tipo,
        porcentaje: porcentajeOriginal, // Se ajustará después si hay prorrateo
        porcentajeOriginal,
        edad: ben.edad,
        sexo: ben.sexo,
        factorProrrateo: 1.0
      });
    }
  }
  
  // APLICAR PRORRATEO SI LA SUMA SUPERA EL 100%
  const sumaPorcentajes = resultados.reduce((sum, r) => sum + r.porcentajeOriginal, 0);
  
  if (sumaPorcentajes > 1.0) {
    // Factor de ajuste: 100% / suma_total
    const factorProrrateo = 1.0 / sumaPorcentajes;
    
    // Aplicar factor a cada beneficiario
    for (const r of resultados) {
      r.porcentaje = r.porcentajeOriginal * factorProrrateo;
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

export function calcularBeneficiosAdicionales(
  pensionMensual: number, 
  edad: number, 
  sexo: Sexo, 
  anosCotizados: number
) {
  const beneficios: { pgu?: number; bonoCotizacion?: number } = {};
  
  // PGU
  if (pensionMensual < PGU.TOPE_INGRESO) {
    const factor = pensionMensual / PGU.TOPE_INGRESO;
    beneficios.pgu = Math.round(PGU.MONTO_BASE * (1 - factor));
  }
  
  // Bono por años cotizados (0.1 UF por año)
  if (anosCotizados > 0) {
    beneficios.bonoCotizacion = Math.round(anosCotizados * 0.1 * UF_ACTUAL);
  }
  
  return Object.keys(beneficios).length > 0 ? beneficios : undefined;
}
