# Fase 3: fundamento previo y plan de validación

Base local: `d1c7ef3`, rama `codex/desarrollo`. Fecha de consulta: 2026-11-08. No implica conformidad normativa del simulador.

## Evidencia documental

- NCG conjunta [SP 306 / CMF 495, 24-02-2023](https://www.cmfchile.cl/normativa/ncg_495_2023.pdf), pp. 2 y 5–16: cinco tablas TM-2020 y factores por sexo. Aplicación indicada desde 01-07-2023 por máximo seis años; no se extiende esa vigencia por extrapolar mortalidad. El [Compendio SP](https://www.spensiones.cl/portal/compendio/596/w3-propertyvalue-10624.html) mantiene ese capítulo en la consulta efectuada. No se acreditó una norma sustitutiva posterior en las fuentes consultadas.
- [Anexo 9 SP, PDF](https://www.spensiones.cl/portal/compendio/596/fo-article-15659.pdf), obtenido íntegramente: SHA-256 `aea2a6389234abdbe32c93f048cfd82f9215527c42a7e0228698098fddb6caf8`. Tablas de qx en pp. 2, 4, 5, 6, 8; factores en pp. 9–14. Se cotejó el texto de la copia CMF con las imágenes de la copia SP, incluidos los cuatro valores discrepantes y el terminal q110=1.
- [D.L. 3.500, art. 58, transcripción SUSESO](https://www.suseso.gob.cl/612/w3-propertyvalue-184728.html), contraste con [pensiones de referencia SP](https://www.spensiones.cl/portal/institucional/594/w3-article-2959.html) y [convivientes civiles CMF](https://www.cmfchile.cl/portal/principal/623/w4-article-102045.html). El porcentaje se aplica a la base de referencia del causante; no es automáticamente una participación normalizada del ingreso total familiar.
- [Anexo 7 SP](https://www.spensiones.cl/portal/compendio/596/fo-article-7253.pdf): fórmulas por situación familiar, cuota mortuoria y casos mensuales especiales. El CNU anual del proyecto no reproduce todo ese anexo.

## Diferencias numéricas comprobadas antes de modificar datos

Cotejo de 535 qx publicados y dos matrices de 111 edades × 16 años (replicadas por sexo en cinco tablas):

| Componente | Local d1c7ef3 | Documento |
| --- | ---: | ---: |
| MI-M qx2020 edad 3 | 0,00016066 | 0,00160661 |
| MI-M qx2020 edad 96 | 0,18859873 | 0,19400400 |
| CB-H AA edad 103, año 2032 | 0,013230 | 0,001323 |
| B-M AA edad 103, año 2027 | 0,015190 | 0,001519 |

Los demás qx publicados y factores cotejados coinciden. RV-M se publica desde edad 20: los veinte valores locales 0–19 no tienen respaldo en ese anexo. Se retirarán del conjunto respaldado y se rechazará su uso en lugar de inventar una extrapolación. La nueva fuente de datos conservará URL, páginas y fecha; los factores acumulados y qx2026 se derivarán por producto, sin copiar derivados potencialmente inconsistentes.

## Diseño mensual estimativo para períodos temporales

Se reemplazará `ceil(meses/12)` por exactamente M pagos mensuales. Se usará una hipótesis explícita de fuerza de mortalidad constante dentro de cada tramo de edad entera y año calendario:

`S(t + d) = S(t) × (1 - qx(edad alcanzada, año))^d`.

Los tramos se parten cuando cambia la edad entera o el año. Para datos sin fecha exacta se supone 1 de enero del año de cálculo y cumpleaños acorde con la edad suministrada. Con fecha, se usa una convención mensual de doce períodos por año (30/360), no un calendario actuarial oficial por días.

Pago mensual vencido de una unidad: `CNU_temporal(M) = suma[m=1..M] S(m/12) × (1+i)^(-m/12)`. La tasa i es anual efectiva real; su equivalente mensual es `(1+i)^(1/12)-1`. No se multiplica otra vez por 12. M=0 implica cero capital. Se permiten tasas negativas mayores que -1. Los pagos se limitan al dominio tabulado y al derecho del beneficiario; el derecho se evalúa al comienzo del mes cubierto y el pago al cierre. Este supuesto de fraccionamiento no se atribuye a SP/CMF.

El CNU vitalicio anual se conservará identificado como aproximación y se auditará separadamente. Mezclar su parte vitalicia anual con un complemento temporal mensual se declarará explícitamente: es una mejora del componente temporal, no una implementación certificada del Anexo 7. Se retirarán las variantes temporales duplicadas sin mortalidad y sus recortes arbitrarios al delegar en el cálculo común documentado. Garantías seguirán usando factores ilustrativos identificados.

Se expondrá una trayectoria mensual y un promedio de los doce pagos por fila anual. Un aumento de 13 meses ocupará doce pagos el primer año y uno el segundo, sin convertir el segundo año completo en fase aumentada. Los gráficos consumirán esos promedios.

## Reglas familiares que se implementarán

- Se distinguirán porcentaje legal documentado, incremento aplicable al hijo, porcentaje manual, porcentaje utilizado y participación relativa en el total familiar. Un override manual no se rotulará legal.
- Cónyuge: 60% o 50% cuando hay hijos comunes con derecho; madre/padre de hijos no matrimoniales: 36% o 30% en ese caso. Conviviente civil: 60/50/15%, según concurrencia y vínculos comunes. Las relaciones deberán informarse; los datos antiguos sin vínculos se marcarán como hipótesis, sin afirmar validación legal.
- Hijo: 15%; invalidez parcial desde 24: 11%. Se elimina el falso 11% por orfandad. Sin cónyuge se examina el incremento de 50 puntos repartidos entre hijos según el último inciso; los casos con adultos concurrentes y vínculos insuficientes se señalarán para revisión, sin inventar acreditaciones.
- Padres: 50% para cada padre que cumpla el art. 10, subordinado a inexistencia de otros beneficiarios. Se requiere acreditar la calidad de causante de asignación familiar: si el dato falta se informa como supuesto, no acreditación.
- La división entre múltiples adultos de la misma categoría es distinta de reducir todos los porcentajes para sumar 100%. Se elimina el tope genérico atribuido erróneamente al art. 58. Los porcentajes legales pueden sumar más de 100%; el CNU ponderado y la base de reparto financiable determinan el flujo del simulador. La participación familiar sí se normaliza y se expone por separado.

Requieren revisión profesional: acreditaciones de arts. 5–10, incisos especiales y concurrencias complejas, calendarios reales, invalidez parcial y transiciones futuras, cuota mortuoria, tasa regulatoria aplicable a cada fecha, garantías y admisibilidad de cláusulas. Las tasas locales no se declararán oficiales sin circular primaria comprobada.

## Trazabilidad del divisor y presentación

Para las variantes temporales, `cnu` representará el divisor que financia la pensión base, conservando sus componentes anual y mensual por separado. Antes se devolvía solo el CNU vitalicio aunque el cálculo usara un divisor mayor. Esto corrige la trazabilidad, sin atribuir carácter oficial al divisor híbrido. Los pagos anuales que atraviesan ambas fases serán promedios; la pensión inicial seguirá siendo el primer pago mensual. Las tasas por compañía heredadas no tienen respaldo primario de vigencia: se anonimizan los escenarios de pantalla y se retiran sus supuestas clasificaciones de riesgo y etiquetas CMF.

## Ajustes auxiliares de dominio y calendario

`calcularLx` no puede crear supervivientes desde edad cero de RV-M, cuya tabla empieza a los 20. Se definirá una raíz condicional explícita de 100.000 a los 20 para ese caso y a cero para las demás tablas; el antiguo comienzo arbitrario a los 18 para invalidez se retira porque MI publica desde cero. No es una función lx oficial: avanza años calendario con el producto de supervivencia local. Las expectativas de beneficiarios deben conservar invalidez y edad cero. Para la presentación de garantías se registrarán meses cubiertos por año (incluido un año mixto) sin cambiar el factor financiero ilustrativo; una fase llamada decreciente no debe usarse para una pensión de monto constante.

Con M=0 no hay pago aumentado: el primer pago debe ser la base, igual que la trayectoria. Los porcentajes de aumento deben ser finitos y no negativos; se conserva la convención de entrada heredada (0,5 o 50 representan 50%).
