# Agro - Feedback cliente 2026-05-07

Fecha de actualizacion: 2026-05-07

## Fuente

Mensaje directo del cliente despues de revisar la demo de `frontend-agro`.

## Aclaracion importante

Cuando el cliente habla de una "planilla de Excel", por ahora la lectura correcta para este demo es:

- una vista tipo planilla
- con filas, columnas, filtros y lectura cronologica
- visualmente parecida a una planilla operativa

No implica todavia exportacion real a `.xlsx` como requisito inmediato.

## Confirmaciones funcionales nuevas

### Contabilidad por moneda

- los ingresos van solamente en `dolares`
- los egresos van en `pesos` y `dolares`
- el cliente quiere mirar la contabilidad por campo
- el sistema deberia permitir ver movimientos por rubro

## Planilla contable esperada

El cliente espera una planilla visual donde pueda revisar:

- fecha
- si fue ingreso o egreso
- monto
- moneda
- rubro
- campo

La lectura deseada es:

- ver en que fecha entro o salio determinado monto
- identificar a que rubro corresponde
- resumir por campo
- resumir por periodo mensual y anual

## Planilla de animales esperada

El cliente espera una planilla visual de movimientos de animales con:

- cantidad
- categoria
- fecha
- precio
- peso
- flete
- comision
- IVA
- monto total
- campo
- potrero

### Aclaracion por tipo de movimiento

- para ingresos de animales se esperan todos los items anteriores
- para egresos, el cliente pidio "lo mismo menos el flete"

## Relacion stock-contabilidad

El cliente quiere relacionar cada movimiento de animales con su impacto economico cuando corresponda.

Ejemplos:

- si entran 10 animales por compra, debe quedar asociado el egreso economico
- si salen animales por venta, debe quedar asociado el ingreso economico

Excepciones explicitadas por el cliente:

- `nacimiento` no se relaciona a monto
- `muerte` no se relaciona a monto

## Resumenes pedidos

El cliente pidio una ventana `Resumen` con foco por campo, no por potrero.

Debe mostrar:

- totales de vacas
- totales de terneros
- totales por categoria
- control de existencias por campo
- animales vendidos por periodo
- animales comprados por periodo
- resumen mensual
- resumen anual

La intencion operativa es que el cliente pueda comparar esos totales contra la realidad fisica y detectar:

- animales faltantes
- ventas no registradas
- compras no registradas
- muertes no registradas

## Registro pluviometrico

Se pide agregar en la parte de `Resumen` un registro pluviometrico por campo.

Lectura inicial sugerida:

- fecha
- campo
- milimetros de lluvia
- observaciones

## Respuestas inferidas sobre las preguntas de discovery actuales

Estas no son respuestas extraidas automaticamente del navegador.

Son respuestas inferidas a partir del mensaje del cliente y sirven como contexto de producto:

- `stock-granularity`: `Cantidad y kilos`
- `sale-link`: `Si siempre`
- `field-visibility`: `Tambien por cada campo`
- `expense-split`: `Segun el campo`
- `field-costing`: `Tambien resultado por campo`
- `wool-cycle`: no queda cerrada aun; el cliente menciona lana pero no define si va separada por zafra
- `stock-history`: `Si`

## Limite tecnico actual

En el demo actual, las respuestas reales de `Preguntas` se guardan en `localStorage` con la clave:

- `saaspro-agro-discovery-answers-v2`

Eso significa que desde el repo puedo ver:

- las preguntas
- la estructura de persistencia
- el contexto funcional inferido

Pero no puedo recuperar desde codigo las respuestas reales ya marcadas en un navegador especifico si no tenemos acceso a ese almacenamiento local.
