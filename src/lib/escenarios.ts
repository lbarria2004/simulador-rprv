/** Configuraciones ficticias. Las cláusulas se comparan, pero nunca se valoran.
 * No reutilizar ModalidadConfig del cotizador histórico: admite ofertas manuales.
 */
import { calcularPiloto, validarDatosPiloto, ErrorPiloto, type DatosPiloto, type MontoPiloto, type ResultadoPiloto } from './piloto.ts';

export const MAX_ESCENARIOS = 12;
export const CATALOGO_MODALIDADES = [
  { id: 'retiro_programado', nombre: 'Retiro Programado', calculable: true, garantia: false, aumento: false, motivo: 'RP simple estimativo. CNU aproximado y validación especializada pendiente.' },
  { id: 'renta_vitalicia_simple', nombre: 'RV inmediata simple', calculable: true, garantia: false, aumento: false, motivo: 'RV inmediata teórica estimativa, sin compañía ni oferta comercial.' },
  { id: 'rv_garantizada', nombre: 'RV con período garantizado', calculable: false, garantia: true, aumento: false, motivo: 'M16–M17: pendientes factores de garantía, pagos por fallecimiento y condiciones contractuales.' },
  { id: 'rv_aumento_temporal', nombre: 'RV con aumento temporal', calculable: false, garantia: false, aumento: true, motivo: 'M18–M19: pendientes valoración temporal, transición de pagos y elegibilidad normativa.' },
  { id: 'rv_combinada', nombre: 'RV combinada', calculable: false, garantia: true, aumento: true, motivo: 'M16–M19/M20: pendiente validar la interacción de garantía y aumento; no se multiplican factores históricos.' }
] as const;
export type ModalidadEscenario = typeof CATALOGO_MODALIDADES[number]['id'];
export interface ConfiguracionEscenario {
  id: string;
  nombre: string;
  modalidad: ModalidadEscenario;
  mesesGarantizados?: number;
  mesesAumento?: number;
  /** Porcentaje, no fracción: 50 significa +50%. No es un factor contractual. */
  porcentajeAumento?: number;
}
export interface SeleccionEscenarios { escenarios: ConfiguracionEscenario[]; seleccionados: string[] }
export interface MontoEscenario { config: ConfiguracionEscenario; monto: MontoPiloto }
export interface ComparacionEscenarios { piloto: ResultadoPiloto; cotizaciones: MontoEscenario[] }

export function modalidadEscenario(id: ModalidadEscenario) {
  return CATALOGO_MODALIDADES.find(m => m.id === id)!;
}
export function escenariosIniciales(): SeleccionEscenarios {
  return { escenarios: [
    { id: 'rp-base', nombre: 'Retiro Programado', modalidad: 'retiro_programado' },
    { id: 'rv-base', nombre: 'Renta Vitalicia teórica', modalidad: 'renta_vitalicia_simple' }
  ], seleccionados: ['rp-base', 'rv-base'] };
}
function objeto(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ErrorPiloto('Se requiere un objeto de escenario.');
  return value as Record<string, unknown>;
}
function claves(d: Record<string, unknown>, permitidas: string[]) {
  if (Object.keys(d).some(k => !permitidas.includes(k))) throw new ErrorPiloto('Campos fuera del contrato de escenarios; no se admiten tasas comerciales, estados manuales ni importes.', 'FUNCION_RESTRINGIDA', 403);
}
function numero(v: unknown, min: number, max: number, nombre: string, entero = false) {
  if (typeof v !== 'number' || !Number.isFinite(v) || v < min || v > max || (entero && !Number.isInteger(v))) throw new ErrorPiloto(`${nombre}: indique ${entero ? 'un entero' : 'un número'} entre ${min} y ${max}.`);
  return v;
}
/** Valida configuración; no autoriza cálculos. Límites técnicos, no límites legales. */
export function validarConfiguracionEscenario(entrada: unknown): ConfiguracionEscenario {
  const e = objeto(entrada);
  const m = CATALOGO_MODALIDADES.find(m => m.id === e.modalidad);
  if (!m) throw new ErrorPiloto('Modalidad desconocida o fuera del catálogo.', 'FUNCION_RESTRINGIDA', 403);
  claves(e, ['id', 'nombre', 'modalidad', ...(m.garantia ? ['mesesGarantizados'] : []), ...(m.aumento ? ['mesesAumento', 'porcentajeAumento'] : [])]);
  if (typeof e.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(e.id)) throw new ErrorPiloto('Identificador de escenario inválido.');
  if (typeof e.nombre !== 'string' || !/^[A-Za-zÀ-ÖØ-öø-ÿ0-9 _()-]{1,60}$/.test(e.nombre) || !e.nombre.trim()) throw new ErrorPiloto('Nombre ficticio: de 1 a 60 letras, números, espacios, guiones o paréntesis.');
  const config: ConfiguracionEscenario = { id: e.id, nombre: e.nombre.trim(), modalidad: m.id };
  if (m.garantia) config.mesesGarantizados = numero(e.mesesGarantizados, 1, 360, 'Período garantizado (meses)', true);
  if (m.aumento) {
    config.mesesAumento = numero(e.mesesAumento, 1, 120, 'Duración del aumento (meses)', true);
    config.porcentajeAumento = numero(e.porcentajeAumento, .01, 100, 'Aumento (%)');
    if (Number(config.porcentajeAumento.toFixed(2)) !== config.porcentajeAumento) throw new ErrorPiloto('Aumento: máximo dos decimales.');
  }
  return config;
}
export function validarListaEscenarios(entrada: unknown): ConfiguracionEscenario[] {
  if (!Array.isArray(entrada) || !entrada.length || entrada.length > MAX_ESCENARIOS) throw new ErrorPiloto(`Seleccione entre 1 y ${MAX_ESCENARIOS} escenarios.`);
  const escenarios = entrada.map(validarConfiguracionEscenario);
  if (new Set(escenarios.map(e => e.id)).size !== escenarios.length) throw new ErrorPiloto('Los escenarios deben tener identificadores únicos.');
  return escenarios;
}
/** Única autorización de modalidades para API y PDF. No confía en flags del cliente. */
export function leerSolicitudEscenarios(body: unknown, reporte = false): { datos: DatosPiloto; escenarios: ConfiguracionEscenario[] } {
  const s = objeto(body);
  claves(s, reporte ? ['datos', 'escenarios'] : ['tipo', 'datos', 'escenarios']);
  if (!reporte && s.tipo !== 'comparacion_escenarios') throw new ErrorPiloto('Tipo de comparación no habilitado.', 'FUNCION_RESTRINGIDA', 403);
  const escenarios = validarListaEscenarios(s.escenarios);
  if (escenarios.some(e => !modalidadEscenario(e.modalidad).calculable)) throw new ErrorPiloto('Selección bloqueada: garantías, aumentos y combinaciones pendientes de validación actuarial. No se calculan pensiones ni PDF, tampoco parcialmente.', 'CLAUSULA_NO_VALIDADA', 403);
  return { datos: validarDatosPiloto(s.datos), escenarios };
}
export function calcularComparacionEscenarios(body: unknown, reporte = false): ComparacionEscenarios {
  const { datos, escenarios } = leerSolicitudEscenarios(body, reporte);
  const piloto = calcularPiloto(datos);
  return { piloto, cotizaciones: escenarios.map(config => ({ config, monto: piloto.comparacion[config.modalidad === 'retiro_programado' ? 'rp' : 'rv'] })) };
}
