# Agro - Feedback cliente 2026-05-07

Fecha de actualizacion: 2026-05-16

## Fuente

Mensaje directo del cliente despues de revisar la demo de `frontend-agro`.

## Aclaracion importante

Cuando el cliente habla de una "planilla de Excel", la lectura correcta para este piloto es:

- una vista tipo planilla
- con filas, columnas, filtros y lectura cronologica
- visualmente parecida a una planilla operativa

No implica todavia exportacion real a `.xlsx` como requisito inmediato.

## Confirmaciones funcionales nuevas

### Contabilidad por moneda

- los ingresos van solamente en `USD`
- los egresos van en `UYU` y `USD`
- el cliente quiere mirar la contabilidad por campo
- el sistema deberia permitir ver movimientos por rubro

### Planilla contable esperada

El cliente espera revisar:

- fecha
- ingreso o egreso
- monto
- moneda
- rubro
- campo

### Planilla de animales esperada

El cliente espera revisar:

- cantidad
- categoria
- fecha
- precio
- peso
- flete cuando corresponde
- comision
- IVA
- monto total
- campo

## Relacion stock-contabilidad

El cliente quiere relacionar cada movimiento de animales con su impacto economico cuando corresponda.

Ejemplos:

- si entran animales por compra, debe quedar asociado el egreso economico
- si salen animales por venta, debe quedar asociado el ingreso economico

Excepciones explicitadas:

- `nacimiento` no se relaciona a monto
- `muerte` no se relaciona a monto

## Resumenes pedidos

El cliente pidio una ventana `Resumen` con foco por campo, no por potrero.

Debe mostrar:

- totales por categoria
- control de existencias por campo
- animales vendidos por periodo
- animales comprados por periodo
- resumen mensual
- resumen anual

## Registro pluviometrico

Se pidio agregar registro pluviometrico por campo.

Lectura inicial sugerida:

- fecha
- campo
- milimetros de lluvia
- observaciones

## Lectura actual de este feedback

Este feedback ya quedo absorbido en la direccion del producto:

- lectura por campo como unidad visible principal
- planilla de animales mas detallada
- planilla contable por campo y moneda
- vista propia para lluvia
- resumen orientado a control operativo
