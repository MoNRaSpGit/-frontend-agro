# Agro - Contexto funcional inicial

Fecha de actualizacion: 2026-05-08

## Definicion actual del producto

`agro` se interpreta hoy como un producto con varios bloques funcionales dentro de una sola app:

- control de stock animal
- contabilidad operativa
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

### Gastos

Se mantienen inicialmente en una planilla mas generica para no sobredisenar antes de validar con el cliente.

## Bloque 3 - Lluvia

La lluvia hoy vive en una vista propia dentro del frontend y permite:

- cargar lluvia por campo
- revisar bitacora cronologica
- editar y eliminar registros cargados en demo

## Bloque 4 - Resumen

`Resumen` queda como tablero de lectura general del establecimiento.

Su funcion en este corte es:

- consolidar lectura por campo
- mostrar indicadores y alertas
- ayudar a contrastar lo cargado contra la realidad operativa

## Relacion entre stock y contabilidad

No se endurece en backend todavia.

La demo deja visible que podrian vincularse, pero sin obligarlo en todos los casos.

## Regla tecnica actual del demo

En esta etapa:

- la operacion del frontend vive principalmente en persistencia local
- el objetivo principal es validar flujos, lenguaje y lectura operativa con cliente
- el backend de `agro` todavia no endurece stock, contabilidad ni lluvia como modelo oficial

## Alcance backend relacionado

El backend conserva un cascaron temprano de `agro` con foco en discovery tecnico y capabilities base.

Eso hoy no se refleja como una vista visible del frontend, pero sigue siendo parte del estado tecnico del modulo.

## Fuente de categorias

La demo se siembra usando el recurso oficial `Codigos de categoria` del catalogo de datos abiertos MGAP/SNIG 2024 para:

- bovinos
- ovinos
- yeguarizos

Referencia oficial:

- https://catalogodatos.gub.uy/dataset/07376382-ff03-446d-86d6-62b7d5a9cf89/resource/9f694fec-f971-4077-aeea-b80ef5814732/download/categorias.csv
