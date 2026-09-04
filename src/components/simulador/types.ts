import { Sexo, TipoPension, BeneficiarioPension, AFP, ResultadoEscenario } from '@/lib/pension-calculator';

export interface AfiliadoState {
  nombre: string;
  rut: string;
  fechaNacimiento: string; // YYYY-MM-DD
  edad: number;
  sexo: Sexo;
  fondosCLP: number;
  fondosUF: number;
  anosCotizados: number;
  tipoPension: TipoPension;
  esInvalido: boolean; // Condición de invalidez calificada (aplica tablas MI-2020)
  gradoInvalidez?: 'total' | 'parcial';
  cubiertoSIS?: boolean; // Cobertura del Seguro de Invalidez y Sobrevivencia (D.L. 3.500)
  ingresoBaseCLP?: number; // Remuneración imponible promedio últimos 10 años (CLP)
  ingresoBaseUF?: number; // Ingreso base en UF
  etapaDictamen?: 'transitoria' | 'definitiva'; // Primer dictamen (transitoria 3 años) o definitivo
  tieneConyuge: boolean;
  fechaNacimientoConyuge?: string; // YYYY-MM-DD
  edadConyuge: number;
  sexoConyuge: Sexo;
  beneficiarios: BeneficiarioPension[];
  conAsesor: boolean; // 1.5% RV / 1.2% RP
}

export interface InvalidezFinanciamientoInfo {
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
  porcentajeReferencia: number; // 0.70 o 0.50
}

export interface BeneficiarioSobrevivenciaInfo {
  tipo: string;
  nombre?: string;
  edad: number;
  sexo: Sexo;
  porcentaje: number;
  porcentajeOriginal: number;
  pensionReferenciaCLP: number;
  pensionReferenciaUF: number;
}

export interface SobrevivenciaFinanciamientoInfo {
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
  beneficiarios: BeneficiarioSobrevivenciaInfo[];
  sumaPorcentajesOriginales: number;
  factorProrrateo: number;
}

export interface CláusulasState {
  mesesGarantizados: number;
  mesesAumento: number;
  porcentajeAumento: number; // 0.20 a 1.00
  afpSeleccionada: AFP;
  incluirPGU: boolean;
  incluirBAC: boolean;
}

export type ModalidadCotizacionTipo = 
  | 'retiro_programado' 
  | 'renta_vitalicia_simple' 
  | 'rv_garantizada' 
  | 'rv_aumento_temporal' 
  | 'rv_combinada';

export interface ModalidadConfig {
  id: string;
  tipo: ModalidadCotizacionTipo;
  nombre: string;
  descripcion?: string;
  mesesGarantizados?: number;
  mesesAumento?: number;
  porcentajeAumento?: number;
  activa: boolean;
  esPersonalizada?: boolean;
}

export interface CotizacionItemResultado {
  config: ModalidadConfig;
  resultado: ResultadoEscenario;
  pguMensual: number;
  bacMensual: number;
  totalConBeneficiosCLP: number;
  totalConBeneficiosUF: number;
}

export interface CompaniasRankingItem {
  nombre: string;
  rating: string;
  tasaVejez: number;
  pensionUF: number;
  pensionCLP: number;
}
