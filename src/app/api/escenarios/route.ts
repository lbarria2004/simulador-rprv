import { NextRequest, NextResponse } from 'next/server';
import { compararEscenarios, CATALOGO_MODALIDADES, MAX_ESCENARIOS } from '@/lib/escenarios';
import { ErrorPiloto, AVISO_PILOTO } from '@/lib/piloto';

export async function GET() {
  return NextResponse.json({ catalogo: CATALOGO_MODALIDADES, maxEscenarios: MAX_ESCENARIOS, aviso: AVISO_PILOTO });
}
export async function POST(request: NextRequest) {
  try {
    const resultado = compararEscenarios(await request.json());
    return NextResponse.json({ success: true, resultado }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (error) {
    return NextResponse.json({ success: false, codigo: error instanceof ErrorPiloto ? error.codigo : 'DATOS_INVALIDOS',
      error: error instanceof Error ? error.message : 'Solicitud inválida.' },
    { status: error instanceof ErrorPiloto ? error.status : 400, headers: { 'Cache-Control': 'no-store' } });
  }
}
