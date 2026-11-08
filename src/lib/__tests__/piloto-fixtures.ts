import type { DatosPiloto } from '../piloto.ts';

/** Casos sintéticos y fechados; no contienen datos de un cliente. */
export function datosPiloto(cambios: Partial<DatosPiloto> = {}): DatosPiloto {
  return {
    caso: 'PILOTO-001', datosFicticios: true, fechaValoracion: '2026-11-08',
    edad: 65, sexo: 'M', fondos: 80000000,
    referenciaUF: { valor: 45000.13, fecha: '2026-11-08', fuente: 'Supuesto ficticio para regresión' },
    tasaTecnicaCNU: .0367, tasaRV: .0282, escenarioRP: 'base', beneficiarios: [], ...cambios
  };
}
export function grupoPiloto(): DatosPiloto['beneficiarios'] {
  return [
    { id: 'c', tipo: 'conyuge', edad: 62, sexo: 'F', porcentajePension: 0, idsHijosComunes: ['h'] },
    { id: 'h', tipo: 'hijo', edad: 12, sexo: 'M', porcentajePension: 0, esEstudiante: false }
  ];
}
