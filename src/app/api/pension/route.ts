import { NextRequest, NextResponse } from 'next/server';
import { calcularPiloto, leerSolicitudPiloto, ErrorPiloto, AVISO_PILOTO, RESTRICCIONES_PILOTO, PERFIL_PILOTO, FUENTES_PILOTO } from '@/lib/piloto';
import { calcularComparacionEscenarios, CATALOGO_MODALIDADES } from '@/lib/escenarios';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    if (body?.tipo === 'comparacion_escenarios') {
      const { piloto, cotizaciones } = calcularComparacionEscenarios(body);
      return NextResponse.json({ success: true, resultado: piloto, cotizaciones }, { headers: { 'Cache-Control': 'no-store' } });
    }
    const datos = leerSolicitudPiloto(body);
    return NextResponse.json({ success: true, resultado: calcularPiloto(datos) }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, codigo: error instanceof ErrorPiloto ? error.codigo : 'DATOS_INVALIDOS', error: error instanceof Error ? error.message : 'Solicitud inválida.' },
      { status: error instanceof ErrorPiloto ? error.status : 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
export async function GET() {
  return NextResponse.json({ perfil: PERFIL_PILOTO, aviso: AVISO_PILOTO, tiposHabilitados: ['comparacion_piloto', 'comparacion_escenarios'], modalidades: CATALOGO_MODALIDADES, restricciones: RESTRICCIONES_PILOTO, fuentes: FUENTES_PILOTO });
}
