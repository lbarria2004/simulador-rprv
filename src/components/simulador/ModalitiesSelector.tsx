'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { 
  CheckCircle2, 
  Circle, 
  Plus, 
  Trash2, 
  ShieldCheck, 
  TrendingUp, 
  Layers, 
  Calculator,
  Landmark,
  Building2,
  Sparkles,
  RotateCcw,
  Percent
} from 'lucide-react';
import { ModalidadConfig, ModalidadCotizacionTipo } from './types';

interface ModalitiesSelectorProps {
  modalidades: ModalidadConfig[];
  onToggleModalidad: (id: string) => void;
  onAgregarModalidad: (nuevaModalidad: Omit<ModalidadConfig, 'id'>) => void;
  onEliminarModalidad: (id: string) => void;
  onGenerarCotizacion: () => void;
  isCotizando?: boolean;
  tipoPension?: 'vejez' | 'invalidez' | 'sobrevivencia';
  tasaRP?: number;
  setTasaRP?: (tasa: number) => void;
  tasaRV?: number;
  setTasaRV?: (tasa: number) => void;
  onRestablecerTasas?: () => void;
}

export function ModalitiesSelector({
  modalidades,
  onToggleModalidad,
  onAgregarModalidad,
  onEliminarModalidad,
  onGenerarCotizacion,
  isCotizando = false,
  tipoPension = 'vejez',
  tasaRP = 3.58,
  setTasaRP,
  tasaRV = 3.08,
  setTasaRV,
  onRestablecerTasas
}: ModalitiesSelectorProps) {
  // Estado local para el constructor de cláusulas adicionales
  const [tipoClausula, setTipoClausula] = useState<'garantizada' | 'aumento' | 'combinada'>('garantizada');
  const [mesesGarantizados, setMesesGarantizados] = useState<number>(180); // 15 años
  const [mesesAumento, setMesesAumento] = useState<number>(36); // 3 años
  const [porcentajeAumento, setPorcentajeAumento] = useState<number>(1.0); // +100%

  // En sobrevivencia, la única cláusula adicional permitida por normativa CMF/SP es el período garantizado
  React.useEffect(() => {
    if (tipoPension === 'sobrevivencia' && tipoClausula !== 'garantizada') {
      setTipoClausula('garantizada');
    }
  }, [tipoPension, tipoClausula]);

  // Cantidad de modalidades activas para cotizar (en sobrevivencia excluye aumento temporal y combinada)
  const modalidadesActivas = modalidades.filter(m => {
    if (!m.activa) return false;
    if (tipoPension === 'sobrevivencia' && (m.tipo === 'rv_aumento_temporal' || m.tipo === 'rv_combinada')) {
      return false;
    }
    return true;
  });

  // Manejar incorporación de combinación a la lista
  const handleAgregarCombinacion = () => {
    if (tipoClausula === 'garantizada' || tipoPension === 'sobrevivencia') {
      const anos = (mesesGarantizados / 12).toFixed(1).replace('.0', '');
      onAgregarModalidad({
        tipo: 'rv_garantizada',
        nombre: tipoPension === 'sobrevivencia'
          ? `RV Sobrevivencia Garantizada ${mesesGarantizados}m (${anos}a)`
          : `RV Garantizada ${mesesGarantizados} meses (${anos}a)`,
        descripcion: tipoPension === 'sobrevivencia'
          ? `Pensión familiar en UF con garantía legal de pago por ${mesesGarantizados} meses (${anos} años) transferible a beneficiarios o herederos designados.`
          : `Pensión vitalicia fija en UF con garantía de pago por ${mesesGarantizados} meses (${anos} años) a beneficiarios o herederos.`,
        mesesGarantizados,
        activa: true,
        esPersonalizada: true
      });
    } else if (tipoClausula === 'aumento') {
      const anos = (mesesAumento / 12).toFixed(1).replace('.0', '');
      const pct = Math.round(porcentajeAumento * 100);
      onAgregarModalidad({
        tipo: 'rv_aumento_temporal',
        nombre: `RV Aumento Temporal +${pct}% (${mesesAumento} meses / ${anos}a)`,
        descripcion: `Pensión aumentada en +${pct}% durante los primeros ${mesesAumento} meses (${anos} años), luego pensión vitalicia constante.`,
        mesesAumento,
        porcentajeAumento,
        activa: true,
        esPersonalizada: true
      });
    } else {
      const anosG = (mesesGarantizados / 12).toFixed(1).replace('.0', '');
      const anosA = (mesesAumento / 12).toFixed(1).replace('.0', '');
      const pct = Math.round(porcentajeAumento * 100);
      onAgregarModalidad({
        tipo: 'rv_combinada',
        nombre: `RV Combinada (Garantía ${mesesGarantizados}m + Aumento +${pct}%)`,
        descripcion: `Máxima protección: garantía de ${mesesGarantizados} meses (${anosG}a) y pensión aumentada por ${mesesAumento} meses (${anosA}a) simultáneamente.`,
        mesesGarantizados,
        mesesAumento,
        porcentajeAumento,
        activa: true,
        esPersonalizada: true
      });
    }
  };

  const rpConfig = modalidades.find(m => m.tipo === 'retiro_programado');
  const rvSimpleConfig = modalidades.find(m => m.tipo === 'renta_vitalicia_simple');
  const otrasModalidades = modalidades.filter(m => {
    if (m.tipo === 'retiro_programado' || m.tipo === 'renta_vitalicia_simple') return false;
    // En sobrevivencia, la única cláusula adicional permitida por normativa CMF/SP es período garantizado
    if (tipoPension === 'sobrevivencia') {
      return m.tipo === 'rv_garantizada';
    }
    return true;
  });

  return (
    <Card className="border-slate-200 shadow-sm overflow-hidden">
      <CardHeader className="bg-gradient-to-r from-slate-900 to-slate-800 text-white pb-3 pt-4 px-5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div className="flex items-center gap-2.5">
            <div className="p-2 rounded-lg bg-blue-600 text-white shadow-sm">
              <Layers className="w-5 h-5" />
            </div>
            <div>
              <CardTitle className="text-base font-semibold text-white">
                Cotizador Multimodalidad SCOMP
              </CardTitle>
              <CardDescription className="text-xs text-slate-300">
                Selecciona las modalidades base, agrega cláusulas a la medida y cotiza todos los escenarios en lote.
              </CardDescription>
            </div>
          </div>
          <Badge variant="outline" className="self-start sm:self-auto bg-slate-800/80 text-blue-300 border-blue-400/40 text-xs px-2.5 py-1">
            {modalidadesActivas.length} seleccionadas
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="p-5 space-y-5">
        {/* Panel de Visualización y Ajuste de Tasas de Cálculo Actuarial */}
        <div className="p-4 rounded-xl border border-blue-200/80 bg-gradient-to-br from-blue-50/70 via-slate-50 to-indigo-50/50 space-y-3.5 shadow-2xs">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-blue-200/60 pb-2.5">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-lg bg-blue-600 text-white shadow-xs">
                <Percent className="w-4 h-4" />
              </div>
              <div>
                <h4 className="text-xs font-bold text-slate-900 tracking-wide uppercase flex items-center gap-1.5">
                  Tasas de Interés de Cálculo Actuarial (Vigentes y Ajustables)
                </h4>
                <p className="text-[11px] text-slate-500">
                  Tasas anuales utilizadas para calcular el Capital Necesario Unitario (CNU) y las pensiones mensuales. Modifícalas para evaluar sensibilidad de mercado.
                </p>
              </div>
            </div>

            {onRestablecerTasas && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={onRestablecerTasas}
                className="text-[11px] h-7 px-2.5 bg-white text-slate-700 hover:text-blue-700 border-slate-300 gap-1.5 self-start sm:self-auto shrink-0 shadow-2xs"
                title="Restablecer a las tasas oficiales de referencia vigentes"
              >
                <RotateCcw className="w-3 h-3" />
                <span>Restablecer Oficiales</span>
              </Button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
            {/* Tasa Retiro Programado (TRP) */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-blue-600" />
                  <span className="text-xs font-bold text-slate-800">Tasa Retiro Programado (TRP)</span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-800 border-blue-200 font-mono">
                  SP Oficial: 3.58%
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="1.0"
                    max="8.0"
                    value={tasaRP ?? 3.58}
                    onChange={e => setTasaRP && setTasaRP(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-bold font-mono pl-3 pr-8 bg-slate-50 border-slate-300 focus:bg-white"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTasaRP && setTasaRP(Number(Math.max(1, (tasaRP ?? 3.58) - 0.1).toFixed(2)))}
                    className="h-8 w-8 p-0 text-xs text-slate-700 border-slate-300 hover:bg-slate-100"
                    title="Disminuir 0.10%"
                  >
                    -0.1
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTasaRP && setTasaRP(Number(Math.min(10, (tasaRP ?? 3.58) + 0.1).toFixed(2)))}
                    className="h-8 w-8 p-0 text-xs text-slate-700 border-slate-300 hover:bg-slate-100"
                    title="Aumentar 0.10%"
                  >
                    +0.1
                  </Button>
                </div>
              </div>

              {/* Atajos rápidos TRP */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-slate-400 font-medium">Escenarios:</span>
                {[
                  { label: '3.20%', val: 3.20 },
                  { label: '3.41%', val: 3.41 },
                  { label: '3.58% (Oficial)', val: 3.58 },
                  { label: '3.80%', val: 3.80 },
                  { label: '4.00%', val: 4.00 }
                ].map(sc => (
                  <button
                    key={sc.val}
                    type="button"
                    onClick={() => setTasaRP && setTasaRP(sc.val)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      Math.abs((tasaRP ?? 3.58) - sc.val) < 0.001
                        ? 'bg-blue-600 text-white border-blue-600 font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Tasa Renta Vitalicia (TRV) */}
            <div className="p-3 bg-white rounded-xl border border-slate-200/90 shadow-2xs space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                  <span className="text-xs font-bold text-slate-800">Tasa Renta Vitalicia (TRV)</span>
                </div>
                <Badge variant="outline" className="text-[10px] bg-indigo-50 text-indigo-800 border-indigo-200 font-mono">
                  {tipoPension === 'invalidez' ? 'CMF Invalidez: 3.03%' : tipoPension === 'sobrevivencia' ? 'CMF Sobrevivencia: 3.01%' : 'CMF Líder: 3.08%'}
                </Badge>
              </div>

              <div className="flex items-center gap-2">
                <div className="relative flex-1">
                  <Input
                    type="number"
                    step="0.01"
                    min="1.0"
                    max="7.0"
                    value={tasaRV ?? 3.08}
                    onChange={e => setTasaRV && setTasaRV(parseFloat(e.target.value) || 0)}
                    className="h-8 text-xs font-bold font-mono pl-3 pr-8 bg-slate-50 border-slate-300 focus:bg-white"
                  />
                  <span className="absolute right-2.5 top-1/2 -translate-y-1/2 text-xs font-bold text-slate-400">%</span>
                </div>

                <div className="flex items-center gap-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTasaRV && setTasaRV(Number(Math.max(1, (tasaRV ?? 3.08) - 0.1).toFixed(2)))}
                    className="h-8 w-8 p-0 text-xs text-slate-700 border-slate-300 hover:bg-slate-100"
                    title="Disminuir 0.10%"
                  >
                    -0.1
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setTasaRV && setTasaRV(Number(Math.min(10, (tasaRV ?? 3.08) + 0.1).toFixed(2)))}
                    className="h-8 w-8 p-0 text-xs text-slate-700 border-slate-300 hover:bg-slate-100"
                    title="Aumentar 0.10%"
                  >
                    +0.1
                  </Button>
                </div>
              </div>

              {/* Atajos rápidos TRV */}
              <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                <span className="text-[10px] text-slate-400 font-medium">Escenarios:</span>
                {[
                  { label: '2.85%', val: 2.85 },
                  { label: '3.01%', val: 3.01 },
                  { label: '3.08% (Líder)', val: 3.08 },
                  { label: '3.25%', val: 3.25 },
                  { label: '3.50%', val: 3.50 }
                ].map(sc => (
                  <button
                    key={sc.val}
                    type="button"
                    onClick={() => setTasaRV && setTasaRV(sc.val)}
                    className={`text-[10px] px-2 py-0.5 rounded border transition-colors ${
                      Math.abs((tasaRV ?? 3.08) - sc.val) < 0.001
                        ? 'bg-indigo-600 text-white border-indigo-600 font-bold'
                        : 'bg-slate-50 text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {sc.label}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* 1. Grilla de Modalidades Base */}
        <div className="space-y-2.5">
          <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider flex items-center gap-1.5">
            <span>1. Modalidades Base Obligatorias del Sistema</span>
          </Label>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {/* Tarjeta Retiro Programado */}
            {rpConfig && (
              <div
                onClick={() => onToggleModalidad(rpConfig.id)}
                className={`cursor-pointer rounded-xl p-3.5 border-2 transition-all flex items-start justify-between gap-3 ${
                  rpConfig.activa
                    ? 'border-blue-600 bg-blue-50/50 shadow-sm ring-1 ring-blue-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 opacity-75'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Landmark className={`w-4 h-4 ${rpConfig.activa ? 'text-blue-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-sm text-slate-900">
                      {tipoPension === 'sobrevivencia' ? 'Retiro Programado de Sobrevivencia' : 'Retiro Programado (RP)'}
                    </span>
                    <Badge variant="secondary" className="text-[10px] bg-slate-200 text-slate-700">
                      AFP
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {tipoPension === 'sobrevivencia'
                      ? 'Pensión familiar mensual calculada anualmente con tablas de sobrevivencia B-2020/MI. Los fondos remanentes constituyen herencia.'
                      : 'Pensión mensual variable calculada anualmente. Los fondos permanecen en tu cuenta individual y constituyen herencia.'}
                  </p>
                  <div className="pt-1">
                    <Badge variant="outline" className="text-[10px] bg-blue-100/70 text-blue-800 border-blue-300 font-mono">
                      Tasa aplicada: {(tasaRP ?? 3.58).toFixed(2)}% anual
                    </Badge>
                  </div>
                </div>
                <div>
                  {rpConfig.activa ? (
                    <CheckCircle2 className="w-5 h-5 text-blue-600 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  )}
                </div>
              </div>
            )}

            {/* Tarjeta Renta Vitalicia Simple */}
            {rvSimpleConfig && (
              <div
                onClick={() => onToggleModalidad(rvSimpleConfig.id)}
                className={`cursor-pointer rounded-xl p-3.5 border-2 transition-all flex items-start justify-between gap-3 ${
                  rvSimpleConfig.activa
                    ? 'border-indigo-600 bg-indigo-50/50 shadow-sm ring-1 ring-indigo-600/20'
                    : 'border-slate-200 bg-white hover:border-slate-300 opacity-75'
                }`}
              >
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <Building2 className={`w-4 h-4 ${rvSimpleConfig.activa ? 'text-indigo-600' : 'text-slate-400'}`} />
                    <span className="font-semibold text-sm text-slate-900">
                      {tipoPension === 'sobrevivencia' ? 'Renta Vitalicia Sobrevivencia Simple' : 'Renta Vitalicia Simple'}
                    </span>
                    <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-700">
                      Compañía
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    {tipoPension === 'sobrevivencia'
                      ? 'Pensión familiar fija e irrevocable en UF de por vida distribuida según Art. 58 DL 3500. La aseguradora asume el riesgo.'
                      : 'Pensión fija e irrevocable en UF de por vida. La aseguradora asume el riesgo financiero y de longevidad.'}
                  </p>
                  <div className="pt-1">
                    <Badge variant="outline" className="text-[10px] bg-indigo-100/70 text-indigo-800 border-indigo-300 font-mono">
                      Tasa aplicada: {(tasaRV ?? 3.08).toFixed(2)}% anual
                    </Badge>
                  </div>
                </div>
                <div>
                  {rvSimpleConfig.activa ? (
                    <CheckCircle2 className="w-5 h-5 text-indigo-600 flex-shrink-0" />
                  ) : (
                    <Circle className="w-5 h-5 text-slate-300 flex-shrink-0" />
                  )}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* 2. Constructor de Cláusulas Adicionales */}
        <div className="p-4 rounded-xl border border-slate-200 bg-slate-50/60 space-y-3.5">
          <div className="flex items-center justify-between">
            <Label className="text-xs font-semibold text-slate-800 uppercase tracking-wider flex items-center gap-1.5">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>2. Diseñar e Incorporar Cláusula Adicional</span>
            </Label>
            <span className="text-[11px] text-slate-500">Agrega múltiples opciones a la cotización</span>
          </div>

          {/* Advertencia regulatoria en pensión de sobrevivencia */}
          {tipoPension === 'sobrevivencia' && (
            <div className="p-2.5 rounded-lg bg-purple-50 border border-purple-200 text-xs text-purple-950 flex items-start gap-2">
              <span className="text-sm">⚖️</span>
              <div className="leading-snug">
                <strong>Normativa Oficial CMF y SP (Compendio de Pensiones):</strong> En pensión de sobrevivencia <strong>NO procede la contratación de cláusulas de Aumento Temporal de Pensión</strong> (reservadas por ley exclusivamente a Vejez e Invalidez). De común acuerdo, los beneficiarios legales pueden optar por <strong>Retiro Programado</strong>, <strong>Renta Vitalicia Simple</strong> o <strong>Renta Vitalicia con Período Garantizado de Pago</strong>.
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Selector de Tipo */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Tipo de Cláusula</Label>
              <Select
                value={tipoClausula}
                onValueChange={(val: 'garantizada' | 'aumento' | 'combinada') => setTipoClausula(val)}
                disabled={tipoPension === 'sobrevivencia'}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="garantizada">
                    {tipoPension === 'sobrevivencia' ? '🛡️ Período Garantizado de Pago (Sobrevivencia)' : '🛡️ Período Garantizado'}
                  </SelectItem>
                  {tipoPension !== 'sobrevivencia' && (
                    <SelectItem value="aumento">📈 Aumento Temporal</SelectItem>
                  )}
                  {tipoPension !== 'sobrevivencia' && (
                    <SelectItem value="combinada">⭐ Garantía + Aumento</SelectItem>
                  )}
                </SelectContent>
              </Select>
            </div>

            {/* Parámetro 1: Garantía (en meses manual) */}
            {(tipoClausula === 'garantizada' || tipoClausula === 'combinada') && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600 font-medium">Garantía (meses)</Label>
                  <Badge variant="outline" className="text-[10px] bg-amber-50 text-amber-800 border-amber-200 py-0 h-4 font-semibold">
                    {(mesesGarantizados / 12).toFixed(1).replace('.0', '')} años
                  </Badge>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={360}
                    step={1}
                    value={mesesGarantizados || ''}
                    onChange={e => setMesesGarantizados(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="180"
                    className="h-9 text-xs bg-white pr-14 font-semibold text-slate-900 font-mono"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-400 font-semibold pointer-events-none">
                    meses
                  </span>
                </div>
                <div className="flex items-center gap-1 pt-0.5">
                  {[120, 180, 240, 300].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMesesGarantizados(m)}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                        mesesGarantizados === m
                          ? 'bg-amber-100 text-amber-900 border-amber-300 font-bold'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {m / 12}a ({m}m)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Parámetro 2: Plazo Aumento (en meses manual) */}
            {(tipoClausula === 'aumento' || tipoClausula === 'combinada') && (
              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <Label className="text-xs text-slate-600 font-medium">Plazo Aumento (meses)</Label>
                  <Badge variant="outline" className="text-[10px] bg-rose-50 text-rose-800 border-rose-200 py-0 h-4 font-semibold">
                    {(mesesAumento / 12).toFixed(1).replace('.0', '')} años
                  </Badge>
                </div>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    step={1}
                    value={mesesAumento || ''}
                    onChange={e => setMesesAumento(Math.max(0, parseInt(e.target.value) || 0))}
                    placeholder="36"
                    className="h-9 text-xs bg-white pr-14 font-semibold text-slate-900 font-mono"
                  />
                  <span className="absolute right-2.5 top-2.5 text-[10px] text-slate-400 font-semibold pointer-events-none">
                    meses
                  </span>
                </div>
                <div className="flex items-center gap-1 pt-0.5">
                  {[12, 24, 36, 48, 60].map(m => (
                    <button
                      key={m}
                      type="button"
                      onClick={() => setMesesAumento(m)}
                      className={`text-[9px] px-1.5 py-0.5 rounded border transition-colors ${
                        mesesAumento === m
                          ? 'bg-rose-100 text-rose-900 border-rose-300 font-bold'
                          : 'bg-white text-slate-500 border-slate-200 hover:bg-slate-50'
                      }`}
                    >
                      {m / 12}a ({m}m)
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Parámetro 3: Porcentaje de Aumento (si aplica) */}
            {(tipoClausula === 'aumento' || tipoClausula === 'combinada') && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Monto del Aumento</Label>
                <Select
                  value={String(porcentajeAumento)}
                  onValueChange={val => setPorcentajeAumento(Number(val))}
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="0.30">+30% de pensión</SelectItem>
                    <SelectItem value="0.50">+50% de pensión</SelectItem>
                    <SelectItem value="0.75">+75% de pensión</SelectItem>
                    <SelectItem value="1.00">+100% (Duplica la pensión)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <div className="flex justify-end pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleAgregarCombinacion}
              className="h-8 text-xs font-semibold bg-white text-blue-700 border-blue-300 hover:bg-blue-50 flex items-center gap-1.5 shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Incorporar combinación a la lista</span>
            </Button>
          </div>
        </div>

        {/* 3. Lista de Modalidades Seleccionadas para Cotizar */}
        {otrasModalidades.length > 0 && (
          <div className="space-y-2">
            <Label className="text-xs font-semibold text-slate-700 uppercase tracking-wider">
              3. Modalidades con Cláusulas Agregadas ({otrasModalidades.length})
            </Label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
              {otrasModalidades.map(mod => (
                <div
                  key={mod.id}
                  className={`rounded-lg p-2.5 border transition-all flex items-center justify-between gap-2 ${
                    mod.activa ? 'bg-emerald-50/50 border-emerald-300' : 'bg-slate-50 border-slate-200 opacity-60'
                  }`}
                >
                  <div
                    onClick={() => onToggleModalidad(mod.id)}
                    className="cursor-pointer flex items-center gap-2 min-w-0 flex-1"
                  >
                    {mod.activa ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-600 flex-shrink-0" />
                    ) : (
                      <Circle className="w-4 h-4 text-slate-400 flex-shrink-0" />
                    )}
                    <div className="truncate">
                      <p className="text-xs font-semibold text-slate-900 truncate">{mod.nombre}</p>
                      <p className="text-[10px] text-slate-500 truncate">{mod.descripcion}</p>
                    </div>
                  </div>
                  {mod.esPersonalizada && (
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => onEliminarModalidad(mod.id)}
                      className="h-6 w-6 text-slate-400 hover:text-rose-600 flex-shrink-0"
                      title="Eliminar combinación"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* 4. Botón de Acción Principal: Generar Cotización en Lote */}
        <div className="pt-2 border-t border-slate-100 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="text-xs text-slate-600 flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-emerald-500"></span>
            <span>
              Se procesarán <strong>{modalidadesActivas.length} modalidades</strong> con las tablas oficiales TM-2020.
            </span>
          </div>

          <Button
            type="button"
            size="default"
            onClick={onGenerarCotizacion}
            disabled={modalidadesActivas.length === 0 || isCotizando}
            className="w-full sm:w-auto h-10 px-6 font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white shadow-md hover:shadow-lg transition-all flex items-center justify-center gap-2"
          >
            <Calculator className={`w-4 h-4 ${isCotizando ? 'animate-spin' : ''}`} />
            <span>Generar Cotización ({modalidadesActivas.length})</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
