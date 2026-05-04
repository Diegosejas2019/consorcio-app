# GestionAr — App (Frontend)

## Descripción

PWA multi-tenant para la gestión de organizaciones (consorcios, gimnasios, colegios, clubes). Propietarios/socios pagan cuotas, consultan avisos y crean reclamos. El admin gestiona miembros, pagos, avisos, reclamos y configuración de la organización.

## Stack

- **Frontend**: PWA vanilla — HTML + CSS + JS (ES modules, sin frameworks ni bundler)
- **Backend**: API REST en Railway → `https://consorcio-api-production.up.railway.app/api`
- **Auth**: JWT en `localStorage` (recordarme) o `sessionStorage` (sesión) bajo la clave `consorcio_token`
- **Offline**: IndexedDB (`gestionar-db`) para caché de GETs + cola de mutaciones offline
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
│   │   ├── authService.js       # Login, logout, enterApp, restore sesión, forgot/reset password
│   │   ├── pushService.js       # setupPushNotifications(), checkMonthlyReminder()
│   │   ├── mercadopagoService.js # Flujo Checkout Pro
│   │   ├── paymentsService.js   # Lógica de pagos del owner
│   │   ├── configService.js     # renderAdminSettings()
│   │   ├── featureService.js    # isFeatureEnabled(key) — feature flags por org
│   │   ├── indexedDbService.js  # idbService: caché offline en IndexedDB
│   │   └── offlineQueue.js      # offlineQueue: cola de mutaciones offline
│   └── pages/
│       ├── admin/
│       │   ├── home.js          # renderAdminHome()
│       │   ├── dashboard.js     # renderAdminDashboard()
│       │   ├── owners.js        # renderOwnersList()
│       │   ├── notices.js       # renderAdminNotices()
│       │   ├── claims.js        # renderAdminClaims()
│       │   ├── expenses.js      # renderAdminExpenses()
│       │   ├── providers.js     # renderAdminProviders()
│       │   ├── report.js        # renderAdminReport()
│       │   ├── votes.js         # renderAdminVotes()
│       │   ├── visits.js        # renderAdminVisits()
│       │   ├── spaces.js        # renderAdminSpaces()
│       │   └── reservations.js  # renderAdminReservations()
│       └── owner/
│           ├── home.js          # renderOwnerHome()
│           ├── pay.js           # renderUploadPage()
│           ├── history.js       # renderOwnerHistory()
│           ├── notices.js       # renderOwnerNotices()
│           ├── claims.js        # renderOwnerClaims()
│           ├── expenses.js      # renderOwnerExpenses()
│           ├── votes.js         # renderOwnerVotes()
│           ├── profile.js       # renderOwnerProfile()
│           ├── visits.js        # renderOwnerVisits()
│           ├── reservations.js  # renderOwnerReservations()
│           └── pago-resultado.js # renderPagoResultado() — resultado del pago MP
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
| `page-owner-visits` | Registrar visitantes autorizados para ingreso al complejo |
| `page-owner-reservations` | Reservar espacios comunes disponibles |
| `page-owner-pago-resultado` | Resultado del pago tras redirect de MercadoPago |

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
| `page-admin-settings` | Configuración: monto, período, recargo, datos de contacto, credenciales MercadoPago, features |
| `page-admin-votes` | Crear y gestionar votaciones, cerrarlas y ver resultados |
| `page-admin-visits` | Ver y gestionar todas las visitas registradas (aprobar, rechazar, marcar estado) |
| `page-admin-spaces` | ABM de espacios comunes reservables (nombre, capacidad, requiere aprobación) |
| `page-admin-reservations` | Ver y gestionar todas las reservas de espacios (aprobar, rechazar) |

## Estado global (js/core/state.js)

```js
export const state = { role: null, user: null, features: {} };
export function setState(updates) { Object.assign(state, updates); }
```

`state.features` es un objeto `{ [featureKey]: boolean }` cargado desde `GET /api/organizations/:id/features`. Controla qué módulos están visibles en la navegación.

## Cache liviano (js/core/state.js)

```js
cache.set(key, val, ttlMs = 30000)
cache.get(key)   // null si expiró
cache.del(key)
cache.clear()
```
TTL por defecto: 30 s. Evita requests redundantes en navegación frecuente.

## Offline (IndexedDB + cola de mutaciones)

