import { validarReferenciaUF, type ReferenciaUF } from './moneda.ts';

const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];

export function fechaEnChile(ahora = new Date()): string {
  const partes = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Santiago', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(ahora);
  return ['year', 'month', 'day'].map(tipo => partes.find(p => p.type === tipo)!.value).join('-');
}

/** Solo lee el mes y día solicitados: jamás busca en el resto de la página si faltan. */
export function leerUFDesdeSII(html: string, fecha: string): ReferenciaUF {
  const [, mes, dia] = fecha.split('-').map(Number);
  const inicio = html.toLowerCase().indexOf(`mes_${MESES[mes - 1]}`);
  if (inicio < 0) throw new RangeError('SII: falta el mes solicitado');
  const fin = html.toLowerCase().indexOf('</table>', inicio);
  if (fin < 0) throw new RangeError('SII: tabla incompleta');
  const tabla = html.slice(inicio, fin);
  const patron = new RegExp(`<strong>\\s*${dia}\\s*</strong>\\s*</th>\\s*<td[^>]*>\\s*([0-9.,]+)\\s*</td>`, 'i');
  const dato = tabla.match(patron)?.[1];
  if (!dato) throw new RangeError('SII: no hay valor para la fecha solicitada');
  return validarReferenciaUF({ valor: Number(dato.replace(/\./g, '').replace(',', '.')), fecha, fuente: 'sii.cl' });
}

export async function consultarReferenciaUF(fecha = fechaEnChile(), obtener: typeof fetch = fetch): Promise<ReferenciaUF> {
  try {
    const respuesta = await obtener(`https://www.sii.cl/valores_y_fechas/uf/uf${fecha.slice(0, 4)}.htm`, { signal: AbortSignal.timeout(4000) });
    if (!respuesta.ok) throw new Error('SII no disponible');
    return leerUFDesdeSII(await respuesta.text(), fecha);
  } catch {
    const respuesta = await obtener('https://mindicador.cl/api/uf', { signal: AbortSignal.timeout(4000) });
    if (!respuesta.ok) throw new Error('No se obtuvo una referencia UF fechada');
    const datos = await respuesta.json();
    const referencias: ReferenciaUF[] = (Array.isArray(datos.serie) ? datos.serie : []).flatMap((dato: { valor: number; fecha?: string }) => {
      try {
        const ref = validarReferenciaUF({ valor: dato.valor, fecha: dato.fecha?.slice(0, 10) ?? '', fuente: 'mindicador.cl (fuente secundaria)' });
        return ref.fecha <= fecha ? [ref] : [];
      } catch { return []; }
    });
    referencias.sort((a, b) => b.fecha.localeCompare(a.fecha));
    if (!referencias.length) throw new Error('No se obtuvo una referencia UF fechada');
    return referencias[0];
  }
}
