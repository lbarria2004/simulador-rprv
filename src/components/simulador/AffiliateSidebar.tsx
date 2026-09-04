'use client';

import React from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Badge } from '@/components/ui/badge';
import { User, Wallet, HeartHandshake, Sparkles, Building2, RefreshCw, Accessibility } from 'lucide-react';
import { AfiliadoState, InvalidezFinanciamientoInfo } from './types';
import { calcularEdadDesdeFecha } from '@/lib/date-utils';
import { BeneficiariesManager } from './BeneficiariesManager';
import { BeneficiarioPension } from '@/lib/pension-calculator';

interface AffiliateSidebarProps {
  afiliado: AfiliadoState;
  setAfiliado: React.Dispatch<React.SetStateAction<AfiliadoState>>;
  valorUF: number;
  fuenteUF: string;
  onRefreshUF: () => void;
  isLoadingUF: boolean;
  onApplyPreset?: (presetKey: 'zamora' | 'spuler' | 'soltero') => void;
  invalidezInfo?: InvalidezFinanciamientoInfo;
}

export function AffiliateSidebar({
  afiliado,
  setAfiliado,
  valorUF,
  fuenteUF,
  onRefreshUF,
  isLoadingUF,
  onApplyPreset,
  invalidezInfo
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

  // Manejar cambio de Ingreso Base en Pesos
  const handleIngresoBaseCLPChange = (valStr: string) => {
    const rawVal = parseFloat(valStr.replace(/\D/g, '')) || 0;
    const ufVal = valorUF > 0 ? Math.round((rawVal / valorUF) * 100) / 100 : 0;
    setAfiliado(prev => ({
      ...prev,
      ingresoBaseCLP: rawVal,
      ingresoBaseUF: ufVal
    }));
  };

  // Manejar cambio de Ingreso Base en UF
  const handleIngresoBaseUFChange = (valStr: string) => {
    const ufVal = parseFloat(valStr.replace(',', '.')) || 0;
    const pesosVal = Math.round(ufVal * valorUF);
    setAfiliado(prev => ({
      ...prev,
      ingresoBaseUF: ufVal,
      ingresoBaseCLP: pesosVal
    }));
  };

  // Sincronizar lista de beneficiarios legales
  const handleBeneficiariosChange = (nuevosBeneficiarios: BeneficiarioPension[]) => {
    const conyuge = nuevosBeneficiarios.find(b => b.tipo === 'conyuge');
    setAfiliado(prev => ({
      ...prev,
      beneficiarios: nuevosBeneficiarios,
      tieneConyuge: !!conyuge,
      edadConyuge: conyuge ? conyuge.edad : prev.edadConyuge,
      sexoConyuge: conyuge ? conyuge.sexo : prev.sexoConyuge,
      fechaNacimientoConyuge: conyuge ? conyuge.fechaNacimiento : prev.fechaNacimientoConyuge
    }));
  };

  return (
    <div className="space-y-4">
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
                {afiliado.tipoPension.toUpperCase()}
              </Badge>
            </div>
          </div>
        </CardHeader>

        <CardContent className="px-4 pb-4 space-y-3.5">
          {/* Nombre y RUT */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">Nombre del Afiliado</Label>
              <Input
                type="text"
                value={afiliado.nombre}
                onChange={e => setAfiliado(prev => ({ ...prev, nombre: e.target.value }))}
                className="h-8 text-xs bg-white"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs text-slate-600">RUT</Label>
              <Input
                type="text"
                value={afiliado.rut}
                onChange={e => setAfiliado(prev => ({ ...prev, rut: e.target.value }))}
                className="h-8 text-xs bg-white font-mono"
              />
            </div>
          </div>

          {/* Fecha de Nacimiento y Sexo */}
          <div className="grid grid-cols-1 sm:grid-cols-12 gap-2">
            <div className="sm:col-span-7 space-y-1">
              <div className="flex items-center justify-between">
                <Label className="text-xs text-slate-600">Fecha de Nacimiento</Label>
                <Badge variant="outline" className="text-[10px] bg-blue-50 text-blue-700 border-blue-200 py-0 h-4 font-semibold">
                  {afiliado.edad} años
                </Badge>
              </div>
              <Input
                type="date"
                value={afiliado.fechaNacimiento}
                onChange={e => {
                  const fecha = e.target.value;
                  const edadCalc = calcularEdadDesdeFecha(fecha);
                  setAfiliado(prev => ({
                    ...prev,
                    fechaNacimiento: fecha,
                    edad: edadCalc
                  }));
                }}
                className="h-8 text-xs bg-white font-mono"
              />
            </div>

            <div className="sm:col-span-5 space-y-1">
              <Label className="text-xs text-slate-600">Sexo Legal</Label>
              <div className="grid grid-cols-2 gap-1">
                <Button
                  type="button"
                  variant={afiliado.sexo === 'M' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAfiliado(prev => ({ ...prev, sexo: 'M' }))}
                  className={`h-8 text-xs ${afiliado.sexo === 'M' ? 'bg-blue-600 hover:bg-blue-700' : 'bg-white'}`}
                >
                  Hombre
                </Button>
                <Button
                  type="button"
                  variant={afiliado.sexo === 'F' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setAfiliado(prev => ({ ...prev, sexo: 'F' }))}
                  className={`h-8 text-xs ${afiliado.sexo === 'F' ? 'bg-rose-600 hover:bg-rose-700' : 'bg-white'}`}
                >
                  Mujer
                </Button>
              </div>
            </div>
          </div>

          {/* Años Cotizados */}
          <div className="space-y-1">
            <Label className="text-xs text-slate-600">Años Cotizados (para beneficio BAC)</Label>
            <Input
              type="number"
              min={0}
              max={50}
              value={afiliado.anosCotizados}
              onChange={e => setAfiliado(prev => ({ ...prev, anosCotizados: Number(e.target.value) || 0 }))}
              className="h-8 text-xs bg-white"
            />
          </div>

          {/* Saldo de Fondos en UF y Pesos */}
          <div className="p-3 bg-slate-50 rounded-lg border border-slate-200/80 space-y-2.5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Wallet className="w-3.5 h-3.5 text-emerald-600" />
                <span>Saldo Acumulado en AFP</span>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onRefreshUF}
                disabled={isLoadingUF}
                className="h-6 px-1.5 text-[10px] text-slate-500 hover:text-blue-600 gap-1"
                title="Actualizar valor UF desde SII"
              >
                <RefreshCw className={`w-3 h-3 ${isLoadingUF ? 'animate-spin' : ''}`} />
                <span>UF: ${valorUF.toLocaleString('es-CL')}</span>
              </Button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500">Monto en UF</Label>
                <div className="relative">
                  <Input
                    type="number"
                    step="0.01"
                    value={afiliado.fondosUF > 0 ? afiliado.fondosUF : ''}
                    onChange={e => handleUFChange(e.target.value)}
                    placeholder="1.035,47"
                    className="h-8 text-xs font-semibold text-blue-900 bg-white"
                  />
                  <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400">UF</span>
                </div>
              </div>
              <div className="space-y-0.5">
                <Label className="text-[11px] text-slate-500">Equivalente en Pesos ($)</Label>
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

          {/* Expediente de Pensión de Invalidez (D.L. 3.500) */}
          <div className={`p-3 rounded-lg border transition-all space-y-2.5 ${
            afiliado.tipoPension === 'invalidez' 
              ? 'border-amber-300 bg-amber-50/50 shadow-xs ring-1 ring-amber-400/30' 
              : 'border-slate-200 bg-slate-50/70'
          }`}>
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-slate-800">
                <Accessibility className={`w-4 h-4 ${afiliado.tipoPension === 'invalidez' ? 'text-amber-600' : 'text-slate-500'}`} />
                <span>Expediente de Pensión de Invalidez</span>
              </div>
              <div className="flex items-center gap-1.5">
                {afiliado.tipoPension === 'invalidez' && (
                  <Badge variant="outline" className="text-[9px] bg-amber-100 text-amber-900 border-amber-300 font-bold py-0 h-4">
                    Tabla {afiliado.sexo === 'M' ? 'MI-H-2020' : 'MI-M-2020'}
                  </Badge>
                )}
                <Switch
                  checked={afiliado.tipoPension === 'invalidez'}
                  onCheckedChange={checked => setAfiliado(prev => ({ 
                    ...prev, 
                    tipoPension: checked ? 'invalidez' : 'vejez',
                    esInvalido: checked,
                    cubiertoSIS: prev.cubiertoSIS ?? true,
                    ingresoBaseCLP: prev.ingresoBaseCLP || 1200000,
                    ingresoBaseUF: prev.ingresoBaseUF || (valorUF > 0 ? Math.round((1200000 / valorUF) * 100) / 100 : 29.35)
                  }))}
                />
              </div>
            </div>

            {afiliado.tipoPension === 'invalidez' ? (
              <div className="space-y-3 pt-2 border-t border-amber-200/60">
                {/* Grado de Invalidez Dictaminado */}
                <div className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] text-amber-950 font-medium">Grado Dictamen Médico</Label>
                    <span className="text-[10px] text-amber-800 font-semibold">
                      Ref: {afiliado.gradoInvalidez === 'parcial' ? '50% Ingreso Base' : '70% Ingreso Base'}
                    </span>
                  </div>
                  <div className="grid grid-cols-2 gap-1.5">
                    <Button
                      type="button"
                      variant={afiliado.gradoInvalidez === 'total' || !afiliado.gradoInvalidez ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAfiliado(prev => ({ ...prev, gradoInvalidez: 'total' }))}
                      className={`h-7 text-[11px] px-2 font-medium ${
                        afiliado.gradoInvalidez === 'total' || !afiliado.gradoInvalidez 
                          ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                          : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
                      }`}
                    >
                      Total (≥66,6%) • 70%
                    </Button>
                    <Button
                      type="button"
                      variant={afiliado.gradoInvalidez === 'parcial' ? 'default' : 'outline'}
                      size="sm"
                      onClick={() => setAfiliado(prev => ({ ...prev, gradoInvalidez: 'parcial' }))}
                      className={`h-7 text-[11px] px-2 font-medium ${
                        afiliado.gradoInvalidez === 'parcial' 
                          ? 'bg-amber-600 hover:bg-amber-700 text-white' 
                          : 'bg-white text-slate-700 border-amber-200 hover:bg-amber-100/50'
                      }`}
                    >
                      Parcial (50%-66,5%) • 50%
                    </Button>
                  </div>
                </div>

                {/* Cobertura del Seguro de Invalidez y Sobrevivencia (SIS) */}
                <div className="p-2.5 bg-white rounded-md border border-amber-200/80 space-y-1.5">
                  <div className="flex items-center justify-between">
                    <Label className="text-[11px] font-semibold text-slate-800">
                      Cobertura del Seguro SIS (D.L. 3.500)
                    </Label>
                    <Switch
                      checked={afiliado.cubiertoSIS ?? true}
                      onCheckedChange={checked => setAfiliado(prev => ({ ...prev, cubiertoSIS: checked }))}
                    />
                  </div>
                  <p className="text-[10px] text-slate-600 leading-tight">
                    {(afiliado.cubiertoSIS ?? true)
                      ? 'Trabajador activo o cesante protegido: La compañía del SIS entera el Aporte Adicional ($AA) si el saldo no alcanza para el Capital Necesario.'
                      : 'Sin cobertura SIS: La pensión se financia exclusivamente con el saldo propio acumulado en AFP.'}
                  </p>
                </div>

                {/* Ingreso Base Promedio (Últimos 10 años) */}
                <div className="space-y-1.5">
                  <Label className="text-[11px] text-amber-950 font-medium flex items-center justify-between">
                    <span>Ingreso Base (Promedio últimos 10 años)</span>
                    <span className="text-[9px] text-slate-400 font-normal">120 cotizaciones</span>
                  </Label>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="relative">
                      <Input
                        type="text"
                        value={afiliado.ingresoBaseCLP ? `$${afiliado.ingresoBaseCLP.toLocaleString('es-CL')}` : '$1.200.000'}
                        onChange={e => handleIngresoBaseCLPChange(e.target.value)}
                        placeholder="$1.200.000"
                        className="h-8 text-xs font-semibold text-amber-950 bg-white"
                      />
                    </div>
                    <div className="relative">
                      <Input
                        type="number"
                        step="0.01"
                        value={afiliado.ingresoBaseUF || ''}
                        onChange={e => handleIngresoBaseUFChange(e.target.value)}
                        placeholder="29,35"
                        className="h-8 text-xs font-semibold text-slate-700 bg-white"
                      />
                      <span className="absolute right-2 top-2 text-[10px] font-bold text-slate-400">UF</span>
                    </div>
                  </div>
                </div>

                {/* Resumen Actuarial de Financiamiento en tiempo real */}
                {invalidezInfo && (
                  <div className="p-2.5 bg-amber-100/60 rounded-md border border-amber-300 text-[11px] space-y-1.5">
                    <div className="font-semibold text-amber-950 text-xs flex items-center justify-between border-b border-amber-200 pb-1">
                      <span>Financiamiento Actuarial SIS</span>
                      <span className="text-[10px] font-normal text-amber-800">
                        {invalidezInfo.cubiertoSIS ? 'Con Aporte SIS' : 'Solo Saldo AFP'}
                      </span>
                    </div>

                    <div className="flex justify-between text-slate-700">
                      <span>Pensión Referencia ({Math.round(invalidezInfo.porcentajeReferencia * 100)}% IB):</span>
                      <strong className="text-amber-950">${invalidezInfo.pensionReferenciaCLP.toLocaleString('es-CL')}/mes</strong>
                    </div>

                    <div className="flex justify-between text-slate-700">
                      <span>Capital Necesario Actuarial (CN):</span>
                      <span className="font-medium">${invalidezInfo.capitalNecesarioCLP.toLocaleString('es-CL')}</span>
                    </div>

                    <div className="flex justify-between text-slate-700">
                      <span>Saldo Acumulado en AFP:</span>
                      <span className="font-medium">${invalidezInfo.saldoPropioCLP.toLocaleString('es-CL')}</span>
                    </div>

                    {invalidezInfo.cubiertoSIS && (
                      <div className="flex justify-between text-emerald-800 bg-emerald-100/80 px-1.5 py-0.5 rounded font-semibold">
                        <span>Aporte Adicional SIS (+AA):</span>
                        <span>+${invalidezInfo.aporteAdicionalSISCLP.toLocaleString('es-CL')}</span>
                      </div>
                    )}

                    <div className="flex justify-between text-indigo-950 font-bold border-t border-amber-200 pt-1">
                      <span>Saldo Total para SCOMP:</span>
                      <span className="text-emerald-700">${invalidezInfo.saldoTotalFinanciamientoCLP.toLocaleString('es-CL')} ({invalidezInfo.saldoTotalFinanciamientoUF} UF)</span>
                    </div>
                  </div>
                )}
              </div>
            ) : (
              <p className="text-[10px] text-slate-500 leading-tight">
                Régimen activo: <strong>Pensión de Vejez</strong> ({afiliado.sexo === 'M' ? 'CB-H-2020' : 'RV-M-2020'}). Active este conmutador o seleccione arriba si tramita dictamen de invalidez.
              </p>
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

      {/* Gestor de Beneficiarios Legales D.L. 3.500 */}
      <BeneficiariesManager
        beneficiarios={afiliado.beneficiarios || []}
        onChange={handleBeneficiariosChange}
      />
    </div>
  );
}
