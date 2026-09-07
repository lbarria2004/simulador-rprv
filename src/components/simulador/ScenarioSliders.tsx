'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Slider } from '@/components/ui/slider';
import { Badge } from '@/components/ui/badge';
import { Label } from '@/components/ui/label';
import { Sliders, Shield, TrendingUp, Award, Calendar, Percent, Landmark, Building2 } from 'lucide-react';
import { CláusulasState } from './types';

interface ScenarioSlidersProps {
  clausulas: CláusulasState;
  setClausulas: React.Dispatch<React.SetStateAction<CláusulasState>>;
  anosCotizados: number;
  setAnosCotizados: (anos: number) => void;
  bacUF: number;
  tasaRP?: number;
  setTasaRP?: (tasa: number) => void;
  tasaRV?: number;
  setTasaRV?: (tasa: number) => void;
}

export function ScenarioSliders({
  clausulas,
  setClausulas,
  anosCotizados,
  setAnosCotizados,
  bacUF,
  tasaRP = 3.58,
  setTasaRP,
  tasaRV = 3.08,
  setTasaRV
}: ScenarioSlidersProps) {
  const anosGarantia = Math.floor(clausulas.mesesGarantizados / 12);
  const anosAumento = Math.floor(clausulas.mesesAumento / 12);
  const pctAumentoInt = Math.round(clausulas.porcentajeAumento * 100);

  return (
    <Card className="border-slate-200 shadow-sm">
      <CardHeader className="pb-3 pt-4 px-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="p-1.5 rounded-md bg-emerald-600 text-white">
              <Sliders className="w-4 h-4" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-slate-900">
                Ajuste Interactivo de Cláusulas y Escenarios
              </CardTitle>
              <CardDescription className="text-xs text-slate-500">
                Modifica los controles deslizantes para recalcular las coberturas en tiempo real
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200">
            Recálculo Instantáneo
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="px-4 pb-4 grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* 1. Slider: Período Garantizado */}
        <div className="space-y-3 p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Shield className="w-4 h-4 text-indigo-600" />
              <Label className="text-xs font-semibold text-slate-800">Período Garantizado</Label>
            </div>
            <Badge className="bg-indigo-600 text-white font-mono text-xs">
              {anosGarantia === 0 ? 'Sin Garantía' : `${anosGarantia} años (${clausulas.mesesGarantizados}m)`}
            </Badge>
          </div>

          <Slider
            min={0}
            max={300}
            step={60}
            value={[clausulas.mesesGarantizados]}
            onValueChange={([val]) => setClausulas(prev => ({ ...prev, mesesGarantizados: val }))}
            className="py-1"
          />

          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>0a</span>
            <span>5a</span>
            <span>10a</span>
            <span className="text-indigo-600 font-bold">15a (SCOMP)</span>
            <span>20a</span>
            <span>25a</span>
          </div>

          <p className="text-[11px] text-slate-500 leading-tight">
            {clausulas.mesesGarantizados > 0
              ? `Si fallece antes de ${anosGarantia} años, los herederos o beneficiarios reciben el 100% de la pensión.`
              : 'Pensión estándar: al fallecer sin cargas legales no genera pagos a herederos.'}
          </p>
        </div>

        {/* 2. Slider: Aumento Temporal */}
        <div className="space-y-3 p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <TrendingUp className="w-4 h-4 text-emerald-600" />
              <Label className="text-xs font-semibold text-slate-800">Aumento Temporal</Label>
            </div>
            <Badge className="bg-emerald-600 text-white font-mono text-xs">
              +{pctAumentoInt}% por {anosAumento} {anosAumento === 1 ? 'año' : 'años'}
            </Badge>
          </div>

          {/* Porcentaje de Aumento */}
          <div className="space-y-1">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Porcentaje de Aumento:</span>
              <span className="font-semibold text-emerald-900">+{pctAumentoInt}%</span>
            </div>
            <Slider
              min={10}
              max={100}
              step={10}
              value={[pctAumentoInt]}
              onValueChange={([val]) => setClausulas(prev => ({ ...prev, porcentajeAumento: val / 100 }))}
              className="py-1"
            />
          </div>

          {/* Plazo del Aumento */}
          <div className="space-y-1 pt-1">
            <div className="flex justify-between text-[11px] text-slate-500">
              <span>Plazo de Duración:</span>
              <span className="font-semibold text-emerald-900">{clausulas.mesesAumento} meses ({anosAumento} años)</span>
            </div>
            <Slider
              min={12}
              max={60}
              step={12}
              value={[clausulas.mesesAumento]}
              onValueChange={([val]) => setClausulas(prev => ({ ...prev, mesesAumento: val }))}
              className="py-1"
            />
          </div>
        </div>

        {/* 3. Slider: Años Cotizados (BAC) */}
        <div className="space-y-3 p-3 bg-slate-50/70 rounded-xl border border-slate-200/70">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Award className="w-4 h-4 text-amber-600" />
              <Label className="text-xs font-semibold text-slate-800">Años Cotizados (BAC)</Label>
            </div>
            <Badge className="bg-amber-600 text-white font-mono text-xs">
              {anosCotizados} años cotizados
            </Badge>
          </div>

          <Slider
            min={0}
            max={40}
            step={1}
            value={[anosCotizados]}
            onValueChange={([val]) => setAnosCotizados(val)}
            className="py-1"
          />

          <div className="flex justify-between text-[10px] text-slate-400 font-medium">
            <span>0 años</span>
            <span>10 años</span>
            <span>20 años</span>
            <span className="text-amber-700 font-bold">25a (Tope 2,5 UF)</span>
            <span>40 años</span>
          </div>

          <div className="p-2 bg-amber-50 rounded-lg border border-amber-200/60 text-[11px] flex items-center justify-between">
            <span className="text-amber-900 font-medium">Bono BAC Devengado:</span>
            <span className="font-bold text-amber-950 font-mono">
              +{bacUF.toFixed(2)} UF/mes {bacUF >= 2.5 && '(Tope legal)'}
            </span>
          </div>
        </div>

        {/* 4. Slider Sensibilidad: Tasa Retiro Programado (TRP) */}
        {setTasaRP && (
          <div className="space-y-3 p-3 bg-blue-50/50 rounded-xl border border-blue-200/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Landmark className="w-4 h-4 text-blue-600" />
                <Label className="text-xs font-semibold text-slate-800">Tasa Retiro Programado (TRP)</Label>
              </div>
              <Badge className="bg-blue-600 text-white font-mono text-xs">
                {tasaRP.toFixed(2)}% anual
              </Badge>
            </div>

            <Slider
              min={1.5}
              max={6.0}
              step={0.05}
              value={[tasaRP]}
              onValueChange={([val]) => setTasaRP(Number(val.toFixed(2)))}
              className="py-1"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>1.5%</span>
              <span>2.5%</span>
              <span className="text-blue-700 font-bold">3.58% (SP)</span>
              <span>4.5%</span>
              <span>6.0%</span>
            </div>

            <p className="text-[11px] text-slate-500 leading-tight">
              Afecta el factor CNU del Retiro Programado. Una tasa mayor incrementa la pensión inicial en la AFP.
            </p>
          </div>
        )}

        {/* 5. Slider Sensibilidad: Tasa Renta Vitalicia (TRV) */}
        {setTasaRV && (
          <div className="space-y-3 p-3 bg-indigo-50/50 rounded-xl border border-indigo-200/70">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5">
                <Building2 className="w-4 h-4 text-indigo-600" />
                <Label className="text-xs font-semibold text-slate-800">Tasa Renta Vitalicia (TRV)</Label>
              </div>
              <Badge className="bg-indigo-600 text-white font-mono text-xs">
                {tasaRV.toFixed(2)}% anual
              </Badge>
            </div>

            <Slider
              min={1.5}
              max={5.0}
              step={0.05}
              value={[tasaRV]}
              onValueChange={([val]) => setTasaRV(Number(val.toFixed(2)))}
              className="py-1"
            />

            <div className="flex justify-between text-[10px] text-slate-400 font-medium">
              <span>1.5%</span>
              <span>2.5%</span>
              <span className="text-indigo-700 font-bold">3.08% (CMF)</span>
              <span>4.0%</span>
              <span>5.0%</span>
            </div>

            <p className="text-[11px] text-slate-500 leading-tight">
              Tasa de descuento de la aseguradora. Una tasa mayor eleva la renta vitalicia mensual en UF garantizada.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
