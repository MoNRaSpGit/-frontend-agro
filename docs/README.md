# Agro Docs

Fecha de actualizacion: 2026-05-22

## Objetivo

Esta carpeta documenta el producto `agro` del lado frontend.

Su funcion es dejar claro:

- como se interpreta hoy el producto
- cual es el estado visible actual de la UI
- como se trabaja el flujo funcional del modulo
- que feedback real ya llego del cliente
- que cambios finos se fueron haciendo en el frontend

## Alcance

`frontend-agro/docs` documenta:

- comportamiento real del frontend `agro`
- estructura funcional visible
- lenguaje operativo del modulo
- persistencia actual del producto
- feedback funcional del cliente
- bitacora operativa del frontend

No documenta:

- arquitectura general del SaaS
- reglas globales de auth, tenant, billing o core
- metodo global de trabajo del SaaS

Eso vive en `backend/docs`.

## Orden recomendado de lectura

1. [Estado actual del frontend](./product/current-state.md)
2. [Contexto funcional del producto](./product/product-context.md)
3. [Feedback cliente 2026-05-07](./product/client-feedback-2026-05-07.md)
4. [Bitacora del modulo](./operations/bitacora.md)

## Estructura de esta carpeta

### `product/`

Define el producto y su corte actual:

- estado visible del frontend
- contexto funcional
- feedback real del cliente

### `operations/`

Guarda el seguimiento fino del modulo:

- que se cambio
- que se valido
- donde quedamos

## Regla de lectura

Si hay contradiccion entre una nota vieja y esta carpeta:

- manda esta carpeta

Si hay contradiccion entre una regla global del SaaS y este modulo:

- manda `backend/docs`

## Regla importante de este corte

Hoy `agro` entra con acceso directo del cliente real y con una puerta demo separada para pruebas controladas.

La persistencia principal del modulo vive en backend mediante el workspace publico.

La prioridad actual no es bajar mas infraestructura, sino:

- validar flujo real con cliente
- afinar lenguaje y lectura operativa
- endurecer solo lo que el uso confirme
