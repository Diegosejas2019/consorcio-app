# ConsorcioPro — CLAUDE.md

## Descripción del proyecto

**ConsorcioPro** es una PWA (Progressive Web App) para la administración de un barrio privado/consorcio. Permite a propietarios pagar expensas y ver avisos, y a administradores gestionar propietarios, pagos, avisos y configuración.

## Arquitectura

- **Frontend**: PWA vanilla (HTML + CSS + JS sin frameworks). Archivos: `index.html`, `styles.css`, `app.js`, `api.js`, `sw.js`, `manifest.json`.
- **Backend**: API REST en Railway → `https://consorcio-api-production.up.railway.app/api`
- **Autenticación**: JWT almacenado en `localStorage` bajo la clave `consorcio_token`.

## Estructura de archivos

```
consorcio-app/
├── index.html       # Shell HTML con todas las pantallas (login + páginas owner/admin)
├── app.js           # Lógica de la app: routing, render de páginas, eventos UI
├── api.js           # Cliente HTTP — todos los llamados a la API REST
├── styles.css       # Estilos globales
├── sw.js            # Service Worker (caché PWA)
├── manifest.json    # Web App Manifest
└── icons/           # Íconos PWA (192x192, 512x512)
```

## Roles de usuario

- **owner** (Propietario): ve su estado de cuenta, sube comprobantes de pago, consulta historial, lee avisos.
- **admin** (Administrador): gestiona propietarios, aprueba/rechaza pagos, publica avisos, configura el consorcio.

## Convenciones del código

- JavaScript vanilla, sin bundler ni transpilación.
- El estado global vive en `let state = { role, user }`.
- Cache liviano en memoria (`cache.set/get/del/clear`) con TTL de 30s para evitar requests redundantes.
- Llamadas a la API siempre a través del wrapper `apiCall(fn, opts)` que maneja loading overlay y errores con toast.
- Toast notifications con `toast(msg, type)` — tipos: `success`, `error`, `default`.
- Navegación entre páginas con `showPage(id)` donde `id` es el id del div `.page`.

## Endpoints principales de la API

| Recurso        | Base path           |
|----------------|---------------------|
| Auth           | `/auth`             |
| Propietarios   | `/owners`           |
| Pagos          | `/payments`         |
| Avisos         | `/notices`          |
| Configuración  | `/config`           |
| MercadoPago    | `/mercadopago`      |

## Notas importantes

- Los pagos se suben como `FormData` (incluyen archivo de comprobante).
- Push notifications via Firebase FCM: el `fcmToken` se envía al login y se actualiza con `api.auth.updateFcmToken`.
- El Service Worker (`sw.js`) maneja caché offline de assets estáticos.
- Credenciales demo: propietario `maria@mail.com / Prop2025!`, admin `admin@consorcio.com / Admin2025!`.
