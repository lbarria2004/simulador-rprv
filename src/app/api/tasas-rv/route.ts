import { NextResponse } from 'next/server';
import { TASAS_RENTA_VITALICIA } from '@/lib/tablas-mortalidad';

interface CacheTasas {
  data: unknown;
  timestamp: number;
}

let cacheTasas: CacheTasas | null = null;
const CACHE_DURATION_MS = 24 * 60 * 60 * 1000; // 24 horas

export async function GET() {
  const now = Date.now();

  // 1. Usar cache en memoria si es reciente
  if (cacheTasas && now - cacheTasas.timestamp < CACHE_DURATION_MS) {
    return NextResponse.json({
      success: true,
      fuente: 'cache',
      tasas: cacheTasas.data
    });
  }

  try {
    const currentYear = new Date().getFullYear().toString();
    const params = new URLSearchParams();
    params.append('aaaa_ini', currentYear);
    params.append('mm_ini', '01');
    params.append('aaaa_fin', currentYear);
    params.append('mm_fin', '12');
    params.append('p', 'tas_int_med_rvp');

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const response = await fetch(
      'https://www.cmfchile.cl/institucional/estadisticas/svtas_tas_int_med_rvp.php',
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
          'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36'
        },
        body: params.toString(),
        signal: controller.signal
      }
    );

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`CMF HTTP ${response.status}`);
    }

    const html = await response.text();
    const start = html.indexOf('<!-- I N I C I O   D A T A-->');
    const end = html.indexOf('<!-- F I N   D A T A-->', start);
    const data = html.substring(start, end !== -1 ? end : start + 6000);

    const rows = [...data.matchAll(/<tr[^>]*>([\s\S]*?)<\/tr>/gi)].map(m => {
      return [...m[1].matchAll(/<t[hd][^>]*>([\s\S]*?)<\/t[hd]>/gi)].map(c => c[1].trim());
    });

    if (rows.length < 2) {
      throw new Error('Estructura de tabla CMF inesperada');
    }

    const parseRate = (val: string) => parseFloat(val.replace(',', '.')) / 100;
    const companias: Record<string, {
      vejez: number;
      vejezAnticipada: number;
      invalidezTotal: number;
      invalidezParcial: number;
      sobrevivencia: number;
      media: number;
    }> = {};
    let mediaMercado = null;

    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      if (!r || r.length < 7) continue;
      const nombre = r[0];
      const tasas = {
        vejez: parseRate(r[1]),
        vejezAnticipada: parseRate(r[2]),
        invalidezTotal: parseRate(r[3]),
        invalidezParcial: parseRate(r[4]),
        sobrevivencia: parseRate(r[5]),
        media: parseRate(r[6])
      };

      if (nombre.toLowerCase().includes('media mercado')) {
        mediaMercado = tasas;
      } else {
        companias[nombre] = tasas;
      }
    }

    const resultado = {
      actualizadoAl: new Date().toISOString(),
      mediaMercado: mediaMercado || TASAS_RENTA_VITALICIA.media_mercado,
      companias
    };

    cacheTasas = {
      data: resultado,
      timestamp: now
    };

    return NextResponse.json({
      success: true,
      fuente: 'cmf_live',
      tasas: resultado
    });
  } catch (error) {
    console.warn('Fallo consulta en vivo a CMF, usando respaldo local:', error);
    return NextResponse.json({
      success: true,
      fuente: 'fallback_local',
      tasas: {
        actualizadoAl: TASAS_RENTA_VITALICIA.fecha_actualizacion,
        mediaMercado: TASAS_RENTA_VITALICIA.media_mercado,
        companias: TASAS_RENTA_VITALICIA.companias
      }
    });
  }
}
