# Agro - Bitacora

Fecha de actualizacion: 2026-05-16

## Regla de este archivo

Este documento si guarda detalle fino del modulo `agro`.

Aca corresponde anotar:

- que se hizo en el frontend
- donde quedo el modulo
- que pidio el cliente
- que flujo quedo pendiente
- que validaciones ya pasaron

## Corte actual

`agro` quedo en un corte activo publicado para esperar devolucion del cliente.

## Ultimo bloque importante ya aplicado

En este ultimo tramo quedaron cerrados tres puntos operativos:

1. `Persistencia real en backend`

- el frontend dejo de depender solo de almacenamiento local
- el workspace publico de `agro` ahora se lee y se guarda contra backend
- el endpoint operativo es:
  - `GET /api/v1/agro/workspace/public`
  - `PUT /api/v1/agro/workspace/public`

2. `App vacia para carga del cliente`

- se limpio la data de prueba del workspace publico en produccion
- la app ahora puede arrancar realmente en cero
- eso permite que el cliente cargue sus establecimientos, stock, lluvia, sanidad y contabilidad

3. `Cartel de actualizacion`

- la app ahora genera metadata de build propia
- si hay una version nueva publicada mientras el usuario tiene una pestana vieja abierta:
  - aparece el cartel `Actualizar`
  - al aceptarlo, la pagina se refresca

## Bloques funcionales ya bajados

Tambien quedaron resueltos pedidos funcionales fuertes:

- tipo de cambio promedio mensual
- `Resumen` mas lineal
- separacion de `cobrado`, `pendiente` y `parcial`
- relacion entre `Animales` y `Contabilidad` para ventas
- filtros por estado comercial
- selector superior de campo como verdad operativa unica
- formularios sin duplicar origen
- ajustes mobile de ancho
- `Inicio` alineado al establecimiento visible
- `Resumen` con capa global y capa puntual
- `Compra de ganado` separada de gastos operativos
- ajuste del `service worker` para evitar frontend viejo por cache

## Pedido cliente ya absorbido

En `Animales` el cliente pidio ampliar los tipos de movimiento.

La direccion actual absorbida es:

- un solo tipo `Traslado`
- se indica `campo origen`
- se indica `campo destino`
- al guardar:
  - baja stock en origen
  - sube stock en destino

## Lo que quedo alineado

- `Inicio`, `Animales`, `Contabilidad`, `Lluvia` y `Resumen` como vistas visibles
- lectura por `campo` como unidad principal
- planilla de animales con validaciones, scroll horizontal y edicion
- planilla contable alineada al mismo criterio
- vista propia de `Lluvia`
- eliminacion con modal propio
- caravana visible en muertes vacunas cuando corresponde

## Validacion tecnica registrada en cortes recientes

En las ultimas rondas del modulo quedaron registrados:

- `lint`: OK
- `typecheck`: OK
- `test`: OK
- `test:smoke`: OK
- `test:functional`: OK
- `build`: OK

## Donde quedamos

El siguiente paso ya no es solo conectar `Animales` con `Contabilidad`.

Lo que queda por seguir bajando ahora es:

1. seguir afinando lenguaje y lectura con cliente
2. decidir si conviene mostrar mas resumen comercial rapido en `Inicio` o `Resumen`
3. revisar si hace falta algun filtro adicional por `moneda`, `rubro` o `establecimiento`
4. seguir endureciendo documentacion funcional del modulo
