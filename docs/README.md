# Agro Docs

Fecha de actualizacion: 2026-05-06

Esta carpeta guarda la documentacion funcional y operativa de `frontend-agro`.

## Regla documental

- la arquitectura general del SaaS vive en `backend/docs`
- el comportamiento real del frontend `agro` se documenta aca

## Estado actual del frontend

`frontend-agro` arranca como boseto demo-first para discovery con cliente.

Hoy el alcance visible se divide en cuatro vistas:

- `Inicio`
- `Stock`
- `Contabilidad`
- `Preguntas`

## Intencion de este corte

Todavia no se endurece backend ni modelo final.

La meta de este primer corte es:

- que el cliente se vea en el sistema
- validar si una sola app cubre stock y contabilidad
- capturar respuestas reales de negocio desde la misma demo

## Base funcional demo

Hoy la demo ya deja ver:

- establecimientos y campos
- stock animal por especie y categoria
- categorias sembradas desde la declaracion jurada MGAP/SNIG 2024
- movimientos simples de stock en memoria
- planilla contable liviana con neto visible
- preguntas de multiple opcion para discovery

## Regla de persistencia en esta etapa

Por ahora la unica pieza con valor real para guardar en base son las respuestas del cliente en `Preguntas`.

En el frontend demo actual esas respuestas sobreviven al refresh usando persistencia local del navegador, para simular el comportamiento que despues ira a backend.

El resto del demo puede seguir efimero:

- movimientos de stock cargados a mano
- asientos contables demo
- pruebas manuales durante la reunion

## Siguiente lectura

- [Contexto funcional del producto](./product-context.md)
