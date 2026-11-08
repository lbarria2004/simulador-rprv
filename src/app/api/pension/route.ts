import { NextRequest, NextResponse } from 'next/server';
import { calcularPiloto, leerSolicitudPiloto, ErrorPiloto, AVISO_PILOTO, RESTRICCIONES_PILOTO, PERFIL_PILOTO, FUENTES_PILOTO } from '@/lib/piloto';

export async function POST(request: NextRequest) {
  try {
    const datos = leerSolicitudPiloto(await request.json());
    return NextResponse.json({ success: true, resultado: calcularPiloto(datos) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, codigo: error instanceof ErrorPiloto ? error.codigo : 'DATOS_INVALIDOS', error: error instanceof Error ? error.message : 'Solicitud inválida.' },
      { status: error instanceof ErrorPiloto ? error.status : 400 });
  }
}
export async function GET() {
  return NextResponse.json({ perfil: PERFIL_PILOTO, aviso: AVISO_PILOTO, tiposHabilitados: ['comparacion_piloto'], restricciones: RESTRICCIONES_PILOTO, fuentes: FUENTES_PILOTO });
}
