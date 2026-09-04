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
  tieneConyuge: boolean;
  fechaNacimientoConyuge?: string; // YYYY-MM-DD
  edadConyuge: number;
  sexoConyuge: Sexo;
  beneficiarios: BeneficiarioPension[];
  conAsesor: boolean; // 1.5% RV / 1.2% RP
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
