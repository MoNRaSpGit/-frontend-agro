# Agro Docs

Fecha de actualizacion: 2026-05-11

Esta carpeta guarda la documentacion funcional y operativa de `frontend-agro`.

## Regla documental

- la arquitectura general del SaaS vive en `backend/docs`
- el comportamiento real del frontend `agro` se documenta aca

## Estado actual del frontend

`frontend-agro` hoy funciona como piloto activo de producto para validacion con cliente.

Hoy el alcance visible se divide en estas vistas:

- `Inicio`
- `Carga inicial`
- `Animales`
- `Contabilidad`
- `Sanidad`
- `Lluvia`
- `Resumen`

## Intencion de este corte

Todavia se sigue validando lenguaje y flujo con cliente, pero el modulo ya dejo de depender solo de demo local.

La meta de este corte es:

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

Hoy los datos operativos principales viven en el endpoint:

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

## Siguiente lectura

- [Contexto funcional del producto](./product-context.md)
- [Feedback cliente 2026-05-07](./client-feedback-2026-05-07.md)
- [Bitacora del modulo](./bitacora.md)
