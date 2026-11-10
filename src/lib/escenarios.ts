/** Configuraciones de orientación: ninguna cláusula contractual se tarifica aquí. */
import { calcularPiloto, validarDatosPiloto, ErrorPiloto, AVISO_PILOTO, type DatosPiloto, type MontoPiloto } from './piloto.ts';

export const MAX_ESCENARIOS = 12;
export const CATALOGO_MODALIDADES = [
  { id: 'retiro_programado', nombre: 'Retiro Programado', calculable: true, componentes: 'M05/M10/M12/M13', motivo: 'RP simple estimativo, con las restricciones del piloto.' },
  { id: 'rv_inmediata', nombre: 'RV inmediata simple', calculable: true, componentes: 'M05/M06/M14', motivo: 'RV inmediata teórica, sin aseguradora ni oferta comercial.' },
  { id: 'rv_garantizada', nombre: 'RV con período garantizado', calculable: false, componentes: 'M16/M17/M20', motivo: 'Falta valorar todos los pagos garantizados y condiciones de beneficiarios. No se utiliza el factor g histórico.' },
  { id: 'rv_aumento', nombre: 'RV con aumento temporal', calculable: false, componentes: 'M18/M19/M20', motivo: 'Falta validar el capital de los flujos del titular y beneficiarios y su metodología contractual.' },
  { id: 'rv_combinada', nombre: 'RV combinada', calculable: false, componentes: 'M16–M20', motivo: 'Falta una metodología conjunta verificable; no se multiplican factores ilustrativos.' },
] as const;
export type ModalidadEscenario = typeof CATALOGO_MODALIDADES[number]['id'];
export interface EscenarioCotizacion {
  id: string;
  nombre: string;
  modalidad: ModalidadEscenario;
  mesesGarantizados: number;
  mesesAumento: number;
  porcentajeAumento: number;
  supuestoTasa: 'referencia' | 'sensibilidad';
  tasaSensibilidad: number | null;
  escenarioRP: 'conservador' | 'base' | 'optimista';
}
export interface ComparacionEscenarios {
  aviso: string;
  fechaValoracion: string;
  referenciaUF: DatosPiloto['referenciaUF'];
  resultados: Array<MontoPiloto & {
    id: string; nombreEscenario: string; modalidad: ModalidadEscenario;
    tasaTecnicaBase: number; supuestoTasa: EscenarioCotizacion['supuestoTasa'];
    escenarioRP: EscenarioCotizacion['escenarioRP'] | null;
  }>;
}

