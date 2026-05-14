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

## Ultimo corte aplicado

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
- eso permite que el cliente cargue sus establecimientos, stock, lluvia, sanidad y contabilidad desde su propia base

3. `Cartel de actualizacion`

- la app ahora genera metadata de build propia
- si hay una version nueva publicada mientras el usuario tiene una pestaña vieja abierta:
  - aparece el cartel `Actualizar`
  - al aceptarlo, la pagina se refresca

## Aclaracion de este corte

- para probar el cartel se hicieron microcambios de texto y accesibilidad
- no fueron cambios funcionales grandes del producto
- sirvieron para confirmar que el detector de nueva version funciona en produccion

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

## Corte siguiente ya aplicado

Sobre ese bloque anterior se termino de bajar la relacion entre `Animales` y `Contabilidad` para ventas:

1. `Venta desde Animales con cobro real`

- una venta cargada desde `Animales` ya no nace obligatoriamente como cobrada
- ahora permite cargar `cobrado` directamente en el formulario de la venta
- desde ahi el asiento relacionado en `Contabilidad` nace con:
  - `total`
  - `cobrado`
  - `pendiente`
- esto deja resuelto el caso de:
  - vender hoy
  - cobrar parcial o cobrar a plazo despues

2. `Filtros por estado`

- en `Contabilidad` ya hay filtro por:
  - `Todos`
  - `Pendiente`
  - `Parcial`
  - `Cobrado`
- en `Operaciones vinculadas` quedo el mismo criterio de lectura comercial

## Aclaracion de este corte

- estos ultimos cambios fueron mas de operacion y lectura que de layout
- no se cambio el modelo base de caja
- se afino la forma de registrar y revisar `cuentas a cobrar` nacidas desde `Animales`

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
- `push`: OK
- `deploy`: OK

## Donde quedamos

El siguiente paso ya no es solo conectar `Animales` con `Contabilidad`.

Lo que queda por seguir bajando ahora es:

1. seguir afinando lenguaje y lectura con cliente
2. decidir si conviene mostrar mas resumen comercial rapido en `Inicio` o `Resumen`
3. revisar si hace falta algun filtro adicional por `moneda`, `rubro` o `establecimiento`
4. seguir endureciendo documentacion funcional del modulo

## Pedido cliente nuevo

En `Animales` el cliente pidio ampliar los tipos de movimiento para contemplar operacion real de campo:

- `Traslado ingreso`
- `Traslado egreso`
- `Faltante`

Lectura funcional actual pedida:

- `traslados` cubren movimientos entre campos o lugares sin compra ni venta
- `faltantes` cubren desaparicion, robo u otras diferencias no explicadas como venta o muerte

## Ajuste funcional posterior

El traslado ya no se piensa como dos cargas manuales separadas.

Ahora la direccion de producto pasa a ser:

- un solo tipo `Traslado`
- se indica `campo origen`
- se indica `campo destino`
- al guardar:
  - baja stock en origen
  - sube stock en destino

## Corte siguiente ya aplicado

En este corte se alineo la UI para que el selector superior marque el contexto operativo real del modulo:

1. `Campo visible como verdad unica`

- el selector superior de `campo`, `ano` y `mes` vuelve a ser la referencia principal
- cuando el usuario cambia ese `campo visible`:
  - `Animales`
  - `Contabilidad`
  - `Lluvia`
  - `Sanidad`
  - `Resumen`

  pasan a trabajar sobre ese mismo establecimiento

2. `Formularios sin duplicar origen`

- en `Animales` ya no se elige otra vez el establecimiento de origen
- en `Traslado` el origen queda tomado del selector superior
- el formulario solo pide `campo destino`
- en `Contabilidad`, `Lluvia` y `Sanidad` el establecimiento activo queda visible como lectura, sin selector duplicado

3. `Ajuste mobile de ancho`

- se corrigio el layout para que las planillas con scroll horizontal no estiren los formularios en celular
- los paneles y formularios ahora pueden encogerse normal aunque la tabla siga teniendo ancho propio

## Ajuste posterior sobre mobile

- se mantuvo la correccion de ancho de formularios en celular
- las cuatro metricas grandes superiores volvieron a quedar visibles en mobile
- no se sostuvo el cambio de ocultarlas

## Validacion ejecutada en este corte

- `lint`: OK
- `typecheck`: OK
- `test`: OK
- `test:smoke`: OK
- `test:functional`: OK
- `build`: OK

## Estado del corte

- listo para `push` y `deploy`

## PF final del ajuste posterior

- `lint`: OK
- `typecheck`: OK
- `test`: OK
- `test:smoke`: OK
- `test:functional`: OK
- `build`: OK
