'use client';

import React from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  TrendingDown, 
  ShieldCheck, 
  Sparkles, 
  HelpCircle, 
  Landmark, 
  Building, 
  CheckCircle2, 
  Coins
} from 'lucide-react';
import { AFP, ResultadoEscenario, ResultadoPGU, ResultadoBAC } from '@/lib/pension-calculator';

interface SummaryCardsProps {
  resultadoRP: ResultadoEscenario | null;
  resultadoRVSimple: ResultadoEscenario | null;
  resultadoRVClausulas: ResultadoEscenario | null;
  afpSeleccionada: AFP;
  onSelectAFP: (afp: AFP) => void;
  pgu: ResultadoPGU;
  bac: ResultadoBAC;
  edadAfiliado: number;
}

const COMISIONES_AFP: Record<AFP, { label: string; pct: number }> = {
  PLANVITAL: { label: 'PlanVital', pct: 0.00 },
  HABITAT: { label: 'Habitat', pct: 0.95 },
  MODELO: { label: 'Modelo', pct: 1.20 },
  UNO: { label: 'Uno', pct: 1.20 },
  CAPITAL: { label: 'Capital', pct: 1.25 },
  CUPRUM: { label: 'Cuprum', pct: 1.25 },
  PROVIDA: { label: 'Provida', pct: 1.25 }
};

