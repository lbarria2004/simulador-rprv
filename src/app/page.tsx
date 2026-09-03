'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AffiliateSidebar } from '@/components/simulador/AffiliateSidebar';
import { SummaryCards } from '@/components/simulador/SummaryCards';
import { ScenarioSliders } from '@/components/simulador/ScenarioSliders';
import { TrajectoryChart } from '@/components/simulador/TrajectoryChart';
import { InsuranceRankingTable } from '@/components/simulador/InsuranceRankingTable';
import { DecisionMatrix } from '@/components/simulador/DecisionMatrix';
import { AfiliadoState, CláusulasState, CompaniasRankingItem } from '@/components/simulador/types';
import {
  calcularRetiroProgramado,
  calcularRVInmediata,
  calcularRVConAmbasClausulas,
  calcularPGU,
  calcularBAC,
  BeneficiarioPension,
  ResultadoEscenario,
  AFP,
  TASAS_INTERES
} from '@/lib/pension-calculator';
import { TASAS_RENTA_VITALICIA } from '@/lib/tablas-mortalidad';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Sparkles, 
  Layers, 
  BarChart3, 
  FileText, 
  CheckCircle, 
  ShieldCheck, 
  Scale
} from 'lucide-react';

const CLASIFICACIONES_RIESGO: Record<string, string> = {
  '4LIFE': 'AAA',
  'AUGUSTAR': 'AA+',
  'BICE': 'AA+',
  'CN_LIFE': 'AA+',
  'CONFUTURO': 'AA+',
  'CONSORCIO_NACIONAL': 'AA+',
  'EUROAMERICA': 'AA',
  'METLIFE': 'AAA',
  'PENTA': 'AA+',
  'RENTA_NACIONAL': 'A'
};

