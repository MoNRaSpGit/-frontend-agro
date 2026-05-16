# Agro - Estado actual del frontend

Fecha de actualizacion: 2026-05-16

## Estado general

`frontend-agro` hoy funciona como piloto activo de producto para validacion con cliente.

## Vistas visibles actuales

- `Inicio`
- `Carga inicial`
- `Animales`
- `Contabilidad`
- `Sanidad`
- `Lluvia`
- `Resumen`

## Intencion de este corte

La meta actual es:

- que el cliente se vea en el sistema
- validar si una sola app cubre stock y contabilidad
- validar lectura por campo como unidad operativa principal
- validar tambien registro de lluvia, sanidad y tablero de resumen

## Base funcional actual

Hoy el modulo ya deja ver:

- establecimientos y campos
- carga inicial de stock, saldo y establecimientos
- stock animal por especie y categoria
- categorias sembradas desde la declaracion jurada MGAP/SNIG 2024
- planilla de animales con altas, edicion y validaciones
- planilla contable con lectura cronologica por campo y moneda
- cuentas a cobrar con estados `Pendiente`, `Parcial` y `Cobrado`
- tipo de cambio promedio mensual para dolarizar egresos en pesos
- planilla sanitaria por establecimiento
- carga de lluvia por campo con bitacora propia
- resumen operativo por establecimiento
- estado de cuenta comercial
- cartel de actualizacion cuando hay una version nueva publicada

## Regla de persistencia actual

La app ya persiste el workspace publico de `agro` en backend.

Hoy los datos operativos principales viven en:

- `GET /api/v1/agro/workspace/public`
- `PUT /api/v1/agro/workspace/public`

Dentro de ese workspace quedan guardados:

- establecimientos
- campos
- movimientos de animales
- asientos contables
- lluvias
- sanidad
- tipos de cambio mensuales

La UI actual ya no depende de datos demo fijos y puede arrancar vacia para que el cliente cargue su informacion.

## Lo que hoy ya esta alineado

- lectura por `campo` como unidad principal
- `Animales` y `Contabilidad` conectados en ventas
- `Inicio`, `Lluvia`, `Sanidad` y `Resumen` como vistas visibles y utilizables
- estado comercial real de cobros dentro de contabilidad

## Siguiente paso recomendado

No abrir complejidad nueva sin devolucion del cliente.

El camino sugerido es:

1. seguir afinando lenguaje y lectura
2. confirmar si el cliente necesita mas filtros o resumenes
3. endurecer solo los bloques que el uso confirme
