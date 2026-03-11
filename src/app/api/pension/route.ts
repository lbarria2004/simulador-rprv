import { NextRequest, NextResponse } from 'next/server';
import {
  calcularRetiroProgramado,
  calcularRVInmediata,
  calcularRVPeriodoGarantizado,
  calcularRVAumentoTemporal,
  calcularRVConAmbasClausulas,
  calcularPensionInvalidez,
  calcularRetiroProgramadoInvalidez,
  calcularRVInmediataInvalidez,
  calcularRVPeriodoGarantizadoInvalidez,
  calcularRVAumentoTemporalInvalidez,
  calcularRVConAmbasClausulasInvalidez,
  calcularPensionSobrevivencia,
  calcularOpcionesSobrevivencia,
  calcularRVInmediataSobrevivencia,
  calcularRVGarantizadoSobrevivencia,
  calcularRVAumentoSobrevivencia,
  calcularRVAmbasSobrevivencia,
  calcularRetiroProgramadoSobrevivencia,
  calcularExpectativaVida,
  Sexo,
  GradoInvalidez,
  MesesGarantizados,
  MesesAumento,
  TASAS_INTERES,
  EDAD_JUBILACION,
  UF_ACTUAL,
  ResultadoEscenario,
  BeneficiarioPension
} from '@/lib/pension-calculator';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { tipo, datos } = body;

    const sexo = datos.sexo as Sexo;
    const edad = datos.edad as number;
    const fondos = datos.fondos as number;
    const beneficiarios = datos.beneficiarios as BeneficiarioPension[] | undefined;
    
    // Permitir tasas personalizadas o usar las por defecto
    const tasaInteres = datos.tasaInteres ?? TASAS_INTERES.RETIRO_PROGRAMADO;
    const tasaRV = datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_VEJEZ;

    let resultado: ResultadoEscenario;

    switch (tipo) {
      // ========== VEJEZ ==========
      case 'retiro_programado':
        resultado = calcularRetiroProgramado(fondos, edad, sexo, tasaInteres, beneficiarios);
        break;

      case 'inmediata':
        resultado = calcularRVInmediata(fondos, edad, sexo, tasaRV, beneficiarios);
        break;

      case 'periodo_garantizado':
        resultado = calcularRVPeriodoGarantizado(
          fondos,
          edad,
          sexo,
          datos.mesesGarantizados as MesesGarantizados,
          tasaRV,
          beneficiarios
        );
        break;

      case 'aumento_temporal':
        resultado = calcularRVAumentoTemporal(
          fondos,
          edad,
          sexo,
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          tasaRV,
          beneficiarios
        );
        break;

      case 'ambas':
        resultado = calcularRVConAmbasClausulas(
          fondos,
          edad,
          sexo,
          datos.mesesGarantizados as MesesGarantizados,
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          tasaRV,
          beneficiarios
        );
        break;

      // ========== INVALIDEZ ==========
      case 'invalidez':
        resultado = calcularPensionInvalidez(
          fondos,
          edad,
          sexo,
          (datos.gradoInvalidez || 'total') as GradoInvalidez,
          datos.ingresoBase || 800000, // Default si no se proporciona
          datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
          beneficiarios,
          datos.cubiertoSIS ?? true
        );
        break;

      case 'invalidez_rp':
        resultado = calcularRetiroProgramadoInvalidez(
          fondos,
          edad,
          sexo,
          tasaInteres,
          beneficiarios
        );
        break;

      // ========== RENTA VITALICIA PARA INVALIDEZ ==========
      case 'invalidez_rv_inmediata':
        resultado = calcularRVInmediataInvalidez(
          fondos,
          edad,
          sexo,
          datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
          beneficiarios
        );
        break;

      case 'invalidez_rv_garantizado':
        resultado = calcularRVPeriodoGarantizadoInvalidez(
          fondos,
          edad,
          sexo,
          datos.mesesGarantizados as MesesGarantizados,
          datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
          beneficiarios
        );
        break;

      case 'invalidez_rv_aumento':
        resultado = calcularRVAumentoTemporalInvalidez(
          fondos,
          edad,
          sexo,
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
          beneficiarios
        );
        break;

      case 'invalidez_rv_ambas':
        resultado = calcularRVConAmbasClausulasInvalidez(
          fondos,
          edad,
          sexo,
          datos.mesesGarantizados as MesesGarantizados,
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          datos.tasaInteres ?? TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ,
          beneficiarios
        );
        break;

      // ========== SOBREVIVENCIA ==========
      case 'sobrevivencia':
        resultado = calcularPensionSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          datos.tasaInteres ?? TASAS_INTERES.SOBREVIVENCIA,
          datos.cubiertoSIS ?? true
        );
        break;

      case 'sobrevivencia_opciones':
        // Este caso retorna múltiples opciones
        const opciones = calcularOpcionesSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante
        );
        return NextResponse.json({ success: true, resultados: opciones });

      case 'sobrevivencia_rp':
        resultado = calcularRetiroProgramadoSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          datos.tasaInteres ?? TASAS_INTERES.RETIRO_PROGRAMADO
        );
        break;

      case 'sobrevivencia_rv_inmediata':
        resultado = calcularRVInmediataSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          datos.tasaInteres ?? TASAS_INTERES.SOBREVIVENCIA
        );
        break;

      case 'sobrevivencia_rv_garantizado':
        resultado = calcularRVGarantizadoSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.mesesGarantizados as MesesGarantizados,
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          datos.tasaInteres ?? TASAS_INTERES.SOBREVIVENCIA
        );
        break;

      case 'sobrevivencia_rv_aumento':
        resultado = calcularRVAumentoSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          datos.tasaInteres ?? TASAS_INTERES.SOBREVIVENCIA
        );
        break;

      case 'sobrevivencia_rv_ambas':
        resultado = calcularRVAmbasSobrevivencia(
          fondos,
          edad,
          sexo,
          beneficiarios || [],
          datos.mesesGarantizados as MesesGarantizados,
          datos.mesesAumento as MesesAumento,
          datos.porcentajeAumento as number,
          datos.pensionReferenciaCausante,
          datos.ingresoBaseCausante,
          datos.tasaInteres ?? TASAS_INTERES.SOBREVIVENCIA
        );
        break;

      default:
        return NextResponse.json(
          { success: false, error: 'Tipo de cálculo no válido' },
          { status: 400 }
        );
    }

    return NextResponse.json({ success: true, resultado });
  } catch (error) {
    console.error('Error en cálculo:', error);
    return NextResponse.json(
      { success: false, error: 'Error al procesar el cálculo: ' + (error instanceof Error ? error.message : 'Error desconocido') },
      { status: 500 }
    );
  }
}

