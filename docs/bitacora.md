# Agro - Bitacora

Fecha de actualizacion: 2026-05-11

## Regla de este archivo

Este documento si puede guardar detalle fino del modulo `agro`.

Aca si corresponde anotar:

- que hicimos hoy
- donde quedamos
- que pidio el cliente
- que flujo quedo pendiente
- que validaciones ya pasaron

## Corte actual

`agro` quedo en un corte activo publicado para esperar devolucion del cliente.

## Ultimo corte funcional

En este corte quedaron resueltos dos puntos funcionales principales pedidos para `Contabilidad` y `Resumen`:

1. `Tipo de cambio promedio mensual`

- se agrego una carga mensual de tipo de cambio promedio
- el dato se registra por `mes`
- los `egresos en UYU` del mes ahora pueden convertirse a `USD`
- en contabilidad ya se muestra:
  - `egresos USD directos`
  - `egresos UYU`
  - `egresos UYU pasados a USD`
  - `total egresos USD equivalentes`

2. `Resumen` mas lineal

- la vista `Resumen` dejo de priorizar tarjetas tipo globitos
- se paso a una lectura mas corta, tipo item + valor
- el cambio aplica a:
  - alertas
  - resumen por establecimiento
  - resumen del periodo
  - resumen anual
- en esa misma lectura ya quedo visible la parte de dolarizacion de egresos en pesos

## Aclaracion del corte

- el ajuste visual del reparto de ancho entre `Cargar movimiento de caja` y `Tipo de cambio promedio mensual` fue un retoque de UX aparte
- lo importante de este corte funcional fue:
  - `tipo de cambio promedio mensual`
  - `resumen` mas lineal

## Corte siguiente ya aplicado

Sobre ese corte anterior se agrego una segunda capa funcional en `Contabilidad`:

1. `Cobro pendiente / parcial / cobrado`

- los `ingresos` ahora pueden separar:
  - `total`
  - `cobrado`
  - `pendiente`
- desde esos datos el sistema deriva estado:
  - `Pendiente`
  - `Parcial`
  - `Cobrado`

2. `Resumen` ajustado a cobros reales

- el `Resumen` ya no toma todos los ingresos como si estuvieran cobrados
- ahora muestra:
  - `ingresos cobrados`
  - `ingresos pendientes de cobro`

## Aclaracion de este corte

- el ajuste final de ancho `35 / 65` entre:
  - `Cargar movimiento de caja`
  - `Tipo de cambio promedio mensual`

fue una mejora de UX del mismo tramo, pero el cambio funcional central fue la separacion entre `cobrado` y `pendiente`

## Lo que quedo alineado

- `Inicio`, `Animales`, `Contabilidad`, `Lluvia` y `Resumen` como vistas visibles
- lectura por `campo` como unidad principal
- planilla de animales con validaciones, scroll horizontal flotante y edicion con retorno al formulario
- planilla contable con comportamiento alineado al de animales
- vista propia de `Lluvia`
- eliminacion con modal propio
- caravana visible en muertes vacunas cuando corresponde

## Limpieza reciente

- se retiro `Preguntas` de la UI actual
- se saco residuo tecnico de discovery del frontend
- se acomodaron docs para que el detalle de modulo viva en esta carpeta
- se limpiaron textos demo que seguian hablando de `lote`

## Validacion ejecutada

- `lint`: OK
- `typecheck`: OK
- `test`: OK
- `test:smoke`: OK
- `test:functional`: OK
- `build`: OK
- `push`: pendiente de este corte
- `deploy`: pendiente de este corte

## Donde quedamos

El siguiente paso ya no es revisar estos dos puntos.

Lo que queda por seguir bajando ahora es:

1. decidir si la logica de `cobro pendiente` tambien debe aparecer desde `Animales`
2. seguir afinando lenguaje y lectura con cliente
3. revisar si conviene sumar filtros especificos para `Pendiente / Parcial / Cobrado`
4. seguir endureciendo documentacion funcional del modulo