export function SummaryCards({
  resultadoRP,
  resultadoRVSimple,
  resultadoRVClausulas,
  afpSeleccionada,
  onSelectAFP,
  pgu,
  bac,
  edadAfiliado
}: SummaryCardsProps) {
  // Ajuste por comisión de AFP en Retiro Programado
  const comisionInfo = COMISIONES_AFP[afpSeleccionada] || { label: 'PlanVital', pct: 0.0 };
  const factorComision = 1 - (comisionInfo.pct / 100);

  const rpNetoCLP = resultadoRP ? Math.round(resultadoRP.pensionMensual * factorComision) : 0;
  const rpNetoUF = resultadoRP ? Math.round((resultadoRP.pensionEnUF * factorComision) * 100) / 100 : 0;

  const pguMonto = pgu.aplica ? pgu.montoMensual : 0;
  const bacMonto = bac.aplica ? bac.beneficioMensualPesos : 0;

  return (
    <div className="space-y-3">
      {/* Banner de Beneficios Estatales Integrados (PGU + BAC) */}
      <div className="bg-gradient-to-r from-blue-900 via-indigo-900 to-slate-900 text-white rounded-xl p-3 px-4 shadow-sm flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-white/10 rounded-lg backdrop-blur-sm border border-white/10">
            <Coins className="w-5 h-5 text-amber-300" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <span className="text-xs font-semibold uppercase tracking-wider text-blue-200">
                Beneficios Estatales Complementarios
              </span>
              <Badge className="bg-amber-400/20 text-amber-300 border-amber-400/30 text-[10px] py-0">
                Ley 21.419
              </Badge>
            </div>
            <p className="text-xs text-slate-300">
              Se suman directamente a la pensión seleccionada si cumple los requisitos legales
            </p>
          </div>
        </div>

        <div className="flex items-center gap-4 text-xs">
          {/* Badge PGU */}
          <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
            <span className="text-slate-300 font-medium">PGU:</span>
            {pgu.aplica ? (
              <span className="text-emerald-300 font-bold font-mono">
                +${pgu.montoMensual.toLocaleString('es-CL')}/mes
              </span>
            ) : (
              <span className="text-amber-200/80 text-[11px]">
                {edadAfiliado < 65 ? 'Disponible desde los 65 años' : 'Pensión supera límite'}
              </span>
            )}
          </div>

          {/* Badge BAC */}
          {bac.aplica && (
            <div className="bg-white/10 px-3 py-1.5 rounded-lg border border-white/10 flex items-center gap-2">
              <span className="text-slate-300 font-medium">BAC (Años Cotizados):</span>
              <span className="text-emerald-300 font-bold font-mono">
                +{bac.beneficioUF.toFixed(2)} UF (+${bac.beneficioMensualPesos.toLocaleString('es-CL')})
              </span>
            </div>
          )}
        </div>
      </div>

      {/* Las 3 Tarjetas Comparativas Principales */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {/* 1. Retiro Programado (AFP) */}
        <Card className="border-slate-200 hover:border-blue-400 transition-all shadow-sm flex flex-col justify-between">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="p-1.5 rounded-md bg-blue-100 text-blue-800">
                  <Building className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-none">Retiro Programado</h3>
                  <span className="text-[10px] text-slate-500">Administrado por AFP</span>
                </div>
              </div>
              <Badge variant="outline" className="text-[10px] font-medium text-slate-600 border-slate-200">
                1er Año
              </Badge>
            </div>

            {/* Selector de AFP para comisión */}
            <div className="flex items-center justify-between text-xs pt-1">
              <span className="text-slate-500 text-[11px]">AFP Administradora:</span>
              <Select value={afpSeleccionada} onValueChange={(val: AFP) => onSelectAFP(val)}>
                <SelectTrigger className="h-6 w-32 text-[11px] font-medium">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PLANVITAL">PlanVital (0,00%)</SelectItem>
                  <SelectItem value="HABITAT">Habitat (0,95%)</SelectItem>
                  <SelectItem value="MODELO">Modelo (1,20%)</SelectItem>
                  <SelectItem value="UNO">Uno (1,20%)</SelectItem>
                  <SelectItem value="PROVIDA">Provida (1,25%)</SelectItem>
                  <SelectItem value="CAPITAL">Capital (1,25%)</SelectItem>
                  <SelectItem value="CUPRUM">Cuprum (1,25%)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Monto Principal */}
            <div className="p-3 bg-blue-50/60 rounded-lg border border-blue-100 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-blue-950 font-mono tracking-tight">
                  {rpNetoUF.toFixed(2)} <span className="text-xs font-semibold text-blue-800">UF/mes</span>
                </span>
                <span className="text-xs font-bold text-blue-800">
                  ${rpNetoCLP.toLocaleString('es-CL')}
                </span>
              </div>
              {pgu.aplica && (
                <div className="text-[11px] text-emerald-800 font-medium flex items-center justify-between border-t border-blue-200/60 pt-1">
                  <span>Con PGU Estatal:</span>
                  <span className="font-bold font-mono">
                    ${(rpNetoCLP + pguMonto).toLocaleString('es-CL')}
                  </span>
                </div>
              )}
            </div>

            {/* Características clave */}
            <ul className="text-[11px] text-slate-600 space-y-1">
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>Mantiene propiedad de fondos y herencia</span>
              </li>
              <li className="flex items-center gap-1.5 text-amber-700">
                <TrendingDown className="w-3.5 h-3.5 text-amber-600 flex-shrink-0" />
                <span>Pensión disminuye con los años (recálculo anual)</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* 2. Renta Vitalicia Inmediata Simple */}
        <Card className="border-slate-200 hover:border-indigo-400 transition-all shadow-sm flex flex-col justify-between">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="p-1.5 rounded-md bg-indigo-100 text-indigo-800">
                  <Landmark className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-none">RV Inmediata Simple</h3>
                  <span className="text-[10px] text-slate-500">Compañía de Seguros</span>
                </div>
              </div>
              <Badge className="bg-indigo-600 text-white text-[10px] py-0">
                De por Vida
              </Badge>
            </div>

            <div className="text-xs text-slate-500 pt-1 flex items-center justify-between">
              <span>Oferta Líder CMF:</span>
              <span className="font-semibold text-slate-700">Confuturo / 4Life (2,92%)</span>
            </div>

            {/* Monto Principal */}
            <div className="p-3 bg-indigo-50/60 rounded-lg border border-indigo-100 space-y-1">
              <div className="flex items-baseline justify-between">
                <span className="text-2xl font-black text-indigo-950 font-mono tracking-tight">
                  {resultadoRVSimple ? resultadoRVSimple.pensionEnUF.toFixed(2) : '0.00'}{' '}
                  <span className="text-xs font-semibold text-indigo-800">UF/mes</span>
                </span>
                <span className="text-xs font-bold text-indigo-800">
                  ${resultadoRVSimple ? resultadoRVSimple.pensionMensual.toLocaleString('es-CL') : '0'}
                </span>
              </div>
              {pgu.aplica && (
                <div className="text-[11px] text-emerald-800 font-medium flex items-center justify-between border-t border-indigo-200/60 pt-1">
                  <span>Con PGU Estatal:</span>
                  <span className="font-bold font-mono">
                    ${((resultadoRVSimple?.pensionMensual || 0) + pguMonto).toLocaleString('es-CL')}
                  </span>
                </div>
              )}
            </div>

            {/* Características clave */}
            <ul className="text-[11px] text-slate-600 space-y-1">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-indigo-600 flex-shrink-0" />
                <span>100% Fija en UF de por vida (no decrece)</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>Garantía Estatal CMF ante quiebra</span>
              </li>
            </ul>
          </CardContent>
        </Card>

        {/* 3. RV con Cláusulas (Aumento Temporal + Garantía) */}
        <Card className="border-indigo-300 bg-gradient-to-b from-white to-slate-50/70 hover:border-emerald-500 transition-all shadow-sm flex flex-col justify-between">
          <CardContent className="p-4 space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <div className="p-1.5 rounded-md bg-emerald-600 text-white">
                  <Sparkles className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 leading-none">RV con Cláusulas</h3>
                  <span className="text-[10px] text-slate-500">Aumento Temporal + Garantía</span>
                </div>
              </div>
              <Badge className="bg-emerald-600 text-white text-[10px] py-0">
                Elegida SCOMP
              </Badge>
            </div>

            {/* Montos Durante Aumento y Posterior */}
            <div className="p-3 bg-emerald-50/60 rounded-lg border border-emerald-200 space-y-1.5">
              <div>
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold text-emerald-900">Período Inicial Aumentado:</span>
                  <Badge variant="outline" className="text-[9px] bg-white text-emerald-800 border-emerald-300 py-0">
                    {resultadoRVClausulas?.aumentoTemporal?.meses ? `${resultadoRVClausulas.aumentoTemporal.meses / 12} Años` : '3 Años'}
                  </Badge>
                </div>
                <div className="flex items-baseline justify-between mt-0.5">
                  <span className="text-xl font-black text-emerald-950 font-mono">
                    {resultadoRVClausulas?.aumentoTemporal
                      ? (resultadoRVClausulas.aumentoTemporal.pensionAumentada / (resultadoRVSimple ? resultadoRVSimple.pensionMensual / resultadoRVSimple.pensionEnUF : 40876)).toFixed(2)
                      : '0.00'}{' '}
                    <span className="text-xs font-semibold text-emerald-800">UF</span>
                  </span>
                  <span className="text-xs font-bold text-emerald-900">
                    ${resultadoRVClausulas?.aumentoTemporal?.pensionAumentada.toLocaleString('es-CL') || '0'}
                  </span>
                </div>
              </div>

              <div className="border-t border-emerald-200/80 pt-1 text-[11px] flex items-center justify-between text-slate-600">
                <span>Pensión posterior vitalicia:</span>
                <span className="font-bold text-slate-900 font-mono">
                  ${resultadoRVClausulas?.aumentoTemporal?.pensionFinal.toLocaleString('es-CL') || '0'}
                </span>
              </div>
            </div>

            {/* Beneficios */}
            <ul className="text-[11px] text-slate-600 space-y-1">
              <li className="flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>Garantía de {resultadoRVClausulas?.periodoGarantizado ? `${resultadoRVClausulas.periodoGarantizado / 12} años` : '15 años'} a herederos</span>
              </li>
              <li className="flex items-center gap-1.5">
                <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600 flex-shrink-0" />
                <span>Mayor liquidez durante los primeros años</span>
              </li>
            </ul>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
