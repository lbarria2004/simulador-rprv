import { getQx } from './tablas-mortalidad.ts';

export interface OpcionesMensuales {
  rol?: 'titular' | 'beneficiario';
  fechaCalculo?: string;
  edadLimite?: number;
}
export interface PagoActuarialMensual {
  mes: number;
  edadInicio: number;
  supervivencia: number;
  descuento: number;
  capitalUnitario: number;
}

/** Método estimativo documentado en docs/fase-3-fundamentos.md. No es CNU regulatorio. */
export function proyectarCapitalTemporalMensual(
  edad: number, sexo: 'M' | 'F', meses: number, tasa: number, esInvalido = false,
  modalidad: 'retiro_programado' | 'renta_vitalicia' = 'renta_vitalicia', anoCalculo = 2026,
  opciones: OpcionesMensuales = {}
): { cnu: number; pagos: PagoActuarialMensual[] } {
  if (!Number.isFinite(edad) || edad < 0 || edad > 110) throw new RangeError('Edad fuera de dominio mensual');
  if (!Number.isInteger(meses) || meses < 0 || meses > 1320) throw new RangeError('Meses deben ser enteros entre 0 y 1320');
  if (!Number.isFinite(tasa) || tasa <= -1) throw new RangeError('Tasa anual efectiva inválida');
  if (!Number.isInteger(anoCalculo) || anoCalculo < 2020) throw new RangeError('Año de cálculo inválido');
  if (!['M', 'F'].includes(sexo) || !['titular', 'beneficiario'].includes(opciones.rol ?? 'titular')) throw new RangeError('Sexo o rol mensual inválido');
  const limite = opciones.edadLimite ?? 110;
  if (!Number.isFinite(limite) || limite < 0 || limite > 110) throw new RangeError('Límite de edad inválido');
  let inicio = anoCalculo;
  if (opciones.fechaCalculo) {
    const fecha = opciones.fechaCalculo;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha) || !Number.isFinite(Date.parse(fecha)) || new Date(fecha).toISOString().slice(0, 10) !== fecha) throw new RangeError('Fecha actuarial inválida');
    const [ano, mes, dia] = fecha.split('-').map(Number);
    if (ano !== anoCalculo) throw new RangeError('Fecha y año actuarial deben coincidir');
    inicio = ano + (mes - 1 + Math.min(dia - 1, 29) / 30) / 12;
  }
  const pagos: PagoActuarialMensual[] = [];
  let supervivencia = 1;
  let tiempo = 0;
  let cnu = 0;
  for (let mes = 1; mes <= meses; mes++) {
    const edadInicio = edad + (mes - 1) / 12;
    if (edadInicio >= limite - 1e-10 || edadInicio >= 110 - 1e-10) break;
    const fin = mes / 12;
    while (tiempo < fin - 1e-12 && supervivencia > 0) {
      const edadEntera = Math.floor(edad + tiempo + 1e-10);
      const ano = Math.floor(inicio + tiempo + 1e-10);
      if (edadEntera >= 110) { supervivencia = 0; break; }
      const siguiente = Math.min(fin, edadEntera + 1 - edad, ano + 1 - inicio);
      const qx = getQx(edadEntera, sexo, esInvalido, modalidad, ano, opciones.rol ?? 'titular');
      supervivencia *= Math.pow(1 - qx, siguiente - tiempo);
      tiempo = siguiente;
    }
    const descuento = Math.pow(1 + tasa, -fin);
    const capitalUnitario = supervivencia * descuento;
    if (!Number.isFinite(capitalUnitario)) throw new RangeError('Capital temporal fuera del dominio numérico');
    pagos.push({ mes, edadInicio, supervivencia, descuento, capitalUnitario });
    cnu += capitalUnitario;
  }
  return { cnu, pagos };
}

export interface PagoTemporal {
  mes: number;
  edad: number;
  pensionMensual: number;
  fase: 'aumento' | 'normal';
}

/** Promedio de los pagos efectivos del año: no extiende un aumento de 13 meses a 24. */
export function crearTrayectoriaTemporal(base: number, aumentada: number, meses: number, edad: number, anos = 30) {
  if (!Number.isInteger(meses) || meses < 0 || meses > 1320) throw new RangeError('Período temporal inválido');
  const mensual: PagoTemporal[] = Array.from({ length: anos * 12 }, (_, indice) => ({
    mes: indice + 1, edad: edad + indice / 12,
    pensionMensual: indice < meses ? aumentada : base,
    fase: indice < meses ? 'aumento' : 'normal'
  }));
  const anual = Array.from({ length: anos }, (_, ano) => {
    const pagos = mensual.slice(ano * 12, (ano + 1) * 12);
    const mesesAumentados = pagos.filter(p => p.fase === 'aumento').length;
    return { año: ano + 1, edad: edad + ano,
      pensionMensual: Math.round(pagos.reduce((suma, p) => suma + p.pensionMensual, 0) / 12),
      saldoAcumulado: 0, retiroAcumulado: 0, mesesAumentados,
      fase: mesesAumentados === 12 ? 'aumento' as const : mesesAumentados === 0 ? 'normal' as const : 'mixta' as const };
  });
  return { mensual, anual };
}