export async function GET() {
  return NextResponse.json({
    success: true,
    parametros: {
      tasasInteres: {
        retiroProgramado: (TASAS_INTERES.RETIRO_PROGRAMADO * 100).toFixed(2) + '%',
        rentaVitaliciaVejez: (TASAS_INTERES.RENTA_VITALICIA_VEJEZ * 100).toFixed(2) + '%',
        rentaVitaliciaInvalidez: (TASAS_INTERES.RENTA_VITALICIA_INVALIDEZ * 100).toFixed(2) + '%',
        sobrevivencia: (TASAS_INTERES.SOBREVIVENCIA * 100).toFixed(2) + '%'
      },
      edadesJubilacion: EDAD_JUBILACION,
      ufReferencia: UF_ACTUAL,
      tiposPension: {
        vejez: ['retiro_programado', 'inmediata', 'periodo_garantizado', 'aumento_temporal', 'ambas'],
        invalidez: ['invalidez', 'invalidez_rp'],
        sobrevivencia: ['sobrevivencia', 'sobrevivencia_opciones']
      },
      gradosInvalidez: [
        { value: 'total', label: 'Total (70%)', descripcion: 'Invalidez total - 70% del ingreso base' },
        { value: 'total_2_3', label: 'Total 2/3 (50%)', descripcion: 'Invalidez total 2/3 - 50% del ingreso base' },
        { value: 'parcial', label: 'Parcial (35%)', descripcion: 'Invalidez parcial - 35% del ingreso base' }
      ],
      porcentajesSobrevivencia: {
        conyugeSinHijos: '60%',
        conyugeConHijos: '50%',
        convivienteSinHijos: '60%',
        convivienteConHijos: '50%',
        hijo: '15% cada uno',
        padreMadre: '15% cada uno (si no hay cónyuge ni hijos)'
      },
      opciones: {
        mesesGarantizados: [60, 120, 180, 240, 300, 360],
        mesesAumento: [12, 24, 36, 48, 60, 84, 108, 120],
        porcentajesAumento: [0.10, 0.20, 0.30, 0.40, 0.50, 0.60, 0.70, 0.80, 0.90, 1.00]
      },
      fechaActualizacion: 'Enero 2025'
    }
  });
}
