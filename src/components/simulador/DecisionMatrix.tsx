'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { 
  FileText, 
  Download, 
  CheckCircle2, 
  AlertCircle, 
  ShieldCheck, 
  Building2, 
  Landmark, 
  Scale,
  Loader2
} from 'lucide-react';

interface DecisionMatrixProps {
  onGenerarPDF: () => void;
  isGeneratingPDF: boolean;
  nombreAfiliado: string;
}

export function DecisionMatrix({ onGenerarPDF, isGeneratingPDF, nombreAfiliado }: DecisionMatrixProps) {
  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white pb-4 pt-4 px-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-500/20 border border-blue-400/30 text-blue-300">
              <Scale className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-bold text-white">
                Matriz de Decisión para el Afiliado
              </CardTitle>
              <CardDescription className="text-xs text-slate-300">
                Resumen comparativo frente a frente para asesoría y elección informada
              </CardDescription>
            </div>
          </div>

          <Button
            onClick={onGenerarPDF}
            disabled={isGeneratingPDF}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs h-9 px-4 shadow-md flex items-center gap-2"
          >
            {isGeneratingPDF ? (
              <>
                <Loader2 className="w-4 h-4 animate-spin" />
                <span>Generando Estudio...</span>
              </>
            ) : (
              <>
                <Download className="w-4 h-4" />
                <span>Generar Propuesta PDF para Afiliado</span>
              </>
            )}
          </Button>
        </div>
      </CardHeader>

      <CardContent className="p-4 md:p-6 space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {/* Columna Retiro Programado */}
          <div className="rounded-xl border border-blue-200/80 bg-blue-50/30 p-4 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-blue-200/60">
              <div className="flex items-center gap-2">
                <Building2 className="w-4 h-4 text-blue-700" />
                <h4 className="font-bold text-sm text-blue-950">Retiro Programado (AFP)</h4>
              </div>
              <Badge variant="outline" className="text-[10px] bg-white text-blue-700 border-blue-200">
                Fondos Propios
              </Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-slate-900 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Herencia Familiar
                </span>
                <p className="text-slate-600 pl-5 leading-relaxed">
                  Si fallece y no quedan beneficiarios con derecho a pensión, el saldo restante constituye <strong className="text-slate-800">herencia legal</strong> para sus herederos.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-900 block flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Evolución en el Tiempo
                </span>
                <p className="text-slate-600 pl-5 leading-relaxed">
                  La pensión <strong className="text-amber-800">disminuye progresivamente</strong> año tras año debido al recálculo anual y aumento de la edad.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-900 block flex items-center gap-1.5">
                  <AlertCircle className="w-3.5 h-3.5 text-amber-600" />
                  Riesgo Financiero y Longevidad
                </span>
                <p className="text-slate-600 pl-5 leading-relaxed">
                  El afiliado asume el riesgo: si la rentabilidad de los fondos es baja o vive muchos años, el fondo se agota más rápido.
                </p>
              </div>
            </div>
          </div>

          {/* Columna Renta Vitalicia */}
          <div className="rounded-xl border border-indigo-200/80 bg-indigo-50/30 p-4 space-y-3.5">
            <div className="flex items-center justify-between pb-2 border-b border-indigo-200/60">
              <div className="flex items-center gap-2">
                <Landmark className="w-4 h-4 text-indigo-700" />
                <h4 className="font-bold text-sm text-indigo-950">Renta Vitalicia (Aseguradora)</h4>
              </div>
              <Badge className="bg-indigo-600 text-white text-[10px] py-0">
                Pensión Garantizada
              </Badge>
            </div>

            <div className="space-y-3 text-xs">
              <div className="space-y-1">
                <span className="font-semibold text-slate-900 block flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Protección a Herederos
                </span>
                <p className="text-slate-600 pl-5 leading-relaxed">
                  No hay herencia ordinaria, pero se garantiza contratando <strong className="text-slate-800">Período Garantizado</strong> (ej: 15 años), pagando el 100% a designados si fallece antes.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-900 block flex items-center gap-1.5">
                  <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                  Evolución en el Tiempo
                </span>
                <p className="text-slate-600 pl-5 leading-relaxed">
                  Pensión <strong className="text-emerald-800">100% fija en UF de por vida</strong>. Se reajusta todos los meses con el IPC oficial, sin bajas ni sorpresas.
                </p>
              </div>

              <div className="space-y-1">
                <span className="font-semibold text-slate-900 block flex items-center gap-1.5">
                  <ShieldCheck className="w-3.5 h-3.5 text-indigo-600" />
                  Riesgo Financiero y Longevidad
                </span>
                <p className="text-slate-600 pl-5 leading-relaxed">
                  El riesgo lo asume íntegramente la Compañía de Seguros. Aunque el pensionado viva 105 años, seguirá recibiendo la misma pensión contratada.
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* Resumen de Recomendación Profesional */}
        <div className="p-3 bg-slate-50 rounded-lg border border-slate-200 text-xs text-slate-600 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <span className="font-semibold text-slate-800">Consejo Asesor:</span>
            <span>
              La cláusula de <strong>Aumento Temporal + Período Garantizado 180m</strong> combina la alta liquidez inicial del Retiro Programado con la seguridad vitalicia de la Renta Vitalicia.
            </span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
