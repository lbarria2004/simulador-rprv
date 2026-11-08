import type { BeneficiarioPension } from './pension-calculator.ts';

export interface PorcentajeBeneficiario extends BeneficiarioPension {
  porcentajeLegal: number;
  incrementoLegal: number;
  porcentaje: number;
  porcentajeOriginal: number;
  participacionFamiliar: number;
  factorProrrateo: number;
  estadoRegla: 'documentada' | 'requiere_datos' | 'personalizada';
  advertenciasRegla: string[];
}

/** D.L. 3500 art.58. Elegibilidad acreditada no se presume certificada por el simulador.
 * Fuente y casos no resueltos: docs/fase-3-fundamentos.md.
 */
export function determinarPorcentajes(beneficiarios: BeneficiarioPension[]): PorcentajeBeneficiario[] {
  for (const b of beneficiarios) {
    if (!b || !Number.isInteger(b.edad) || b.edad < 0 || b.edad > 110 || !['M', 'F'].includes(b.sexo)) throw new RangeError('Beneficiario con edad o sexo inválidos');
    if (!['conyuge', 'conviviente', 'madre_padre_hijos_nm', 'hijo', 'padre', 'madre'].includes(b.tipo)) throw new RangeError('Tipo de beneficiario inválido');
    if (!Number.isFinite(b.porcentajePension) || b.porcentajePension < 0 || b.porcentajePension > 1) throw new RangeError('Porcentaje individual inválido');
    if (b.idsHijosComunes !== undefined && (!Array.isArray(b.idsHijosComunes) || !b.idsHijosComunes.every(id => typeof id === 'string'))) throw new RangeError('Vínculos de hijos inválidos');
    if (b.gradoInvalidez !== undefined && !['total', 'parcial'].includes(b.gradoInvalidez)) throw new RangeError('Grado de invalidez inválido');
  }
  const vigentes = beneficiarios.filter(b => b.edad < 110 && b.requisitosAcreditados !== false &&
    (b.tipo !== 'hijo' || b.esInvalido || b.edad < (b.esEstudiante ? 24 : 18)));
  const hijos = vigentes.filter(b => b.tipo === 'hijo');
  const adultos = vigentes.filter(b => ['conyuge', 'conviviente', 'madre_padre_hijos_nm'].includes(b.tipo));
  const conyuges = adultos.filter(b => b.tipo === 'conyuge');
  const comunes = (adulto: BeneficiarioPension) => adulto.idsHijosComunes === undefined ? hijos : hijos.filter(h => h.id && adulto.idsHijosComunes!.includes(h.id));
  const porcentajeAdulto = (b: BeneficiarioPension) => {
    if (b.tipo === 'conviviente') return comunes(b).length ? .5 : hijos.length ? .15 : .6;
    if (b.tipo === 'madre_padre_hijos_nm') return comunes(b).length ? .3 : .36;
    return comunes(b).length ? .5 : .6;
  };
  const hijosConIncremento = hijos.filter(h => !adultos.some(a => {
    if (a.tipo !== 'madre_padre_hijos_nm' && a.tipo !== 'conviviente') return false;
    const porcentaje = porcentajeAdulto(a);
    return (a.tipo === 'madre_padre_hijos_nm' && porcentaje === .3 || a.tipo === 'conviviente' && porcentaje === .15) && comunes(a).includes(h);
  }));
  const resultados: PorcentajeBeneficiario[] = [];
  for (const b of vigentes) {
    const avisos: string[] = [];
    let porcentajeLegal = 0;
    let incrementoLegal = 0;
    if (adultos.includes(b)) {
      if (hijos.length && b.idsHijosComunes === undefined) avisos.push('No se informaron hijos comunes: se asumen comunes para el modelo; requiere verificación.');
      porcentajeLegal = porcentajeAdulto(b) / adultos.filter(a => a.tipo === b.tipo).length;
      if (adultos.filter(a => a.tipo !== b.tipo).length) avisos.push('Concurrencia de categorías adultas: revisar acreditación y acrecimientos con especialista.');
    } else if (b.tipo === 'hijo') {
      porcentajeLegal = b.esInvalido && b.gradoInvalidez === 'parcial' && b.edad >= 24 ? .11 : .15;
      if (b.esInvalido && !b.gradoInvalidez) avisos.push('Invalidez sin grado: hipótesis de invalidez total; verificar dictamen y fecha.');
      if (!conyuges.length && hijosConIncremento.includes(b)) {
        incrementoLegal = .5 / hijosConIncremento.length;
        if (adultos.length) avisos.push('Incremento del último inciso con adultos concurrentes: revisar vínculos y excepciones con especialista.');
      }
    } else if (b.tipo === 'padre' || b.tipo === 'madre') {
      if (adultos.length || hijos.length || b.cargaFamiliarAcreditada === false) continue;
      porcentajeLegal = .5;
      if (b.cargaFamiliarAcreditada !== true) avisos.push('Se supone carga familiar; el art.10 exige acreditación al fallecimiento.');
      if (vigentes.filter(p => p.tipo === 'padre' || p.tipo === 'madre').length > 1) avisos.push('Concurrencia de padres: verificar capitales y acreditación individual.');
    }
    if (!porcentajeLegal) continue;
    const manual = b.porcentajePension > 0;
    const porcentaje = manual ? b.porcentajePension : porcentajeLegal + incrementoLegal;
    if (!Number.isFinite(porcentaje) || porcentaje < 0 || porcentaje > 1) throw new RangeError('Porcentaje individual fuera de dominio');
    if (manual) avisos.push('Porcentaje manual: no representa el porcentaje legal documentado.');
    resultados.push({ ...b, porcentajeLegal, incrementoLegal, porcentaje, porcentajeOriginal: porcentaje,
      participacionFamiliar: 0, factorProrrateo: 1,
      estadoRegla: manual ? 'personalizada' : avisos.length ? 'requiere_datos' : 'documentada', advertenciasRegla: avisos });
  }
  const total = resultados.reduce((suma, b) => suma + b.porcentaje, 0);
  for (const b of resultados) b.participacionFamiliar = total ? b.porcentaje / total : 0;
  return resultados;
}
