# Agro - Contexto funcional inicial

Fecha de actualizacion: 2026-05-06

## Definicion inicial del producto

`agro` se interpreta hoy como un producto con dos bloques funcionales dentro de una sola app:

- control de stock animal
- contabilidad operativa

## Regla de producto para este piloto

No se parte en dos aplicaciones separadas.

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

### Criterio actual

Como todavia no esta cerrado el nivel fino de detalle:

- el modelo arranca generico
- primero se controla por cantidad
- despues se podra afinar con kilos, edades, procedencia u otros datos

## Bloque 2 - Contabilidad

La contabilidad del cliente hoy se entiende como:

- ingresos
- egresos

### Ingresos iniciales

- venta de vacunos
- venta de ovinos
- venta de lana
- venta de equinos

### Datos visibles de una transaccion comercial

- kilos
- precio
- comision
- impuestos
- neto

### Gastos

Se mantienen inicialmente en una planilla mas generica para no sobredisenar antes de validar con el cliente.

## Relacion entre stock y contabilidad

No se endurece todavia.

La demo deja visible que podrian vincularse, pero sin obligarlo.

## Preguntas abiertas

La vista `Preguntas` queda como parte del producto para relevar decisiones reales como:

- medios de pago y cobro
- si el stock va solo por cantidad o tambien por kilos
- si las ventas deben descontar stock automaticamente
- si los gastos deben analizarse por campo
- como se quiere manejar la lana

## Regla tecnica actual del demo

En esta etapa:

- las respuestas de `Preguntas` son la unica informacion que vale la pena persistir en base
- el resto de los datos ingresados en demo puede vivir localmente
- si se pierde al refrescar, no rompe el objetivo de validacion

## Contrato previsto para backend de discovery

La primera integracion real sugerida entre `frontend-agro` y backend no es stock ni contabilidad.

Es `Preguntas`.

Payload previsto:

```json
{
  "moduleKey": "agro",
  "version": "v1",
  "answeredAt": "2026-05-06T12:00:00.000Z",
  "answers": [
    {
      "questionId": "sale-link",
      "selectedOption": "Si siempre"
    }
  ]
}
```

Ruta sugerida:

- `POST /api/v1/agro/discovery`
- `GET /api/v1/agro/discovery/latest`

La idea es persistir solo respuestas de discovery por tenant y dejar el resto del demo desacoplado hasta validar mejor el negocio.

## Fuente de categorias

La demo se siembra usando el recurso oficial `Códigos de categoría` del catalogo de datos abiertos MGAP/SNIG 2024 para:

- bovinos
- ovinos
- yeguarizos

Referencia oficial:

- https://catalogodatos.gub.uy/dataset/07376382-ff03-446d-86d6-62b7d5a9cf89/resource/9f694fec-f971-4077-aeea-b80ef5814732/download/categorias.csv
