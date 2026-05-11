# Agro - Contexto funcional inicial

Fecha de actualizacion: 2026-05-11

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
- especies:
  - `vacunos`
  - `ovinos`
  - `equinos`
- categorias por especie
- entradas y salidas de animales
- lectura por establecimiento y por campo
- caravana para muertes vacunas cuando corresponde

### Criterio actual

Como todavia no esta cerrado el nivel fino de detalle:

- el modelo arranca generico
- combina cantidad con datos economicos cuando el movimiento lo requiere
- despues se podra afinar con edades, procedencia u otros datos

## Bloque 2 - Contabilidad

La contabilidad del cliente hoy se entiende como:

- ingresos
- egresos
- lectura por moneda
- lectura por campo
- seguimiento de cobro real

### Ingresos iniciales

- venta de vacunos
- venta de ovinos
- venta de lana
- venta de equinos

### Datos visibles de una transaccion comercial

- kilos
- precio
- flete cuando corresponde
- comision
- impuestos
- neto
- cobrado
- pendiente

### Criterio comercial actual

- un ingreso puede quedar `Pendiente`
- tambien puede quedar `Parcial`
- solo pasa a `Cobrado` cuando el cobro cubre el total
- los egresos en `UYU` pueden pasarse a `USD` usando tipo de cambio promedio mensual

### Gastos

Se mantienen inicialmente en una planilla mas generica para no sobredisenar antes de validar con el cliente.

## Bloque 3 - Sanidad

La sanidad hoy vive en una vista propia y permite:

- cargar fecha
- cargar establecimiento
- cargar especie
- cargar cantidad
- cargar tratamiento
- revisar bitacora sanitaria

## Bloque 4 - Lluvia

La lluvia hoy vive en una vista propia dentro del frontend y permite:

- cargar lluvia por campo
- revisar bitacora cronologica
- editar y eliminar registros cargados en demo

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

No se endurece en backend todavia.

La demo deja visible que podrian vincularse, pero sin obligarlo en todos los casos.

## Regla tecnica actual

En este corte:

- la operacion visible del frontend persiste en backend usando el workspace publico
- el objetivo principal sigue siendo validar flujos, lenguaje y lectura operativa con cliente
- el backend ya guarda:
  - establecimientos
  - campos
  - animales
  - contabilidad
  - lluvia
  - sanidad
  - tipos de cambio mensuales

## Alcance backend relacionado

El backend conserva discovery tecnico y capabilities base, pero ademas ya expone el workspace publico de la app.

Eso hoy se usa directamente desde la UI para leer y guardar la operacion del cliente.

## Fuente de categorias

La demo se siembra usando el recurso oficial `Codigos de categoria` del catalogo de datos abiertos MGAP/SNIG 2024 para:

- bovinos
- ovinos
- yeguarizos

Referencia oficial:

- https://catalogodatos.gub.uy/dataset/07376382-ff03-446d-86d6-62b7d5a9cf89/resource/9f694fec-f971-4077-aeea-b80ef5814732/download/categorias.csv
