# GestionAr — App (Frontend)

## Descripción

PWA multi-tenant para la gestión de organizaciones (consorcios, gimnasios, colegios, clubes). Propietarios/socios pagan cuotas, consultan avisos y crean reclamos. El admin gestiona miembros, pagos, avisos, reclamos y configuración de la organización.

## Stack

- **Frontend**: PWA vanilla — HTML + CSS + JS (ES modules, sin frameworks ni bundler)
- **Backend**: API REST en Railway → `https://consorcio-api-production.up.railway.app/api`
- **Auth**: JWT en `localStorage` (recordarme) o `sessionStorage` (sesión) bajo la clave `consorcio_token`
- **Push**: Firebase FCM (firebase-app-compat + firebase-messaging-compat v10.12.2)
- **Excel**: SheetJS (xlsx-0.20.3) para exportar reportes desde el dashboard
- **Tests**: Jest + jsdom (`npm test` en raíz del proyecto)
- **Íconos PWA**: `icons/icon-192.png`, `icons/icon-512.png` (logo GestionAr)

## Estructura de archivos

```
consorcio-app/
├── index.html               # Shell HTML — todas las pantallas declaradas como <div class="page">
├── app.js                   # Entry point ES module: importa todos los módulos y registra renderers
├── api.js                   # Cliente HTTP — todos los llamados a la API REST
├── utils.js                 # Utilidades puras (getRecentMonths, formatPeriodLabel)
├── styles.css               # Estilos globales
├── sw.js                    # Service Worker — caché offline de assets estáticos
├── firebase-messaging-sw.js # Service Worker de Firebase para push en background
├── manifest.json            # Web App Manifest (PWA)
├── package.json             # Solo para tests (Jest)
├── icons/                   # Íconos PWA (192×192, 512×512, svg, logogestionar.png)
├── js/
│   ├── core/
│   │   ├── state.js         # Estado global (state, setState) y cache liviano (cache)
│   │   ├── router.js        # showPage(), PAGE_RENDERERS
│   │   └── apiWrapper.js    # apiCall() — loading overlay + manejo de errores
│   ├── ui/
│   │   ├── toast.js         # toast(msg, type)
│   │   ├── modal.js         # openModal(html) / closeModal()
│   │   ├── loading.js       # showLoading(bool), showSessionRestoreError()
│   │   ├── skeleton.js      # skeleton(lines) — shimmer loader
│   │   ├── offline.js       # updateOnlineStatus()
│   │   ├── pwa.js           # showInstallBanner(), isStandalone()
│   │   ├── icons.js         # Objeto SVG con iconos inline
│   │   ├── helpers.js       # Utilidades UI compartidas
│   │   └── onboarding.js    # Hints de primera visita (guardados en localStorage)
│   ├── services/
│   │   ├── authService.js   # Login, logout, enterApp, restore sesión, forgot/reset password
│   │   ├── pushService.js   # setupPushNotifications(), checkMonthlyReminder()
│   │   ├── mercadopagoService.js # Flujo Checkout Pro
│   │   ├── paymentsService.js   # Lógica de pagos del owner
│   │   └── configService.js     # renderAdminSettings()
│   └── pages/
│       ├── admin/
│       │   ├── home.js      # renderAdminHome()
│       │   ├── dashboard.js # renderAdminDashboard()
│       │   ├── owners.js    # renderOwnersList()
│       │   ├── notices.js   # renderAdminNotices()
│       │   ├── claims.js    # renderAdminClaims()
│       │   ├── expenses.js  # renderAdminExpenses()
│       │   ├── providers.js # renderAdminProviders()
│       │   ├── report.js    # renderAdminReport()
│       │   └── votes.js     # renderAdminVotes()
│       └── owner/
│           ├── home.js      # renderOwnerHome()
│           ├── pay.js       # renderUploadPage()
│           ├── history.js   # renderOwnerHistory()
│           ├── notices.js   # renderOwnerNotices()
│           ├── claims.js    # renderOwnerClaims()
│           ├── expenses.js  # renderOwnerExpenses()
│           ├── votes.js     # renderOwnerVotes()
│           └── profile.js   # renderOwnerProfile()
└── tests/
    ├── globals.js           # Mocks globales para Jest
    ├── setup/               # Configuración de entorno de test
    ├── dom/                 # Tests de interacciones DOM
    ├── utils/               # Tests de utilidades puras
    ├── filePreview.test.js
    ├── submitReceipt.test.js
    └── utils.test.js
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
| `page-owner-expenses` | Ver gastos compartidos de la organización (solo lectura) |
| `page-owner-votes` | Participar en votaciones abiertas |
| `page-owner-profile` | Editar nombre, email y cambiar contraseña |

### Admin
| id | Contenido |
|----|-----------|
| `page-admin-home` | Resumen: propietarios al día / deudores, pagos pendientes, avisos recientes |
| `page-admin-dashboard` | Gráfico de recaudación mensual (filtrable por año), stats, exportar Excel |
| `page-admin-owners` | CRUD de propietarios con paginación (10/pág), filtro por nombre y lote, carga masiva Excel |
| `page-admin-notices` | CRUD de avisos (info / warning / urgent) con push opcional |
| `page-admin-claims` | Ver todos los reclamos, cambiar estado (open/in_progress/resolved), agregar nota |
| `page-admin-expenses` | Registro de gastos por categoría/proveedor, marcar como pagado, filtrar y exportar |
| `page-admin-providers` | ABM de proveedores de servicio (limpieza, seguridad, mantenimiento, etc.) |
| `page-admin-report` | Resumen financiero mensual (ingresos, egresos por categoría, saldo) |
| `page-admin-settings` | Configuración: monto, período, recargo, datos de contacto, credenciales MercadoPago |
| `page-admin-votes` | Crear y gestionar votaciones, cerrarlas y ver resultados |

## Estado global (js/core/state.js)

```js
export const state = { role: null, user: null };
export function setState(updates) { Object.assign(state, updates); }
```

## Cache liviano (js/core/state.js)

```js
cache.set(key, val, ttlMs = 30000)
cache.get(key)   // null si expiró
cache.del(key)
cache.clear()
```
TTL por defecto: 30 s. Evita requests redundantes en navegación frecuente.

## Funciones y módulos clave

| Función / Módulo | Ubicación | Descripción |
|-----------------|-----------|-------------|
| `showPage(id)` | `js/core/router.js` | Routing: activa el div `.page` correspondiente y marca el nav-item |
| `apiCall(fn, opts)` | `js/core/apiWrapper.js` | Wrapper: muestra loading overlay, captura errores con toast |
| `toast(msg, type)` | `js/ui/toast.js` | Notificación flotante — tipos: `success`, `error`, `warning`, `default` |
| `showLoading(bool)` | `js/ui/loading.js` | Activa / desactiva overlay de carga |
| `skeleton(lines)` | `js/ui/skeleton.js` | Genera HTML de skeleton loader con clase `.skeleton` (CSS shimmer) |
| `openModal(html)` / `closeModal()` | `js/ui/modal.js` | Modal genérico |
| `enterApp()` | `js/services/authService.js` | Post-login: configura nav, top bar y renderiza la vista según rol |
| `logout()` | `js/services/authService.js` | Limpia token, cache y estado; vuelve al login |
| `setupPushNotifications()` | `js/services/pushService.js` | Inicializa FCM y registra/actualiza fcmToken del owner |
| `checkMonthlyReminder()` | `js/services/pushService.js` | Muestra recordatorio si hay expensa pendiente del período actual |
| `PAGE_RENDERERS` | `js/core/router.js` | Mapa `pageId → renderFn`, poblado en `app.js` |

## Autenticación — recordarme

- `remember = true` (por defecto) → token en `localStorage`
- `remember = false` → token en `sessionStorage` (se borra al cerrar pestaña)
- `getToken()` busca en localStorage primero, luego sessionStorage

## Owners view — paginación y filtros (js/pages/admin/owners.js)

```js
const ownersListState = { all: [], page: 1, perPage: 10, filterName: '', filterUnit: '' };
```

- Carga hasta 500 propietarios una vez (`renderOwnersList`)
- Filtra en memoria por nombre o lote con highlight en resultados
- Paginación smart con `_buildPagination()` / `_pageRange()`
- Restaura foco y cursor position en inputs de filtro tras rerender

## API client (api.js)

`window.api` expone:

```js
api.auth.login(email, password, fcmToken?)
api.auth.getMe()
api.auth.register(data)
api.auth.updatePassword(currentPassword, newPassword)
api.auth.updateFcmToken(fcmToken)
api.auth.forgotPassword(email)
api.auth.resetPassword(token, newPassword)

