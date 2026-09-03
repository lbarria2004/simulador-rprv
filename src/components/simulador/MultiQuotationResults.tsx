'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  CheckCircle2, 
  Landmark, 
  Building2, 
  ShieldCheck, 
  TrendingUp, 
  Sparkles, 
  Download,
  AlertCircle,
  Clock,
  Coins
} from 'lucide-react';
import { CotizacionItemResultado } from './types';

interface MultiQuotationResultsProps {
  items: CotizacionItemResultado[];
  valorUF: number;
  onDescargarPDF: () => void;
  isGeneratingPDF?: boolean;
}

export function MultiQuotationResults({
  items,
  valorUF,
  onDescargarPDF,
  isGeneratingPDF = false
}: MultiQuotationResultsProps) {
  if (items.length === 0) {
    return (
      <Card className="border-dashed border-slate-300 p-8 text-center bg-slate-50/50">
        <div className="max-w-md mx-auto space-y-3">
          <div className="w-12 h-12 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
            <Coins className="w-6 h-6" />
          </div>
          <h3 className="font-semibold text-slate-800 text-base">Aún no se ha generado una cotización</h3>
          <p className="text-xs text-slate-500">
            Selecciona las modalidades base que deseas cotizar o agrega combinaciones personalizadas y presiona <strong>&quot;Generar Cotización&quot;</strong>.
          </p>
        </div>
      </Card>
    );
  }

  // Identificar la pensión más alta
  const pensionMaxima = Math.max(...items.map(i => i.totalConBeneficiosCLP));

  return (
    <div className="space-y-4">
      {/* Header con resumen y botón de descarga */}
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 p-4 bg-gradient-to-r from-blue-900 to-indigo-950 text-white rounded-xl shadow-sm">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-amber-300" />
            <h2 className="text-base font-semibold">Resumen Comparativo de Cotización ({items.length} Modalidades)</h2>
          </div>
          <p className="text-xs text-blue-200 mt-0.5">
            Cálculo actuarial oficial con tablas generacionales TM-2020 a valor UF ${valorUF.toLocaleString('es-CL', { minimumFractionDigits: 2 })}
          </p>
        </div>

        <Button
          type="button"
          onClick={onDescargarPDF}
          disabled={isGeneratingPDF}
          size="sm"
          className="bg-white text-blue-950 hover:bg-blue-50 font-semibold text-xs h-9 px-4 shadow-sm flex items-center gap-1.5"
        >
          <Download className={`w-3.5 h-3.5 ${isGeneratingPDF ? 'animate-spin' : ''}`} />
          <span>{isGeneratingPDF ? 'Generando PDF...' : 'Descargar Estudio Oficial (PDF)'}</span>
        </Button>
      </div>

      {/* Grid de Tarjetas de Cotización */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {items.map((item, idx) => {
          const isMax = item.totalConBeneficiosCLP === pensionMaxima;
          const isRP = item.config.tipo === 'retiro_programado';
          const isRVSimple = item.config.tipo === 'renta_vitalicia_simple';

          return (
            <Card
              key={item.config.id || idx}
              className={`relative overflow-hidden transition-all border-2 ${
                isMax 
                  ? 'border-emerald-500 shadow-md ring-1 ring-emerald-500/20' 
                  : 'border-slate-200 shadow-sm hover:border-slate-300'
              }`}
            >
              {isMax && (
                <div className="absolute top-0 right-0">
                  <div className="bg-emerald-600 text-white text-[10px] font-bold uppercase tracking-wider py-0.5 px-3 rounded-bl-lg shadow-sm">
                    Mayor Pensión Inicial
                  </div>
                </div>
              )}

              <CardHeader className="pb-2 pt-3.5 px-4">
                <div className="flex items-center gap-1.5 mb-1">
                  {isRP ? (
                    <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 flex items-center gap-1 py-0">
                      <Landmark className="w-2.5 h-2.5" /> AFP
                    </Badge>
                  ) : (
                    <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-700 border-indigo-200 flex items-center gap-1 py-0">
                      <Building2 className="w-2.5 h-2.5" /> Aseguradora
                    </Badge>
                  )}
                  {item.config.mesesGarantizados ? (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-700 border-amber-200 py-0">
                      🛡️ {Math.round(item.config.mesesGarantizados / 12)}a garantía
                    </Badge>
                  ) : null}
                  {item.config.mesesAumento ? (
                    <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-700 border-rose-200 py-0">
                      📈 +{Math.round((item.config.porcentajeAumento || 1) * 100)}% ({Math.round(item.config.mesesAumento / 12)}a)
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-sm font-semibold text-slate-900 leading-snug">
                  {item.config.nombre}
                </CardTitle>
              </CardHeader>

              <CardContent className="px-4 pb-4 space-y-3">
                {/* Monto Total Pensión */}
                <div className="p-2.5 rounded-lg bg-slate-50 border border-slate-100">
                  <span className="text-[10px] text-slate-500 font-medium uppercase tracking-wider block">
                    Pensión Total Mensual
                  </span>
                  <div className="flex items-baseline gap-1.5 mt-0.5">
                    <span className="text-xl font-black text-slate-900">
                      ${item.totalConBeneficiosCLP.toLocaleString('es-CL')}
                    </span>
                    <span className="text-xs font-semibold text-blue-700 font-mono">
                      ({item.totalConBeneficiosUF.toFixed(2)} UF)
                    </span>
                  </div>
                  {(item.pguMensual > 0 || item.bacMensual > 0) && (
                    <div className="text-[10px] text-slate-500 mt-1 flex flex-wrap gap-1">
                      <span>Base: ${(item.resultado.pensionMensual).toLocaleString('es-CL')}</span>
                      {item.pguMensual > 0 && <span className="text-emerald-700 font-medium">+ PGU</span>}
                      {item.bacMensual > 0 && <span className="text-indigo-700 font-medium">+ BAC</span>}
                    </div>
                  )}
                </div>

                {/* Atributos clave */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block">Régimen Legal</span>
                    <span className="font-medium text-slate-700">
                      {isRP ? 'Propiedad del afiliado' : 'Contrato irrevocable'}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block">Herencia</span>
                    <span className="font-medium text-slate-700">
                      {isRP ? 'Constituye herencia' : (item.config.mesesGarantizados ? 'Garantía traspasable' : 'Sin herencia')}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block">Riesgo Financiero</span>
                    <span className="font-medium text-slate-700">
                      {isRP ? 'Asume el afiliado' : 'Asume la aseguradora'}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block">Moneda de Pago</span>
                    <span className="font-medium text-slate-700">
                      {isRP ? 'Variable anualmente' : 'Fija en UF'}
                    </span>
                  </div>
                </div>
              </CardContent>
            </Card>
          );
        })}
      </div>

      {/* Tabla Comparativa Consolidada (Estilo SCOMP) */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="py-3 px-4 bg-slate-50/70 border-b border-slate-200">
          <CardTitle className="text-xs font-semibold text-slate-800 uppercase tracking-wider">
            Matriz Comparativa de Ofertas Cotizadas
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0 overflow-x-auto">
          <table className="w-full text-xs text-left">
            <thead className="bg-slate-100/60 text-slate-600 font-semibold border-b border-slate-200 text-[11px]">
              <tr>
                <th className="py-2.5 px-3">Modalidad</th>
                <th className="py-2.5 px-3">Entidad</th>
                <th className="py-2.5 px-3 text-right">Pensión Base (UF)</th>
                <th className="py-2.5 px-3 text-right">Pensión Total ($)</th>
                <th className="py-2.5 px-3">Cláusulas</th>
                <th className="py-2.5 px-3">Herencia / Garantía</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((item, idx) => {
                const isRP = item.config.tipo === 'retiro_programado';
                return (
                  <tr key={idx} className="hover:bg-slate-50/80 transition-colors">
                    <td className="py-2.5 px-3 font-semibold text-slate-900">
                      {item.config.nombre}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {isRP ? 'AFP (Fondo C)' : 'Compañía de Seguros'}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-blue-900">
                      {item.resultado.pensionEnUF.toFixed(2)} UF
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      ${item.totalConBeneficiosCLP.toLocaleString('es-CL')}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {item.config.mesesGarantizados && item.config.mesesAumento ? (
                        <span>Garantía {Math.round(item.config.mesesGarantizados/12)}a + Aumento</span>
                      ) : item.config.mesesGarantizados ? (
                        <span>Garantía {Math.round(item.config.mesesGarantizados/12)} años</span>
                      ) : item.config.mesesAumento ? (
                        <span>Aumento {Math.round(item.config.mesesAumento/12)}a (+{Math.round((item.config.porcentajeAumento || 1)*100)}%)</span>
                      ) : (
                        <span className="text-slate-400">Simple sin cláusula</span>
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-slate-600">
                      {isRP ? (
                        <span className="text-blue-700 font-medium">100% fondos remanentes</span>
                      ) : item.config.mesesGarantizados ? (
                        <span className="text-amber-700 font-medium">{Math.round(item.config.mesesGarantizados/12)} años garantizados</span>
                      ) : (
                        <span className="text-slate-400">Pensión de sobrevivencia legal</span>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </CardContent>
      </Card>
    </div>
  );
}
