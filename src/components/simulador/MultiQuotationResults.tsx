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
import { CotizacionItemResultado, InvalidezFinanciamientoInfo, SobrevivenciaFinanciamientoInfo } from './types';

interface MultiQuotationResultsProps {
  items: CotizacionItemResultado[];
  valorUF: number;
  onDescargarPDF: () => void;
  isGeneratingPDF?: boolean;
  tipoPension?: 'vejez' | 'invalidez' | 'sobrevivencia';
  invalidezInfo?: InvalidezFinanciamientoInfo;
  sobrevivenciaInfo?: SobrevivenciaFinanciamientoInfo;
  tasaRP?: number;
  tasaRV?: number;
  sexo?: 'M' | 'F';
}

function formatCLP(val: number): string {
  if (val === undefined || val === null || isNaN(val)) return '$0';
  return `$${Math.round(val).toLocaleString('es-CL')}`;
}

function formatUF(val: number): string {
  if (val === undefined || val === null || isNaN(val)) return '0.00 UF';
  return `${Number(val).toFixed(2)} UF`;
}

export function MultiQuotationResults({
  items,
  valorUF,
  onDescargarPDF,
  isGeneratingPDF = false,
  tipoPension = 'vejez',
  invalidezInfo,
  sobrevivenciaInfo,
  tasaRP = 3.58,
  tasaRV = 3.08,
  sexo = 'M'
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
            <h2 className="text-base font-semibold">
              {tipoPension === 'invalidez' 
                ? 'Cotización de Pensión de Invalidez' 
                : tipoPension === 'sobrevivencia' 
                  ? 'Cotización de Pensión de Sobrevivencia' 
                  : 'Resumen Comparativo de Cotización'} ({items.length} Modalidades)
            </h2>
          </div>
          <p className="text-xs text-blue-200 mt-0.5">
            {tipoPension === 'invalidez' 
              ? `Cálculo con Tablas Generacionales MI-2020 • UF $${valorUF.toLocaleString('es-CL', { minimumFractionDigits: 2 })} • TRP: ${tasaRP.toFixed(2)}% | TRV: ${tasaRV.toFixed(2)}%`
              : tipoPension === 'sobrevivencia'
                ? `Cálculo actuarial oficial según D.L. 3.500 Art. 58 y Tablas B-2020 • UF $${valorUF.toLocaleString('es-CL', { minimumFractionDigits: 2 })} • TRP: ${tasaRP.toFixed(2)}% | TRV: ${tasaRV.toFixed(2)}%`
                : `Cálculo actuarial oficial con tablas generacionales TM-2020 • UF $${valorUF.toLocaleString('es-CL', { minimumFractionDigits: 2 })} • TRP: ${tasaRP.toFixed(2)}% | TRV: ${tasaRV.toFixed(2)}%`
            }
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

      {/* Banner de Financiamiento Pensión de Invalidez (D.L. 3.500) */}
      {tipoPension === 'invalidez' && invalidezInfo && (
        <div className="p-3.5 rounded-xl border border-amber-300 bg-amber-50/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-amber-600 text-white hover:bg-amber-700 text-xs font-bold">
                Invalidez {invalidezInfo.grado === 'total' ? 'Total (70% IB)' : 'Parcial (50% IB)'}
              </Badge>
              <Badge variant="outline" className={`text-xs font-semibold ${invalidezInfo.cubiertoSIS ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                {invalidezInfo.cubiertoSIS ? '✓ Cubierto por Seguro SIS' : '✗ Sin Cobertura SIS'}
              </Badge>
              <Badge variant="outline" className="text-xs bg-white text-slate-700 border-slate-300 font-mono">
                Tabla MI-2020
              </Badge>
            </div>
            <p className="text-xs text-amber-950 leading-relaxed">
              {invalidezInfo.cubiertoSIS ? (
                <>
                  Pensión de Referencia por Ley: <strong>{formatCLP(invalidezInfo.pensionReferenciaCLP)} / mes</strong> ({formatUF(invalidezInfo.pensionReferenciaUF)}). 
                  La compañía del SIS integra un Aporte Adicional de <strong>+{formatCLP(invalidezInfo.aporteAdicionalSISCLP)}</strong> a su saldo en AFP para enterar el Capital Necesario actuarial ({formatCLP(invalidezInfo.capitalNecesarioCLP)}).
                </>
              ) : (
                <>
                  Pensión financiada exclusivamente con el ahorro propio en la AFP ({formatCLP(invalidezInfo.saldoPropioCLP)}). Al no contar con seguro SIS vigente, no aplica Aporte Adicional.
                </>
              )}
            </p>
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-amber-200 shrink-0 text-right space-y-0.5 min-w-[180px]">
            <div className="text-[10px] text-slate-500 font-medium">Saldo Total para Cotizar</div>
            <div className="text-sm font-extrabold text-indigo-950">{formatCLP(invalidezInfo.saldoTotalFinanciamientoCLP)}</div>
            <div className="text-[10px] font-semibold text-emerald-700">{formatUF(invalidezInfo.saldoTotalFinanciamientoUF)}</div>
          </div>
        </div>
      )}

      {/* Banner de Financiamiento Pensión de Sobrevivencia (D.L. 3.500) */}
      {tipoPension === 'sobrevivencia' && sobrevivenciaInfo && (
        <div className="p-3.5 rounded-xl border border-purple-300 bg-purple-50/90 shadow-xs flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="space-y-1.5 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <Badge className="bg-purple-700 text-white hover:bg-purple-800 text-xs font-bold gap-1">
                <span>🕊️</span> Sobrevivencia Legal (Art. 58 DL 3500)
              </Badge>
              <Badge variant="outline" className={`text-xs font-semibold ${sobrevivenciaInfo.cubiertoSIS ? 'bg-emerald-50 text-emerald-800 border-emerald-300' : 'bg-slate-100 text-slate-700 border-slate-300'}`}>
                {sobrevivenciaInfo.cubiertoSIS ? '✓ Cubierto por Seguro SIS' : '✗ Sin Cobertura SIS'}
              </Badge>
              <Badge variant="outline" className="text-xs bg-white text-slate-700 border-slate-300 font-mono">
                Tablas B-2020 / MI
              </Badge>
            </div>
            <p className="text-xs text-purple-950 leading-relaxed">
              {sobrevivenciaInfo.cubiertoSIS ? (
                <>
                  Pensión Referencia Causante (70% IB): <strong>{formatCLP(sobrevivenciaInfo.pensionReferenciaCausanteCLP)} / mes</strong> ({formatUF(sobrevivenciaInfo.pensionReferenciaCausanteUF)}). 
                  La aseguradora del SIS entera un Aporte Adicional de <strong>+{formatCLP(sobrevivenciaInfo.aporteAdicionalSISCLP)}</strong> al saldo AFP para constituir el Capital Necesario familiar ({formatCLP(sobrevivenciaInfo.capitalNecesarioCLP)}).
                </>
              ) : (
                <>
                  Pensión financiada íntegramente con los fondos acumulados por el causante en su AFP ({formatCLP(sobrevivenciaInfo.saldoPropioCLP)}). Al no estar cubierto por SIS a la fecha de defunción, no aplica Aporte Adicional.
                </>
              )}
            </p>
            {sobrevivenciaInfo.beneficiarios.length > 0 && (
              <div className="flex flex-wrap items-center gap-1.5 pt-1 border-t border-purple-200/80">
                <span className="text-[11px] font-semibold text-purple-900 mr-1">Beneficiarios con Derecho:</span>
                {sobrevivenciaInfo.beneficiarios.map((ben, bIdx) => (
                  <Badge key={bIdx} variant="secondary" className="text-[10px] bg-white text-purple-900 border border-purple-200">
                    {ben.nombre || (ben.tipo === 'conyuge' ? 'Cónyuge' : 'Hijo/a')} ({(ben.porcentaje * 100).toFixed(0)}%): {formatCLP(ben.pensionReferenciaCLP)}
                  </Badge>
                ))}
              </div>
            )}
          </div>

          <div className="bg-white p-2.5 rounded-lg border border-purple-200 shrink-0 text-right space-y-0.5 min-w-[190px]">
            <div className="text-[10px] text-slate-500 font-medium">Saldo Total SCOMP</div>
            <div className="text-sm font-extrabold text-indigo-950">{formatCLP(sobrevivenciaInfo.saldoTotalFinanciamientoCLP)}</div>
            <div className="text-[10px] font-semibold text-emerald-700">{formatUF(sobrevivenciaInfo.saldoTotalFinanciamientoUF)}</div>
          </div>
        </div>
      )}

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
                  {item.config.esTasaEspecial ? (
                    <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-300 font-mono py-0">
                      ⚡ Tasa Esp: {(item.resultado.tasaInteres * 100).toFixed(2)}%
                    </Badge>
                  ) : null}
                </div>
                <CardTitle className="text-sm font-semibold text-slate-900 leading-snug">
                  {item.config.nombre}
                </CardTitle>
              </CardHeader>

              <CardContent className="px-4 pb-4 space-y-3">
                {/* Desglose Estructurado de Pensión */}
                <div className="p-3.5 rounded-xl bg-slate-50/90 border border-slate-200/90 shadow-2xs space-y-3">
                  {/* 1. Renglón Superior: Pensión de Base (EL VALOR DESTACADO PRINCIPAL) */}
                  <div>
                    <span className="text-[10px] font-black text-slate-500 uppercase tracking-wider block">
                      {tipoPension === 'sobrevivencia'
                        ? 'Pensión Base Causante'
                        : (isRP ? 'Pensión Base Retiro Programado' : 'Pensión Base Renta Vitalicia')}
                    </span>
                    <div className="flex items-baseline gap-2 mt-0.5">
                      <span className="text-2xl sm:text-[26px] font-black text-slate-900 tracking-tight">
                        {formatCLP(item.resultado.pensionMensual)}
                      </span>
                      <span className="text-xs sm:text-sm font-black text-blue-700 font-mono">
                        ({formatUF(item.resultado.pensionEnUF)})
                      </span>
                    </div>
                  </div>

                  {/* 2. Bloque Intermedio: Bonificaciones del Estado (PGU, BAC, Expectativa de Vida Mujeres) */}
                  <div className="pt-2 border-t border-slate-200/70 space-y-1.5">
                    <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">
                      Bonificaciones del Estado
                    </span>

                    {/* A. PGU */}
                    <div className="flex items-center justify-between text-xs">
                      <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-emerald-500"></span>
                        PGU:
                      </span>
                      {item.pguMensual > 0 ? (
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-emerald-700 font-mono text-xs">
                            +{formatCLP(item.pguMensual)}
                          </span>
                          <span className="text-[10px] text-emerald-600 font-mono font-medium">
                            ({formatUF(item.pguMensual / valorUF)})
                          </span>
                        </div>
                      ) : (
                        <span className="text-[10.5px] text-slate-400">No aplica / $0</span>
                      )}
                    </div>

                    {/* B. Bonificación por Años Cotizados (BAC) */}
                    {item.bacMensual > 0 && (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-medium text-slate-600 flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-indigo-500"></span>
                          Bono por Años Cotizados (BAC):
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-indigo-700 font-mono text-xs">
                            +{formatCLP(item.bacMensual)}
                          </span>
                          <span className="text-[10px] text-indigo-600 font-mono font-medium">
                            ({formatUF(item.bacMensual / valorUF)})
                          </span>
                        </div>
                      </div>
                    )}

                    {/* C. Bonificación por Expectativa de Vida en el caso de las Mujeres */}
                    {item.bonoMujerMensual && item.bonoMujerMensual > 0 ? (
                      <div className="flex items-center justify-between text-xs">
                        <span className="text-[11px] font-semibold text-rose-700 flex items-center gap-1.5">
                          <span className="inline-block w-1.5 h-1.5 rounded-full bg-rose-500"></span>
                          Bono Expectativa de Vida (Mujer):
                        </span>
                        <div className="flex items-baseline gap-1">
                          <span className="font-bold text-rose-700 font-mono text-xs">
                            +{formatCLP(item.bonoMujerMensual)}
                          </span>
                          <span className="text-[10px] text-rose-600 font-mono font-medium">
                            ({formatUF(item.bonoMujerUF || 0.25)})
                          </span>
                        </div>
                      </div>
                    ) : null}
                  </div>

                  {/* 3. Última Línea: Suma Total de la Pensión (Mucho más pequeño) */}
                  <div className="pt-2 border-t border-slate-200/80 flex items-center justify-between text-xs">
                    <span className="text-[11px] font-semibold text-slate-500 uppercase tracking-wide">
                      {tipoPension === 'sobrevivencia' ? 'Suma Total Familiar:' : 'Suma Total de la Pensión:'}
                    </span>
                    <div className="flex items-baseline gap-1">
                      <span className="text-sm font-bold text-slate-800 font-mono">
                        {formatCLP(item.totalConBeneficiosCLP)}
                      </span>
                      <span className="text-[10.5px] font-semibold text-blue-700 font-mono">
                        ({formatUF(item.totalConBeneficiosUF)})
                      </span>
                    </div>
                  </div>

                  {item.config.tipo === 'rv_aumento_temporal' && item.resultado.proyeccion && item.resultado.proyeccion.length > 0 && (
                    <div className="text-[10px] text-rose-700 font-medium pt-1.5 border-t border-slate-200/60">
                      Fase inicial aumentada por {Math.round((item.config.mesesAumento || 36) / 12)} años.
                      {item.resultado.proyeccion.find(p => p.fase === 'vitalicia') && (
                        <span className="text-slate-600 ml-1">
                          Posterior: {formatCLP(item.resultado.proyeccion.find(p => p.fase === 'vitalicia')?.pensionMensual || 0)} / mes
                        </span>
                      )}
                    </div>
                  )}

                  {/* Distribución por Beneficiario en Sobrevivencia */}
                  {tipoPension === 'sobrevivencia' && item.resultado.pensionPorBeneficiario && item.resultado.pensionPorBeneficiario.length > 0 && (
                    <div className="mt-2.5 pt-2 border-t border-purple-200/60 space-y-1 bg-purple-50/50 p-2 rounded">
                      <div className="flex justify-between items-center text-[10px] font-bold text-purple-950 uppercase tracking-wider">
                        <span>Distribución a Beneficiarios:</span>
                        {item.config.tipo === 'rv_aumento_temporal' && (
                          <span className="text-purple-700 normal-case font-medium">
                            (Inicial → Vitalicia)
                          </span>
                        )}
                      </div>
                      <div className="space-y-0.5">
                        {item.resultado.pensionPorBeneficiario.map((ben, bIdx) => (
                          <div key={bIdx} className="flex justify-between items-center text-xs">
                            <span className="text-slate-700 capitalize">
                              {ben.tipo === 'conyuge' ? 'Cónyuge' : ben.tipo === 'hijo' ? 'Hijo/a' : ben.tipo} ({(ben.porcentaje * 100).toFixed(0)}%):
                            </span>
                            <span className="font-bold text-purple-950 font-mono">
                              {formatCLP(ben.pensionMensual)}
                              {ben.pensionPosterior !== undefined && ben.pensionPosterior !== ben.pensionMensual && (
                                <span className="text-slate-500 font-normal text-[10px] ml-1">
                                  → {formatCLP(ben.pensionPosterior)}
                                </span>
                              )}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {/* Atributos clave */}
                <div className="grid grid-cols-2 gap-2 text-xs">
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block">Tasa Actuarial</span>
                    <span className={`font-semibold font-mono ${item.config.esTasaEspecial ? 'text-amber-700' : 'text-slate-900'}`}>
                      {(item.resultado.tasaInteres * 100).toFixed(2)}% anual {item.config.esTasaEspecial ? '(⚡ Especial)' : ''}
                    </span>
                  </div>
                  <div className="space-y-0.5">
                    <span className="text-[10px] text-slate-400 block">Factor CNU</span>
                    <span className="font-semibold text-slate-900 font-mono">
                      {item.resultado.cnu.toFixed(2)}
                    </span>
                  </div>
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
                <th className="py-2.5 px-3 text-center">Tasa (%)</th>
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
                    <td className="py-2.5 px-3 text-center font-mono font-semibold text-slate-800">
                      {item.config.esTasaEspecial ? (
                        <span className="inline-flex items-center gap-1 text-amber-800 font-bold bg-amber-50 px-1.5 py-0.5 rounded border border-amber-200">
                          ⚡ {(item.resultado.tasaInteres * 100).toFixed(2)}%
                        </span>
                      ) : (
                        `${(item.resultado.tasaInteres * 100).toFixed(2)}%`
                      )}
                    </td>
                    <td className="py-2.5 px-3 text-right font-mono font-medium text-blue-900">
                      {formatUF(item.resultado.pensionEnUF)}
                    </td>
                    <td className="py-2.5 px-3 text-right font-bold text-slate-900">
                      {formatCLP(item.totalConBeneficiosCLP)}
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
