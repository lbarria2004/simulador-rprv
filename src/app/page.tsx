'use client'

import { useState, useCallback, useEffect } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { Badge } from '@/components/ui/badge'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { Separator } from '@/components/ui/separator'
import { 
  Calculator, 
  TrendingUp, 
  Users, 
  AlertTriangle,
  Info,
  DollarSign,
  PiggyBank,
  CheckCircle2,
  Loader2,
  Plus,
  Trash2,
  Shield,
  ArrowUpRight,
  FileText,
  RefreshCw,
  Settings
} from 'lucide-react'
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend
} from 'recharts'

// Tipos
type Sexo = 'M' | 'F'
type TipoPension = 'vejez' | 'invalidez' | 'sobrevivencia'

type TipoBeneficiario = 'conyuge' | 'conviviente' | 'hijo' | 'padre' | 'madre'

interface Beneficiario {
  id: string
  tipo: TipoBeneficiario
  edad: number
  sexo: Sexo
  porcentajePension: number
}

interface EscenarioRV {
  id: string
  tipo: 'inmediata' | 'periodo_garantizado' | 'aumento_temporal' | 'ambas'
  mesesGarantizados: number  // Input manual
  mesesAumento: number       // Input manual
  porcentajeAumento: number  // Input manual (0-100)
}

interface FormData {
  nombreAfiliado: string
  sexo: Sexo
  edad: number
  fondosAcumulados: number
  anosCotizados: number
  
  // Tipo de pensión
  tipoPension: TipoPension
  
  // Para invalidez
  gradoInvalidez: 'total' | 'total_2_3' | 'parcial'
  ingresoBase: number
  cubiertoSIS: boolean
  
  // Para sobrevivencia
  pensionReferenciaCausante: number
  ingresoBaseCausante: number
  esPensionado: boolean
  
  // Beneficiarios
  beneficiarios: Beneficiario[]
  
  // Escenarios
  calcularRP: boolean
  escenariosRV: EscenarioRV[]
}

interface ParametrosSistema {
  uf: number
  ufFecha: string
  ufFuente: string
  tasaRP: number
  tasaRV: number
  usarTasasManuales: boolean
  tasaRPManual: number
  tasaRVManual: number
  usarUFManual: boolean
  ufManual: number
}

interface PensionPorBeneficiario {
  tipo: string
  porcentaje: number
  pensionMensual: number
}

interface ResultadoEscenario {
  nombre: string
  pensionMensual: number
  pensionEnUF: number
  pensionAnual: number
  cnu: number
  tasaInteres: number
  expectativaVida: number
  periodoGarantizado?: number
  aumentoTemporal?: {
    meses: number
    porcentaje: number
    pensionAumentada: number
    pensionFinal: number
  }
  proyeccion?: Array<{
    año: number
    edad: number
    pensionMensual: number
    saldoAcumulado: number
    retiroAcumulado: number
    fase?: string
  }>
  advertencias?: string[]
  pensionPorBeneficiario?: PensionPorBeneficiario[]
  gradoInvalidez?: string
  ingresoBase?: number
  porcentajeInvalidez?: number
}

// Formateadores
const formatearPesos = (monto: number): string => {
  return '$' + Math.round(monto).toLocaleString('es-CL')
}

const formatearUF = (valor: number): string => {
  return valor.toFixed(2) + ' UF'
}

const formatearPorcentaje = (valor: number): string => {
  return (valor * 100).toFixed(2) + '%'
}

// Eliminar las constantes de opciones que ya no se usan como selectores
// Valores referencia para sugerencias
const SUGERENCIAS_MESES_GARANTIZADOS = [60, 120, 180, 240, 300, 360]
const SUGERENCIAS_MESES_AUMENTO = [12, 24, 36, 48, 60, 84, 108, 120]

const OPCIONES_TIPO_BENEFICIARIO = [
  { value: 'conyuge', label: 'Cónyuge', porcentajeDefault: 0.60 },
  { value: 'conviviente', label: 'Conviviente', porcentajeDefault: 0.50 },
  { value: 'hijo', label: 'Hijo/a', porcentajeDefault: 0.15 },
  { value: 'padre', label: 'Padre', porcentajeDefault: 0.15 },
  { value: 'madre', label: 'Madre', porcentajeDefault: 0.15 }
]

