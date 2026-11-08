/** Política del piloto. No introduce fórmulas actuariales: delega en el motor verificado.
 * Fundamento: docs/piloto-decisiones.md y matriz de fase 4, M01–M27.
 */
import { calcularEscenariosRetiroProgramado, calcularRVInmediata, calcularPorcentajesBeneficiarios, ESCENARIOS_RENTABILIDAD_RP, TASAS_INTERES, type BeneficiarioPension, type EscenarioRentabilidadRP, type ResultadoEscenario, type ProyeccionRetiroProgramado } from './pension-calculator.ts';
import { validarReferenciaUF, clpAUf, type ReferenciaUF } from './moneda.ts';

export const PERFIL_PILOTO = 'piloto_interno_v1';
export const FECHA_REVISION_PILOTO = '2026-11-08';
export const AVISO_PILOTO = 'Piloto interno con datos ficticios. Estimación orientativa, sin certificación normativa. No es una oferta de AFP o aseguradora. Sin conexión con SCOMP.';
export const AVISO_TASA_RP_HISTORICA = 'El 3,67% documentado desde octubre de 2026 se usa aquí solo como hipótesis: no corresponde asumir su vigencia para esta fecha.';
export const LIMITACION_CNU = 'CNU anual aproximado: no reproduce íntegramente el Anexo 7, sus correcciones ni la cuota mortuoria. Los montos requieren validación especializada.';
export const FUENTES_PILOTO = [
  { titulo: 'SP · Anexo 7: capitales necesarios', url: 'https://www.spensiones.cl/portal/compendio/596/fo-article-7253.pdf', alcance: 'Referencia para comparar fórmulas; implementación incompleta.' },
  { titulo: 'SP / CMF · TM-2020, NCG 306 / 495', url: 'https://www.cmfchile.cl/normativa/ncg_495_2023.pdf', alcance: 'Datos cotejados; uso desde julio de 2023 por máximo seis años, sujeto a reemplazo.' },
  { titulo: 'SP · Circular 2425, 02-10-2026', url: 'https://www.spensiones.cl/apps/GetFile.php?id=001&namefile=CAFP2425.pdf', alcance: 'RP 3,67% desde 01-10-2026. No se selecciona circular por fecha ni se garantizan tasas futuras.' },
  { titulo: 'D.L. 3500 · Artículo 58', url: 'https://www.suseso.gob.cl/612/w3-propertyvalue-184728.html', alcance: 'Porcentajes sujetos a requisitos y vínculos; no acredita derechos individuales.' }
] as const;
export const RESTRICCIONES_PILOTO = [
  { id: 'clausulas', titulo: 'Garantías, aumentos y combinaciones', componentes: ['M16', 'M17', 'M18', 'M19', 'M20'], motivo: 'Factores y condiciones contractuales pendientes de validación especializada.' },
  { id: 'familia', titulo: 'Proyecciones familiares futuras', componentes: ['M07', 'M11', 'M21', 'M22'], motivo: 'Fallecimientos, pérdida de requisitos y acrecimientos no liquidados íntegramente. Con beneficiarios solo se muestran montos iniciales.' },
  { id: 'sis', titulo: 'Invalidez, sobrevivencia y SIS', componentes: ['M04', 'M23'], motivo: 'Requieren dictámenes, cobertura, ingreso base y capitales especializados. No se incorporan aportes hipotéticos al saldo.' },
  { id: 'complementos', titulo: 'Beneficios, comisiones y pensión líquida', componentes: ['M25'], motivo: 'PGU, BAC, BEV, salud y comisiones no se incluyen en este piloto.' },
  { id: 'comercial', titulo: 'Ofertas y tasas de aseguradoras', componentes: ['M14', 'M15', 'M26'], motivo: 'RV exclusivamente teórica, sin compañías, tarifas comerciales ni comparaciones de ofertas.' }
] as const;
export const CONTROLES_MATRIZ = Array.from({ length: 27 }, (_, i) => `M${String(i + 1).padStart(2, '0')}`);