**`indexedDbService`** (`js/services/indexedDbService.js`): wrapper sobre IndexedDB (`gestionar-db`).
- Object stores: `cache` (GETs cacheados), `offlineQueue` (mutaciones pendientes), `metadata`.
- API: `idbService.get(store, key)`, `idbService.set(store, key, value)`, `idbService.getAll(store)`, `idbService.del(store, key)`, `idbService.clear(store)`.
- Expuesto en `window.idbService`.

**`offlineQueue`** (`js/services/offlineQueue.js`): encola mutaciones (POST/PATCH/DELETE) cuando no hay conexión. Al recuperar conexión, las procesa en orden.
- Expuesto en `window.offlineQueue`.

Comportamiento de `api.js`:
- **Sin conexión + GET**: intenta IDB cache; si no hay, lanza error.
- **Sin conexión + mutación con FormData**: lanza error (requiere internet).
- **Sin conexión + mutación JSON**: encola en offlineQueue, retorna `{ success: true, offline: true }`.
- **Con conexión + GET exitoso**: guarda respuesta en IDB (fire-and-forget).

## Feature flags (js/services/featureService.js)

```js
import { isFeatureEnabled } from './featureService.js';
isFeatureEnabled('visits')       // true si habilitado (default true si no configurado)
```

Feature keys disponibles: `visits`, `reservations`, `votes`, `expenses`, `providers`.
Mapa `PAGE_FEATURE_MAP` vincula cada pageId a su feature key; el router oculta la entrada de nav si la feature está deshabilitada.

## Funciones y módulos clave

| Función / Módulo | Ubicación | Descripción |
|-----------------|-----------|-------------|
| `showPage(id)` | `js/core/router.js` | Routing: activa el div `.page` correspondiente y marca el nav-item |
| `apiCall(fn, opts)` | `js/core/apiWrapper.js` | Wrapper: muestra loading overlay, captura errores con toast |
| `toast(msg, type)` | `js/ui/toast.js` | Notificación flotante — tipos: `success`, `error`, `warning`, `default` |
| `showLoading(bool)` | `js/ui/loading.js` | Activa / desactiva overlay de carga |
| `skeleton(lines)` | `js/ui/skeleton.js` | Genera HTML de skeleton loader con clase `.skeleton` (CSS shimmer) |
| `openModal(html)` / `closeModal()` | `js/ui/modal.js` | Modal genérico |
| `enterApp()` | `js/services/authService.js` | Post-login: carga features, configura nav, top bar y renderiza la vista según rol |
| `logout()` | `js/services/authService.js` | Limpia token, cache y estado; vuelve al login |
| `setupPushNotifications()` | `js/services/pushService.js` | Inicializa FCM y registra/actualiza fcmToken del owner |
| `checkMonthlyReminder()` | `js/services/pushService.js` | Muestra recordatorio si hay expensa pendiente del período actual |
| `isFeatureEnabled(key)` | `js/services/featureService.js` | Retorna si una feature está habilitada para la org actual |
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
api.notices.markRead(id)
api.notices.markUnread(id)

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
api.expenses.getAttachmentUrl(id, index)
api.expenses.deleteAttachment(id, index)

api.providers.getAll(params?)
api.providers.create(data)
api.providers.update(id, data)
api.providers.delete(id)
api.providers.getDocumentUrl(id, index)
api.providers.deleteDocument(id, index)

api.reports.getMonthlySummary(month)   // month: 'YYYY-MM'
api.reports.downloadExpensasPdf(month) // retorna Blob del PDF

api.config.get()
api.config.update(data)

api.mercadopago.createPreference(periods?)  // periods: array de 'YYYY-MM' opcionales
api.mercadopago.getPaymentStatus(mpPaymentId)

api.organizations.getTemplates()
api.organizations.create(data)
api.organizations.getFeatures(orgId)
api.organizations.updateFeatures(orgId, features)   // features: { [key]: boolean }

api.units.getAll(params?)
api.units.create(data)
api.units.update(id, data)
api.units.delete(id)

api.visits.getAll(params?)
api.visits.getMy()
api.visits.create(data)               // { name, type, expectedDate, note? }
api.visits.updateStatus(id, status)   // admin: approved | rejected | inside | exited
api.visits.delete(id)

api.spaces.getAll()
api.spaces.create(data)               // admin: { name, description?, capacity?, requiresApproval? }
api.spaces.update(id, data)
api.spaces.delete(id)