export default function SimuladorPensiones() {
  const [isLoading, setIsLoading] = useState(false)
  const [isLoadingUF, setIsLoadingUF] = useState(false)
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [resultados, setResultados] = useState<ResultadoEscenario[]>([])
  
  const [formData, setFormData] = useState<FormData>({
    nombreAfiliado: '',
    sexo: 'M',
    edad: 65,
    fondosAcumulados: 50000000,
    anosCotizados: 30,
    tipoPension: 'vejez',
    gradoInvalidez: 'total',
    ingresoBase: 800000,
    cubiertoSIS: true,
    pensionReferenciaCausante: 0,
    ingresoBaseCausante: 0,
    esPensionado: false,
    beneficiarios: [],
    calcularRP: true,
    escenariosRV: []
  })

  const [parametros, setParametros] = useState<ParametrosSistema>({
    uf: 38500,
    ufFecha: '',
    ufFuente: 'fallback',
    tasaRP: 0.0341,
    tasaRV: 0.0279,
    usarTasasManuales: false,
    tasaRPManual: 3.41,
    tasaRVManual: 2.79,
    usarUFManual: false,
    ufManual: 38500
  })

  // Cargar UF automática al iniciar
  useEffect(() => {
    cargarUF()
  }, [])

  const cargarUF = async () => {
    setIsLoadingUF(true)
    try {
      const response = await fetch('/api/uf')
      const data = await response.json()
      if (data.success) {
        setParametros(prev => ({
          ...prev,
          uf: data.valor,
          ufFecha: data.fecha,
          ufFuente: data.fuente,
          ufManual: data.valor
        }))
      }
    } catch (e) {
      console.error('Error cargando UF:', e)
    } finally {
      setIsLoadingUF(false)
    }
  }

  // Handlers
  const handleInputChange = useCallback((field: keyof FormData, value: string | number | boolean) => {
    setFormData(prev => ({ ...prev, [field]: value }))
  }, [])

  const handleParametroChange = useCallback((field: keyof ParametrosSistema, value: string | number | boolean) => {
    setParametros(prev => ({ ...prev, [field]: value }))
  }, [])

  // Agregar escenario RV
  const agregarEscenarioRV = useCallback((tipo: EscenarioRV['tipo']) => {
    const nuevoEscenario: EscenarioRV = {
      id: Date.now().toString(),
      tipo,
      mesesGarantizados: 120,
      mesesAumento: 36,
      porcentajeAumento: 30  // Porcentaje en formato 0-100
    }
    setFormData(prev => ({
      ...prev,
      escenariosRV: [...prev.escenariosRV, nuevoEscenario]
    }))
  }, [])

  const eliminarEscenarioRV = useCallback((id: string) => {
    setFormData(prev => ({
      ...prev,
      escenariosRV: prev.escenariosRV.filter(e => e.id !== id)
    }))
  }, [])

  const actualizarEscenarioRV = useCallback((id: string, field: keyof EscenarioRV, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      escenariosRV: prev.escenariosRV.map(e => 
        e.id === id ? { ...e, [field]: value } : e
      )
    }))
  }, [])

  // Handlers para beneficiarios
  const agregarBeneficiario = useCallback(() => {
    const nuevoBeneficiario: Beneficiario = {
      id: Date.now().toString(),
      tipo: 'conyuge',
      edad: formData.sexo === 'M' ? 60 : 65,
      sexo: formData.sexo === 'M' ? 'F' : 'M',
      porcentajePension: 0.60
    }
    setFormData(prev => ({
      ...prev,
      beneficiarios: [...prev.beneficiarios, nuevoBeneficiario]
    }))
  }, [formData.sexo])

  const eliminarBeneficiario = useCallback((id: string) => {
    setFormData(prev => ({
      ...prev,
      beneficiarios: prev.beneficiarios.filter(b => b.id !== id)
    }))
  }, [])

  const actualizarBeneficiario = useCallback((id: string, field: keyof Beneficiario, value: string | number) => {
    setFormData(prev => ({
      ...prev,
      beneficiarios: prev.beneficiarios.map(b => {
        if (b.id === id) {
          const updated = { ...b, [field]: value }
          // Auto-asignar porcentaje según tipo
          if (field === 'tipo') {
            const tipoInfo = OPCIONES_TIPO_BENEFICIARIO.find(t => t.value === value)
            if (tipoInfo) {
              updated.porcentajePension = tipoInfo.porcentajeDefault
            }
          }
          return updated
        }
        return b
      })
    }))
  }, [])

  // Validar que los porcentajes no excedan 100%
  const validarBeneficiarios = (): string | null => {
    const totalPorcentaje = formData.beneficiarios.reduce((sum, b) => sum + b.porcentajePension, 0)
    if (totalPorcentaje > 1) {
      return `El total de porcentajes (${(totalPorcentaje * 100).toFixed(0)}%) excede el 100%`
    }
    return null
  }

  // Obtener tasas activas
  const getTasasActivas = () => {
    if (parametros.usarTasasManuales) {
      return {
        tasaRP: parametros.tasaRPManual / 100,
        tasaRV: parametros.tasaRVManual / 100
      }
    }
    return {
      tasaRP: parametros.tasaRP,
      tasaRV: parametros.tasaRV
    }
  }

  // Obtener UF activa
  const getUFActiva = () => {
    return parametros.usarUFManual ? parametros.ufManual : parametros.uf
  }

  // Calcular
  const calcular = async () => {
    setIsLoading(true)
    setError(null)
    setResultados([])

    try {
      const escenariosCalculados: ResultadoEscenario[] = []

      // Validar beneficiarios
      const errorBeneficiarios = validarBeneficiarios()
      if (errorBeneficiarios) {
        setError(errorBeneficiarios)
        setIsLoading(false)
        return
      }

      // Preparar datos de beneficiarios para el API
      const beneficiariosAPI = formData.beneficiarios.map(b => ({
        tipo: b.tipo,
        edad: b.edad,
        sexo: b.sexo,
        porcentajePension: b.porcentajePension
      }))

      const tasas = getTasasActivas()

      // ========== VEJEZ ==========
      if (formData.tipoPension === 'vejez') {
        // 1. Retiro Programado
        if (formData.calcularRP) {
          const response = await fetch('/api/pension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'retiro_programado',
              datos: {
                fondos: formData.fondosAcumulados,
                edad: formData.edad,
                sexo: formData.sexo,
                beneficiarios: beneficiariosAPI,
                tasaInteres: tasas.tasaRP,
                uf: getUFActiva()
              }
            })
          })
          const data = await response.json()
          if (data.success) {
            escenariosCalculados.push(data.resultado)
          }
        }

        // 2. Escenarios de RV
        for (const escenario of formData.escenariosRV) {
          const response = await fetch('/api/pension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: escenario.tipo,
              datos: {
                fondos: formData.fondosAcumulados,
                edad: formData.edad,
                sexo: formData.sexo,
                mesesGarantizados: escenario.mesesGarantizados,
                mesesAumento: escenario.mesesAumento,
                porcentajeAumento: escenario.porcentajeAumento,
                beneficiarios: beneficiariosAPI,
                tasaInteres: tasas.tasaRV,
                uf: getUFActiva()
              }
            })
          })
          const data = await response.json()
          if (data.success) {
            escenariosCalculados.push(data.resultado)
          }
        }

        // Si no hay RP ni escenarios RV, calcular RV inmediata por defecto
        if (escenariosCalculados.length === 0) {
          const response = await fetch('/api/pension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'inmediata',
              datos: {
                fondos: formData.fondosAcumulados,
                edad: formData.edad,
                sexo: formData.sexo,
                beneficiarios: beneficiariosAPI,
                tasaInteres: tasas.tasaRV,
                uf: getUFActiva()
              }
            })
          })
          const data = await response.json()
          if (data.success) {
            escenariosCalculados.push(data.resultado)
          }
        }
      }

      // ========== INVALIDEZ ==========
      if (formData.tipoPension === 'invalidez') {
        // Retiro Programado Invalidez
        if (formData.calcularRP) {
          const response = await fetch('/api/pension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'invalidez_rp',
              datos: {
                fondos: formData.fondosAcumulados,
                edad: formData.edad,
                sexo: formData.sexo,
                beneficiarios: beneficiariosAPI,
                tasaInteres: tasas.tasaRP
              }
            })
          })
          const data = await response.json()
          if (data.success) {
            escenariosCalculados.push(data.resultado)
          }
        }

        // Escenarios de RV para Invalidez (Inmediata, Garantizada, Aumento y Ambas - todas permitidas)
        for (const escenario of formData.escenariosRV) {
          let tipoAPI: string;
          
          switch (escenario.tipo) {
            case 'inmediata':
              tipoAPI = 'invalidez_rv_inmediata';
              break;
            case 'periodo_garantizado':
              tipoAPI = 'invalidez_rv_garantizado';
              break;
            case 'aumento_temporal':
              tipoAPI = 'invalidez_rv_aumento';
              break;
            case 'ambas':
              tipoAPI = 'invalidez_rv_ambas';
              break;
            default:
              continue;
          }
          
          const response = await fetch('/api/pension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: tipoAPI,
              datos: {
                fondos: formData.fondosAcumulados,
                edad: formData.edad,
                sexo: formData.sexo,
                mesesGarantizados: escenario.mesesGarantizados,
                mesesAumento: escenario.mesesAumento,
                porcentajeAumento: escenario.porcentajeAumento,
                beneficiarios: beneficiariosAPI,
                tasaInteres: tasas.tasaRV
              }
            })
          })
          const data = await response.json()
          if (data.success) {
            escenariosCalculados.push(data.resultado)
          }
        }

        // Pensión de invalidez básica (solo si no hay escenarios RV ni RP)
        if (formData.escenariosRV.length === 0 && !formData.calcularRP) {
          const response = await fetch('/api/pension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'invalidez',
              datos: {
                fondos: formData.fondosAcumulados,
                edad: formData.edad,
                sexo: formData.sexo,
                gradoInvalidez: formData.gradoInvalidez,
                ingresoBase: formData.ingresoBase,
                cubiertoSIS: formData.cubiertoSIS,
                beneficiarios: beneficiariosAPI
              }
            })
          })
          const data = await response.json()
          if (data.success) {
            escenariosCalculados.push(data.resultado)
          }
        }
      }

      // ========== SOBREVIVENCIA ==========
      if (formData.tipoPension === 'sobrevivencia') {
        // Retiro Programado Sobrevivencia
        if (formData.calcularRP) {
          const response = await fetch('/api/pension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'sobrevivencia_rp',
              datos: {
                fondos: formData.fondosAcumulados,
                edad: formData.edad,
                sexo: formData.sexo,
                pensionReferenciaCausante: formData.pensionReferenciaCausante || undefined,
                ingresoBaseCausante: formData.ingresoBaseCausante || undefined,
                cubiertoSIS: formData.cubiertoSIS,
                beneficiarios: beneficiariosAPI,
                tasaInteres: tasas.tasaRP
              }
            })
          })
          const data = await response.json()
          if (data.success) {
            escenariosCalculados.push(data.resultado)
          }
        }

        // Escenarios de RV para Sobrevivencia (SOLO Inmediata y Garantizada - por normativa)
        for (const escenario of formData.escenariosRV) {
          let tipoAPI: string;
          
          // En Sobrevivencia NO se permite RV con Aumento Temporal (normativa)
          if (escenario.tipo === 'aumento_temporal' || escenario.tipo === 'ambas') {
            continue; // Saltar estos escenarios
          }
          
          switch (escenario.tipo) {
            case 'inmediata':
              tipoAPI = 'sobrevivencia_rv_inmediata';
              break;
            case 'periodo_garantizado':
              tipoAPI = 'sobrevivencia_rv_garantizado';
              break;
            default:
              continue;
          }
          
          const response = await fetch('/api/pension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: tipoAPI,
              datos: {
                fondos: formData.fondosAcumulados,
                edad: formData.edad,
                sexo: formData.sexo,
                mesesGarantizados: escenario.mesesGarantizados,
                pensionReferenciaCausante: formData.pensionReferenciaCausante || undefined,
                ingresoBaseCausante: formData.ingresoBaseCausante || undefined,
                cubiertoSIS: formData.cubiertoSIS,
                beneficiarios: beneficiariosAPI,
                tasaInteres: tasas.tasaRV
              }
            })
          })
          const data = await response.json()
          if (data.success) {
            escenariosCalculados.push(data.resultado)
          }
        }

        // Si no hay RP ni escenarios RV, calcular opciones básicas
        if (escenariosCalculados.length === 0) {
          const response = await fetch('/api/pension', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              tipo: 'sobrevivencia_opciones',
              datos: {
                fondos: formData.fondosAcumulados,
                edad: formData.edad,
                sexo: formData.sexo,
                pensionReferenciaCausante: formData.pensionReferenciaCausante || undefined,
                ingresoBaseCausante: formData.ingresoBaseCausante || undefined,
                cubiertoSIS: formData.cubiertoSIS,
                beneficiarios: beneficiariosAPI
              }
            })
          })
          const data = await response.json()
          if (data.success && data.resultados) {
            escenariosCalculados.push(...data.resultados)
          }
        }
      }

      setResultados(escenariosCalculados)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error en el cálculo')
    } finally {
      setIsLoading(false)
    }
  }

  // Generar reporte PDF
  const generarReporte = async () => {
    if (resultados.length === 0) {
      setError('Primero debe calcular los escenarios')
      return
    }

    setIsGeneratingPDF(true)
    try {
      const response = await fetch('/api/reporte', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          afiliado: {
            nombre: formData.nombreAfiliado || 'Afiliado',
            sexo: formData.sexo,
            edad: formData.edad,
            fondosAcumulados: formData.fondosAcumulados,
            anosCotizados: formData.anosCotizados,
            tipoPension: formData.tipoPension,
            gradoInvalidez: formData.gradoInvalidez,
            ingresoBase: formData.ingresoBase
          },
          parametros: {
            uf: getUFActiva(),
            tasaRP: getTasasActivas().tasaRP,
            tasaRV: getTasasActivas().tasaRV
          },
          resultados: resultados,
          beneficiarios: formData.beneficiarios
        })
      })

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}))
        throw new Error(errorData.error || 'Error generando reporte')
      }

      // Descargar el PDF
      const blob = await response.blob()
      const url = window.URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `Estudio_${formData.nombreAfiliado.replace(/\s+/g, '_') || 'Afiliado'}.pdf`
      document.body.appendChild(a)
      a.click()
      window.URL.revokeObjectURL(url)
      document.body.removeChild(a)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error generando reporte')
    } finally {
      setIsGeneratingPDF(false)
    }
  }

  // Render escenario RV
  const renderEscenarioRV = (escenario: EscenarioRV, index: number) => {
    const tipoLabels = {
      inmediata: 'RV Inmediata',
      periodo_garantizado: 'RV con Período Garantizado',
      aumento_temporal: 'RV con Aumento Temporal',
      ambas: 'RV con Ambas Cláusulas'
    }

    // Convertir meses a años para mostrar
    const formatMeses = (meses: number) => {
      const anos = Math.floor(meses / 12)
      const mesesRestantes = meses % 12
      if (anos > 0 && mesesRestantes > 0) return `${anos}a ${mesesRestantes}m`
      if (anos > 0) return `${anos} años`
      return `${meses} meses`
    }

    return (
      <Card key={escenario.id} className="relative">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm flex items-center gap-2">
              {escenario.tipo === 'periodo_garantizado' && <Shield className="h-4 w-4 text-blue-500" />}
              {escenario.tipo === 'aumento_temporal' && <ArrowUpRight className="h-4 w-4 text-green-500" />}
              {escenario.tipo === 'ambas' && <Shield className="h-4 w-4 text-purple-500" />}
              {tipoLabels[escenario.tipo]}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={() => eliminarEscenarioRV(escenario.id)}>
              <Trash2 className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {escenario.tipo === 'periodo_garantizado' && (
            <div className="space-y-2">
              <Label className="text-xs">Período garantizado (meses)</Label>
              <Input
                type="number"
                min={0}
                max={480}
                step={12}
                value={escenario.mesesGarantizados}
                onChange={(e) => actualizarEscenarioRV(escenario.id, 'mesesGarantizados', parseInt(e.target.value) || 0)}
                className="h-8"
              />
              <p className="text-[10px] text-muted-foreground">
                ≈ {formatMeses(escenario.mesesGarantizados)} | Sugerido: 60, 120, 180, 240, 300, 360
              </p>
            </div>
          )}

          {escenario.tipo === 'aumento_temporal' && (
            <div className="grid grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label className="text-xs">Duración aumento (meses)</Label>
                <Input
                  type="number"
                  min={1}
                  max={120}
                  value={escenario.mesesAumento}
                  onChange={(e) => actualizarEscenarioRV(escenario.id, 'mesesAumento', parseInt(e.target.value) || 12)}
                  className="h-8"
                />
                <p className="text-[10px] text-muted-foreground">≈ {formatMeses(escenario.mesesAumento)}</p>
              </div>
              <div className="space-y-2">
                <Label className="text-xs">% Aumento</Label>
                <div className="relative">
                  <Input
                    type="number"
                    min={1}
                    max={100}
                    step={5}
                    value={escenario.porcentajeAumento}
                    onChange={(e) => actualizarEscenarioRV(escenario.id, 'porcentajeAumento', parseFloat(e.target.value) || 10)}
                    className="h-8 pr-8"
                  />
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                </div>
                <p className="text-[10px] text-muted-foreground">1% - 100%</p>
              </div>
            </div>
          )}

          {escenario.tipo === 'ambas' && (
            <div className="space-y-3">
              <div className="space-y-2">
                <Label className="text-xs">Período garantizado (meses)</Label>
                <Input
                  type="number"
                  min={0}
                  max={480}
                  step={12}
                  value={escenario.mesesGarantizados}
                  onChange={(e) => actualizarEscenarioRV(escenario.id, 'mesesGarantizados', parseInt(e.target.value) || 0)}
                  className="h-8"
                />
                <p className="text-[10px] text-muted-foreground">
                  ≈ {formatMeses(escenario.mesesGarantizados)}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-2">
                  <Label className="text-xs">Duración aumento (meses)</Label>
                  <Input
                    type="number"
                    min={1}
                    max={120}
                    value={escenario.mesesAumento}
                    onChange={(e) => actualizarEscenarioRV(escenario.id, 'mesesAumento', parseInt(e.target.value) || 12)}
                    className="h-8"
                  />
                  <p className="text-[10px] text-muted-foreground">≈ {formatMeses(escenario.mesesAumento)}</p>
                </div>
                <div className="space-y-2">
                  <Label className="text-xs">% Aumento</Label>
                  <div className="relative">
                    <Input
                      type="number"
                      min={1}
                      max={100}
                      step={5}
                      value={escenario.porcentajeAumento}
                      onChange={(e) => actualizarEscenarioRV(escenario.id, 'porcentajeAumento', parseFloat(e.target.value) || 10)}
                      className="h-8 pr-8"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">%</span>
                  </div>
                  <p className="text-[10px] text-muted-foreground">1% - 100%</p>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>
    )
  }

  // Render resultados
  const renderResultados = () => {
    if (resultados.length === 0) return null

    const colores = ['#22c55e', '#3b82f6', '#f59e0b', '#8b5cf6', '#ec4899', '#06b6d4', '#f43f5e']
    const maxPension = Math.max(...resultados.map(r => r.pensionMensual))

    // Preparar datos de gráfico
    const chartData: Array<Record<string, string | number>> = []
    const maxProyeccion = Math.max(...resultados.map(r => r.proyeccion?.length || 0), 15)
    
    for (let i = 0; i < maxProyeccion; i++) {
      const punto: Record<string, string | number> = { 
        año: `Año ${i + 1}`
      }
      resultados.forEach((resultado, idx) => {
        if (resultado.proyeccion && resultado.proyeccion[i]) {
          punto[`s${idx}`] = Math.round(resultado.proyeccion[i].pensionMensual / 1000)
        }
      })
      chartData.push(punto)
    }

    return (
      <div className="space-y-4">
        {/* Cards de resultados */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
          {resultados.map((resultado, idx) => (
            <Card 
              key={idx} 
              className={`transition-all ${resultado.pensionMensual >= maxPension ? 'ring-2 ring-green-500' : ''}`}
            >
              <CardHeader className="pb-2">
                <CardTitle className="text-sm flex items-center justify-between">
                  <span className="truncate pr-2">{resultado.nombre}</span>
                  {resultado.pensionMensual >= maxPension && (
                    <Badge variant="default" className="text-xs shrink-0">Mejor</Badge>
                  )}
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold" style={{ color: colores[idx % colores.length] }}>
                  {formatearPesos(resultado.pensionMensual)}
                </div>
                <p className="text-xs text-muted-foreground">
                  {formatearUF(resultado.pensionEnUF)} mensual
                </p>
                
                {/* Info de cláusulas */}
                {resultado.aumentoTemporal && (
                  <div className="mt-2 p-2 bg-green-50 rounded text-xs">
                    <div className="flex justify-between">
                      <span>Durante aumento:</span>
                      <span className="font-medium">{formatearPesos(resultado.aumentoTemporal.pensionAumentada)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Después:</span>
                      <span className="font-medium">{formatearPesos(resultado.aumentoTemporal.pensionFinal)}</span>
                    </div>
                  </div>
                )}
                
                {resultado.periodoGarantizado && resultado.periodoGarantizado > 0 && (
                  <div className="mt-2 text-xs text-blue-600">
                    <Shield className="h-3 w-3 inline mr-1" />
                    Garantía: {resultado.periodoGarantizado} meses
                  </div>
                )}
                
                {/* Info para Invalidez */}
                {resultado.gradoInvalidez && (
                  <div className="mt-2 p-2 bg-amber-50 rounded text-xs">
                    <div className="font-medium text-amber-800">
                      Grado: {resultado.gradoInvalidez === 'total' ? 'Total (70%)' : resultado.gradoInvalidez === 'total_2_3' ? 'Total 2/3 (50%)' : 'Parcial (35%)'}
                    </div>
                    {resultado.ingresoBase && (
                      <div className="text-amber-700">Ingreso Base: {formatearPesos(resultado.ingresoBase)}</div>
                    )}
                  </div>
                )}
                
                {/* Info para Sobrevivencia - Distribución por beneficiario */}
                {resultado.pensionPorBeneficiario && resultado.pensionPorBeneficiario.length > 0 && (
                  <div className="mt-2 p-2 bg-purple-50 rounded text-xs">
                    <div className="font-medium text-purple-800 mb-1">Distribución:</div>
                    {resultado.pensionPorBeneficiario.map((ben, benIdx) => (
                      <div key={benIdx} className="flex justify-between text-purple-700">
                        <span>{ben.tipo === 'conyuge' ? 'Cónyuge' : ben.tipo === 'conviviente' ? 'Conviviente' : ben.tipo === 'hijo' ? 'Hijo/a' : ben.tipo === 'padre' ? 'Padre' : ben.tipo === 'madre' ? 'Madre' : ben.tipo}:</span>
                        <span>{(ben.porcentaje * 100).toFixed(0)}% = {formatearPesos(ben.pensionMensual)}</span>
                      </div>
                    ))}
                  </div>
                )}
                
                <div className="mt-3 grid grid-cols-3 gap-1 text-xs text-muted-foreground">
                  <div className="text-center">
                    <div>CNU</div>
                    <div className="font-medium text-foreground">{resultado.cnu.toFixed(1)}</div>
                  </div>
                  <div className="text-center">
                    <div>Tasa</div>
                    <div className="font-medium text-foreground">{formatearPorcentaje(resultado.tasaInteres)}</div>
                  </div>
                  <div className="text-center">
                    <div>E. Vida</div>
                    <div className="font-medium text-foreground">{resultado.expectativaVida}a</div>
                  </div>
                </div>
                
                {/* Advertencias */}
                {resultado.advertencias && resultado.advertencias.length > 0 && (
                  <div className="mt-2 text-xs text-muted-foreground">
                    {resultado.advertencias.slice(0, 2).map((adv, advIdx) => (
                      <div key={advIdx} className="truncate" title={adv}>• {adv}</div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>

        {/* Gráfico */}
        {chartData.length > 0 && resultados.some(r => r.proyeccion) && (
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-base">Proyección Comparativa</CardTitle>
              <CardDescription>Pensión mensual en miles de pesos</CardDescription>
            </CardHeader>
            <CardContent>
              <div className="h-[280px]">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={chartData}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="año" tick={{ fontSize: 10 }} />
                    <YAxis tick={{ fontSize: 10 }} tickFormatter={(v) => `$${v}k`} />
                    <Tooltip formatter={(value: number) => `$${value.toLocaleString()} mil`} />
                    <Legend wrapperStyle={{ fontSize: '10px' }} />
                    {resultados.map((resultado, idx) => (
                      resultado.proyeccion && (
                        <Line
                          key={idx}
                          type="monotone"
                          dataKey={`s${idx}`}
                          stroke={colores[idx % colores.length]}
                          name={resultado.nombre.substring(0, 15)}
                          strokeWidth={2}
                          dot={false}
                        />
                      )
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-green-50">
      <div className="container mx-auto px-4 py-6">
        {/* Header */}
        <div className="text-center mb-6">
          <div className="flex items-center justify-center gap-2 mb-2">
            <Calculator className="h-8 w-8 text-blue-600" />
            <h1 className="text-2xl font-bold">Simulador de Pensiones AFP</h1>
          </div>
          <p className="text-sm text-muted-foreground">
            Compare múltiples escenarios de pensión de forma independiente
          </p>
          <div className="flex justify-center gap-2 mt-2 flex-wrap">
            <Badge variant="outline">Tasa RP: {(getTasasActivas().tasaRP * 100).toFixed(2)}%</Badge>
            <Badge variant="outline">Tasa RV: {(getTasasActivas().tasaRV * 100).toFixed(2)}%</Badge>
            <Badge variant="outline" className="cursor-pointer" onClick={cargarUF}>
              {isLoadingUF ? <Loader2 className="h-3 w-3 animate-spin inline mr-1" /> : <RefreshCw className="h-3 w-3 inline mr-1" />}
              UF: ${getUFActiva().toLocaleString('es-CL')}
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Panel izquierdo - Formulario */}
          <div className="space-y-4">
            {/* Datos básicos */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <PiggyBank className="h-4 w-4" />
                  Datos del Afiliado
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  <div className="space-y-1">
                    <Label className="text-xs">Nombre completo (para reporte)</Label>
                    <Input
                      type="text"
                      placeholder="Ingrese nombre del afiliado"
                      value={formData.nombreAfiliado}
                      onChange={(e) => handleInputChange('nombreAfiliado', e.target.value)}
                      className="h-8"
                    />
                  </div>
                  
                  {/* Selector de Tipo de Pensión */}
                  <div className="space-y-1">
                    <Label className="text-xs font-medium">Tipo de Pensión</Label>
                    <Select 
                      value={formData.tipoPension} 
                      onValueChange={(v: TipoPension) => handleInputChange('tipoPension', v)}
                    >
                      <SelectTrigger className="h-8">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="vejez">Vejez (Edad Legal o Anticipada)</SelectItem>
                        <SelectItem value="invalidez">Invalidez</SelectItem>
                        <SelectItem value="sobrevivencia">Sobrevivencia</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  
                  {/* Campos específicos para Invalidez */}
                  {formData.tipoPension === 'invalidez' && (
                    <div className="p-3 bg-amber-50 rounded-lg space-y-3">
                      <div className="text-xs font-medium text-amber-800">Datos para Invalidez</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Grado de Invalidez</Label>
                          <Select 
                            value={formData.gradoInvalidez} 
                            onValueChange={(v) => handleInputChange('gradoInvalidez', v)}
                          >
                            <SelectTrigger className="h-7 text-xs">
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="total" className="text-xs">Total (70%)</SelectItem>
                              <SelectItem value="total_2_3" className="text-xs">Total 2/3 (50%)</SelectItem>
                              <SelectItem value="parcial" className="text-xs">Parcial (35%)</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Ingreso Base ($)</Label>
                          <Input
                            type="number"
                            min={0}
                            value={formData.ingresoBase}
                            onChange={(e) => handleInputChange('ingresoBase', parseInt(e.target.value) || 0)}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.cubiertoSIS}
                          onCheckedChange={(v) => handleInputChange('cubiertoSIS', v)}
                        />
                        <Label className="text-[10px]">Cubierto por SIS</Label>
                      </div>
                    </div>
                  )}
                  
                  {/* Campos específicos para Sobrevivencia */}
                  {formData.tipoPension === 'sobrevivencia' && (
                    <div className="p-3 bg-purple-50 rounded-lg space-y-3">
                      <div className="text-xs font-medium text-purple-800">Datos del Causante Fallecido</div>
                      <div className="grid grid-cols-2 gap-3">
                        <div className="space-y-1">
                          <Label className="text-[10px]">Pensión Referencia ($)</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="Si era pensionado"
                            value={formData.pensionReferenciaCausante || ''}
                            onChange={(e) => handleInputChange('pensionReferenciaCausante', parseInt(e.target.value) || 0)}
                            className="h-7 text-xs"
                          />
                        </div>
                        <div className="space-y-1">
                          <Label className="text-[10px]">Ingreso Base ($)</Label>
                          <Input
                            type="number"
                            min={0}
                            placeholder="Si era activo"
                            value={formData.ingresoBaseCausante || ''}
                            onChange={(e) => handleInputChange('ingresoBaseCausante', parseInt(e.target.value) || 0)}
                            className="h-7 text-xs"
                          />
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <Switch
                          checked={formData.esPensionado}
                          onCheckedChange={(v) => handleInputChange('esPensionado', v)}
                        />
                        <Label className="text-[10px]">Era pensionado al fallecer</Label>
                      </div>
                    </div>
                  )}
                  
                  <div className="grid grid-cols-2 gap-3">
                    <div className="space-y-1">
                      <Label className="text-xs">Sexo</Label>
                      <Select 
                        value={formData.sexo} 
                        onValueChange={(v: Sexo) => handleInputChange('sexo', v)}
                      >
                        <SelectTrigger className="h-8">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="M">Masculino (65a)</SelectItem>
                          <SelectItem value="F">Femenino (60a)</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Edad</Label>
                      <Input
                        type="number"
                        min={18}
                        max={110}
                        value={formData.edad}
                        onChange={(e) => handleInputChange('edad', parseInt(e.target.value) || 0)}
                        className="h-8"
                      />
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Fondos acumulados ($)</Label>
                      <Input
                        type="number"
                        min={0}
                        step={1000000}
                        value={formData.fondosAcumulados}
                        onChange={(e) => handleInputChange('fondosAcumulados', parseInt(e.target.value) || 0)}
                        className="h-8"
                      />
                      <p className="text-xs text-muted-foreground">≈ {formatearUF(formData.fondosAcumulados / getUFActiva())}</p>
                    </div>
                    <div className="space-y-1">
                      <Label className="text-xs">Años cotizados</Label>
                      <Input
                        type="number"
                        min={0}
                        max={60}
                        value={formData.anosCotizados}
                        onChange={(e) => handleInputChange('anosCotizados', parseInt(e.target.value) || 0)}
                        className="h-8"
                      />
                    </div>
                  </div>
                </div>
              </CardContent>
            </Card>

            {/* Parámetros del Sistema */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Settings className="h-4 w-4" />
                  Parámetros del Sistema
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                {/* UF */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Valor UF</Label>
                    <Switch
                      checked={parametros.usarUFManual}
                      onCheckedChange={(v) => handleParametroChange('usarUFManual', v)}
                    />
                    <span className="text-xs text-muted-foreground">Manual</span>
                  </div>
                  {parametros.usarUFManual ? (
                    <Input
                      type="number"
                      min={30000}
                      max={50000}
                      value={parametros.ufManual}
                      onChange={(e) => handleParametroChange('ufManual', parseInt(e.target.value) || 38500)}
                      className="h-8"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <div className="flex-1 p-2 bg-slate-50 rounded text-sm">
                        ${parametros.uf.toLocaleString('es-CL')}
                        {parametros.ufFecha && <span className="text-xs text-muted-foreground ml-2">({parametros.ufFecha})</span>}
                      </div>
                      <Button variant="outline" size="sm" onClick={cargarUF} disabled={isLoadingUF}>
                        {isLoadingUF ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCw className="h-3 w-3" />}
                      </Button>
                    </div>
                  )}
                </div>

                <Separator />

                {/* Tasas */}
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label className="text-xs font-medium">Tasas de Interés</Label>
                    <Switch
                      checked={parametros.usarTasasManuales}
                      onCheckedChange={(v) => handleParametroChange('usarTasasManuales', v)}
                    />
                    <span className="text-xs text-muted-foreground">Manual</span>
                  </div>
                  {parametros.usarTasasManuales ? (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <Label className="text-[10px]">Tasa RP (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step={0.01}
                          value={parametros.tasaRPManual}
                          onChange={(e) => handleParametroChange('tasaRPManual', parseFloat(e.target.value) || 3.41)}
                          className="h-8"
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-[10px]">Tasa RV (%)</Label>
                        <Input
                          type="number"
                          min={0}
                          max={10}
                          step={0.01}
                          value={parametros.tasaRVManual}
                          onChange={(e) => handleParametroChange('tasaRVManual', parseFloat(e.target.value) || 2.79)}
                          className="h-8"
                        />
                      </div>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-3">
                      <div className="p-2 bg-slate-50 rounded">
                        <div className="text-[10px] text-muted-foreground">Retiro Programado</div>
                        <div className="text-sm font-medium">3.41%</div>
                      </div>
                      <div className="p-2 bg-slate-50 rounded">
                        <div className="text-[10px] text-muted-foreground">Renta Vitalicia</div>
                        <div className="text-sm font-medium">2.79%</div>
                      </div>
                    </div>
                  )}
                </div>
              </CardContent>
            </Card>

            {/* Beneficiarios de Pensión */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <Users className="h-4 w-4 text-purple-600" />
                    Beneficiarios de Pensión
                  </CardTitle>
                  <Button 
                    variant="outline" 
                    size="sm" 
                    onClick={agregarBeneficiario}
                    className="h-7 text-xs"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    Agregar
                  </Button>
                </div>
                <CardDescription className="text-xs">
                  Al fallecer, estos beneficiarios recibirán pensión de sobrevivencia
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {formData.beneficiarios.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    No hay beneficiarios registrados. Agregue cónyuge, hijos u otros.
                  </p>
                ) : (
                  <>
                    <div className="space-y-2">
                      {formData.beneficiarios.map((ben, idx) => (
                        <div key={ben.id} className="p-2 border rounded-lg bg-slate-50 space-y-2">
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium">Beneficiario {idx + 1}</span>
                            <Button variant="ghost" size="sm" onClick={() => eliminarBeneficiario(ben.id)} className="h-6 w-6 p-0">
                              <Trash2 className="h-3 w-3 text-red-500" />
                            </Button>
                          </div>
                          <div className="grid grid-cols-4 gap-2">
                            <div className="space-y-1">
                              <Label className="text-[10px]">Tipo</Label>
                              <Select 
                                value={ben.tipo} 
                                onValueChange={(v) => actualizarBeneficiario(ben.id, 'tipo', v as TipoBeneficiario)}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {OPCIONES_TIPO_BENEFICIARIO.map(op => (
                                    <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Edad</Label>
                              <Input
                                type="number"
                                min={0}
                                max={110}
                                value={ben.edad}
                                onChange={(e) => actualizarBeneficiario(ben.id, 'edad', parseInt(e.target.value) || 0)}
                                className="h-7 text-xs"
                              />
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">Sexo</Label>
                              <Select 
                                value={ben.sexo} 
                                onValueChange={(v) => actualizarBeneficiario(ben.id, 'sexo', v as Sexo)}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  <SelectItem value="M" className="text-xs">M</SelectItem>
                                  <SelectItem value="F" className="text-xs">F</SelectItem>
                                </SelectContent>
                              </Select>
                            </div>
                            <div className="space-y-1">
                              <Label className="text-[10px]">%</Label>
                              <Select 
                                value={ben.porcentajePension.toString()} 
                                onValueChange={(v) => actualizarBeneficiario(ben.id, 'porcentajePension', parseFloat(v))}
                              >
                                <SelectTrigger className="h-7 text-xs">
                                  <SelectValue />
                                </SelectTrigger>
                                <SelectContent>
                                  {[
                                    { value: '0.10', label: '10%' },
                                    { value: '0.15', label: '15%' },
                                    { value: '0.20', label: '20%' },
                                    { value: '0.25', label: '25%' },
                                    { value: '0.30', label: '30%' },
                                    { value: '0.35', label: '35%' },
                                    { value: '0.40', label: '40%' },
                                    { value: '0.50', label: '50%' },
                                    { value: '0.60', label: '60%' }
                                  ].map(op => (
                                    <SelectItem key={op.value} value={op.value} className="text-xs">{op.label}</SelectItem>
                                  ))}
                                </SelectContent>
                              </Select>
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    <div className="flex items-center justify-between text-xs pt-2 border-t">
                      <span className="text-muted-foreground">Total asignado:</span>
                      <span className={`font-medium ${
                        formData.beneficiarios.reduce((sum, b) => sum + b.porcentajePension, 0) > 1 
                          ? 'text-red-600' 
                          : 'text-green-600'
                      }`}>
                        {(formData.beneficiarios.reduce((sum, b) => sum + b.porcentajePension, 0) * 100).toFixed(0)}%
                      </span>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>

            {/* Retiro Programado */}
            <Card>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base flex items-center gap-2">
                    <TrendingUp className="h-4 w-4 text-green-600" />
                    Retiro Programado
                  </CardTitle>
                  <Switch
                    checked={formData.calcularRP}
                    onCheckedChange={(v) => handleInputChange('calcularRP', v)}
                  />
                </div>
                <CardDescription className="text-xs">
                  Fondos en AFP, pensión decreciente
                </CardDescription>
              </CardHeader>
            </Card>

            {/* Renta Vitalicia - Escenarios */}
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Renta Vitalicia - Escenarios</CardTitle>
                <CardDescription className="text-xs">
                  Agregue múltiples configuraciones para comparar
                </CardDescription>
              </CardHeader>
              <CardContent className="space-y-3">
                {/* Lista de escenarios */}
                {formData.escenariosRV.length === 0 ? (
                  <p className="text-sm text-muted-foreground text-center py-4">
                    Agregue escenarios de Renta Vitalicia para comparar
                  </p>
                ) : (
                  <div className="space-y-3">
                    {formData.escenariosRV.map((escenario, idx) => renderEscenarioRV(escenario, idx))}
                  </div>
                )}

                <Separator />

                {/* Botones para agregar */}
                <div className="grid grid-cols-2 gap-2">
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => agregarEscenarioRV('inmediata')}
                    className="h-auto py-2"
                  >
                    <Plus className="h-3 w-3 mr-1" />
                    RV Inmediata
                  </Button>
                  <Button 
                    variant="outline" 
                    size="sm"
                    onClick={() => agregarEscenarioRV('periodo_garantizado')}
                    className="h-auto py-2"
                  >
                    <Shield className="h-3 w-3 mr-1 text-blue-500" />
                    Con Garantía
                  </Button>
                  {/* Solo mostrar opciones de Aumento para Vejez e Invalidez (NO para Sobrevivencia por normativa) */}
                  {formData.tipoPension !== 'sobrevivencia' && (
                    <>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => agregarEscenarioRV('aumento_temporal')}
                        className="h-auto py-2"
                      >
                        <ArrowUpRight className="h-3 w-3 mr-1 text-green-500" />
                        Con Aumento
                      </Button>
                      <Button 
                        variant="outline" 
                        size="sm"
                        onClick={() => agregarEscenarioRV('ambas')}
                        className="h-auto py-2"
                      >
                        <Shield className="h-3 w-3 mr-1 text-purple-500" />
                        Ambas Cláusulas
                      </Button>
                    </>
                  )}
                </div>
                {formData.tipoPension === 'sobrevivencia' && (
                  <p className="text-xs text-amber-600 mt-2">
                    ⚠️ Por normativa, en Sobrevivencia solo se permite RV Inmediata y con Garantía
                  </p>
                )}
              </CardContent>
            </Card>

            {/* Error */}
            {error && (
              <Alert variant="destructive">
                <AlertTriangle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            {/* Botones de acción */}
            <div className="space-y-2">
              <Button 
                onClick={calcular} 
                className="w-full" 
                size="lg"
                disabled={isLoading || (!formData.calcularRP && formData.escenariosRV.length === 0)}
              >
                {isLoading ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <Calculator className="mr-2 h-4 w-4" />
                )}
                Calcular {formData.calcularRP ? 1 : 0 + formData.escenariosRV.length} Escenario(s)
              </Button>
              
              {resultados.length > 0 && (
                <Button 
                  onClick={generarReporte} 
                  variant="outline"
                  className="w-full" 
                  size="lg"
                  disabled={isGeneratingPDF}
                >
                  {isGeneratingPDF ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <FileText className="mr-2 h-4 w-4" />
                  )}
                  Generar Reporte PDF
                </Button>
              )}
            </div>
          </div>

          {/* Panel derecho - Resultados */}
          <div>
            {renderResultados()}
          </div>
        </div>

        {/* Info */}
        <div className="mt-6 text-center text-xs text-muted-foreground">
          <p>Simulador referencial. Valores pueden variar según condiciones del mercado.</p>
          <p>Fuente: SP - Tablas TM-2020 | Tasas Oct 2025</p>
        </div>
      </div>
    </div>
  )
}
