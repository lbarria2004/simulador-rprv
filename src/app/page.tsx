'use client';

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { AffiliateSidebar } from '@/components/simulador/AffiliateSidebar';
import { ModalitiesSelector } from '@/components/simulador/ModalitiesSelector';
import { MultiQuotationResults } from '@/components/simulador/MultiQuotationResults';
import { SummaryCards } from '@/components/simulador/SummaryCards';
import { ScenarioSliders } from '@/components/simulador/ScenarioSliders';
import { TrajectoryChart } from '@/components/simulador/TrajectoryChart';
import { InsuranceRankingTable } from '@/components/simulador/InsuranceRankingTable';
import { DecisionMatrix } from '@/components/simulador/DecisionMatrix';
import { 
  AfiliadoState, 
  CláusulasState, 
  CompaniasRankingItem,
  ModalidadConfig,
  CotizacionItemResultado
} from '@/components/simulador/types';
import {
  calcularRetiroProgramado,
  calcularRVInmediata,
  calcularRVPeriodoGarantizado,
  calcularRVAumentoTemporal,
  calcularRVConAmbasClausulas,
  calcularPGU,
  calcularBAC,
  BeneficiarioPension,
  ResultadoEscenario,
  AFP,
  Sexo
} from '@/lib/pension-calculator';
import { TASAS_RENTA_VITALICIA } from '@/lib/tablas-mortalidad';
import { calcularFechaDesdeEdad } from '@/lib/date-utils';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { 
  Building2, 
  Layers, 
  BarChart3, 
  CheckCircle, 
  ShieldCheck, 
  Scale,
  Sliders
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
  const [isCotizando, setIsCotizando] = useState<boolean>(false);

  // Estado del Afiliado (por defecto: Caso real Juan Zamora SCOMP)
  const [afiliado, setAfiliado] = useState<AfiliadoState>({
    nombre: 'Juan Lorenzo Zamora Mena',
    rut: '9.171.135-4',
    fechaNacimiento: '1961-02-15',
    edad: 65,
    sexo: 'M',
    fondosUF: 1035.47,
    fondosCLP: Math.round(1035.47 * 40876.41),
    anosCotizados: 25,
    tipoPension: 'vejez',
    tieneConyuge: true,
    fechaNacimientoConyuge: '1964-06-10',
    edadConyuge: 62,
    sexoConyuge: 'F',
    conAsesor: true
  });

  // Modalidades configuradas para cotizar en lote
  const [modalidades, setModalidades] = useState<ModalidadConfig[]>([
    {
      id: 'base-rp',
      tipo: 'retiro_programado',
      nombre: 'Retiro Programado',
      descripcion: 'Administrado por AFP • Fondos heredables',
      activa: true
    },
    {
      id: 'base-rv-simple',
      tipo: 'renta_vitalicia_simple',
      nombre: 'Renta Vitalicia Inmediata Simple',
      descripcion: 'Aseguradora • Pensión fija en UF de por vida',
      activa: true
    },
    {
      id: 'base-rv-garantizada-15',
      tipo: 'rv_garantizada',
      nombre: 'RV Garantizada 15 años (180 meses)',
      descripcion: 'Pensión fija con garantía de pago por 15 años a beneficiarios o herederos',
      mesesGarantizados: 180,
      activa: true
    }
  ]);

  // Resultados de la cotización generada
  const [cotizacionResultados, setCotizacionResultados] = useState<CotizacionItemResultado[]>([]);

  // Estado de las Cláusulas y Escenarios para explorador complementario
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
        fechaNacimiento: '1961-02-15',
        edad: 65,
        sexo: 'M',
        fondosUF: 1035.47,
        fondosCLP: Math.round(1035.47 * valorUF),
        anosCotizados: 25,
        tipoPension: 'vejez',
        tieneConyuge: true,
        fechaNacimientoConyuge: '1964-06-10',
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
        fechaNacimiento: '1962-04-12',
        edad: 64,
        sexo: 'F',
        fondosUF: 2177.40,
        fondosCLP: Math.round(2177.40 * valorUF),
        anosCotizados: 30,
        tipoPension: 'vejez',
        tieneConyuge: true,
        fechaNacimientoConyuge: '1956-08-20',
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
        fechaNacimiento: '1961-01-01',
        edad: 65,
        sexo: 'M',
        fondosUF: 1500.00,
        fondosCLP: Math.round(1500.00 * valorUF),
        anosCotizados: 20,
        tipoPension: 'vejez',
        tieneConyuge: false,
        fechaNacimientoConyuge: undefined,
        edadConyuge: 60,
        sexoConyuge: 'F',
        conAsesor: false
      });
    }
  };

  // Función de cálculo individual por modalidad
  const calcularModalidad = useCallback((
    mod: ModalidadConfig,
    fondosRP: number,
    fondosRV: number,
    edad: number,
    sexo: Sexo,
    tasaRVSimple: number,
    beneficiarios: BeneficiarioPension[]
  ): CotizacionItemResultado => {
    let resultado: ResultadoEscenario;

    if (mod.tipo === 'retiro_programado') {
      resultado = calcularRetiroProgramado(fondosRP, edad, sexo, 0.0358, beneficiarios);
    } else if (mod.tipo === 'renta_vitalicia_simple') {
      resultado = calcularRVInmediata(fondosRV, edad, sexo, tasaRVSimple, beneficiarios);
    } else if (mod.tipo === 'rv_garantizada') {
      resultado = calcularRVPeriodoGarantizado(
        fondosRV,
        edad,
        sexo,
        mod.mesesGarantizados || 180,
        tasaRVSimple,
        beneficiarios
      );
    } else if (mod.tipo === 'rv_aumento_temporal') {
      resultado = calcularRVAumentoTemporal(
        fondosRV,
        edad,
        sexo,
        mod.mesesAumento || 36,
        mod.porcentajeAumento || 1.0,
        tasaRVSimple,
        beneficiarios
      );
    } else {
      // RV Combinada
      resultado = calcularRVConAmbasClausulas(
        fondosRV,
        edad,
        sexo,
        mod.mesesGarantizados || 180,
        mod.mesesAumento || 36,
        mod.porcentajeAumento || 1.0,
        tasaRVSimple,
        beneficiarios
      );
    }

    const pguObj = clausulas.incluirPGU 
      ? calcularPGU(resultado.pensionMensual, edad) 
      : { montoBeneficioCLP: 0, cumpleRequisitos: false, descripcion: '' };
    const pguMensual = pguObj.montoBeneficioCLP;

    const bacObj = clausulas.incluirBAC 
      ? calcularBAC(afiliado.anosCotizados, 0, valorUF) 
      : { beneficioCLP: 0, beneficioUF: 0, cumpleRequisitos: false, descripcion: '' };
    const bacMensual = bacObj.beneficioCLP;

    const totalCLP = resultado.pensionMensual + pguMensual + bacMensual;
    const totalUF = valorUF > 0 ? totalCLP / valorUF : 0;

    return {
      config: mod,
      resultado,
      pguMensual,
      bacMensual,
      totalConBeneficiosCLP: Math.round(totalCLP),
      totalConBeneficiosUF: Number(totalUF.toFixed(2))
    };
  }, [afiliado.anosCotizados, clausulas.incluirPGU, clausulas.incluirBAC, valorUF]);

  // Manejar cálculo de todas las modalidades activas en lote
  const handleGenerarCotizacion = useCallback(() => {
    setIsCotizando(true);
    try {
      const beneficiarios: BeneficiarioPension[] = [];
      if (afiliado.tieneConyuge) {
        beneficiarios.push({
          tipo: 'conyuge',
          edad: afiliado.edadConyuge,
          sexo: afiliado.sexoConyuge,
          porcentajePension: 0.60
        });
      }

      const fondosBase = afiliado.fondosCLP;
      const fondosRP = afiliado.conAsesor ? fondosBase * (1 - 0.012) : fondosBase;
      const fondosRV = afiliado.conAsesor ? fondosBase * (1 - 0.015) : fondosBase;
      const tasaRVSimple = TASAS_RENTA_VITALICIA.companias['4LIFE']?.vejez || 0.0292;

      const activas = modalidades.filter(m => m.activa);
      const resultados = activas.map(mod =>
        calcularModalidad(
          mod,
          fondosRP,
          fondosRV,
          afiliado.edad,
          afiliado.sexo,
          tasaRVSimple,
          beneficiarios
        )
      );

      setCotizacionResultados(resultados);
    } finally {
      setIsCotizando(false);
    }
  }, [afiliado, modalidades, calcularModalidad]);

  // Generar cotización inicial al cargar o cambiar parámetros clave
  useEffect(() => {
    handleGenerarCotizacion();
  }, [handleGenerarCotizacion]);

  // Manejadores de modalidades
  const handleToggleModalidad = (id: string) => {
    setModalidades(prev => prev.map(m => m.id === id ? { ...m, activa: !m.activa } : m));
  };

  const handleAgregarModalidad = (nueva: Omit<ModalidadConfig, 'id'>) => {
    const id = `custom-${Date.now()}`;
    setModalidades(prev => [...prev, { ...nueva, id }]);
  };

  const handleEliminarModalidad = (id: string) => {
    setModalidades(prev => prev.filter(m => m.id !== id));
  };

  // Cálculos complementarios de ranking de aseguradoras
  const rankingCompanias = useMemo(() => {
    const beneficiarios: BeneficiarioPension[] = [];
    if (afiliado.tieneConyuge) {
      beneficiarios.push({
        tipo: 'conyuge',
        edad: afiliado.edadConyuge,
        sexo: afiliado.sexoConyuge,
        porcentajePension: 0.60
      });
    }

    const fondosBase = afiliado.fondosCLP;
    const fondosRV = afiliado.conAsesor ? fondosBase * (1 - 0.015) : fondosBase;

    const ranking: CompaniasRankingItem[] = [];
    for (const [key, item] of Object.entries(TASAS_RENTA_VITALICIA.companias)) {
      if (!item.vejez) continue;
      const rvComp = calcularRVInmediata(
        fondosRV,
        afiliado.edad,
        afiliado.sexo,
        item.vejez,
        beneficiarios
      );

      ranking.push({
        nombre: key.replace('_', ' '),
        rating: CLASIFICACIONES_RIESGO[key] || 'AA+',
        tasaVejez: item.vejez,
        pensionUF: rvComp.pensionEnUF,
        pensionCLP: rvComp.pensionMensual
      });
    }
    return ranking;
  }, [afiliado]);

  // Descarga del Informe PDF Oficial con todas las modalidades cotizadas
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
            fechaNacimiento: afiliado.fechaNacimiento,
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
          resultados: cotizacionResultados.map(r => r.resultado),
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

  // Extraer resultados representativos para gráficos y tablas comparativas
  const primerRP = cotizacionResultados.find(r => r.config.tipo === 'retiro_programado')?.resultado;
  const primerRVSimple = cotizacionResultados.find(r => r.config.tipo === 'renta_vitalicia_simple')?.resultado;
  const primerRVClausula = cotizacionResultados.find(r => r.config.tipo !== 'retiro_programado' && r.config.tipo !== 'renta_vitalicia_simple')?.resultado;

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
                Tablas TM-2020 Oficiales • SII • CMF • Multi-Cotización en Lote
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
              <span>Tablas TM-2020</span>
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
            {/* 1. Selector y Constructor de Modalidades a Cotizar */}
            <ModalitiesSelector
              modalidades={modalidades}
              onToggleModalidad={handleToggleModalidad}
              onAgregarModalidad={handleAgregarModalidad}
              onEliminarModalidad={handleEliminarModalidad}
              onGenerarCotizacion={handleGenerarCotizacion}
              isCotizando={isCotizando}
            />

            {/* 2. Resultados Consolidados de la Multi-Cotización */}
            <MultiQuotationResults
              items={cotizacionResultados}
              valorUF={valorUF}
              onDescargarPDF={handleGenerarPDF}
              isGeneratingPDF={isGeneratingPDF}
            />

            {/* 3. Pestañas de Análisis Detallado (Curva a 25 años, Ranking Aseguradoras, Sliders y Matriz) */}
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

                <TabsTrigger value="sliders" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Ajustes Finos</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="grafico" className="pt-3">
                {primerRP && primerRVSimple && (
                  <TrajectoryChart
                    edadInicial={afiliado.edad}
                    proyeccionRP={primerRP.proyeccion}
                    resultadoRVSimple={primerRVSimple}
                    resultadoRVClausulas={primerRVClausula || primerRVSimple}
                    valorUF={valorUF}
                  />
                )}
              </TabsContent>

              <TabsContent value="ranking" className="pt-3">
                <InsuranceRankingTable
                  items={rankingCompanias}
                  valorUF={valorUF}
                />
              </TabsContent>

              <TabsContent value="sliders" className="pt-3">
                <ScenarioSliders
                  clausulas={clausulas}
                  setClausulas={setClausulas}
                  anosCotizados={afiliado.anosCotizados}
                  setAnosCotizados={(anos: number) => setAfiliado(prev => ({ ...prev, anosCotizados: anos }))}
                  bacUF={calcularBAC(afiliado.anosCotizados, 0, valorUF).beneficioUF}
                />
              </TabsContent>
            </Tabs>

            {/* Matriz siempre accesible al pie para asesoría y generación de PDF */}
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
