import { NextResponse } from 'next/server';
import { consultarReferenciaUF, fechaEnChile } from '@/lib/uf-remota';
import type { ReferenciaUF } from '@/lib/moneda';

let cache: { consulta: string; obtenido: number; referencia: ReferenciaUF } | undefined;

export async function GET() {
  const fecha = fechaEnChile();
  try {
    if (cache?.consulta === fecha && Date.now() - cache.obtenido < 3600000) {
      return NextResponse.json({ success: true, ...cache.referencia, cache: true });
    }
    const referencia = await consultarReferenciaUF(fecha);
    cache = { consulta: fecha, obtenido: Date.now(), referencia };
    return NextResponse.json({ success: true, ...referencia });
  } catch {
    return NextResponse.json({ success: false, error: 'No se obtuvo UF. Conserve o configure una referencia fechada.',
      ultimaReferencia: cache?.referencia }, { status: 503 });
  }
}
