# Requisitos para habilitar cálculos por modalidad

Ampliación desde `318f57f`, con revisión funcional del 12-11-2026. **No es una actualización normativa ni una aprobación actuarial**: las fuentes y fechas de valoración del motor continúan congeladas al 08-11-2026. Solo datos ficticios, sin SCOMP, compañías, tarifas comerciales ni factores nuevos.

La [matriz M01–M27](fase-4-matriz-trazabilidad.md) conserva el detalle de fuentes, aproximaciones y defectos pendientes; las [decisiones del piloto](piloto-decisiones.md) prevalecen sobre las posibilidades de los componentes históricos. Este documento amplía la experiencia de configuración, no el alcance de cálculo.

## Estado y requisitos específicos

| Modalidad del catálogo | Estado en esta entrega | Requisitos actuariales antes de ampliar el cálculo | Revisión normativa y contractual pendiente |
| --- | --- | --- | --- |
| Retiro Programado | Calculable solo como aproximación del piloto | CNU íntegro del Anexo 7, CNCM cuando corresponda, correcciones de fraccionamiento/precisión, edades y calendario; contraste independiente de capitales, retiros y recálculos. M05–M13. | Selección de circular/tasas por fecha y flujo, requisitos de vejez, beneficiarios y cambios de derecho; confirmar normativa vigente para cada fecha. No inferir validez futura del 3,67%. |
| Renta Vitalicia inmediata simple | Calculable solo como RV teórica, sin oferta | Validar el CNU completo, reversión a beneficiarios y cuota mortuoria; separar divisor financiero del precio de una póliza. Contrastar casos reproducibles revisados por especialista. M05–M09/M14–M15. | Verificar elegibilidad, prestaciones, tablas y condiciones de una RV inmediata para el supuesto autorizado. La tasa manual de descuento no representa un precio, una tasa universal de mercado ni una oferta de compañía. |
| RV con período garantizado | Solo configuración; cálculo y PDF bloqueados | Sustituir los factores históricos interpolados por una metodología documentada y validada de flujos garantizados y contingentes; identificar quién recibe cada pago, fallecimiento antes/durante/después del período, fin de garantía y reversión. Incluir descuento, mortalidad, capital y redondeos. M16–M17. | Verificar cláusula aplicable y texto contractual, plazos realmente admisibles, beneficiarios/designaciones y tratamiento de herederos, exclusiones y eventos. No afirmar transferencia genérica o disponibilidad de cualquier plazo. |
| RV con aumento temporal | Solo configuración; cálculo y PDF bloqueados | Documentar el significado del porcentaje respecto de la pensión base, calendario mensual, pago anticipado/vencido, cambio al pago base y tratamiento de fracciones. Valorar aumento del titular y eventual reversión, evitar omitir capital de beneficiarios. Contrastar equivalencia de capital y casos de borde. M18–M19. | Verificar admisibilidad por tipo de pensión, duración, porcentaje, personas cubiertas y condiciones de la cláusula vigente. Distinguir aumento temporal de aumento diferido y vitalicio, y de su anticipo. No habilitar sobrevivencia o invalidez por analogía. |
| RV combinada | Solo configuración; cálculo y PDF bloqueados | En este constructor significa **período garantizado más aumento temporal**, no una combinación RP/RV. Validar ambos componentes y su interacción mediante flujos conjuntos: cruces de vencimientos, fallecimiento durante aumento/garantía, beneficiarios y pagos restantes, sin doble conteo. No multiplicar factores ni sumar divisores locales sin validación. M16–M19 y límites M20. | Comprobar que la combinación y condiciones exactas sean admisibles en el contrato y para el tipo de pensión; resolver prevalencia de cláusulas, exclusiones, transiciones y receptores. La existencia de dos cláusulas separadas no demuestra su contratación conjunta. |

## Evidencia necesaria para cambiar un bloqueo

1. Un especialista actuarial debe documentar metodología, unidades, fuentes primarias y versiones, tipo de pensión, tablas, edades, pagos, prestaciones y contingencias. Registrar qué CNU es regulatorio y qué divisor o tarifa es contractual.
2. La revisión jurídica/normativa debe comprobar la vigencia y aplicabilidad de las normas SP/CMF y del texto de las cláusulas; registrar fechas, ámbito, exclusiones y criterios de aceptación. Las fuentes de la matriz son puntos de partida, no prueba automática de vigencia al día de esta entrega.
3. Preparar casos de referencia independientes, sin datos personales: sin beneficiarios y con grupos admitidos, bordes de mes/edad/año, garantía/aumento mínimo y máximo admisible, fallecimientos y transición entre pagos. Conciliar capital, pensión base, pensión temporal, reversión, CNCM, unidades UF/CLP y redondeos; justificar tolerancias.
4. Validar cada modalidad por separado y después la combinación. Mantener rechazadas las configuraciones fuera del ámbito validado. No basta cambiar `calculable`, quitar un aviso o aprobar una prueba de monotonía.
5. Actualizar conjuntamente política compartida, API, PDF, catálogo, documentación y pruebas negativas de manipulación; exigir revisión independiente antes de ampliar el alcance autorizado. La presentación estimativa no subsana una fórmula sin validar.

Las referencias pertinentes ya están en la [matriz](fase-4-matriz-trazabilidad.md): Anexo 7 (S1), tablas TM-2020 (S2), circulares RP por fecha (S3), requisitos familiares (S4), descripción de garantía/aumento y referencias NCG (S5), y cláusulas distintas de aumento diferido/vitalicio y sus modificaciones (S6). No se consultó ni certificó una actualización normativa nueva en este trabajo.

## Tasas y límites del constructor

- **Tasas técnicas/descuento:** `tasaTecnicaCNU` para RP y `tasaRV` para la RV teórica, reales anuales en decimal por API. Se conservan los valores del piloto y su advertencia de vigencia. Son comunes a todos los escenarios seleccionados.
- **Sensibilidad:** el retorno real AFP 0/2/4% se mantiene separado del CNU. Cambiar el retorno no altera la pensión inicial del mismo modelo; afecta sus flujos posteriores bajo las hipótesis simplificadas del piloto. Los descuentos editados son también supuestos, nunca ofertas.
- **Tasas comerciales:** ausentes. El contrato nuevo rechaza compañías, tasas especiales/comerciales, factores e importes manuales. `/api/tasas-rv` continúa respondiendo 403. Una posible habilitación futura exigiría evidencia de procedencia, fecha, condiciones y alcance; queda fuera de esta entrega y no implica integrar SCOMP.
- **Límites de interfaz:** máximo 12 escenarios, nombres ficticios de hasta 60 caracteres, garantía 1–360 meses, aumento 1–120 meses y +0,01–100%, con hasta dos decimales. Son límites técnicos de captura, **no límites legales ni una oferta de esos parámetros**. No se convierten porcentajes ambiguos: `50` significa +50%.

## Restricciones que continúan

Sin pensiones reales certificadas, SIS, beneficios, comisiones, pensión líquida, grupos complejos, invalidez o causante fallecido. Con beneficiarios admitidos, solo montos iniciales; sin curvas familiares. No hay datos personales recuperados del cotizador antiguo ni almacenamiento del constructor. Los nombres libres no detectan automáticamente información personal: el operador debe usar etiquetas ficticias.

Siguen pendientes autenticación, autorización y controles de acceso multiusuario del [checklist del piloto](piloto/seguridad-y-privacidad.md). La ampliación no habilita acceso público ni datos reales. Publicación, PR, integración en `master` o despliegue requieren una instrucción posterior expresa.
