# Agro - Contexto funcional del producto

Fecha de actualizacion: 2026-05-16

## Definicion actual del producto

`agro` se interpreta hoy como un producto con varios bloques funcionales dentro de una sola app:

- carga inicial operativa
- control de stock animal
- contabilidad operativa
- registro sanitario
- registro de lluvia por campo
- resumen operativo por establecimiento

## Regla de producto para este piloto

No se parte en aplicaciones separadas.

Primero se valida una sola experiencia con secciones internas distintas.

## Bloque 1 - Stock animal

El sistema debe permitir:

- multiples establecimientos por empresa
- multiples campos por establecimiento
- especies `vacunos`, `ovinos` y `equinos`
- categorias por especie
- entradas y salidas de animales
- lectura por establecimiento y por campo
- caravana para muertes vacunas cuando corresponde

## Bloque 2 - Contabilidad

La contabilidad del cliente hoy se entiende como:

- ingresos
- egresos
- lectura por moneda
- lectura por campo
- seguimiento de cobro real

### Criterio comercial actual

- un ingreso puede quedar `Pendiente`
- tambien puede quedar `Parcial`
- solo pasa a `Cobrado` cuando el cobro cubre el total
- los egresos en `UYU` pueden pasarse a `USD` usando tipo de cambio promedio mensual

## Bloque 3 - Sanidad

La sanidad vive en una vista propia y permite:

- cargar fecha
- cargar establecimiento
- cargar especie
- cargar cantidad
- cargar tratamiento
- revisar bitacora sanitaria

## Bloque 4 - Lluvia

La lluvia vive en una vista propia y permite:

- cargar lluvia por campo
- revisar bitacora cronologica

## Bloque 5 - Resumen

`Resumen` queda como tablero de lectura general del establecimiento.

Su funcion en este corte es:

- consolidar lectura por campo
- mostrar indicadores y alertas
- ayudar a contrastar lo cargado contra la realidad operativa
- mostrar tambien estado de cuenta comercial

## Bloque 6 - Carga inicial

La carga inicial permite:

- sembrar stock base por establecimiento y especie
- sembrar saldo contable base
- crear nuevos establecimientos
- cargar una fecha de referencia para arrancar ordenado

## Relacion entre stock y contabilidad

Hoy la relacion ya se baja en parte desde el frontend para ventas, pero no se endurece como regla cerrada para todos los casos.

La prioridad sigue siendo validar operacion real con cliente.

## Regla tecnica actual

En este corte:

- la operacion visible del frontend persiste en backend usando el workspace publico
- el objetivo principal sigue siendo validar flujos, lenguaje y lectura operativa con cliente
- el backend ya guarda establecimientos, campos, animales, contabilidad, lluvia, sanidad y tipos de cambio mensuales

## Fuente de categorias

La app se siembra usando el recurso oficial `Codigos de categoria` del catalogo de datos abiertos MGAP/SNIG 2024 para:

- bovinos
- ovinos
- yeguarizos
