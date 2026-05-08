# Agro Docs

Fecha de actualizacion: 2026-05-08

Esta carpeta guarda la documentacion funcional y operativa de `frontend-agro`.

## Regla documental

- la arquitectura general del SaaS vive en `backend/docs`
- el comportamiento real del frontend `agro` se documenta aca

## Estado actual del frontend

`frontend-agro` hoy funciona como piloto activo de producto para validacion con cliente.

Hoy el alcance visible se divide en cinco vistas:

- `Inicio`
- `Animales`
- `Contabilidad`
- `Lluvia`
- `Resumen`

## Intencion de este corte

Todavia no se endurece backend ni modelo final de negocio.

La meta de este corte es:

- que el cliente se vea en el sistema
- validar si una sola app cubre stock y contabilidad
- validar lectura por campo como unidad operativa principal
- validar tambien registro de lluvia y tablero de resumen

## Base funcional demo

Hoy la demo ya deja ver:

- establecimientos y campos
- stock animal por especie y categoria
- categorias sembradas desde la declaracion jurada MGAP/SNIG 2024
- planilla de animales con altas, edicion y validaciones
- planilla contable con lectura cronologica por campo y moneda
- carga de lluvia por campo con bitacora propia
- resumen operativo por establecimiento

## Regla de persistencia en esta etapa

En esta etapa el frontend prioriza validacion de flujo y lenguaje con persistencia local.

Los datos principales sobreviven al refresh usando almacenamiento local del navegador:

- movimientos de animales
- movimientos contables
- registros de lluvia

El backend de `agro` sigue existiendo, pero hoy su alcance real documentado sigue concentrado en discovery tecnico y capabilities base. La UI actual ya no expone esa parte.

## Siguiente lectura

- [Contexto funcional del producto](./product-context.md)
- [Feedback cliente 2026-05-07](./client-feedback-2026-05-07.md)
- [Bitacora del modulo](./bitacora.md)