export function modalidadEscenario(id: ModalidadEscenario) {
  return CATALOGO_MODALIDADES.find(m => m.id === id)!;
}
function objeto(v: unknown): Record<string, unknown> {
  if (!v || typeof v !== 'object' || Array.isArray(v)) throw new ErrorPiloto('Configuración de escenario inválida.');
  return v as Record<string, unknown>;
}
function claves(v: Record<string, unknown>, permitidas: string[]) {
  if (Object.keys(v).some(k => !permitidas.includes(k))) throw new ErrorPiloto('Campo no permitido: no se aceptan tasas comerciales, resultados ni banderas de habilitación.', 'FUNCION_RESTRINGIDA', 403);
}
function numero(v: unknown, min: number, max: number, entero = false) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (entero && !Number.isInteger(v))) throw new ErrorPiloto('Parámetro numérico de escenario fuera del rango operativo.');
  return v;
}
/** Valida también borradores bloqueados, sin convertirlos en cálculos admisibles. */
export function validarEscenario(entrada: unknown): EscenarioCotizacion {
  const e = objeto(entrada);
  claves(e, ['id', 'nombre', 'modalidad', 'mesesGarantizados', 'mesesAumento', 'porcentajeAumento', 'supuestoTasa', 'tasaSensibilidad', 'escenarioRP']);
  if (typeof e.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(e.id)) throw new ErrorPiloto('Identificador de escenario inválido.');
  if (typeof e.nombre !== 'string' || !e.nombre.trim() || e.nombre.length > 60 || !/^[A-Za-z0-9 À-ÿ()_.,%+/-]+$/.test(e.nombre)) throw new ErrorPiloto('Use un nombre descriptivo de hasta 60 caracteres, sin datos personales ni etiquetas HTML.');
  if (typeof e.modalidad !== 'string' || !CATALOGO_MODALIDADES.some(m => m.id === e.modalidad)) throw new ErrorPiloto('Modalidad desconocida o heredada no habilitada.', 'FUNCION_RESTRINGIDA', 403);
  if (e.supuestoTasa !== 'referencia' && e.supuestoTasa !== 'sensibilidad') throw new ErrorPiloto('Seleccione referencia técnica del estudio o sensibilidad; no se admiten tasas comerciales.');
  if (e.supuestoTasa === 'referencia' ? e.tasaSensibilidad !== null : typeof e.tasaSensibilidad !== 'number') throw new ErrorPiloto('La sensibilidad debe ser explícita y solo corresponde al modo sensibilidad.');
  const tasaSensibilidad = e.supuestoTasa === 'sensibilidad' ? numero(e.tasaSensibilidad, 0, .1) : null;
  if (typeof e.escenarioRP !== 'string' || !['conservador', 'base', 'optimista'].includes(e.escenarioRP)) throw new ErrorPiloto('Escenario de retorno real inválido.');
  if (e.modalidad !== 'retiro_programado' && e.escenarioRP !== 'base') throw new ErrorPiloto('El retorno AFP no se aplica a la RV.');
  const garantia = numero(e.mesesGarantizados, 0, 600, true);
  const aumento = numero(e.mesesAumento, 0, 600, true);
  const porcentaje = numero(e.porcentajeAumento, 0, 100);
  const conGarantia = ['rv_garantizada', 'rv_combinada'].includes(e.modalidad);
  const conAumento = ['rv_aumento', 'rv_combinada'].includes(e.modalidad);
  if ((!conGarantia && garantia !== 0) || (!conAumento && (aumento !== 0 || porcentaje !== 0))) throw new ErrorPiloto('Una modalidad simple no puede encubrir parámetros de cláusulas.', 'FUNCION_RESTRINGIDA', 403);
  if ((conGarantia && garantia === 0) || (conAumento && (aumento === 0 || porcentaje === 0))) throw new ErrorPiloto('La cláusula requiere meses y, para aumento, porcentaje positivos.');
  return { id: e.id, nombre: e.nombre.trim().replace(/ +/g, ' '), modalidad: e.modalidad as ModalidadEscenario,
    mesesGarantizados: garantia, mesesAumento: aumento, porcentajeAumento: porcentaje,
    supuestoTasa: e.supuestoTasa, tasaSensibilidad, escenarioRP: e.escenarioRP as EscenarioCotizacion['escenarioRP'] };
}
export function validarListaEscenarios(entrada: unknown): EscenarioCotizacion[] {
  if (!Array.isArray(entrada) || !entrada.length || entrada.length > MAX_ESCENARIOS) throw new ErrorPiloto(`Seleccione entre 1 y ${MAX_ESCENARIOS} escenarios.`);
  const lista = entrada.map(validarEscenario);
  if (new Set(lista.map(e => e.id)).size !== lista.length || new Set(lista.map(e => e.nombre.toLocaleLowerCase('es-CL'))).size !== lista.length) throw new ErrorPiloto('Use identificadores y nombres únicos para comparar sin ambigüedad.');
  return lista;
}
export function escenarioInicial(id: string, modalidad: ModalidadEscenario, nombre: string): EscenarioCotizacion {
  return { id, nombre, modalidad, mesesGarantizados: ['rv_garantizada', 'rv_combinada'].includes(modalidad) ? 120 : 0,
    mesesAumento: ['rv_aumento', 'rv_combinada'].includes(modalidad) ? 36 : 0,
    porcentajeAumento: ['rv_aumento', 'rv_combinada'].includes(modalidad) ? 25 : 0,
    supuestoTasa: 'referencia', tasaSensibilidad: null, escenarioRP: 'base' };
}
/** Valida el lote completo antes de calcular: ninguna salida parcial de cláusulas. */
export function compararEscenarios(entrada: unknown): ComparacionEscenarios {
  const body = objeto(entrada);
  claves(body, ['datos', 'escenarios']);
  const d = validarDatosPiloto(body.datos), lista = validarListaEscenarios(body.escenarios);
  if (lista.some(e => !modalidadEscenario(e.modalidad).calculable)) throw new ErrorPiloto('Cláusulas pendientes de validación: solo pueden compararse sus configuraciones, sin pensiones ni PDF.', 'MODALIDAD_PENDIENTE', 403);
  const resultados = lista.map(e => {
    const rp = e.modalidad === 'retiro_programado';
    const tasaTecnicaBase = rp ? d.tasaTecnicaCNU : d.tasaRV;
    const tasa = e.supuestoTasa === 'sensibilidad' ? e.tasaSensibilidad! : tasaTecnicaBase;
    const calculo = calcularPiloto({ ...d, ...(rp ? { tasaTecnicaCNU: tasa, escenarioRP: e.escenarioRP } : { tasaRV: tasa }) });
    return { ...(rp ? calculo.comparacion.rp : calculo.comparacion.rv), id: e.id, nombreEscenario: e.nombre,
      modalidad: e.modalidad, tasaTecnicaBase, supuestoTasa: e.supuestoTasa, escenarioRP: rp ? e.escenarioRP : null };
  });
  return { aviso: AVISO_PILOTO, fechaValoracion: d.fechaValoracion, referenciaUF: d.referenciaUF, resultados };
}