api.owners.getAll(params?)
api.owners.getOne(id)
api.owners.getStats()
api.owners.create(data)
api.owners.update(id, data)
api.owners.delete(id)
api.owners.notify(id, title, body)
api.owners.bulkCreate(formData)        // FormData con archivo .xlsx
api.owners.downloadTemplate()          // URL para descargar plantilla Excel

api.payments.getAll(params?)
api.payments.getOne(id)
api.payments.create(formData)    // FormData con archivo receipt (PDF/JPG/PNG/WebP/HEIC)
api.payments.approve(id)
api.payments.reject(id, rejectionNote)
api.payments.delete(id)
api.payments.getDashboard(year?)
api.payments.getReceiptUrl(id)
api.payments.sendReminders()

api.notices.getAll(params?)
api.notices.getOne(id)
api.notices.create(data)
api.notices.update(id, data)
api.notices.delete(id)

api.claims.getAll(params?)
api.claims.create(data)
api.claims.updateStatus(id, status, adminNote?)
api.claims.delete(id)

api.expenses.getSummary(month)         // month: 'YYYY-MM' — accesible a owner y admin
api.expenses.getAll(params?)
api.expenses.create(data)              // FormData con archivo receipt opcional
api.expenses.update(id, data)
api.expenses.markAsPaid(id, data?)
api.expenses.delete(id)

