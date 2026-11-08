/** Una UF fechada por cálculo; los flujos se expresan en CLP reales de esa fecha. */
export interface ReferenciaUF {
  valor: number;
  fecha: string;
  fuente: string;
}

export const UF_REFERENCIA_EJEMPLO: Readonly<ReferenciaUF> = Object.freeze({
  valor: 40_000,
  fecha: '2026-01-01',
  fuente: 'Supuesto ilustrativo configurable; no es una cotización vigente'
});

export function validarReferenciaUF(uf: ReferenciaUF): ReferenciaUF {
  if (!uf || !Number.isFinite(uf.valor) || uf.valor <= 0) throw new RangeError('UF debe ser positiva y finita');
  if (typeof uf.fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(uf.fecha)
    || !Number.isFinite(Date.parse(uf.fecha)) || new Date(uf.fecha).toISOString().slice(0, 10) !== uf.fecha) {
    throw new RangeError('UF requiere una fecha válida YYYY-MM-DD');
  }
  if (typeof uf.fuente !== 'string' || !uf.fuente.trim()) throw new RangeError('UF requiere fuente o descripción del supuesto');
  return { valor: uf.valor, fecha: uf.fecha, fuente: uf.fuente };
}

function validarMonto(monto: number): void {
  if (!Number.isFinite(monto)) throw new RangeError('El importe monetario debe ser finito');
}

export function clpAUf(clp: number, uf: ReferenciaUF): number {
  validarMonto(clp);
  const resultado = clp / validarReferenciaUF(uf).valor;
  validarMonto(resultado);
  return resultado;
}

export function ufAClp(unidadesUF: number, uf: ReferenciaUF): number {
  validarMonto(unidadesUF);
  const resultado = unidadesUF * validarReferenciaUF(uf).valor;
  validarMonto(resultado);
  return resultado;
}

export function referenciaDesdeValor(valor: number, fecha: string, fuente: string): ReferenciaUF {
  return validarReferenciaUF({ valor, fecha, fuente });
}