export interface DatosPiloto {
  caso: string;
  datosFicticios: true;
  fechaValoracion: string;
  edad: number;
  sexo: 'M' | 'F';
  fondos: number;
  referenciaUF: ReferenciaUF;
  tasaTecnicaCNU: number;
  tasaRV: number;
  escenarioRP: EscenarioRentabilidadRP;
  beneficiarios: BeneficiarioPension[];
}
export interface MontoPiloto {
  nombre: string;
  clasificacion: 'aproximacion_documentada';
  validacionIndividual: 'pendiente_validacion_especializada';
  pensionMensual: number;
  pensionEnUF: number;
  cnu: number;
  tasaDescuento: number;
}
export interface PuntoPiloto {
  ano: number;
  edad: number;
  conservadorPension: number; basePension: number; optimistaPension: number;
  conservadorSaldo: number; baseSaldo: number; optimistaSaldo: number;
}
export interface ResultadoPiloto {
  perfil: typeof PERFIL_PILOTO;
  aviso: string;
  datos: DatosPiloto;
  supuestos: string[];
  comparacion: { rp: MontoPiloto; rv: MontoPiloto };
  escenarios: { id: EscenarioRentabilidadRP; nombre: string; rentabilidadRealAnual: number; pensionInicial: number }[];
  proyecciones: { disponibles: boolean; motivo: string; puntos: PuntoPiloto[] };
  porcentajesActuales: ReturnType<typeof calcularPorcentajesBeneficiarios>;
  restricciones: typeof RESTRICCIONES_PILOTO;
  fuentes: typeof FUENTES_PILOTO;
  fechaRevision: string;
}
export class ErrorPiloto extends RangeError {
  codigo: string;
  status: number;
  constructor(message: string, codigo = 'DATOS_INVALIDOS', status = 400) {
    super(message); this.name = 'ErrorPiloto'; this.codigo = codigo; this.status = status;
  }
}
function objeto(value: unknown): Record<string, unknown> {
  if (!value || typeof value !== 'object' || Array.isArray(value)) throw new ErrorPiloto('Se requiere un objeto de datos del piloto.');
  return value as Record<string, unknown>;
}
function claves(value: Record<string, unknown>, permitidas: string[]) {
  const extra = Object.keys(value).filter(k => !permitidas.includes(k));
  if (extra.length) throw new ErrorPiloto(`Campos fuera del piloto: ${extra.join(', ')}.`, 'FUNCION_RESTRINGIDA', 403);
}
function numero(value: unknown, min: number, max: number, nombre: string, entero = false): number {
  if (typeof value !== 'number' || !Number.isFinite(value) || value < min || value > max || (entero && !Number.isInteger(value))) throw new ErrorPiloto(`${nombre}: valor fuera del rango del piloto (${min}–${max}).`);
  return value;
}
export function validarDatosPiloto(entrada: unknown): DatosPiloto {
  const d = objeto(entrada);
  claves(d, ['caso', 'datosFicticios', 'fechaValoracion', 'edad', 'sexo', 'fondos', 'referenciaUF', 'tasaTecnicaCNU', 'tasaRV', 'escenarioRP', 'beneficiarios']);
  if (d.datosFicticios !== true) throw new ErrorPiloto('Confirme el uso de datos ficticios antes de simular.');
  if (typeof d.caso !== 'string' || !/^[A-Za-z0-9 _-]{1,40}$/.test(d.caso) || !d.caso.trim()) throw new ErrorPiloto('Use un identificador anónimo de hasta 40 letras, números, espacios o guiones.');
  if (d.sexo !== 'M' && d.sexo !== 'F') throw new ErrorPiloto('Sexo debe ser M o F.');
  const edad = numero(d.edad, d.sexo === 'M' ? 65 : 60, 90, 'Edad', true);
  const ufEntrada = objeto(d.referenciaUF);
  claves(ufEntrada, ['valor', 'fecha', 'fuente']);
  const referenciaUF = validarReferenciaUF(ufEntrada as unknown as ReferenciaUF);
  if (referenciaUF.valor < .01 || referenciaUF.valor > 1e6 || Number(referenciaUF.valor.toFixed(2)) !== referenciaUF.valor) throw new ErrorPiloto('UF fuera del formato del piloto: 0,01 a 1.000.000 CLP, hasta dos decimales.');
  if (referenciaUF.fuente.length > 160 || !/^[\x20-\x7e\u00a0-\u00ff]+$/.test(referenciaUF.fuente)) throw new ErrorPiloto('Fuente UF: máximo 160 caracteres latinos imprimibles en una línea.');
  if (d.fechaValoracion !== referenciaUF.fecha) throw new ErrorPiloto('La fecha de valoración debe coincidir con la fecha UF para mantener la base monetaria y actuarial.');
  if (referenciaUF.fecha < '2023-07-01' || referenciaUF.fecha > FECHA_REVISION_PILOTO) throw new ErrorPiloto(`Valoración fuera del piloto: entre 2023-07-01 y ${FECHA_REVISION_PILOTO}, fecha de revisión de fuentes.`);
  if (typeof d.escenarioRP !== 'string' || !['conservador', 'base', 'optimista'].includes(d.escenarioRP)) throw new ErrorPiloto('Seleccione un escenario de rentabilidad del piloto.');
  if (!Array.isArray(d.beneficiarios) || d.beneficiarios.length > 5) throw new ErrorPiloto('Grupo fuera del piloto: un cónyuge y hasta cuatro hijos comunes no inválidos.', 'FAMILIA_RESTRINGIDA', 403);
  const beneficiarios = d.beneficiarios.map((entrada): BeneficiarioPension => {
    const b = objeto(entrada);
    claves(b, ['id', 'tipo', 'edad', 'sexo', 'porcentajePension', 'esEstudiante', 'idsHijosComunes']);
    if (typeof b.tipo !== 'string' || !['conyuge', 'hijo'].includes(b.tipo) || b.porcentajePension !== 0) throw new ErrorPiloto('No se admiten este parentesco ni porcentajes manuales en el piloto.', 'FAMILIA_RESTRINGIDA', 403);
    if (typeof b.id !== 'string' || !/^[A-Za-z0-9_-]{1,40}$/.test(b.id)) throw new ErrorPiloto('Identificador de beneficiario inválido.');
    if (b.sexo !== 'M' && b.sexo !== 'F') throw new ErrorPiloto('Sexo de beneficiario inválido.');
    if (b.esEstudiante !== undefined && typeof b.esEstudiante !== 'boolean') throw new ErrorPiloto('La condición de estudios debe ser booleana.');
    const edadBen = numero(b.edad, b.tipo === 'conyuge' ? 18 : 0, b.tipo === 'conyuge' ? 100 : 23, 'Edad de beneficiario', true);
    if (b.tipo === 'hijo' && edadBen >= 18 && b.esEstudiante !== true) throw new ErrorPiloto('El hijo de 18 a 23 años requiere la hipótesis explícita de estudios con derecho. No se acredita elegibilidad.');
    if (b.tipo === 'conyuge' && b.esEstudiante !== undefined) throw new ErrorPiloto('La condición de estudios corresponde solo a hijos.');
    if (b.tipo === 'hijo' && b.idsHijosComunes !== undefined) throw new ErrorPiloto('Los vínculos comunes deben declararse en el cónyuge.');
    if (b.tipo === 'conyuge' && (!Array.isArray(b.idsHijosComunes) || !b.idsHijosComunes.every(id => typeof id === 'string'))) throw new ErrorPiloto('Declare explícitamente los vínculos comunes del cónyuge.');
    return { id: b.id, tipo: b.tipo as 'conyuge' | 'hijo', edad: edadBen, sexo: b.sexo, porcentajePension: 0,
      ...(b.tipo === 'hijo' ? { esEstudiante: b.esEstudiante === true } : { idsHijosComunes: [...b.idsHijosComunes as string[]] }) };
  });
  if (new Set(beneficiarios.map(b => b.id)).size !== beneficiarios.length) throw new ErrorPiloto('Los beneficiarios deben tener identificadores únicos.');
  const conyuges = beneficiarios.filter(b => b.tipo === 'conyuge');
  const hijos = beneficiarios.filter(b => b.tipo === 'hijo');
  if (beneficiarios.length && conyuges.length !== 1) throw new ErrorPiloto('La composición familiar requiere validación especializada y queda fuera de este piloto.', 'FAMILIA_RESTRINGIDA', 403);
  if (conyuges.length) {
    const ids = conyuges[0].idsHijosComunes!;
    if (new Set(ids).size !== hijos.length || ids.length !== hijos.length || hijos.some(h => !ids.includes(h.id!))) throw new ErrorPiloto('El piloto solo admite hijos comunes con vínculos explícitos y únicos.', 'FAMILIA_RESTRINGIDA', 403);
  }
  return { caso: d.caso.trim(), datosFicticios: true, fechaValoracion: referenciaUF.fecha, edad, sexo: d.sexo,
    fondos: numero(d.fondos, 0, 1e12, 'Saldo AFP', true), referenciaUF,
    tasaTecnicaCNU: numero(d.tasaTecnicaCNU, 0, .1, 'Tasa CNU'), tasaRV: numero(d.tasaRV, 0, .1, 'Tasa RV teórica'),
    escenarioRP: d.escenarioRP as EscenarioRentabilidadRP, beneficiarios };
}
export function leerSolicitudPiloto(body: unknown, reporte = false): DatosPiloto {
  const solicitud = objeto(body);
  claves(solicitud, reporte ? ['datos'] : ['tipo', 'datos']);
  if (!reporte && solicitud.tipo !== 'comparacion_piloto') throw new ErrorPiloto('Modalidad deshabilitada. El piloto solo admite comparación RP simple / RV inmediata teórica.', 'FUNCION_RESTRINGIDA', 403);
  return validarDatosPiloto(solicitud.datos);
}

