'use client';

import React, { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Label } from '@/components/ui/label';
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
  Sparkles
} from 'lucide-react';
import { ModalidadConfig, ModalidadCotizacionTipo } from './types';

interface ModalitiesSelectorProps {
  modalidades: ModalidadConfig[];
  onToggleModalidad: (id: string) => void;
  onAgregarModalidad: (nuevaModalidad: Omit<ModalidadConfig, 'id'>) => void;
  onEliminarModalidad: (id: string) => void;
  onGenerarCotizacion: () => void;
  isCotizando?: boolean;
}

export function ModalitiesSelector({
  modalidades,
  onToggleModalidad,
  onAgregarModalidad,
  onEliminarModalidad,
  onGenerarCotizacion,
  isCotizando = false
}: ModalitiesSelectorProps) {
  // Estado local para el constructor de cláusulas adicionales
  const [tipoClausula, setTipoClausula] = useState<'garantizada' | 'aumento' | 'combinada'>('garantizada');
  const [mesesGarantizados, setMesesGarantizados] = useState<number>(180); // 15 años
  const [mesesAumento, setMesesAumento] = useState<number>(36); // 3 años
  const [porcentajeAumento, setPorcentajeAumento] = useState<number>(1.0); // +100%

  // Cantidad de modalidades activas para cotizar
  const modalidadesActivas = modalidades.filter(m => m.activa);

  // Manejar incorporación de combinación a la lista
  const handleAgregarCombinacion = () => {
    if (tipoClausula === 'garantizada') {
      const anos = Math.round(mesesGarantizados / 12);
      onAgregarModalidad({
        tipo: 'rv_garantizada',
        nombre: `RV Garantizada ${anos} años (${mesesGarantizados} meses)`,
        descripcion: `Pensión vitalicia fija en UF con garantía de pago por ${anos} años a beneficiarios o herederos.`,
        mesesGarantizados,
        activa: true,
        esPersonalizada: true
      });
    } else if (tipoClausula === 'aumento') {
      const anos = Math.round(mesesAumento / 12);
      const pct = Math.round(porcentajeAumento * 100);
      onAgregarModalidad({
        tipo: 'rv_aumento_temporal',
        nombre: `RV Aumento Temporal +${pct}% (${anos} ${anos === 1 ? 'año' : 'años'})`,
        descripcion: `Pensión aumentada al doble durante los primeros ${anos} años, luego pensión vitalicia constante.`,
        mesesAumento,
        porcentajeAumento,
        activa: true,
        esPersonalizada: true
      });
    } else {
      const anosG = Math.round(mesesGarantizados / 12);
      const anosA = Math.round(mesesAumento / 12);
      const pct = Math.round(porcentajeAumento * 100);
      onAgregarModalidad({
        tipo: 'rv_combinada',
        nombre: `RV Combinada (Garantía ${anosG}a + Aumento +${pct}%)`,
        descripcion: `Máxima protección: garantía de ${anosG} años y pensión aumentada por ${anosA} años simultáneamente.`,
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
  const otrasModalidades = modalidades.filter(m => m.tipo !== 'retiro_programado' && m.tipo !== 'renta_vitalicia_simple');

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
                    <span className="font-semibold text-sm text-slate-900">Retiro Programado (RP)</span>
                    <Badge variant="secondary" className="text-[10px] bg-slate-200 text-slate-700">
                      AFP
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pensión mensual variable calculada anualmente. Los fondos permanecen en tu cuenta individual y constituyen herencia.
                  </p>
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
                    <span className="font-semibold text-sm text-slate-900">Renta Vitalicia Simple</span>
                    <Badge variant="secondary" className="text-[10px] bg-indigo-100 text-indigo-700">
                      Compañía
                    </Badge>
                  </div>
                  <p className="text-xs text-slate-600 leading-relaxed">
                    Pensión fija e irrevocable en UF de por vida. La aseguradora asume el riesgo financiero y de longevidad.
                  </p>
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

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            {/* Selector de Tipo */}
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Tipo de Cláusula</Label>
              <Select
                value={tipoClausula}
                onValueChange={(val: 'garantizada' | 'aumento' | 'combinada') => setTipoClausula(val)}
              >
                <SelectTrigger className="h-9 text-xs bg-white">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="garantizada">🛡️ Período Garantizado</SelectItem>
                  <SelectItem value="aumento">📈 Aumento Temporal</SelectItem>
                  <SelectItem value="combinada">⭐ Garantía + Aumento</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {/* Parámetro 1: Garantía (si aplica) */}
            {(tipoClausula === 'garantizada' || tipoClausula === 'combinada') && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Período Garantizado</Label>
                <Select
                  value={String(mesesGarantizados)}
                  onValueChange={val => setMesesGarantizados(Number(val))}
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="120">10 años (120 meses)</SelectItem>
                    <SelectItem value="180">15 años (180 meses - Estándar)</SelectItem>
                    <SelectItem value="240">20 años (240 meses)</SelectItem>
                    <SelectItem value="300">25 años (300 meses)</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            )}

            {/* Parámetro 2: Plazo Aumento (si aplica) */}
            {(tipoClausula === 'aumento' || tipoClausula === 'combinada') && (
              <div className="space-y-1">
                <Label className="text-xs text-slate-600">Plazo de Aumento</Label>
                <Select
                  value={String(mesesAumento)}
                  onValueChange={val => setMesesAumento(Number(val))}
                >
                  <SelectTrigger className="h-9 text-xs bg-white">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="12">1 año (12 meses)</SelectItem>
                    <SelectItem value="24">2 años (24 meses)</SelectItem>
                    <SelectItem value="36">3 años (36 meses - Recomendado)</SelectItem>
                    <SelectItem value="48">4 años (48 meses)</SelectItem>
                    <SelectItem value="60">5 años (60 meses)</SelectItem>
                  </SelectContent>
                </Select>
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