export default function SimuladorPage() {
  // Estado del valor oficial de la UF (obtenido del SII)
  const [valorUF, setValorUF] = useState<number>(40876.41);
  const [fuenteUF, setFuenteUF] = useState<string>('sii.cl');
  const [isLoadingUF, setIsLoadingUF] = useState<boolean>(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);

  // Estado del Afiliado (por defecto: Caso real Juan Zamora SCOMP)
  const [afiliado, setAfiliado] = useState<AfiliadoState>({
    nombre: 'Juan Lorenzo Zamora Mena',
    rut: '9.171.135-4',
    edad: 65,
    sexo: 'M',
    fondosUF: 1035.47,
    fondosCLP: Math.round(1035.47 * 40876.41),
    anosCotizados: 25,
    tipoPension: 'vejez',
    tieneConyuge: true,
    edadConyuge: 62,
    sexoConyuge: 'F',
    conAsesor: true
  });

  // Estado de las Cláusulas y Escenarios
  const [clausulas, setClausulas] = useState<CláusulasState>({
    mesesGarantizados: 180, // 15 años
    mesesAumento: 36,       // 3 años
    porcentajeAumento: 1.0,  // +100%
    afpSeleccionada: 'PLANVITAL',
    incluirPGU: true,
    incluirBAC: true
  });

  // Consultar UF oficial al montar el componente
  const fetchUF = useCallback(async () => {
    setIsLoadingUF(true);
    try {
      const res = await fetch('/api/uf');
      if (res.ok) {
        const data = await res.json();
        if (data.valor && data.valor > 0) {
          setValorUF(data.valor);
          setFuenteUF(data.fuente || 'sii.cl');
          // Sincronizar pesos con la nueva UF
          setAfiliado(prev => ({
            ...prev,
            fondosCLP: Math.round(prev.fondosUF * data.valor)
          }));
        }
      }
    } catch (err) {
      console.warn('Error al obtener UF:', err);
    } finally {
      setIsLoadingUF(false);
    }
  }, []);

  useEffect(() => {
    fetchUF();
  }, [fetchUF]);

  // Manejar presets de casos reales SCOMP
  const handleApplyPreset = (presetKey: 'zamora' | 'spuler' | 'soltero') => {
    if (presetKey === 'zamora') {
      setAfiliado({
        nombre: 'Juan Lorenzo Zamora Mena',
        rut: '9.171.135-4',
        edad: 65,
        sexo: 'M',
        fondosUF: 1035.47,
        fondosCLP: Math.round(1035.47 * valorUF),
        anosCotizados: 25,
        tipoPension: 'vejez',
        tieneConyuge: true,
        edadConyuge: 62,
        sexoConyuge: 'F',
        conAsesor: true
      });
      setClausulas(prev => ({
        ...prev,
        mesesGarantizados: 180,
        mesesAumento: 36,
        porcentajeAumento: 1.0
      }));
    } else if (presetKey === 'spuler') {
      setAfiliado({
        nombre: 'Mónica Cecilia Spuler Inostroza',
        rut: '7.706.092-8',
        edad: 64,
        sexo: 'F',
        fondosUF: 2177.40,
        fondosCLP: Math.round(2177.40 * valorUF),
        anosCotizados: 30,
        tipoPension: 'vejez',
        tieneConyuge: true,
        edadConyuge: 70,
        sexoConyuge: 'M',
        conAsesor: true
      });
      setClausulas(prev => ({
        ...prev,
        mesesGarantizados: 180,
        mesesAumento: 48,
        porcentajeAumento: 0.60
      }));
    } else {
      setAfiliado({
        nombre: 'Afiliado Soltero',
        rut: '12.345.678-9',
        edad: 65,
        sexo: 'M',
        fondosUF: 1500.00,
        fondosCLP: Math.round(1500.00 * valorUF),
        anosCotizados: 20,
        tipoPension: 'vejez',
        tieneConyuge: false,
        edadConyuge: 60,
        sexoConyuge: 'F',
        conAsesor: false
      });
    }
  };

  // ==========================================
  // MOTOR DE CÁLCULO ACTUARIAL EN TIEMPO REAL
  // ==========================================
  const calculos = useMemo(() => {
    const beneficiarios: BeneficiarioPension[] = [];
    if (afiliado.tieneConyuge) {
      beneficiarios.push({
        tipo: 'conyuge',
        edad: afiliado.edadConyuge,
        sexo: afiliado.sexoConyuge,
        porcentajePension: 0.60
      });
    }

    // Descuento regulado de comisión de asesor según SCOMP (1,5% en RV, 1,2% en RP)
    const fondosBase = afiliado.fondosCLP;
    const fondosRP = afiliado.conAsesor ? fondosBase * (1 - 0.012) : fondosBase;
    const fondosRV = afiliado.conAsesor ? fondosBase * (1 - 0.015) : fondosBase;

    // 1. Retiro Programado (tasa de mercado ~3.58%)
    const resultadoRP = calcularRetiroProgramado(
      fondosRP,
      afiliado.edad,
      afiliado.sexo,
      0.0358,
      beneficiarios
    );

    // 2. Renta Vitalicia Simple (tasa mercado CMF ~2.80% - 2.92%)
    const tasaRVSimple = TASAS_RENTA_VITALICIA.companias['4LIFE']?.vejez || 0.0292;
    const resultadoRVSimple = calcularRVInmediata(
      fondosRV,
      afiliado.edad,
      afiliado.sexo,
      tasaRVSimple,
      beneficiarios
    );

    // 3. Renta Vitalicia con Cláusulas (Aumento Temporal + Garantía)
    const resultadoRVClausulas = calcularRVConAmbasClausulas(
      fondosRV,
      afiliado.edad,
      afiliado.sexo,
      clausulas.mesesGarantizados,
      clausulas.mesesAumento,
      clausulas.porcentajeAumento,
      tasaRVSimple,
      beneficiarios
    );

    // 4. Beneficios Estatales
    const pgu = calcularPGU(resultadoRVSimple.pensionMensual, afiliado.edad);
    const bac = calcularBAC(afiliado.anosCotizados, 0, valorUF);

    // 5. Ranking por Compañías Aseguradoras
    const rankingCompanias: CompaniasRankingItem[] = [];
    for (const [key, item] of Object.entries(TASAS_RENTA_VITALICIA.companias)) {
      if (!item.vejez || item.vejez === 0) continue;
      const rvComp = calcularRVInmediata(
        fondosRV,
        afiliado.edad,
        afiliado.sexo,
        item.vejez,
        beneficiarios
      );

      rankingCompanias.push({
        nombre: key.replace('_', ' '),
        rating: CLASIFICACIONES_RIESGO[key] || 'AA+',
        tasaVejez: item.vejez,
        pensionUF: rvComp.pensionEnUF,
        pensionCLP: rvComp.pensionMensual
      });
    }

    return {
      resultadoRP,
      resultadoRVSimple,
      resultadoRVClausulas,
      pgu,
      bac,
      rankingCompanias
    };
  }, [afiliado, clausulas, valorUF]);

  // Descarga del Informe PDF Oficial
  const handleGenerarPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const res = await fetch('/api/reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          afiliado: {
            nombre: afiliado.nombre || 'Afiliado',
            sexo: afiliado.sexo,
            edad: afiliado.edad,
            fondosAcumulados: afiliado.fondosCLP,
            anosCotizados: afiliado.anosCotizados,
            tipoPension: afiliado.tipoPension
          },
          parametros: {
            uf: valorUF,
            tasaRP: 0.0358,
            tasaRV: TASAS_RENTA_VITALICIA.media_mercado.vejez,
            incluirPGU: clausulas.incluirPGU,
            incluirBAC: clausulas.incluirBAC,
            afpSeleccionada: clausulas.afpSeleccionada
          },
          resultados: [
            calculos.resultadoRP,
            calculos.resultadoRVSimple,
            calculos.resultadoRVClausulas
          ],
          beneficiarios: afiliado.tieneConyuge ? [{
            tipo: 'conyuge',
            edad: afiliado.edadConyuge,
            sexo: afiliado.sexoConyuge,
            porcentajePension: 0.60
          }] : []
        })
      });

      if (!res.ok) throw new Error('Error al generar PDF');

      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `Estudio_Pensiones_${afiliado.nombre.replace(/\s+/g, '_') || 'Afiliado'}.pdf`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (err) {
      console.error(err);
      alert('Hubo un problema al generar el informe PDF. Por favor reintente.');
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100/70 text-slate-900 pb-12">
      {/* Barra de Encabezado Superior */}
      <header className="sticky top-0 z-30 bg-white/95 backdrop-blur border-b border-slate-200/80 shadow-xs">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <div className="p-2 rounded-xl bg-gradient-to-tr from-blue-700 to-indigo-600 text-white shadow-sm">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-900 tracking-tight leading-none">
                Simulador Actuarial de Pensiones SCOMP
              </h1>
              <span className="text-[11px] text-slate-500 font-medium">
                Calibrado con normativa SP, CMF y Servicio de Impuestos Internos (SII)
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200 gap-1.5 py-1 px-2.5 font-medium">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>UF Hoy: ${valorUF.toLocaleString('es-CL', { minimumFractionDigits: 2 })}</span>
            </Badge>

            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-800 border-blue-200 gap-1.5 py-1 px-2.5 font-medium hidden sm:flex">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Tasas CMF 2026</span>
            </Badge>
          </div>
        </div>
      </header>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 py-5">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Barra Lateral Izquierda (4 columnas en LG) */}
          <div className="lg:col-span-4">
            <AffiliateSidebar
              afiliado={afiliado}
              setAfiliado={setAfiliado}
              valorUF={valorUF}
              fuenteUF={fuenteUF}
              onRefreshUF={fetchUF}
              isLoadingUF={isLoadingUF}
              onApplyPreset={handleApplyPreset}
            />
          </div>

          {/* Panel Principal (8 columnas en LG) */}
          <div className="lg:col-span-8 space-y-5">
            {/* 1. Tarjetas Ejecutivas de Comparación */}
            <SummaryCards
              resultadoRP={calculos.resultadoRP}
              resultadoRVSimple={calculos.resultadoRVSimple}
              resultadoRVClausulas={calculos.resultadoRVClausulas}
              afpSeleccionada={clausulas.afpSeleccionada}
              onSelectAFP={(afp: AFP) => setClausulas(prev => ({ ...prev, afpSeleccionada: afp }))}
              pgu={calculos.pgu}
              bac={calculos.bac}
              edadAfiliado={afiliado.edad}
            />

            {/* 2. Sliders Interactivos de Cláusulas */}
            <ScenarioSliders
              clausulas={clausulas}
              setClausulas={setClausulas}
              anosCotizados={afiliado.anosCotizados}
              setAnosCotizados={(anos: number) => setAfiliado(prev => ({ ...prev, anosCotizados: anos }))}
              bacUF={calculos.bac.beneficioUF}
            />

            {/* 3. Pestañas de Detalle (Gráfico, Ranking de Aseguradoras y Matriz Cliente) */}
            <Tabs defaultValue="grafico" className="w-full">
              <TabsList className="grid grid-cols-3 bg-white border border-slate-200 h-10 p-1 rounded-xl shadow-xs">
                <TabsTrigger value="grafico" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900">
                  <BarChart3 className="w-3.5 h-3.5" />
                  <span>Curva a 25 Años</span>
                </TabsTrigger>

                <TabsTrigger value="ranking" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900">
                  <Layers className="w-3.5 h-3.5" />
                  <span>Ranking Aseguradoras CMF</span>
                </TabsTrigger>

                <TabsTrigger value="matriz" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900">
                  <Scale className="w-3.5 h-3.5" />
                  <span>Matriz para el Cliente</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="grafico" className="pt-3">
                <TrajectoryChart
                  edadInicial={afiliado.edad}
                  proyeccionRP={calculos.resultadoRP.proyeccion}
                  resultadoRVSimple={calculos.resultadoRVSimple}
                  resultadoRVClausulas={calculos.resultadoRVClausulas}
                  valorUF={valorUF}
                />
              </TabsContent>

              <TabsContent value="ranking" className="pt-3">
                <InsuranceRankingTable
                  items={calculos.rankingCompanias}
                  valorUF={valorUF}
                />
              </TabsContent>

              <TabsContent value="matriz" className="pt-3">
                <DecisionMatrix
                  onGenerarPDF={handleGenerarPDF}
                  isGeneratingPDF={isGeneratingPDF}
                  nombreAfiliado={afiliado.nombre}
                />
              </TabsContent>
            </Tabs>

            {/* Matriz siempre accesible al pie para generación rápida de PDF */}
            <DecisionMatrix
              onGenerarPDF={handleGenerarPDF}
              isGeneratingPDF={isGeneratingPDF}
              nombreAfiliado={afiliado.nombre}
            />
          </div>
        </div>
      </main>
    </div>
  );
}
