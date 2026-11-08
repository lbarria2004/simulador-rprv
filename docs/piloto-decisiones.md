# Fundamento del piloto interno

Base local: `a1e8b1f`, rama `codex/desarrollo`. Diseño: 2026-11-08. Referencia: matriz de 27 componentes de fase 4.

Se conserva el motor actuarial sin modificar sus fórmulas. Una capa de política compartida restringe pantalla, API y PDF: solo vejez ordinaria hipotética, ahorro propio, RP simple y RV inmediata teórica. El piloto no determina elegibilidad legal ni tarifica pólizas. Toda pensión es estimativa y queda pendiente de validación especializada.

- M01–M09: fuentes/versiones y límites del CNU visibles; no se presenta certificación ni expectativa de vida individual.
- M10–M11/M22: curvas solo de RP con flujos calculados y comprobados, sin beneficiarios y con saldo positivo. Con beneficiarios solo se muestra la comparación inicial; no se devuelven curvas familiares. No se inventa una curva RV constante ni un saldo de aseguradora.
- M12–M15: tasas explícitas iguales en pantalla/API/PDF; RP separado de retornos reales 0/2/4%. Ninguna selección automática de circular. Fecha de valoración y UF coinciden por contrato; solo fechas dentro del soporte de TM-2020 y hasta la fecha de revisión de fuentes.
- M16–M20: garantías, aumentos, combinaciones, tasas comerciales y ofertas deshabilitados también por HTTP. No hay modo experto para eludir la política.
- M21/M22: grupo admitido: sin beneficiarios o un cónyuge adulto, opcionalmente con hasta cuatro hijos no inválidos comunes y vínculos explícitos. No se admiten porcentajes manuales, orfandad ni concurrencias complejas. Los requisitos son hipótesis, no acreditaciones. El rechazo de otros grupos limita el piloto; no afirma que carezcan de derecho.
- M23/M25: invalidez, sobrevivencia del causante fallecido, SIS, PGU/BAC/BEV, comisiones y líquidos fuera del piloto. El saldo es únicamente ahorro propio.
- M24/M26/M27: referencia UF centralizada, sin datos comerciales heredados ni alias de tablas expuestos. El PDF se recalcula en servidor desde los datos validados; no acepta pensiones ni resultados precalculados suministrados por el navegador.

Rangos del ejercicio: edad 65–90 hombre / 60–90 mujer, tasas de descuento 0–10%, saldo entero entre 0 y un billón CLP; UF entre 0,01 y 1.000.000 CLP con hasta dos decimales. Son límites operativos del piloto, no límites normativos ni validación de jubilación anticipada. Se requiere confirmar uso de datos ficticios; el identificador del caso es anónimo. No se agrega almacenamiento ni autenticación. Uso local, sin publicación, sin SCOMP y sin servicios de pago.

Los cálculos históricos siguen disponibles como biblioteca y mantienen sus regresiones. La API pública local cambia de contrato al perfil piloto: rechaza rutas de cálculo y cuerpos históricos que permitan cláusulas o resultados arbitrarios. El generador PDF histórico se conserva para regresión, sin ruta HTTP que lo exponga.