api.reservations.getAll(params?)
api.reservations.getMine()
api.reservations.create(data)         // { space, date, startTime, endTime, note? }
api.reservations.updateStatus(id, status)  // admin: approved | rejected | cancelled
api.reservations.delete(id)

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
- `setupPushNotifications()` solo se llama para owners; los admins no reciben push.

**Proyecto Firebase:** `consorcio-app-15e78`. SDK Web v10.12.2 (compat). La config está hardcodeada en `pushService.js` y en `firebase-messaging-sw.js` — ambos deben tener los mismos valores. VAPID key: requerida para obtener el token de suscripción web.

**Foreground (`onMessage` en `pushService.js`):**
- Muestra `toast` con `title: body` en la app.
- Si Notification está granted, también muestra `showNotification` via SW (para que sea visible si el usuario está en otra pestaña del mismo origen).
- `requireInteraction: true` cuando `payload.data.type === 'urgent'`.
- `tag` = `payload.data.type || 'consorcio'` (clave de deduplicación del navegador).

**Background (`onBackgroundMessage` en `firebase-messaging-sw.js`):**
- Muestra `showNotification` con los mismos campos (title, body, icon, badge, tag, requireInteraction).
- Click en la notificación → abre/enfoca la ventana de la app en `/`.

**`checkMonthlyReminder()`:**
- Solo corre los primeros 5 días del mes (`today > 5` → no hace nada).
- Requiere `Notification.permission === 'granted'`.
- Consulta `api.config.get()` para obtener `expenseMonthCode` y `dueDayOfMonth`, luego `api.payments.getAll({ month })` para ver si hay pago aprobado.
- Si no hay pago aprobado, muestra una `Notification` nativa y guarda `notif_sent_{userId}_{month}` en `localStorage` para no repetirla en el mismo período.

## MercadoPago

- Integración **Checkout Pro** (redirect a MP).
- El frontend solicita preferencia al backend → recibe `init_point` → abre en nueva pestaña.
- Las credenciales MP se configuran desde Settings admin (se guardan en DB, nunca en código).
- El botón usa SVG inline para evitar dependencia de imagen externa.
- Tras el redirect, `page-owner-pago-resultado` muestra el estado del pago consultando la API.

## Credenciales demo

```
Propietario: maria@mail.com / Prop2025!
Admin:       admin@consorcio.com / Admin2025!
```

## Diseño visual

### Tema
Dark mode con paleta verde bosque. Fondo oscuro (`#0e1512`) + acento verde neón (`#9cf27b`). Glassmorphism en top bar y login box (`backdrop-filter: blur`). Gradiente radial verde sutil en el fondo del body (fijo con `background-attachment: fixed`).

### Variables CSS clave (`styles.css :root`)

| Variable | Valor | Uso |
|----------|-------|-----|
| `--bg` | `#0e1512` | Fondo base de la app |
| `--surface` | `#18221d` | Cards, modales |
| `--surface-2` | `#131b17` | Inputs, fondo de tabs |
| `--surface-3` | `#18221d` | Botón secundario, tab activo |
| `--border` | `rgba(255,255,255,0.08)` | Bordes sutiles |
| `--border-md` | `rgba(255,255,255,0.14)` | Bordes con más peso |
| `--accent` | `#9cf27b` | Verde neón — botón primario, focus, dot del brand |
| `--accent-2` | `#7dd65e` | Hover del acento |
| `--accent-lt` | `rgba(156,242,123,0.12)` | Fondo tenue del acento |
| `--success` | `#22C55E` | Estado aprobado/exitoso |
| `--warning` | `#FBBF24` | Estado pendiente/advertencia |
| `--danger` | `#F87171` | Estado rechazado/error |
| `--text` | `#a8b3ac` | Texto normal |
| `--text-bright` | `#eef1ed` | Títulos y valores destacados |
| `--muted` | `#6b7870` | Labels de formulario, subtextos |
| `--radius` | `14px` | Radio de cards |
| `--font` | `'Inter'` | Tipografía base |
| `--font-display` | `'Inter Tight'` | Headings y valores grandes |

### Tipografía
- `h1`: 1.75rem / 700 / letter-spacing −0.04em / `var(--text-bright)`
- `h2`: 1.25rem / 700 / letter-spacing −0.02em / `var(--text-bright)`
- `h3`: 1rem / 600 / `var(--text-bright)`
- `small`: 0.8rem / `var(--muted)`
- Labels de formulario (`.form-group label`): 0.82rem / 700 / `var(--muted)` / uppercase

