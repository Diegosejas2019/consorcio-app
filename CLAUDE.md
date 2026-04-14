# GestionAr — App (Frontend)

## Descripción

PWA multi-tenant para la gestión de organizaciones (consorcios, gimnasios, colegios, clubes). Propietarios/socios pagan cuotas, consultan avisos y crean reclamos. El admin gestiona miembros, pagos, avisos, reclamos y configuración de la organización.

## Stack

- **Frontend**: PWA vanilla — HTML + CSS + JS sin frameworks ni bundler
- **Backend**: API REST en Railway → `https://consorcio-api-production.up.railway.app/api`
- **Auth**: JWT en `localStorage` bajo la clave `consorcio_token`
- **Push**: Firebase FCM (firebase-app-compat + firebase-messaging-compat v10.12.2)
- **Excel**: SheetJS (xlsx-0.20.3) para exportar reportes desde el dashboard
- **Íconos PWA**: `icons/icon-192.png`, `icons/icon-512.png` (logo GestionAr)

## Estructura de archivos

```
consorcio-app/
├── index.html               # Shell HTML — todas las pantallas declaradas como <div class="page">
├── app.js                   # Lógica completa: routing, render, eventos UI (~1800 líneas)
├── api.js                   # Cliente HTTP — todos los llamados a la API REST
├── utils.js                 # Utilidades puras (getRecentMonths, formatPeriodLabel)
├── styles.css               # Estilos globales
├── sw.js                    # Service Worker — caché offline de assets estáticos
├── firebase-messaging-sw.js # Service Worker de Firebase para push en background
├── manifest.json            # Web App Manifest (PWA)
└── icons/                   # Íconos PWA (192×192, 512×512, svg, logogestionar.png)
```

## Páginas (divs .page en index.html)

### Owner
| id | Contenido |
|----|-----------|
| `page-owner-home` | Resumen: balance, estado de pago del período, último pago, avisos recientes |
| `page-owner-pay` | Subir comprobante (PDF/imagen) o pagar con MercadoPago (Checkout Pro) |
| `page-owner-history` | Historial de pagos con descarga de comprobante |
| `page-owner-notices` | Lista de avisos del consorcio/organización |
| `page-owner-claims` | Crear y ver estado de reclamos propios |

### Admin
| id | Contenido |
|----|-----------|
| `page-admin-home` | Resumen: propietarios al día / deudores, pagos pendientes, avisos recientes |
| `page-admin-dashboard` | Gráfico de recaudación mensual (filtrable por año), stats, exportar Excel |
| `page-admin-owners` | CRUD de propietarios con paginación (10/pág), filtro por nombre y lote |
| `page-admin-notices` | CRUD de avisos (info / warning / urgent) con push opcional |
| `page-admin-claims` | Ver todos los reclamos, cambiar estado (open/in_progress/resolved), agregar nota |
| `page-admin-settings` | Configuración: monto, período, recargo, datos de contacto, credenciales MercadoPago |

## Estado global

```js
let state = { role: null, user: null }; // se pobla en login / restore de sesión
```

## Funciones clave de app.js

| Función | Descripción |
|---------|-------------|
| `showPage(id)` | Routing: activa el div `.page` correspondiente y marca el nav-item |
| `apiCall(fn, opts)` | Wrapper: muestra loading overlay, captura errores con toast |
| `toast(msg, type)` | Notificación flotante — tipos: `success`, `error`, `default` |
| `showLoading(bool)` | Activa / desactiva overlay de carga |
| `skeleton(lines)` | Genera HTML de skeleton loader con clase `.skeleton` (CSS shimmer) |
| `openModal(html)` / `closeModal()` | Modal genérico |
| `enterApp()` | Post-login: configura nav, top bar y renderiza la vista según rol |
| `logout()` | Limpia token, cache y estado; vuelve al login |
| `setupPushNotifications()` | Inicializa FCM y registra/actualiza fcmToken del owner |
| `checkMonthlyReminder()` | Muestra recordatorio si hay expensa pendiente del período actual |
| `debounce(fn, ms)` | Utilidad de debounce (350 ms por defecto) para filtros |

