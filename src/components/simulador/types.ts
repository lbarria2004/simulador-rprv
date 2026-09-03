import { Sexo, TipoPension, BeneficiarioPension, AFP, ResultadoEscenario } from '@/lib/pension-calculator';

export interface AfiliadoState {
  nombre: string;
  rut: string;
  edad: number;
  sexo: Sexo;
  fondosCLP: number;
  fondosUF: number;
  anosCotizados: number;
  tipoPension: TipoPension;
  tieneConyuge: boolean;
  edadConyuge: number;
  sexoConyuge: Sexo;
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

export interface CompaniasRankingItem {
  nombre: string;
  rating: string;
  tasaVejez: number;
  pensionUF: number;
  pensionCLP: number;
}
