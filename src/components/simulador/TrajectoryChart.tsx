'use client';

import { clpAUf, ufAClp, type ReferenciaUF } from '@/lib/moneda';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend
} from 'recharts';
import { ProyeccionAnual, ResultadoEscenario } from '@/lib/pension-calculator';
import { TrendingUp, BarChart3 } from 'lucide-react';

interface TrajectoryChartProps {
  edadInicial: number;
  proyeccionRP: ProyeccionAnual[] | undefined;
  resultadoRVSimple: ResultadoEscenario | null;
  resultadoRVClausulas: ResultadoEscenario | null;
  referenciaUF: ReferenciaUF;
}

export function TrajectoryChart({
  edadInicial,
  proyeccionRP,
  resultadoRVSimple,
  resultadoRVClausulas,
  referenciaUF
}: TrajectoryChartProps) {
  const valorUF = referenciaUF.valor;
  // Construir serie de tiempo de 25 años
  const chartData = React.useMemo(() => {
    const data: Array<{
      año: number;
      edad: number;
      retiroProgramado: number | null;
      rentaVitalicia: number;
      rvConAumento: number;
      retiroProgramadoUF: number | null;
      rentaVitaliciaUF: number;
      rvConAumentoUF: number;
    }> = [];

    const rvSimpleCLP = resultadoRVSimple?.pensionMensual || 0;
    const rvSimpleUF = clpAUf(rvSimpleCLP, referenciaUF);

    const aumentoCLP = resultadoRVClausulas?.aumentoTemporal?.pensionAumentada ?? resultadoRVClausulas?.pensionMensual ?? rvSimpleCLP;
    const finalCLP = resultadoRVClausulas?.aumentoTemporal?.pensionFinal ?? resultadoRVClausulas?.pensionMensual ?? rvSimpleCLP;
    const mesesAumento = resultadoRVClausulas?.aumentoTemporal?.meses ?? 0;

    for (let año = 1; año <= 25; año++) {
      const edadActual = edadInicial + año - 1;
      const puntoRP = proyeccionRP?.[año - 1];
      const rpCLP = puntoRP?.pensionMensual ?? null;

      const mesesAumentados = Math.max(0, Math.min(12, mesesAumento - (año - 1) * 12));
      const promedio = (mesesAumentados * aumentoCLP + (12 - mesesAumentados) * finalCLP) / 12;
      const rvAumentoActualCLP = resultadoRVClausulas?.proyeccion?.[año - 1]?.pensionMensual ?? promedio;

      data.push({
        año,
        edad: edadActual,
        retiroProgramado: rpCLP,
        rentaVitalicia: rvSimpleCLP,
        rvConAumento: rvAumentoActualCLP,
        retiroProgramadoUF: rpCLP === null ? null : valorUF > 0 ? clpAUf(rpCLP, referenciaUF) : 0,
        rentaVitaliciaUF: rvSimpleUF,
        rvConAumentoUF: valorUF > 0 ? Math.round((clpAUf(rvAumentoActualCLP, referenciaUF)) * 100) / 100 : 0
      });
    }

    return data;
  }, [edadInicial, proyeccionRP, resultadoRVSimple, resultadoRVClausulas, valorUF, referenciaUF]);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-2 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-blue-600 text-white">
              <BarChart3 className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Trayectoria Comparativa de Pensión (Proyección a 25 Años)
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Estimaciones de ingreso mensual; RP se muestra solo dentro del horizonte calculado
              </CardDescription>
            </div>
          </div>
          <div className="flex items-center gap-2 text-xs">
            <Badge variant="outline" className="text-blue-800 bg-blue-50 border-blue-200 font-medium">
              Pesos de poder adquisitivo constante
            </Badge>
          </div>
        </div>
      </CardHeader>

      <CardContent className="px-2 pb-4">
        <div className="h-[280px] w-full">
          <ResponsiveContainer width="100%" height="100%">
            <ComposedChart data={chartData} margin={{ top: 10, right: 20, left: 10, bottom: 0 }}>
              <defs>
                {/* Gradiente Renta Vitalicia Simple */}
                <linearGradient id="colorRV" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.25} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0.0} />
                </linearGradient>
                {/* Gradiente RV Aumento Temporal */}
                <linearGradient id="colorRVAumento" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.35} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0.0} />
                </linearGradient>
              </defs>

              <CartesianGrid strokeDasharray="3 3" stroke="#e2e8f0" vertical={false} />
              
              <XAxis 
                dataKey="edad" 
                stroke="#64748b" 
                fontSize={11} 
                tickLine={false}
                tickFormatter={(edad) => `${edad}a`}
              />

              <YAxis 
                stroke="#64748b" 
                fontSize={11}
                tickLine={false}
                axisLine={false}
                tickFormatter={(val) => `$${(val / 1000).toFixed(0)}k`}
              />

              <Tooltip 
                content={({ active, payload, label }) => {
                  if (active && payload && payload.length) {
                    const dataPoint = payload[0].payload;
                    return (
                      <div className="bg-slate-900 text-white p-3 rounded-lg shadow-lg text-xs space-y-1.5 border border-slate-700">
                        <div className="font-bold border-b border-slate-700 pb-1 text-slate-200">
                          Edad: {label} años (Año {dataPoint.año})
                        </div>
                        <div className="text-emerald-300 flex justify-between gap-4">
                          <span>RV con cláusulas:</span>
                          <span className="font-mono font-bold">
                            {dataPoint.rvConAumentoUF} UF (${dataPoint.rvConAumento.toLocaleString('es-CL')})
                          </span>
                        </div>
                        <div className="text-blue-300 flex justify-between gap-4">
                          <span>RV Simple Fija:</span>
                          <span className="font-mono font-bold">
                            {dataPoint.rentaVitaliciaUF} UF (${dataPoint.rentaVitalicia.toLocaleString('es-CL')})
                          </span>
                        </div>
                        <div className="text-amber-300 flex justify-between gap-4">
                          <span>Retiro Programado:</span>
                          <span className="font-mono font-bold">
                            {dataPoint.retiroProgramado === null ? 'Sin proyección' : `${dataPoint.retiroProgramadoUF} UF ($${dataPoint.retiroProgramado.toLocaleString('es-CL')})`}
                          </span>
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />

              <Legend 
                verticalAlign="top" 
                height={32}
                iconType="circle"
                wrapperStyle={{ fontSize: '11px', paddingTop: '0px' }}
                formatter={(value) => {
                  if (value === 'rvConAumento') return 'RV con Cláusulas (Verde)';
                  if (value === 'rentaVitalicia') return 'Renta Vitalicia Fija (Azul)';
                  if (value === 'retiroProgramado') return 'Retiro Programado Simulado (Naranja)';
                  return value;
                }}
              />

              {/* 1. RV Aumento Temporal */}
              <Area 
                type="stepAfter" 
                dataKey="rvConAumento" 
                stroke="#10b981" 
                strokeWidth={2.5}
                fillOpacity={1} 
                fill="url(#colorRVAumento)" 
                name="rvConAumento"
              />

              {/* 2. Renta Vitalicia Fija */}
              <Area 
                type="monotone" 
                dataKey="rentaVitalicia" 
                stroke="#2563eb" 
                strokeWidth={2} 
                strokeDasharray="4 4"
                fillOpacity={1} 
                fill="url(#colorRV)" 
                name="rentaVitalicia"
              />

              {/* 3. Retiro Programado */}
              <Line 
                type="monotone" 
                dataKey="retiroProgramado" 
                stroke="#f59e0b" 
                strokeWidth={2.5} 
                dot={false}
                name="retiroProgramado"
              />
            </ComposedChart>
          </ResponsiveContainer>
        </div>
      </CardContent>
    </Card>
  );
}
