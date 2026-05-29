# Agro - Bitacora

Fecha de actualizacion: 2026-05-26

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

## 2026-05-29 - Nuevos rubros contables en egresos

Se amplian los rubros disponibles en `Contabilidad > Egresos` para acompañar mejor la carga real del cliente.

Quedan disponibles como conceptos operativos nuevos:

- `Honorarios profesionales`
- `Semillas`
- `Fertilizantes`

El alta aplica a egresos en `USD` y tambien a egresos en `UYU`, porque el rubro se elige aparte de la moneda.

## 2026-05-27 - Nuevo rubro contable Arrendamiento

Se agrega en `Contabilidad > Egresos` el rubro:

- `Arrendamiento`

Queda disponible como concepto operativo nuevo dentro de la carga contable del frontend.

## 2026-05-27 - Comision e IVA ya no exigen 00 en egresos

Se ajusta la carga contable para no pedir datos innecesarios en la operacion real.

Queda asi:

- en `Contabilidad`, los egresos pueden dejar `Comision` vacio
- tambien pueden dejar `IVA` vacio
- si ambos campos quedan vacios, el sistema los interpreta como `0`

## 2026-05-27 - Los formularios ya no pierden el contexto al guardar

Se mejora la experiencia de carga repetitiva para no obligar al cliente a rearmar el formulario en cada guardado.

Queda asi:

- despues de guardar, el formulario mantiene el contexto util actual
- se conserva por ejemplo `tipo`, `rubro`, `campo`, `especie`, `moneda` o `mes`
- se limpian solo los valores cargados como importes, cantidades y notas

## 2026-05-26 - Inputs numericos aceptan coma decimal

Se ajusta la carga manual del frontend para no pelearse con la forma real en que el cliente escribe numeros.

Queda asi:

- los campos decimales ahora aceptan valores con coma `,`
- tambien se normalizan valores con miles y decimal como `1.234,56`
- el cambio aplica en `Carga inicial`, `Animales`, `Contabilidad`, `Lluvia` y `Tipo de cambio`
- la validacion y los calculos visibles usan el mismo parseo para evitar diferencias entre lo escrito y lo guardado

## 2026-05-26 - Demo con ingreso directo

Se simplifica tambien la puerta demo para que el acceso de pruebas no agregue un paso manual innecesario.

Queda asi:

- el boton `Demo` ya no abre modal ni pide clave intermedia
- al tocar `Demo`, el frontend entra directo usando la cuenta demo real
- `Rosendo` y `Demo` quedan alineados como accesos directos desde la misma pantalla

## 2026-05-26 - Formato visible con 2 decimales

Se alinea la lectura visual de los numeros cargados para que no se pierdan los decimales al revisar la informacion.

Queda asi:

- montos, hectareas, lluvia, peso y tipo de cambio se muestran con `2` decimales
- la presentacion visible usa formato `es-UY`
- un valor como `1250000,75` ahora se lee como `1.250.000,75`

## 2026-05-26 - El campo visible ya no vuelve a La Milagrosa al guardar

Se corrige un desvio del frontend que rompia el trabajo por campo cuando el usuario guardaba cambios fuera de `La Milagrosa`.

Queda asi:

- al guardar en `Animales`, `Contabilidad`, `Lluvia` o `Sanidad`, la pantalla mantiene el campo activo actual
- los resets de formulario ya no vuelven por defecto al primer establecimiento del array
- esto evita que el trabajo salte solo a `La Milagrosa` despues de cada guardado

## 2026-05-22 - Acceso directo del cliente, cierre visible y re-login por actualizacion

Se simplifica la puerta de entrada del frontend para este corte del cliente real.

Queda asi:

- pantalla de acceso con un solo boton `Ingresar`
- login directo contra backend con la cuenta `Rosendo`
- boton visible de `Cerrar sesion` dentro de la app
- el cartel `Actualizar` ahora limpia sesion y devuelve al login antes de recargar la app nueva

En este corte el cliente autenticado entra sobre un workspace publico de `agro` que arranca vacio para carga real.

## 2026-05-22 - Acceso demo separado para pruebas y workspace por tenant

Se agrega una puerta controlada de pruebas para que el cliente real no entre por error al entorno demo.

Queda asi:

- boton `Rosendo` con ingreso directo
- boton `Demo` separado
- el demo abre un modal y pide solo una contrasena corta
- si la clave es valida, el frontend entra con un usuario demo real
- ese usuario demo guarda contra un workspace autenticado por tenant, separado del cliente real

## 2026-05-22 - Hectareas obligatorias al crear campo

Se endurece la carga inicial para que no queden campos sin superficie declarada.

Queda asi:

- `Hectareas` pasa a ser obligatoria al crear campo
- si falta ese dato, sale un aviso visible
- el input queda marcado en rojo hasta corregirlo

## Ultimo bloque importante ya aplicado

En este ultimo tramo quedaron cerrados tres puntos operativos:

1. `Persistencia real en backend`

- el frontend dejo de depender solo de almacenamiento local
- el frontend autenticado de `agro` ahora lee y guarda contra backend por tenant
- el endpoint operativo es:
  - `GET /api/v1/agro/workspace`
  - `PUT /api/v1/agro/workspace`
- el endpoint `workspace/public` queda como compatibilidad operativa del backend

2. `App vacia para carga del cliente`

- se limpio la data de prueba del workspace publico en produccion
- la app ahora puede arrancar realmente en cero
- eso permite que el cliente cargue sus establecimientos, stock, lluvia, sanidad y contabilidad

3. `Cartel de actualizacion`

- la app ahora genera metadata de build propia
- si hay una version nueva publicada mientras el usuario tiene una pestana vieja abierta:
  - aparece el cartel `Actualizar`
  - al aceptarlo, se limpia la sesion
  - despues la pagina se refresca y vuelve al login

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
- boton superior de cierre de sesion visible en desktop
- resumen por campo mostrando hectareas reales
- `Carga inicial` sin saldo inicial, sin fecha de corte y sin localidad
- demo separado del cliente real con acceso propio
- validacion visual de hectareas obligatorias al crear campo

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
- acceso real simplificado para un solo cliente operativo

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