api.providers.getAll(params?)
api.providers.create(data)
api.providers.update(id, data)
api.providers.delete(id)

api.reports.getMonthlySummary(month)  // month: 'YYYY-MM'

api.config.get()
api.config.update(data)

api.mercadopago.createPreference()
api.mercadopago.getPaymentStatus(mpPaymentId)

api.organizations.getTemplates()
api.organizations.create(data)

api.votes.getAll(params?)
api.votes.getOne(id)
api.votes.create(data)                 // {title, description, options[], endsAt?}
api.votes.update(id, data)
api.votes.close(id)
api.votes.cast(id, optionIndex)        // owner vota
api.votes.results(id)                  // admin ve resultados
api.votes.delete(id)
```

## SVG Icons (js/ui/icons.js)

Objeto global `SVG` con iconos inline: `home`, `users`, `bell`, `settings`, `upload`, `list`, `check`, `x`, `logout`, `download`, `claim`, `pdf`.

## Tests

```bash
npm test          # ejecutar tests con Jest
npm run test:watch
```

Tests ubicados en `tests/`. Usan Jest + jsdom. `tests/globals.js` configura los mocks globales de `window.api`, `window.toast`, etc.

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
- El HTML de las páginas se genera dinámicamente con template strings en los módulos de `js/pages/`.
- Evitar agregar dependencias externas; usar solo las ya incluidas (Firebase, SheetJS).
- Siempre pasar llamadas a la API por `apiCall()` para el manejo uniforme de loading y errores.
- Usar clase `.skeleton` (no estilos inline) para animaciones shimmer.
- Usar clase `.loading-spinner` (no estilos inline) para spinner de carga.
- Después de cada cambio terminado, hacer commit y push.

## MCPs disponibles

| Servidor | Uso |
|----------|-----|
| **MercadoPago** | Documentación y sugerencias de integración MP (`https://mcp.mercadopago.com/mcp`) |