## Owners view — paginación y filtros

```js
const ownersListState = { all: [], page: 1, perPage: 10, filterName: '', filterUnit: '' };
const _debouncedOwnerFilter = debounce(() => { ownersListState.page = 1; _renderOwnersView(); }, 350);
```

- Carga hasta 500 propietarios una vez (`renderOwnersList`)
- Filtra en memoria por nombre o lote con highlight en resultados
- Paginación smart con `_buildPagination()` / `_pageRange()`
- Restaura foco y cursor position en inputs de filtro tras rerender

## Cache liviano

```js
cache.set(key, val, ttlMs = 30000)
cache.get(key)   // null si expiró
cache.del(key)
cache.clear()
```
TTL por defecto: 30 s. Evita requests redundantes en navegación frecuente.

## API client (api.js)

`window.api` expone:

```js
api.auth.login(email, password, fcmToken?)
api.auth.getMe()
api.auth.register(data)
api.auth.updatePassword(currentPassword, newPassword)
api.auth.updateFcmToken(fcmToken)

api.owners.getAll(params?)
api.owners.getOne(id)
api.owners.getStats()
api.owners.create(data)
api.owners.update(id, data)
api.owners.delete(id)

api.payments.getAll(params?)
api.payments.create(formData)    // FormData con archivo receipt (PDF/JPG/PNG/WebP/HEIC)
api.payments.approve(id)
api.payments.reject(id, rejectionNote)
api.payments.getDashboard(year?)
api.payments.getReceiptUrl(id)

api.notices.getAll(params?)
api.notices.create(data)
api.notices.update(id, data)
api.notices.delete(id)

api.claims.getAll(params?)
api.claims.create(data)
api.claims.updateStatus(id, status, adminNote?)
api.claims.delete(id)

api.config.get()
api.config.update(data)

api.mercadopago.createPreference()
api.mercadopago.getPaymentStatus(mpPaymentId)
```

## SVG Icons

Objeto global `SVG` con iconos inline: `home`, `users`, `bell`, `settings`, `upload`, `list`, `check`, `x`, `logout`, `download`, `claim`, `pdf`.

## PWA

- Install banner aparece 4 s después del login si la app no está instalada como standalone.
- Dismiss guarda timestamp en `localStorage` (`install_dismissed_until`) por 7 días.
- `isStandalone()` detecta modo instalado vía `matchMedia('(display-mode: standalone)')`.
- Íconos: logo oficial GestionAr (192×192 y 512×512).

## Push Notifications (FCM)

- `firebase-messaging-sw.js` maneja notificaciones en **background**.
- Al login del owner se solicita permiso y se registra el token con `api.auth.updateFcmToken`.
- Los mensajes son **data-only** (sin campo `notification`); el SW los procesa manualmente.
- Icono: `/icons/icon-192.png` (logo GestionAr); badge: mismo ícono para Android.

## MercadoPago

- Integración **Checkout Pro** (redirect a MP).
- El frontend solicita preferencia al backend → recibe `init_point` → abre en nueva pestaña.
- Las credenciales MP se configuran desde Settings admin (se guardan en DB, nunca en código).
- El botón usa SVG inline para evitar dependencia de imagen externa.

## Credenciales demo

```
Propietario: maria@mail.com / Prop2025!
Admin:       admin@consorcio.com / Admin2025!
```

## Convenciones

- Todo el código es ES2020+ vanilla, sin transpilación.
- El HTML de las páginas se genera dinámicamente con template strings en `app.js`.
- Evitar agregar dependencias externas; usar solo las ya incluidas (Firebase, SheetJS).
- Siempre pasar llamadas a la API por `apiCall()` para el manejo uniforme de loading y errores.
- Usar clase `.skeleton` (no estilos inline) para animaciones shimmer.
- Usar clase `.loading-spinner` (no estilos inline) para spinner de carga.
- Después de cada cambio terminado, hacer commit y push.

## MCPs disponibles

| Servidor | Uso |
|----------|-----|
| **MercadoPago** | Documentación y sugerencias de integración MP (`https://mcp.mercadopago.com/mcp`) |
