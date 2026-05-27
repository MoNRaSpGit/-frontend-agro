# Agro - Estado actual del frontend

Fecha de actualizacion: 2026-05-26

## Estado general

`frontend-agro` hoy funciona como piloto activo de producto para validacion con cliente.

## Vistas visibles actuales

- `Inicio`
- `Carga inicial`
- `Animales`
- `Contabilidad`
- `Sanidad`
- `Lluvia`
- `Resumen`

## Intencion de este corte

La meta actual es:

- que el cliente se vea en el sistema
- validar si una sola app cubre stock y contabilidad
- validar lectura por campo como unidad operativa principal
- validar tambien registro de lluvia, sanidad y tablero de resumen

## Base funcional actual

Hoy el modulo ya deja ver:

- establecimientos y campos
- carga inicial de stock y campos
- stock animal por especie y categoria
- categorias sembradas desde la declaracion jurada MGAP/SNIG 2024
- planilla de animales con altas, edicion y validaciones
- planilla contable con lectura cronologica por campo y moneda
- rubro `Arrendamiento` disponible dentro de egresos contables
- `Comision` e `IVA` opcionales en egresos manuales
- los formularios mantienen contexto util despues de guardar
- cuentas a cobrar con estados `Pendiente`, `Parcial` y `Cobrado`
- tipo de cambio promedio mensual para dolarizar egresos en pesos
- planilla sanitaria por establecimiento
- carga de lluvia por campo con bitacora propia
- carga numerica compatible con coma decimal en formularios operativos
- lectura visible con formato `es-UY` y `2` decimales en valores numericos relevantes
- persistencia del campo visible despues de guardar cambios en formularios operativos
- resumen operativo por establecimiento
- estado de cuenta comercial
- cartel de actualizacion cuando hay una version nueva publicada
- acceso directo con un solo boton `Ingresar`
- cierre de sesion visible dentro de la app

## Regla de persistencia actual

La app ya persiste `agro` en backend con workspace autenticado por tenant.

Hoy los datos operativos principales viven en:

- `GET /api/v1/agro/workspace`
- `PUT /api/v1/agro/workspace`

Dentro de ese workspace quedan guardados:

- establecimientos
- campos
- movimientos de animales
- asientos contables
- lluvias
- sanidad
- tipos de cambio mensuales

La UI actual ya no depende de datos demo fijos y puede arrancar vacia para que el cliente cargue su informacion.

El endpoint `workspace/public` queda como compatibilidad operativa del backend, pero ya no es la puerta principal del frontend autenticado.

## Acceso operativo actual

Hoy el ingreso visible del cliente funciona asi:

- boton verde `Rosendo`
- login directo contra backend con la cuenta real `Rosendo`
- boton `Demo`
- login directo contra backend con un usuario demo real separado del cliente
- boton visible de `Cerrar sesion` dentro de la app
- si aparece una nueva version y el cliente acepta `Actualizar`, la app vuelve al login y obliga reingreso

## Carga inicial actual

La carga inicial hoy permite:

- crear campo con `Nombre` y `Hectareas`
- cargar stock inicial de animales por especie y categoria
- arrancar desde workspace vacio real si el cliente no tiene nada sembrado
- exigir `Hectareas` al crear campo
- marcar el input en rojo si falta ese dato
- mostrar aviso visible cuando intentan guardar sin hectareas

Ya no forma parte de esta pantalla:

- saldo inicial
- fecha de corte
- localidad del campo

## Lo que hoy ya esta alineado

- lectura por `campo` como unidad principal
- `Animales` y `Contabilidad` conectados en ventas
- `Inicio`, `Lluvia`, `Sanidad` y `Resumen` como vistas visibles y utilizables
- estado comercial real de cobros dentro de contabilidad
- hectareas visibles dentro de los resumenes por campo
- hectareas obligatorias en el alta de campo

## Siguiente paso recomendado

No abrir complejidad nueva sin devolucion del cliente.

El camino sugerido es:

1. seguir afinando lenguaje y lectura
2. confirmar si el cliente necesita mas filtros o resumenes
3. endurecer solo los bloques que el uso confirme
