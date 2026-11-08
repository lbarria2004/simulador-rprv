'use client';

import { clpAUf, ufAClp, validarReferenciaUF, UF_REFERENCIA_EJEMPLO, type ReferenciaUF } from '@/lib/moneda';

import React, { useState, useMemo, useCallback } from 'react';
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
  CotizacionItemResultado,
  InvalidezFinanciamientoInfo,
  SobrevivenciaFinanciamientoInfo
} from '@/components/simulador/types';
import {
  calcularRetiroProgramado,
  calcularRetiroProgramadoSobrevivencia,
  calcularRVInmediataSobrevivencia,
  AVISO_SIMULACION,
  ESCENARIOS_RENTABILIDAD_RP,
  type EscenarioRentabilidadRP,
  calcularRVInmediata,
  calcularRVPeriodoGarantizado,
  calcularRVAumentoTemporal,
  calcularRVConAmbasClausulas,
  calcularPGU,
  calcularBAC,
  calcularCompensacionExpectativaVidaMujer,
  calcularFinanciamientoInvalidez,
  calcularFinanciamientoSobrevivencia,
  calcularCNUSobrevivencia,
  calcularRVAumentoTemporalSobrevivencia,
  calcularRVSobrevivenciaGarantizada,
  calcularPorcentajesBeneficiarios,
  calcularExpectativaVida,
  BeneficiarioPension,
  ResultadoEscenario,
  ProyeccionAnual,
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
  Sliders,
  Accessibility
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
  const [referenciaUF, setReferenciaUF] = useState<ReferenciaUF>({ ...UF_REFERENCIA_EJEMPLO });
  const valorUF = referenciaUF.valor;
  const fuenteUF = referenciaUF.fuente;
  const [errorUF, setErrorUF] = useState('');

  const [isLoadingUF, setIsLoadingUF] = useState<boolean>(false);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState<boolean>(false);
  const isCotizando = false;

  // Estado del Afiliado (por defecto: Caso real Juan Zamora SCOMP)
  const [afiliado, setAfiliado] = useState<AfiliadoState>({
    nombre: 'Juan Lorenzo Zamora Mena',
    rut: '9.171.135-4',
    fechaNacimiento: '1961-02-15',
    edad: 65,
    sexo: 'M',
    fondosUF: 1035.47,
    fondosCLP: ufAClp(1035.47, UF_REFERENCIA_EJEMPLO),
    anosCotizados: 25,
    tipoPension: 'vejez',
    esInvalido: false,
    gradoInvalidez: 'total',
    cubiertoSIS: true,
    ingresoBaseCLP: 1200000,
    ingresoBaseUF: clpAUf(1200000, UF_REFERENCIA_EJEMPLO),
    tieneConyuge: true,
    fechaNacimientoConyuge: '1964-06-10',
    edadConyuge: 62,
    sexoConyuge: 'F',
    beneficiarios: [
      {
        id: 'ben-default-conyuge',
        nombre: 'Cónyuge',
        tipo: 'conyuge',
        fechaNacimiento: '1964-06-10',
        edad: 62,
        sexo: 'F',
        porcentajePension: 0.60
      }
    ],
    conAsesor: true
  });

  const actualizarReferenciaUF = useCallback((referencia: ReferenciaUF) => {
    const uf = validarReferenciaUF(referencia);
    setReferenciaUF(uf);
    setAfiliado(prev => ({ ...prev, fondosUF: clpAUf(prev.fondosCLP, uf),
      ingresoBaseUF: clpAUf(prev.ingresoBaseCLP ?? 0, uf) }));
    setErrorUF('');
  }, []);

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


  // Tasas de Interés de Cálculo Actuarial (en porcentaje %, ej. 3.67 para 3.67%)
  const [escenarioRP, setEscenarioRP] = useState<EscenarioRentabilidadRP>('base');
  const [tasaRP, setTasaRP] = useState<number>(3.67);
  const [tasaRV, setTasaRV] = useState<number>(2.99);

  // Función para obtener la tasa oficial recomendada según régimen previsional
  const getTasaRVOficial = useCallback((tipo: 'vejez' | 'invalidez' | 'sobrevivencia', grado?: 'total' | 'parcial') => {
    if (tipo === 'invalidez') {
      const val = grado === 'parcial'
        ? (TASAS_RENTA_VITALICIA?.companias?.['CONFUTURO']?.invalidez_parcial || 0.0272)
        : (TASAS_RENTA_VITALICIA?.companias?.['EUROAMERICA']?.invalidez_total || 0.0302);
      return Number((val * 100).toFixed(2));
    }
    if (tipo === 'sobrevivencia') {
      const val = TASAS_RENTA_VITALICIA?.companias?.['EUROAMERICA']?.sobrevivencia || 0.0295;
      return Number((val * 100).toFixed(2));
    }
    const val = TASAS_RENTA_VITALICIA?.companias?.['EUROAMERICA']?.vejez || 0.0299;
    return Number((val * 100).toFixed(2));
  }, []);

  const handleRestablecerTasas = useCallback(() => {
    setTasaRP(3.67);
    setTasaRV(getTasaRVOficial(afiliado.tipoPension, afiliado.gradoInvalidez));
  }, [afiliado.tipoPension, afiliado.gradoInvalidez, getTasaRVOficial]);

  // Estado de las Cláusulas y Escenarios para explorador complementario
  const [clausulas, setClausulas] = useState<CláusulasState>({
    mesesGarantizados: 180, // 15 años
    mesesAumento: 36,       // 3 años
    porcentajeAumento: 1.0,  // +100%
    afpSeleccionada: 'PLANVITAL',
    incluirPGU: true,
    incluirBAC: true,
    incluirBonoMujer: true
  });

  // Consultar UF oficial al montar el componente
  const fetchUF = useCallback(async () => {
    setIsLoadingUF(true);
    try {
      const res = await fetch('/api/uf');
      if (res.ok) {
        const data = await res.json();
        if (!data.success) throw new Error(data.error || 'No se pudo obtener UF');
        actualizarReferenciaUF({ valor: data.valor, fecha: data.fecha, fuente: data.fuente });
      } else {
        throw new Error('No se obtuvo una referencia UF fechada; se conserva la seleccionada');
      }
    } catch (err) {
      setErrorUF(err instanceof Error ? err.message : 'No se pudo obtener UF');
    } finally {
      setIsLoadingUF(false);
    }
  }, [actualizarReferenciaUF]);

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
        fondosCLP: ufAClp(1035.47, referenciaUF),
        anosCotizados: 25,
        tipoPension: 'vejez',
        esInvalido: false,
        gradoInvalidez: 'total',
        tieneConyuge: true,
        fechaNacimientoConyuge: '1964-06-10',
        edadConyuge: 62,
        sexoConyuge: 'F',
        beneficiarios: [
          {
            id: 'ben-zamora-conyuge',
            nombre: 'Cónyuge',
            tipo: 'conyuge',
            fechaNacimiento: '1964-06-10',
            edad: 62,
            sexo: 'F',
            porcentajePension: 0.60
          }
        ],
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
        fondosCLP: ufAClp(2177.40, referenciaUF),
        anosCotizados: 30,
        tipoPension: 'vejez',
        esInvalido: false,
        gradoInvalidez: 'total',
        tieneConyuge: true,
        fechaNacimientoConyuge: '1956-08-20',
        edadConyuge: 70,
        sexoConyuge: 'M',
        beneficiarios: [
          {
            id: 'ben-spuler-conyuge',
            nombre: 'Cónyuge',
            tipo: 'conyuge',
            fechaNacimiento: '1956-08-20',
            edad: 70,
            sexo: 'M',
            porcentajePension: 0.60
          }
        ],
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
        nombre: 'Afiliado Sin Beneficiarios',
        rut: '12.345.678-9',
        fechaNacimiento: '1961-01-01',
        edad: 65,
        sexo: 'M',
        fondosUF: 1500.00,
        fondosCLP: ufAClp(1500.00, referenciaUF),
        anosCotizados: 20,
        tipoPension: 'vejez',
        esInvalido: false,
        gradoInvalidez: 'total',
        tieneConyuge: false,
        fechaNacimientoConyuge: undefined,
        edadConyuge: 60,
        sexoConyuge: 'F',
        beneficiarios: [],
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
    tasaRPActuarial: number,
    tasaRVActuarial: number,
    beneficiarios: BeneficiarioPension[],
    esInvalido: boolean = false,
    tipoPension: 'vejez' | 'invalidez' | 'sobrevivencia' = 'vejez'
  ): CotizacionItemResultado => {
    let resultado: ResultadoEscenario;

    // Determinación de la tasa de Renta Vitalicia a aplicar:
    // Si la modalidad tiene asignada una tasa especial manual específica, esta prevalece.
    const tasaRVEfectiva = (mod.tasaEspecialRV !== undefined && mod.tasaEspecialRV > 0)
      ? (mod.tasaEspecialRV > 0.5 ? mod.tasaEspecialRV / 100 : mod.tasaEspecialRV)
      : tasaRVActuarial;

    if (tipoPension === 'sobrevivencia') {
      const porcentajes = calcularPorcentajesBeneficiarios(beneficiarios);
      if (mod.tipo === 'retiro_programado') {
        resultado = calcularRetiroProgramadoSobrevivencia(fondosRP, edad, sexo, beneficiarios,
          undefined, undefined, tasaRPActuarial, referenciaUF,
          { rentabilidadRealAnual: ESCENARIOS_RENTABILIDAD_RP[escenarioRP].rentabilidadRealAnual });
      } else {
        // Modalidades de Renta Vitalicia en Sobrevivencia (Normativa Oficial CMF y SP)
        if (mod.tipo === 'renta_vitalicia_simple') {
          resultado = calcularRVInmediataSobrevivencia(fondosRV, edad, sexo, beneficiarios,
            undefined, undefined, tasaRVEfectiva, referenciaUF);
        } else if (mod.tipo === 'rv_garantizada') {
          resultado = calcularRVSobrevivenciaGarantizada(
            fondosRV,
            beneficiarios,
            mod.mesesGarantizados || 180,
            tasaRVEfectiva,
            referenciaUF
          );
          if (mod.esTasaEspecial || (mod.tasaEspecialRV !== undefined && mod.tasaEspecialRV > 0)) {
            resultado.advertencias = [
              ...(resultado.advertencias || []),
              `⚡ Tasa Especial Ajustada: ${(tasaRVEfectiva * 100).toFixed(2)}% anual`
            ];
          }
        } else {
          // Aumento Temporal o Combinada en Sobrevivencia (No permitidas por normativa CMF/SP)
          resultado = {
            referenciaUF, unidadMonetaria: 'CLP_REALES',
            nombre: `${mod.nombre} (No autorizada en Sobrevivencia)`,
            pensionMensual: 0,
            pensionEnUF: 0,
            pensionAnual: 0,
            cnu: 0,
            tasaInteres: tasaRVEfectiva,
            expectativaVida: 0,
            advertencias: [
              'Cláusula de Aumento Temporal no permitida en Sobrevivencia según normativa CMF/SP.',
              'El Aumento Temporal es exclusivo de pensiones de Vejez e Invalidez.',
              'En Sobrevivencia solo procede Retiro Programado, RV Simple o RV con Período Garantizado.'
            ]
          };
        }
      }
    } else if (mod.tipo === 'retiro_programado') {
      resultado = calcularRetiroProgramado(fondosRP, edad, sexo, tasaRPActuarial, beneficiarios, esInvalido, {
        rentabilidadRealAnual: ESCENARIOS_RENTABILIDAD_RP[escenarioRP].rentabilidadRealAnual
      }, referenciaUF);
    } else if (mod.tipo === 'renta_vitalicia_simple') {
      resultado = calcularRVInmediata(fondosRV, edad, sexo, tasaRVEfectiva, beneficiarios, esInvalido, referenciaUF);
      if (mod.esTasaEspecial || (mod.tasaEspecialRV !== undefined && mod.tasaEspecialRV > 0)) {
        resultado.advertencias = [
          ...(resultado.advertencias || []),
          `⚡ Tasa Especial Ajustada: ${(tasaRVEfectiva * 100).toFixed(2)}% anual`
        ];
      }
    } else if (mod.tipo === 'rv_garantizada') {
      resultado = calcularRVPeriodoGarantizado(
        fondosRV,
        edad,
        sexo,
        mod.mesesGarantizados || 180,
        tasaRVEfectiva,
        beneficiarios,
        esInvalido, referenciaUF
      );
      if (mod.esTasaEspecial || (mod.tasaEspecialRV !== undefined && mod.tasaEspecialRV > 0)) {
        resultado.advertencias = [
          ...(resultado.advertencias || []),
          `⚡ Tasa Especial Ajustada: ${(tasaRVEfectiva * 100).toFixed(2)}% anual`
        ];
      }
    } else if (mod.tipo === 'rv_aumento_temporal') {
      resultado = calcularRVAumentoTemporal(
        fondosRV,
        edad,
        sexo,
        mod.mesesAumento || 36,
        mod.porcentajeAumento || 1.0,
        tasaRVEfectiva,
        beneficiarios,
        esInvalido, referenciaUF
      );
      if (mod.esTasaEspecial || (mod.tasaEspecialRV !== undefined && mod.tasaEspecialRV > 0)) {
        resultado.advertencias = [
          ...(resultado.advertencias || []),
          `⚡ Tasa Especial Ajustada: ${(tasaRVEfectiva * 100).toFixed(2)}% anual`
        ];
      }
    } else {
      // RV Combinada
      resultado = calcularRVConAmbasClausulas(
        fondosRV,
        edad,
        sexo,
        mod.mesesGarantizados || 180,
        mod.mesesAumento || 36,
        mod.porcentajeAumento || 1.0,
        tasaRVEfectiva,
        beneficiarios,
        esInvalido, referenciaUF
      );
      if (mod.esTasaEspecial || (mod.tasaEspecialRV !== undefined && mod.tasaEspecialRV > 0)) {
        resultado.advertencias = [
          ...(resultado.advertencias || []),
          `⚡ Tasa Especial Ajustada: ${(tasaRVEfectiva * 100).toFixed(2)}% anual`
        ];
      }
    }

    const pguObj = (tipoPension !== 'sobrevivencia' && clausulas.incluirPGU)
      ? calcularPGU(resultado.pensionMensual, edad) 
      : null;
    const pguMensual = (pguObj && pguObj.aplica) ? (pguObj.montoMensual || 0) : 0;

    const bacObj = (tipoPension !== 'sobrevivencia' && clausulas.incluirBAC)
      ? calcularBAC(afiliado.anosCotizados, 0, referenciaUF)
      : null;
    const bacMensual = (bacObj && bacObj.aplica) ? (bacObj.beneficioMensualPesos || 0) : 0;

    // Compensación por Diferencias de Expectativa de Vida para Mujeres (Seguro Social Previsional)
    const bonoMujerObj = (clausulas.incluirBonoMujer && afiliado.sexo === 'F' && tipoPension !== 'sobrevivencia')
      ? calcularCompensacionExpectativaVidaMujer(afiliado.sexo, edad, referenciaUF, tipoPension, afiliado.cubiertoSIS)
      : null;
    const bonoMujerMensual = (bonoMujerObj && bonoMujerObj.aplica) ? bonoMujerObj.beneficioMensualPesos : 0;
    const bonoMujerUF = (bonoMujerObj && bonoMujerObj.aplica) ? bonoMujerObj.beneficioUF : 0;

    const baseCLP = Number(resultado.pensionMensual) || 0;
    const totalCLP = baseCLP + pguMensual + bacMensual + bonoMujerMensual;
    const totalUF = clpAUf(totalCLP, referenciaUF);

    return {
      config: mod,
      resultado,
      pguMensual,
      bacMensual,
      bonoMujerMensual,
      bonoMujerUF,
      totalConBeneficiosCLP: Math.round(totalCLP),
      totalConBeneficiosUF: Number(totalUF.toFixed(2))
    };
  }, [afiliado.anosCotizados, afiliado.sexo, afiliado.cubiertoSIS, valorUF, escenarioRP, referenciaUF, clausulas.incluirPGU, clausulas.incluirBAC, clausulas.incluirBonoMujer]);

  // Desglose actuarial de financiamiento para Pensión de Invalidez (D.L. 3.500)
  const financiamientoInvalidez = useMemo<InvalidezFinanciamientoInfo | undefined>(() => {
    if (afiliado.tipoPension !== 'invalidez') return undefined;

    const beneficiarios: BeneficiarioPension[] = (afiliado.beneficiarios && afiliado.beneficiarios.length > 0)
      ? afiliado.beneficiarios
      : (afiliado.tieneConyuge ? [{
          tipo: 'conyuge',
          edad: afiliado.edadConyuge,
          sexo: afiliado.sexoConyuge,
          porcentajePension: 0.60
        }] : []);

    const ingresoBase = afiliado.ingresoBaseCLP || 1200000;
    const grado = afiliado.gradoInvalidez || 'total';
    const cubiertoSIS = afiliado.cubiertoSIS ?? true;

    return calcularFinanciamientoInvalidez(
      afiliado.fondosCLP,
      ingresoBase,
      grado,
      cubiertoSIS,
      afiliado.edad,
      afiliado.sexo,
      (tasaRP || 3.67) / 100,
      beneficiarios,
      referenciaUF
    );
  }, [
    afiliado.tipoPension,
    afiliado.fondosCLP,
    afiliado.ingresoBaseCLP,
    afiliado.gradoInvalidez,
    afiliado.cubiertoSIS,
    afiliado.edad,
    afiliado.sexo,
    afiliado.beneficiarios,
    afiliado.tieneConyuge,
    afiliado.edadConyuge,
    afiliado.sexoConyuge,
    referenciaUF,
    valorUF,
    tasaRP
  ]);

  // Desglose actuarial de financiamiento para Pensión de Sobrevivencia (D.L. 3.500)
  const financiamientoSobrevivencia = useMemo<SobrevivenciaFinanciamientoInfo | undefined>(() => {
    if (afiliado.tipoPension !== 'sobrevivencia') return undefined;

    const beneficiarios: BeneficiarioPension[] = (afiliado.beneficiarios && afiliado.beneficiarios.length > 0)
      ? afiliado.beneficiarios
      : (afiliado.tieneConyuge ? [{
          tipo: 'conyuge',
          edad: afiliado.edadConyuge,
          sexo: afiliado.sexoConyuge,
          porcentajePension: 0.60
        }] : []);

    const ingresoBase = afiliado.ingresoBaseCLP || 1200000;
    const cubiertoSIS = afiliado.cubiertoSIS ?? true;

    return calcularFinanciamientoSobrevivencia(
      afiliado.fondosCLP,
      ingresoBase,
      cubiertoSIS,
      beneficiarios,
      (tasaRP || 3.67) / 100,
      referenciaUF
    );
  }, [
    afiliado.tipoPension,
    afiliado.fondosCLP,
    afiliado.ingresoBaseCLP,
    afiliado.cubiertoSIS,
    afiliado.beneficiarios,
    afiliado.tieneConyuge,
    afiliado.edadConyuge,
    afiliado.sexoConyuge,
    referenciaUF,
    valorUF,
    tasaRP
  ]);

  // Manejar cálculo de todas las modalidades activas en lote
  const calcularResultados = useCallback(() => {
      const beneficiarios: BeneficiarioPension[] = (afiliado.beneficiarios && afiliado.beneficiarios.length > 0)
        ? afiliado.beneficiarios
        : (afiliado.tieneConyuge ? [{
            tipo: 'conyuge',
            edad: afiliado.edadConyuge,
            sexo: afiliado.sexoConyuge,
            porcentajePension: 0.60
          }] : []);

      const esInvalido = afiliado.tipoPension === 'invalidez' || !!afiliado.esInvalido;
      const esSobrevivencia = afiliado.tipoPension === 'sobrevivencia';
      
      // En Invalidez o Sobrevivencia con cobertura SIS, el saldo para cotizar en SCOMP incluye el Aporte Adicional del SIS
      const fondosEfectivos = (esInvalido && financiamientoInvalidez)
        ? financiamientoInvalidez.saldoTotalFinanciamientoCLP
        : (esSobrevivencia && financiamientoSobrevivencia)
          ? financiamientoSobrevivencia.saldoTotalFinanciamientoCLP
          : afiliado.fondosCLP;

      const fondosRP = afiliado.conAsesor ? fondosEfectivos * (1 - 0.012) : fondosEfectivos;
      const fondosRV = afiliado.conAsesor ? fondosEfectivos * (1 - 0.015) : fondosEfectivos;
      
      const tasaRPAct = (tasaRP || 3.67) / 100;
      const tasaRVAct = (tasaRV || 2.99) / 100;

      const activas = modalidades
        .filter(m => m.activa)
        .filter(m => !esSobrevivencia || (m.tipo !== 'rv_garantizada' && m.tipo !== 'rv_combinada'));
      const resultados = activas.map(mod =>
        calcularModalidad(
          mod,
          fondosRP,
          fondosRV,
          afiliado.edad,
          afiliado.sexo,
          tasaRPAct,
          tasaRVAct,
          beneficiarios,
          esInvalido,
          afiliado.tipoPension
        )
      );

      return resultados;
  }, [afiliado, modalidades, calcularModalidad, financiamientoInvalidez, financiamientoSobrevivencia, tasaRP, tasaRV]);

  // Datos derivados en la misma renderización: nunca combinar resultados viejos y UF nueva.
  const cotizacionResultados = useMemo(() => calcularResultados(), [calcularResultados]);
  const handleGenerarCotizacion = useCallback(() => { calcularResultados(); }, [calcularResultados]);

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
    const beneficiarios: BeneficiarioPension[] = (afiliado.beneficiarios && afiliado.beneficiarios.length > 0)
      ? afiliado.beneficiarios
      : (afiliado.tieneConyuge ? [{
          tipo: 'conyuge',
          edad: afiliado.edadConyuge,
          sexo: afiliado.sexoConyuge,
          porcentajePension: 0.60
        }] : []);

    const esInvalido = afiliado.tipoPension === 'invalidez' || !!afiliado.esInvalido;
    const esSobrevivencia = afiliado.tipoPension === 'sobrevivencia';

    const fondosEfectivos = (esInvalido && financiamientoInvalidez)
      ? financiamientoInvalidez.saldoTotalFinanciamientoCLP
      : (esSobrevivencia && financiamientoSobrevivencia)
        ? financiamientoSobrevivencia.saldoTotalFinanciamientoCLP
        : afiliado.fondosCLP;

    const fondosRV = afiliado.conAsesor ? fondosEfectivos * (1 - 0.015) : fondosEfectivos;

    const ranking: CompaniasRankingItem[] = [];
    for (const [key, item] of Object.entries(TASAS_RENTA_VITALICIA?.companias || {})) {
      let tasaAplicable: number = item.vejez;
      if (esInvalido) {
        tasaAplicable = (afiliado.gradoInvalidez === 'parcial' ? item.invalidez_parcial : item.invalidez_total) || item.vejez;
      } else if (esSobrevivencia) {
        tasaAplicable = item.sobrevivencia;
      }
      if (!tasaAplicable || tasaAplicable <= 0) continue;

      let pensionUF = 0;
      let pensionCLP = 0;

      if (esSobrevivencia) {
        const rv = calcularRVInmediataSobrevivencia(fondosRV, afiliado.edad, afiliado.sexo, beneficiarios, undefined, undefined, tasaAplicable, referenciaUF);
        pensionCLP = rv.pensionMensual;
        pensionUF = rv.pensionEnUF;
      } else {
        const rvComp = calcularRVInmediata(
          fondosRV,
          afiliado.edad,
          afiliado.sexo,
          tasaAplicable,
          beneficiarios,
          esInvalido, referenciaUF
        );
        pensionUF = rvComp.pensionEnUF;
        pensionCLP = rvComp.pensionMensual;
      }

      ranking.push({
        nombre: key.replace('_', ' '),
        rating: CLASIFICACIONES_RIESGO[key] || 'AA+',
        tasaVejez: tasaAplicable,
        pensionUF,
        pensionCLP
      });
    }
    return ranking;
  }, [afiliado, financiamientoInvalidez, financiamientoSobrevivencia, valorUF, referenciaUF]);

  // Descarga del Informe PDF Orientativo con todas las modalidades cotizadas
  const handleGenerarPDF = async () => {
    setIsGeneratingPDF(true);
    try {
      const beneficiariosReporte = (afiliado.beneficiarios && afiliado.beneficiarios.length > 0)
        ? afiliado.beneficiarios
        : (afiliado.tieneConyuge ? [{
            tipo: 'conyuge',
            edad: afiliado.edadConyuge,
            sexo: afiliado.sexoConyuge,
            porcentajePension: 0.60
          }] : []);

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
            tipoPension: afiliado.tipoPension,
            esInvalido: afiliado.esInvalido,
            gradoInvalidez: afiliado.gradoInvalidez,
            cubiertoSIS: afiliado.cubiertoSIS
          },
          parametros: {
            referenciaUF,
            tasaRP: (tasaRP || 3.67) / 100,
            rentabilidadRealAnualRP: ESCENARIOS_RENTABILIDAD_RP[escenarioRP].rentabilidadRealAnual,
            tasaRV: (tasaRV || 2.99) / 100,
            incluirPGU: clausulas.incluirPGU,
            incluirBAC: clausulas.incluirBAC,
            incluirBonoMujer: clausulas.incluirBonoMujer ?? true,
            afpSeleccionada: clausulas.afpSeleccionada
          },
          resultados: cotizacionResultados.map(r => ({
            ...r.resultado,
            nombre: r.config.nombre || r.resultado.nombre || (r.config.tipo === 'retiro_programado' ? 'Retiro Programado' : 'Renta Vitalicia Inmediata Simple'),
            periodoGarantizado: r.config.mesesGarantizados || r.resultado.periodoGarantizado,
            aumentoTemporal: r.resultado.aumentoTemporal || (r.config.mesesAumento ? {
              meses: r.config.mesesAumento,
              porcentaje: r.config.porcentajeAumento || 1,
              pensionAumentada: r.resultado.pensionMensual,
              pensionFinal: r.resultado.proyeccion?.find(p => p.fase === 'normal' || p.fase === 'vitalicia')?.pensionMensual
                || r.resultado.pensionMensual
            } : undefined)
          })),
          beneficiarios: beneficiariosReporte
        })
      });

      if (!res.ok) {
        const errJson = await res.json().catch(() => null);
        throw new Error(errJson?.error || 'Error al generar PDF');
      }

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
                Simulador de Orientación Previsional
              </h1>
              <span className="text-[11px] text-slate-500 font-medium">
                Comparación ilustrativa de Retiro Programado y Renta Vitalicia
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Badge variant="outline" className="text-xs bg-emerald-50 text-emerald-800 border-emerald-200 gap-1.5 py-1 px-2.5 font-medium">
              <CheckCircle className="w-3.5 h-3.5 text-emerald-600" />
              <span>UF de referencia: ${valorUF.toLocaleString('es-CL', { minimumFractionDigits: 2 })} ({referenciaUF.fecha})</span>
            </Badge>

            <Badge variant="outline" className="text-xs bg-blue-50 text-blue-800 border-blue-200 gap-1.5 py-1 px-2.5 font-medium hidden sm:flex">
              <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
              <span>Tablas TM-2020</span>
            </Badge>
          </div>
        </div>
      </header>

      {/* Selector Superior de Régimen de Pensión: Vejez vs Invalidez vs Sobrevivencia */}
      <div className="bg-white border-b border-slate-200/90 shadow-2xs">
        <div className="max-w-7xl mx-auto px-4 py-2.5 flex flex-col sm:flex-row items-center justify-between gap-3">
          <div className="flex items-center gap-3">
            <span className="text-xs font-semibold text-slate-700 hidden sm:inline">Régimen Previsional:</span>
            <div className="inline-flex p-1 bg-slate-100/90 rounded-xl border border-slate-200 shadow-2xs gap-1">
              <button
                type="button"
                onClick={() => {
                  setAfiliado(prev => ({
                    ...prev,
                    tipoPension: 'vejez',
                    esInvalido: false
                  }));
                  setTasaRV(getTasaRVOficial('vejez'));
                  setModalidades(prev => {
                    const hasGarantizada = prev.some(m => m.tipo === 'rv_garantizada');
                    if (!hasGarantizada) {
                      return [
                        ...prev,
                        {
                          id: 'base-rv-garantizada-15',
                          tipo: 'rv_garantizada' as const,
                          nombre: 'RV Garantizada 15 años (180 meses)',
                          descripcion: 'Pensión fija con garantía de pago por 15 años a beneficiarios o herederos',
                          mesesGarantizados: 180,
                          activa: true
                        }
                      ];
                    }
                    return prev;
                  });
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  afiliado.tipoPension === 'vejez'
                    ? 'bg-white text-blue-900 shadow-sm border border-slate-200/80 ring-1 ring-blue-500/20'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="text-base">👴</span>
                <span>Pensión de Vejez</span>
                {afiliado.tipoPension === 'vejez' && (
                  <Badge variant="outline" className="text-[9px] bg-blue-50 text-blue-800 border-blue-200 py-0 h-4">
                    Tablas CB/RV
                  </Badge>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAfiliado(prev => {
                    setTasaRV(getTasaRVOficial('invalidez', prev.gradoInvalidez || 'total'));
                    return {
                      ...prev,
                      tipoPension: 'invalidez',
                      esInvalido: true,
                      gradoInvalidez: prev.gradoInvalidez || 'total',
                      cubiertoSIS: prev.cubiertoSIS ?? true,
                      ingresoBaseCLP: prev.ingresoBaseCLP || 1200000,
                      ingresoBaseUF: prev.ingresoBaseUF || (clpAUf(1200000, referenciaUF))
                    };
                  });
                  setModalidades(prev => {
                    const hasGarantizada = prev.some(m => m.tipo === 'rv_garantizada');
                    if (!hasGarantizada) {
                      return [
                        ...prev,
                        {
                          id: 'base-rv-garantizada-15',
                          tipo: 'rv_garantizada' as const,
                          nombre: 'RV Garantizada 15 años (180 meses)',
                          descripcion: 'Pensión fija con garantía de pago por 15 años a beneficiarios o herederos',
                          mesesGarantizados: 180,
                          activa: true
                        }
                      ];
                    }
                    return prev;
                  });
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  afiliado.tipoPension === 'invalidez'
                    ? 'bg-amber-600 text-white shadow-sm ring-1 ring-amber-600/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="text-base">🩺</span>
                <span>Pensión de Invalidez</span>
                {afiliado.tipoPension === 'invalidez' && (
                  <Badge variant="outline" className="text-[9px] bg-amber-500 text-white border-amber-400 py-0 h-4">
                    Tablas MI-2020 + SIS
                  </Badge>
                )}
              </button>

              <button
                type="button"
                onClick={() => {
                  setAfiliado(prev => ({
                    ...prev,
                    tipoPension: 'sobrevivencia',
                    esInvalido: false,
                    cubiertoSIS: prev.cubiertoSIS ?? true,
                    ingresoBaseCLP: prev.ingresoBaseCLP || 1200000,
                    ingresoBaseUF: prev.ingresoBaseUF || (clpAUf(1200000, referenciaUF))
                  }));
                  setTasaRV(getTasaRVOficial('sobrevivencia'));
                  setModalidades(prev => {
                    const filtered = prev.filter(m => m.tipo !== 'rv_aumento_temporal' && m.tipo !== 'rv_combinada');
                    const hasGarantizada = filtered.some(m => m.tipo === 'rv_garantizada');
                    if (!hasGarantizada) {
                      filtered.push({
                        id: 'base-rv-garantizada-sob-15',
                        tipo: 'rv_garantizada' as const,
                        nombre: 'RV Sobrevivencia Garantizada 15 años (180 meses)',
                        descripcion: 'Pensión familiar en UF con garantía legal de 15 años transferible a beneficiarios',
                        mesesGarantizados: 180,
                        activa: true
                      });
                    }
                    return filtered;
                  });
                }}
                className={`flex items-center gap-2 px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all ${
                  afiliado.tipoPension === 'sobrevivencia'
                    ? 'bg-purple-700 text-white shadow-sm ring-1 ring-purple-700/30'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-200/60'
                }`}
              >
                <span className="text-base">🕊️</span>
                <span>Pensión de Sobrevivencia</span>
                {afiliado.tipoPension === 'sobrevivencia' && (
                  <Badge variant="outline" className="text-[9px] bg-purple-600 text-white border-purple-500 py-0 h-4">
                    Tablas B-2020 + SIS
                  </Badge>
                )}
              </button>
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs">
            {afiliado.tipoPension === 'invalidez' ? (
              <Badge className="bg-amber-100 text-amber-900 border-amber-300 gap-1.5 py-1 px-3">
                <Accessibility className="w-3.5 h-3.5 text-amber-600" />
                <span>Régimen Invalidez Calificada (D.L. 3.500) • Tabla {afiliado.sexo === 'M' ? 'MI-H-2020' : 'MI-M-2020'}</span>
              </Badge>
            ) : afiliado.tipoPension === 'sobrevivencia' ? (
              <Badge className="bg-purple-100 text-purple-900 border-purple-300 gap-1.5 py-1 px-3">
                <ShieldCheck className="w-3.5 h-3.5 text-purple-600" />
                <span>Régimen Sobrevivencia Legal (D.L. 3.500 Art. 58) • Tablas B-M / B-H / MI</span>
              </Badge>
            ) : (
              <Badge className="bg-slate-100 text-slate-700 border-slate-300 gap-1.5 py-1 px-3">
                <ShieldCheck className="w-3.5 h-3.5 text-slate-600" />
                <span>Régimen Ordinario de Vejez • Tabla {afiliado.sexo === 'M' ? 'CB-H-2020' : 'RV-M-2020'}</span>
              </Badge>
            )}
          </div>
        </div>
      </div>

      {/* Contenido Principal */}
      <main className="max-w-7xl mx-auto px-4 py-5">
        <p role="note" className="mb-4 rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-950">
          {AVISO_SIMULACION}
        </p>
        <div className="mb-4 rounded-lg border bg-white p-3 flex flex-wrap gap-4 items-end">
          <label className="text-sm">UF en CLP
            <input aria-label="UF en CLP" type="number" min="0.01" step="0.01" defaultValue={valorUF} key={`valor-${valorUF}`}
              onBlur={event => { try { actualizarReferenciaUF({ ...referenciaUF, valor: Number(event.target.value), fuente: 'Configuración manual' }); } catch (error) { setErrorUF(String(error)); } }} className="block border rounded p-1" />
          </label>
          <label className="text-sm">Fecha de referencia UF
            <input aria-label="Fecha de referencia UF" type="date" value={referenciaUF.fecha}
              onChange={event => { try { actualizarReferenciaUF({ ...referenciaUF, fecha: event.target.value, fuente: 'Configuración manual' }); } catch (error) { setErrorUF(String(error)); } }} className="block border rounded p-1" />
          </label>
          <p className="text-xs text-slate-600">{fuenteUF}. Los fondos en CLP se conservan al cambiar la referencia.</p>
          {errorUF && <p role="alert" className="text-sm text-red-700">{errorUF}</p>}
        </div>
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Barra Lateral Izquierda (4 columnas en LG) */}
          <div className="lg:col-span-4">
            <AffiliateSidebar
              afiliado={afiliado}
              setAfiliado={setAfiliado}
              clausulas={clausulas}
              setClausulas={setClausulas}
              referenciaUF={referenciaUF}
              fuenteUF={fuenteUF}
              onRefreshUF={fetchUF}
              isLoadingUF={isLoadingUF}
              invalidezInfo={financiamientoInvalidez}
              sobrevivenciaInfo={financiamientoSobrevivencia}
              tasaRP={tasaRP}
              tasaRV={tasaRV}
            />
          </div>

          {/* Panel Principal (8 columnas en LG) */}
          <div className="lg:col-span-8 space-y-5">
            {(
              <div className="rounded-xl border border-slate-200 bg-white p-4 space-y-2">
                <label htmlFor="escenario-rp" className="block text-sm font-semibold">Rentabilidad real hipotética del fondo AFP</label>
                <select id="escenario-rp" value={escenarioRP}
                  onChange={event => setEscenarioRP(event.target.value as EscenarioRentabilidadRP)}
                  className="w-full rounded-md border border-slate-300 p-2 text-sm">
                  {(Object.keys(ESCENARIOS_RENTABILIDAD_RP) as EscenarioRentabilidadRP[]).map(clave => (
                    <option key={clave} value={clave}>
                      {ESCENARIOS_RENTABILIDAD_RP[clave].nombre}: {ESCENARIOS_RENTABILIDAD_RP[clave].rentabilidadRealAnual * 100}% real anual
                    </option>
                  ))}
                </select>
                <p className="text-xs text-slate-600">Supuestos constantes ilustrativos. Cambian la trayectoria del saldo y la pensión futura; la tasa técnica del CNU se ajusta por separado. Año base actuarial: 2026.</p>
              </div>
            )}
            {/* 1. Selector y Constructor de Modalidades a Cotizar */}
            <ModalitiesSelector
              modalidades={modalidades}
              onToggleModalidad={handleToggleModalidad}
              onAgregarModalidad={handleAgregarModalidad}
              onEliminarModalidad={handleEliminarModalidad}
              onGenerarCotizacion={handleGenerarCotizacion}
              isCotizando={isCotizando}
              tipoPension={afiliado.tipoPension}
              tasaRP={tasaRP}
              setTasaRP={setTasaRP}
              tasaRV={tasaRV}
              setTasaRV={setTasaRV}
              onRestablecerTasas={handleRestablecerTasas}
            />

            {/* 2. Resultados Consolidados de la Multi-Cotización */}
            <MultiQuotationResults
              items={cotizacionResultados}
              referenciaUF={referenciaUF}
              onDescargarPDF={handleGenerarPDF}
              isGeneratingPDF={isGeneratingPDF}
              tipoPension={afiliado.tipoPension}
              invalidezInfo={financiamientoInvalidez}
              sobrevivenciaInfo={financiamientoSobrevivencia}
              tasaRP={tasaRP}
              tasaRV={tasaRV}
              sexo={afiliado.sexo}
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
                  <span>Referencias de RV</span>
                </TabsTrigger>

                <TabsTrigger value="sliders" className="text-xs font-semibold gap-1.5 data-[state=active]:bg-blue-50 data-[state=active]:text-blue-900">
                  <Sliders className="w-3.5 h-3.5" />
                  <span>Ajustes Finos</span>
                </TabsTrigger>
              </TabsList>

              <TabsContent value="grafico" className="pt-3">
                {primerRP && primerRVSimple && (
                  <TrajectoryChart
                    edadInicial={afiliado.tipoPension === 'sobrevivencia' ? (primerRP?.proyeccion?.[0]?.edad ?? afiliado.edad) : afiliado.edad}
                    proyeccionRP={primerRP.proyeccion}
                    resultadoRVSimple={primerRVSimple}
                    resultadoRVClausulas={primerRVClausula || primerRVSimple}
                    referenciaUF={referenciaUF}
                  />
                )}
              </TabsContent>

              <TabsContent value="ranking" className="pt-3">
                <InsuranceRankingTable
                  items={rankingCompanias}
                  referenciaUF={referenciaUF}
                  tipoPension={afiliado.tipoPension}
                />
              </TabsContent>

              <TabsContent value="sliders" className="pt-3">
                <ScenarioSliders
                  clausulas={clausulas}
                  setClausulas={setClausulas}
                  anosCotizados={afiliado.anosCotizados}
                  setAnosCotizados={(anos: number) => setAfiliado(prev => ({ ...prev, anosCotizados: anos }))}
                  bacUF={calcularBAC(afiliado.anosCotizados, 0, referenciaUF).beneficioUF}
                  tasaRP={tasaRP}
                  setTasaRP={setTasaRP}
                  tasaRV={tasaRV}
                  setTasaRV={setTasaRV}
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
