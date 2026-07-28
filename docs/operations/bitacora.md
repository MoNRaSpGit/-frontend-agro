# Agro - Bitacora

Fecha de actualizacion: 2026-07-28

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

## 2026-07-28 - El guardado mentia y la sesion se cerraba sin motivo real

Rosendo reporto dos sintomas que en un principio parecian sueltos, pero resultaron ser dos bugs de confianza reales, no cosmeticos: (1) a veces la app decia "no se pudo guardar la carga del campo o potrero" y sin embargo el dato **si** habia quedado guardado; y (2) con la app abierta e inactiva un tiempo (ej. 4 horas), a veces la sesion se cerraba sola y otras veces no, sin ningun patron aparente.

### Por que importa este corte

No es un ajuste visual. Si la app puede decir "no se guardo" estando guardado (o al reves), el cliente deja de poder confiar en lo que ve en pantalla mientras carga datos productivos reales. Y si la sesion se cierra al azar, puede perder trabajo en progreso sin previo aviso. Por eso este bloque se aborda con precision antes que con velocidad: se prefirio hacer el guardado mas explicito (indicador de estado, avisos especificos) en vez de mas rapido/silencioso.

### Que se encontro (causa real, no sintoma)

1. `agro.client.ts` tiraba siempre el mismo string generico ante cualquier error HTTP al guardar/cargar, sin mirar el status code ni el mensaje real que ya devolvia el backend. Un error de validacion (ej. el guardia que bloquea un guardado que parece vaciar informacion existente), un error de sesion vencida, un error de servidor y un corte de conexion terminaban todos mostrando el mismo mensaje generico.
2. El autoguardado era silencioso cuando salia bien, y si fallaba una vez mostraba un aviso de error **que nunca se cerraba solo**. Si el guardado siguiente si tenia exito, el aviso viejo se quedaba pegado en pantalla diciendo "no se guardo" aunque el dato ya estuviera a salvo.
3. El cierre de sesion intermitente era una carrera al renovar el token: el refresh token del backend es de un solo uso (se invalida apenas se canjea). Si dos pedidos pedian renovarlo casi al mismo tiempo (mas de una pestana abierta con la misma sesion, o dos pedidos en paralelo), el segundo perdia la carrera, el backend lo rechazaba, y el frontend interpretaba ese rechazo como "la sesion murio" y borraba todo — aunque el token de 7 dias en realidad seguia vigente.
4. Sin buscarlo, tambien se confirmo que no habia proteccion real ante edicion simultanea desde dos dispositivos/pestanas: el guardado era "el ultimo que llega gana", sin deteccion de conflicto.

### Queda asi

- los errores de guardado/carga ahora se clasifican por causa real: sin conexion, sesion vencida, dato invalido (con el mensaje que ya manda el backend), error de servidor
- hay un indicador de estado siempre visible ("Guardando...", "Guardado (hora)", o el motivo especifico del error) en vez de depender solo de un toast
- si un guardado falla y el siguiente tiene exito, el aviso de error viejo se cierra solo
- si se cierra la pestana con un guardado pendiente o en viaje, el navegador avisa antes de perder ese cambio
- se arreglo la carrera de renovacion de sesion: dentro de la misma pestana los pedidos concurrentes esperan un unico refresh en curso; ademas, antes de pedir un refresh se chequea si otra pestana ya lo hizo, y si el propio refresh falla se revisa si ya quedo guardada una sesion mas nueva antes de cerrar todo
- si la sesion vence de verdad (7 dias sin actividad), ahora manda al login en vez de dejar la app trabada sin poder guardar nada
- el cartel `Actualizar` ya no cierra la sesion al aplicar una version nueva (antes si lo hacia, ver nota de 2026-05-22 mas abajo, que queda superada por este corte)
- se agrego deteccion de edicion simultanea entre dispositivos/pestanas: cada guardado manda la version de fila que vio la ultima vez (`expectedRowVersion`); si el backend ya tiene una version mas nueva, rechaza el guardado con un aviso claro pidiendo recargar, en vez de pisar en silencio el cambio de otro dispositivo
- se subio el limite de tamano de body en el backend (100kb -> 10mb) para que un workspace grande no falle con un error de servidor generico
- se agrego un Error Boundary global: un error de render en cualquier parte de la app ya no deja una pantalla en blanco sin explicacion
- se agregaron 60 tests (antes habia 7), incluyendo tests que reproducen exactamente la carrera de sesion arreglada, para que si alguien vuelve a tocar ese codigo y rompe el fix, quede detectado
- de paso, `AgroHomePage.tsx` (3753 lineas) se redujo a 3399 sacando funciones puras a archivos aparte, sin cambio de comportamiento

### Deliberadamente fuera de este corte

- el fix viejo de calculo de venta neta (rama `agent/fix-agro-sale-net-total`) sigue archivado, no se toco a pedido explicito
- el endpoint `GET/PUT /agro/workspace/public` sigue sin autenticacion; no lo usa el frontend pero tampoco se cerro, a pedido explicito
- todavia no hay tests de UI/componentes ni end-to-end, solo tests unitarios de funciones puras y de la logica de sesion/errores

### Validacion tecnica de este corte

- `lint`: OK (0 errores/warnings en los archivos tocados)
- `typecheck`: OK
- `test`: OK (60/60)
- `build`: OK (bundle final practicamente identico en tamano, confirma que el refactor no cambio comportamiento)
- deploy verificado en vivo (frontend GitHub Pages + backend Render) despues del merge a `main`

## 2026-06-05 - Rosendo pasa de acceso automatico a clave propia

Se deja de depender del ingreso automatico con credencial fija para la cuenta real del cliente.

Queda asi:

- el acceso principal ya no entra directo con un boton `Rosendo`
- la pantalla pide `usuario` y `contrasena`
- se mantiene `rosendo` como cuenta operativa real
- aparece la accion `Definir nueva contrasena para Rosendo`
- ese flujo valida la clave actual y guarda una nueva sobre la misma cuenta
- el acceso `Demo` sigue separado

Objetivo:

- permitir que el cliente defina su propia contrasena
- mantener la misma cuenta y los mismos datos
- dejar listo un boton temporal para la migracion de clave y luego retirarlo cuando el cliente confirme

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