/** Comprueba las identidades del modelo existente, sin validar una pensión normativa. */
export function verificarProyeccionPiloto(filas: ProyeccionRetiroProgramado[], fondos: number, retorno: number, edad: number, ano: number): boolean {
  const maxFilas = Math.min(45, 110 - edad) + 1;
  if (!filas.length || fondos <= 0 || filas.length > maxFilas || (filas.length < maxFilas && filas.at(-1)!.saldoFinal !== 0)) return false;
  let saldo = fondos, acumulado = 0;
  return filas.every((f, i) => {
    const valores = [f.pensionMensual, f.saldoAcumulado, f.saldoFinal, f.retiroAnual, f.retiroAcumulado, f.cnu];
    if (saldo <= 0 || !valores.every(v => Number.isFinite(v) && v >= 0) || f.cnu <= 0 || f.beneficiarios.length) return false;
    const tolerancia = Math.max(1e-7, saldo * 1e-12);
    const ok = f.año === i + 1 && f.edad === edad + i && f.anoCalendario === ano + i &&
      f.saldoAcumulado === Math.round(saldo) && f.retiroAcumulado === Math.round(acumulado) &&
      f.retiroAnual <= saldo + tolerancia && f.pensionMensual === Math.round(f.retiroAnual / 12) &&
      Math.abs(f.retiroAnual - Math.min(saldo, saldo / f.cnu * 12)) <= tolerancia &&
      Math.abs(f.saldoFinal - (saldo - f.retiroAnual) * (1 + retorno)) <= tolerancia;
    saldo = f.saldoFinal; acumulado += f.retiroAnual;
    return ok;
  });
}
function monto(r: ResultadoEscenario, nombre: string): MontoPiloto {
  if (![r.pensionMensual, r.pensionEnUF, r.cnu, r.tasaInteres].every(Number.isFinite) || r.cnu <= 0 || r.pensionMensual < 0 || r.pensionEnUF !== clpAUf(r.pensionMensual, r.referenciaUF)) throw new ErrorPiloto('Resultado fuera de dominio. No se presenta la comparación.', 'RESULTADO_NO_VERIFICABLE', 422);
  return { nombre, clasificacion: 'aproximacion_documentada', validacionIndividual: 'pendiente_validacion_especializada',
    pensionMensual: r.pensionMensual, pensionEnUF: r.pensionEnUF, cnu: r.cnu, tasaDescuento: r.tasaInteres };
}
export function calcularPiloto(entrada: unknown): ResultadoPiloto {
  const d = validarDatosPiloto(entrada);
  const ano = Number(d.fechaValoracion.slice(0, 4));
  const escenarios = calcularEscenariosRetiroProgramado(d.fondos, d.edad, d.sexo, d.tasaTecnicaCNU, d.beneficiarios, false, ano, d.referenciaUF);
  const rv = calcularRVInmediata(d.fondos, d.edad, d.sexo, d.tasaRV, d.beneficiarios, false, d.referenciaUF);
  const clavesEscenario = Object.keys(ESCENARIOS_RENTABILIDAD_RP) as EscenarioRentabilidadRP[];
  const puedeProyectar = d.beneficiarios.length === 0 && new Set(clavesEscenario.map(k => escenarios[k].proyeccion.length)).size === 1 && clavesEscenario.every(k => verificarProyeccionPiloto(escenarios[k].proyeccion, d.fondos, ESCENARIOS_RENTABILIDAD_RP[k].rentabilidadRealAnual, d.edad, ano));
  const puntos = puedeProyectar ? escenarios.base.proyeccion.map((f, i): PuntoPiloto => {
    const c = escenarios.conservador.proyeccion[i], o = escenarios.optimista.proyeccion[i];
    if (!c || !o) throw new ErrorPiloto('Escenarios con horizontes incompatibles.', 'RESULTADO_NO_VERIFICABLE', 422);
    return { ano: f.anoCalendario, edad: f.edad, conservadorPension: c.pensionMensual, basePension: f.pensionMensual, optimistaPension: o.pensionMensual,
      conservadorSaldo: c.saldoAcumulado, baseSaldo: f.saldoAcumulado, optimistaSaldo: o.saldoAcumulado };
  }) : [];
  return { perfil: PERFIL_PILOTO, aviso: AVISO_PILOTO, datos: d, fechaRevision: FECHA_REVISION_PILOTO,
    comparacion: { rp: monto(escenarios[d.escenarioRP], 'Retiro Programado simple'), rv: monto(rv, 'Renta Vitalicia inmediata teórica') },
    supuestos: [LIMITACION_CNU, 'Solo ahorro propio. Montos brutos antes de salud, comisiones, impuestos y beneficios estatales.',
      'Tasas de descuento reales configurables; sin selección automática de norma por fecha. RV sin tasa comercial ni compañía atribuida.',
      'RP: retiro anual al inicio y rentabilidad real constante sobre el remanente. Escenarios 0%, 2% y 4%; no son pronósticos.',
      'La curva RP está condicionada a supervivencia y supuestos del modelo. No se dibuja una proyección RV ni un saldo de aseguradora.',
      ...(d.fechaValoracion < '2026-10-01' && Math.abs(d.tasaTecnicaCNU - TASAS_INTERES.RETIRO_PROGRAMADO) < 1e-12 ? [AVISO_TASA_RP_HISTORICA] : []),
      ...(d.beneficiarios.length ? ['Beneficiarios hipotéticos: los porcentajes actuales y vínculos no acreditan derechos. Proyecciones familiares futuras bloqueadas.'] : [])],
    escenarios: clavesEscenario.map(id => ({ id, ...ESCENARIOS_RENTABILIDAD_RP[id], pensionInicial: escenarios[id].pensionMensual })),
    proyecciones: { disponibles: puedeProyectar, motivo: d.beneficiarios.length ? 'M11/M22: proyecciones familiares futuras restringidas; solo comparación inicial.' : d.fondos === 0 ? 'Sin saldo AFP positivo no hay evolución financiada para graficar.' : puedeProyectar ? 'RP sin beneficiarios: flujos calculados y comprobados; no certificación normativa.' : 'No se dispone de una proyección completa con identidades financieras verificables.', puntos },
    porcentajesActuales: calcularPorcentajesBeneficiarios(d.beneficiarios), restricciones: RESTRICCIONES_PILOTO, fuentes: FUENTES_PILOTO };
}
