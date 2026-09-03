'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { User, Wallet, HeartHandshake, Sparkles, Building2, RefreshCw } from 'lucide-react';
import { AfiliadoState } from './types';

interface AffiliateSidebarProps {
  afiliado: AfiliadoState;
  setAfiliado: React.Dispatch<React.SetStateAction<AfiliadoState>>;
  valorUF: number;
  fuenteUF: string;
  onRefreshUF: () => void;
  isLoadingUF: boolean;
  onApplyPreset: (presetKey: 'zamora' | 'spuler' | 'soltero') => void;
}

export function AffiliateSidebar({
  afiliado,
  setAfiliado,
  valorUF,
  fuenteUF,
  onRefreshUF,
  isLoadingUF,
  onApplyPreset
}: AffiliateSidebarProps) {
  // Manejar cambio de fondos en Pesos y sincronizar UF
  const handlePesosChange = (valStr: string) => {
    const rawVal = parseFloat(valStr.replace(/\D/g, '')) || 0;
    const ufVal = valorUF > 0 ? Math.round((rawVal / valorUF) * 100) / 100 : 0;
    setAfiliado(prev => ({
      ...prev,
      fondosCLP: rawVal,
      fondosUF: ufVal
    }));
  };

  // Manejar cambio de fondos en UF y sincronizar Pesos
  const handleUFChange = (valStr: string) => {
    const ufVal = parseFloat(valStr.replace(',', '.')) || 0;
    const pesosVal = Math.round(ufVal * valorUF);
    setAfiliado(prev => ({
      ...prev,
      fondosUF: ufVal,
      fondosCLP: pesosVal
    }));
  };

  return (
    <div className="space-y-4">
      {/* Tarjeta de Presets SCOMP Rápidos */}
      <Card className="border-blue-200/60 bg-gradient-to-br from-blue-50/50 to-indigo-50/30 shadow-sm">
        <CardHeader className="pb-2 pt-3 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5 text-xs font-semibold text-blue-900">
              <Sparkles className="w-3.5 h-3.5 text-blue-600" />
              <span>Cargar Casos SCOMP Reales</span>
            </div>
            <Badge variant="outline" className="text-[10px] bg-white text-blue-700 border-blue-200">
              1-Clic
            </Badge>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-3 pt-0">
          <div className="grid grid-cols-2 gap-1.5 pt-1">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onApplyPreset('zamora')}
              className="text-xs h-8 bg-white hover:bg-blue-100/60 hover:text-blue-900 border-blue-200 justify-start px-2 font-medium"
            >
              👨 Juan Z. (1.035 UF)
            </Button>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onApplyPreset('spuler')}
              className="text-xs h-8 bg-white hover:bg-blue-100/60 hover:text-blue-900 border-blue-200 justify-start px-2 font-medium"
            >
              👩 Mónica S. (2.177 UF)
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Tarjeta de Datos del Afiliado */}
      <Card className="shadow-sm border-slate-200">
        <CardHeader className="pb-3 pt-4 px-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="p-1.5 rounded-md bg-blue-600 text-white">
                <User className="w-4 h-4" />
              </div>
              <CardTitle className="text-base font-semibold text-slate-900">Datos del Afiliado</CardTitle>
            </div>
            <div className="flex items-center gap-1">
              <Badge variant="secondary" className="text-[11px] font-mono font-medium text-slate-700">
                UF: ${valorUF.toLocaleString('es-CL', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </Badge>
              <Button
                variant="ghost"
                size="icon"
                onClick={onRefreshUF}
                disabled={isLoadingUF}
                className="h-6 w-6 text-slate-400 hover:text-blue-600"
                title={`Fuente: ${fuenteUF}. Clic para actualizar`}
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingUF ? 'animate-spin' : ''}`} />
              </Button>
            </div>
          </div>
          <CardDescription className="text-xs text-slate-500">
            Valores sincronizados con el SII oficial de Chile
          </CardDescription>
        </CardHeader>

        <CardContent className="px-4 pb-4 space-y-3.5">
          {/* Nombre y RUT */}
          <div className="grid grid-cols-5 gap-2">
            <div className="col-span-3 space-y-1">
              <Label className="text-xs text-slate-600">Nombre Completo</Label>
              <Input
                value={afiliado.nombre}
                onChange={e => setAfiliado(prev => ({ ...prev, nombre: e.target.value }))}
                placeholder="Ej. Juan Pérez"
                className="h-8 text-xs"
              />
            </div>
            <div className="col-span-2 space-y-1">
              <Label className="text-xs text-slate-600">RUT</Label>
              <Input
                value={afiliado.rut}
                onChange={e => setAfiliado(prev => ({ ...prev, rut: e.target.value }))}
                placeholder="12.345.678-9"
                className="h-8 text-xs font-mono"
              />
            </div>
          </div>

          {/* Edad y Sexo */}
          <div className="grid grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Edad (años)</Label>
              <Input
                type="number"
                min={18}
                max={100}
                value={afiliado.edad}
                onChange={e => setAfiliado(prev => ({ ...prev, edad: parseInt(e.target.value) || 0 }))}
                className="h-8 text-xs font-semibold"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Sexo Legal</Label>
              <Select
                value={afiliado.sexo}
                onValueChange={(val: 'M' | 'F') => setAfiliado(prev => ({ ...prev, sexo: val }))}
              >
                <SelectTrigger className="h-8 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="M">Masculino (65 años legal)</SelectItem>
                  <SelectItem value="F">Femenino (60 años legal)</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {/* Fondos Acumulados (UF y CLP sincronizados) */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
            <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
              <Wallet className="w-3.5 h-3.5 text-blue-600" />
              <span>Saldo Total para Pensión</span>
            </div>

            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500 font-medium">En Unidades de Fomento</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    value={afiliado.fondosUF || ''}
                    onChange={e => handleUFChange(e.target.value)}
                    placeholder="1000.00"
                    className="h-8 text-xs pr-7 font-semibold text-blue-950 font-mono bg-white"
                  />
                  <span className="absolute right-2 top-2 text-[10px] text-slate-400 font-semibold pointer-events-none">UF</span>
                </div>
              </div>

              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500 font-medium">En Pesos Chilenos</Label>
                <div className="relative">
                  <Input
                    type="text"
                    value={afiliado.fondosCLP > 0 ? `$${afiliado.fondosCLP.toLocaleString('es-CL')}` : ''}
                    onChange={e => handlePesosChange(e.target.value)}
                    placeholder="$40.000.000"
                    className="h-8 text-xs font-semibold text-emerald-900 bg-white"
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Cónyuge / Sobrevivencia */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-medium text-slate-800">
                <HeartHandshake className="w-3.5 h-3.5 text-rose-500" />
                <span>Cónyuge con Derecho a Pensión</span>
              </div>
              <Switch
                checked={afiliado.tieneConyuge}
                onCheckedChange={checked => setAfiliado(prev => ({ ...prev, tieneConyuge: checked }))}
              />
            </div>

            {afiliado.tieneConyuge && (
              <div className="grid grid-cols-2 gap-2 pt-1">
                <div className="space-y-0.5">
                  <Label className="text-[11px] text-slate-500">Edad Cónyuge</Label>
                  <Input
                    type="number"
                    min={18}
                    max={100}
                    value={afiliado.edadConyuge}
                    onChange={e => setAfiliado(prev => ({ ...prev, edadConyuge: parseInt(e.target.value) || 0 }))}
                    className="h-7 text-xs bg-white"
                  />
                </div>
                <div className="space-y-0.5">
                  <Label className="text-[11px] text-slate-500">Sexo Cónyuge</Label>
                  <Select
                    value={afiliado.sexoConyuge}
                    onValueChange={(val: 'M' | 'F') => setAfiliado(prev => ({ ...prev, sexoConyuge: val }))}
                  >
                    <SelectTrigger className="h-7 text-xs bg-white">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="F">Mujer (60% pensión)</SelectItem>
                      <SelectItem value="M">Hombre (60% pensión)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>
            )}
          </div>

          {/* Asesor Previsional SCOMP Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg border border-indigo-100 bg-indigo-50/40">
            <div className="space-y-0.5 pr-2">
              <div className="text-xs font-semibold text-indigo-950 flex items-center gap-1">
                <Building2 className="w-3.5 h-3.5 text-indigo-600" />
                <span>Asesor Previsional</span>
              </div>
              <p className="text-[10px] text-indigo-700/80 leading-tight">
                Aplica comisiones SCOMP: 1,5% RV y 1,2% RP
              </p>
            </div>
            <Switch
              checked={afiliado.conAsesor}
              onCheckedChange={checked => setAfiliado(prev => ({ ...prev, conAsesor: checked }))}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