### Componentes CSS

**Botones**
- `.btn-primary` — fondo `--accent` (verde neón), texto `#0a1209`, sombra verde. Hover: sube 1px + glow.
- `.btn-secondary` — fondo `--surface-3`, borde `--border-md`. Hover: oscurece.
- `.btn-ghost` — transparente, color `--accent`, borde 1.5px semitransparente.
- `.btn-danger` — fondo `--danger-lt`, borde rojo semitransparente.
- `.btn-success` — fondo `--success-lt`, borde verde semitransparente.
- `.btn-sm` — padding reducido, border-radius 7px.
- `.btn-icon` — cuadrado pequeño, fondo `--surface-3`, color `--muted`.

**Cards**
- `.card` — fondo `--surface`, border `--border`, radius 14px, `backdrop-filter: blur(8px)`.
- `.card-header` — padding 1.1rem 1.5rem, borde inferior.
- `.card-body` — padding 1.35rem 1.5rem.
- `.stat-card` — layout column con `.stat-label` (uppercase tiny), `.stat-value` (2rem bold), `.stat-sub`.
- `.stat-card-clickable` — hover: sube 2px + border + sombra; línea de acento en el top al hover.

**Badges**
- `.badge` — pill (border-radius 999px), 0.72rem, bold, letra-spacing 0.02em.
- `.badge-success/warning/danger/neutral` — fondo y color semántico.

**Inputs / Formularios**
- `.input`, `.select`, `textarea` — border 1.5px `--border-md`, radius 9px, fondo `--surface-2`.
- Focus: borde `--accent` + glow `rgba(156,242,123,0.12)`.
- `.form-group` — flex column con gap 0.45rem, label uppercase pequeño en `--muted`.

**Utilidades**
`.hidden`, `.flex`, `.col`, `.gap-1/2/3`, `.center`, `.between`, `.w-full`, `.mt-1/2/3`, `.text-sm`, `.text-muted`, `.bold`

### Shell de la app
- **Top bar**: sticky, glassmorphism. Brand con punto verde pulsante (`.dot` con glow). Altura 58px.
- **Login box**: glassmorphism (`backdrop-filter: blur(20px)`), radius 22px, borde sutil con toque verde.
- **Skeleton loaders**: clase `.skeleton` con animación shimmer CSS.
- **Loading spinner**: clase `.loading-spinner` (no estilos inline).

## Convenciones

- Todo el código es ES2020+ vanilla, sin transpilación.
- El HTML de las páginas se genera dinámicamente con template strings en los módulos de `js/pages/`.
- Evitar agregar dependencias externas; usar solo las ya incluidas (Firebase, SheetJS).
- Siempre pasar llamadas a la API por `apiCall()` para el manejo uniforme de loading y errores.
- Usar clase `.skeleton` (no estilos inline) para animaciones shimmer.
- Usar clase `.loading-spinner` (no estilos inline) para spinner de carga.
- Después de cada cambio terminado, hacer commit y push.

## Emails automáticos (disparados desde el frontend)

El backend envía emails automáticamente en respuesta a las siguientes acciones del usuario. El frontend no gestiona emails directamente.

| Acción del usuario | Email enviado | Quién lo recibe |
|--------------------|---------------|-----------------|
| Admin crea un propietario (individual o carga masiva) | Bienvenida con contraseña temporal | Propietario creado |
| Usuario solicita recuperar contraseña | Link de reset (válido 10 min) | Usuario solicitante |
| Admin aprueba un pago | Confirmación de pago aprobado | Propietario del pago |
| Admin aprueba un pago (si genera recibo PDF) | Recibo de pago con link de descarga | Propietario del pago |
| Admin rechaza un pago | Notificación de rechazo con motivo | Propietario del pago |
| Admin reenvía recibo (`POST /api/payments/:id/resend-receipt`) | Recibo de pago con link de descarga | Propietario del pago |
| Webhook MercadoPago acredita un pago | Confirmación de pago aprobado | Propietario del pago |
| Admin dispara recordatorios manuales | Recordatorio de vencimiento de expensas | Owners sin pago aprobado del período |
| Cron diario 09:00 UTC (automático) | Recordatorio de vencimiento de expensas | Owners sin pago aprobado del período |

## MCPs disponibles

| Servidor | Uso |
|----------|-----|
| **MercadoPago** | Documentación y sugerencias de integración MP (`https://mcp.mercadopago.com/mcp`) |
