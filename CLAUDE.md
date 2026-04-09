# ConsorcioPro — App (Frontend)

## Descripción

PWA para la administración de consorcios y barrios privados. Propietarios pagan expensas, consultan avisos y crean reclamos. El admin gestiona propietarios, pagos, avisos, reclamos y configuración del consorcio.

## Stack

- **Frontend**: PWA vanilla — HTML + CSS + JS sin frameworks ni bundler
- **Backend**: API REST en Railway → `https://consorcio-api-production.up.railway.app/api`
- **Auth**: JWT en `localStorage` bajo la clave `consorcio_token`
- **Push**: Firebase FCM (firebase-app-compat + firebase-messaging-compat v10.12.2)
- **Excel**: SheetJS (xlsx-0.20.3) para exportar reportes desde el dashboard

## Estructura de archivos

```
consorcio-app/
├── index.html               # Shell HTML — todas las pantallas declaradas como <div class="page">
├── app.js                   # Lógica completa: routing, render, eventos UI (~1750 líneas)
├── api.js                   # Cliente HTTP — todos los llamados a la API REST
├── styles.css               # Estilos globales
├── sw.js                    # Service Worker — caché offline de assets estáticos
├── firebase-messaging-sw.js # Service Worker de Firebase para push en background
├── manifest.json            # Web App Manifest (PWA)
└── icons/                   # Íconos PWA (192×192, 512×512)
```

## Páginas (divs .page en index.html)

### Owner
| id | Contenido |
|----|-----------|
| `page-owner-home` | Resumen de cuenta: balance, estado de pago, último pago, avisos recientes |
| `page-owner-pay` | Subir comprobante de pago (FormData con PDF) o pagar con MercadoPago |
| `page-owner-history` | Historial de pagos con descarga de comprobante PDF |
| `page-owner-notices` | Lista de avisos del consorcio |
| `page-owner-claims` | Crear y ver estado de reclamos propios |

### Admin
| id | Contenido |
|----|-----------|
| `page-admin-home` | Resumen: propietarios al día / deudores, pagos pendientes, avisos recientes |
| `page-admin-dashboard` | Gráfico de recaudación mensual (filtrable por año), stats, exportar Excel |
| `page-admin-owners` | CRUD de propietarios con detalle y últimos pagos |
| `page-admin-notices` | CRUD de avisos (info / warning / urgent) |
| `page-admin-claims` | Ver reclamos de todos los propietarios, cambiar estado, agregar nota |
| `page-admin-settings` | Configuración del consorcio (monto, período, recargo, datos de contacto, MP) |

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
| `skeleton(lines)` | Genera HTML de skeleton loader para estados de carga |
| `openModal(html)` / `closeModal()` | Modal genérico |
| `enterApp()` | Post-login: configura nav, top bar y renderiza la vista según rol |
| `logout()` | Limpia token, cache y estado; vuelve al login |
| `setupPushNotifications()` | Inicializa FCM y registra/actualiza fcmToken del owner |
| `checkMonthlyReminder()` | Muestra recordatorio si hay expensa pendiente del período actual |

## Cache liviano

```js
cache.set(key, val, ttlMs = 30000)
cache.get(key)   // null si expiró
cache.del(key)
cache.clear()
```
Se usa para evitar requests redundantes en navegación frecuente. TTL por defecto: 30 s.

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
api.payments.getOne(id)
api.payments.create(formData)         // FormData con archivo receipt
api.payments.approve(id)
api.payments.reject(id, rejectionNote)
api.payments.delete(id)
api.payments.getDashboard(year?)
api.payments.getReceiptUrl(id)        // URL directa para proxy de descarga

api.notices.getAll(params?)
api.notices.getOne(id)
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
- Dismiss guarda timestamp en `localStorage` (`install_dismissed_until`) para no volver a mostrar por 7 días.
- `isStandalone()` detecta modo instalado vía `matchMedia('(display-mode: standalone)')`.

## Push Notifications (FCM)

- `firebase-messaging-sw.js` maneja notificaciones en background.
- Al login del owner, se solicita permiso y se registra el token con `api.auth.updateFcmToken`.
- Los mensajes son data-only (sin campo `notification`); el SW los procesa manualmente.

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
- Después de cada cambio terminado, hacer commit y push.
