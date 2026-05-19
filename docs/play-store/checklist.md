# Checklist: GestionAr → Google Play Store (TWA / Bubblewrap)

## 1. Requisitos PWA

- [x] `manifest.json` presente y accesible en `/manifest.json`
- [x] `name`: "GestionAr"
- [x] `short_name`: "GestionAr"
- [x] `start_url`: "/"
- [x] `scope`: "/"
- [x] `display`: "standalone"
- [x] `theme_color`: "#0e1512"
- [x] `background_color`: "#0e1512"
- [x] Ícono 192×192 PNG (`icons/icon-192.png`)
- [x] Ícono 512×512 PNG (`icons/icon-512.png`)
- [x] Purpose separados: `maskable` y `any` en entradas distintas
- [x] Service Worker registrado (`sw.js`)
- [x] Offline básico funcional (IndexedDB + caché de assets)
- [x] HTTPS en producción (Vercel auto-TLS)
- [x] SPA rewrite para rutas en producción (`vercel.json`)
- [ ] Screenshots en manifest (`screenshots/`) — recomendado para banner de instalación
- [ ] Verificar safe zone de íconos maskable en https://maskable.app

## 2. Requisitos TWA / Bubblewrap

- [x] `.well-known/assetlinks.json` creado (con placeholder SHA-256)
- [ ] **Reemplazar SHA-256 placeholder** con el fingerprint real del keystore generado por Bubblewrap
- [ ] Verificar que `/.well-known/assetlinks.json` se sirva con `Content-Type: application/json`
- [ ] Confirmar dominio de producción a usar en Bubblewrap (ej: `https://app.gestionar.ar`)
- [ ] Ejecutar `npx @bubblewrap/cli init --manifest https://TU_DOMINIO/manifest.json`
- [ ] Generar keystore con Bubblewrap y guardar en lugar seguro
- [ ] Copiar SHA-256 del keystore en `assetlinks.json` y re-deployar
- [ ] Ejecutar `npx @bubblewrap/cli build` → genera `.aab`
- [ ] Probar el `.aab` en un dispositivo físico antes de subir

## 3. Assets gráficos para Play Store

- [ ] **Ícono de app** (512×512 PNG, sin transparencia, sin redondeado — Play Store lo aplica)
  - Usar `icons/icon-512.png` (ya existe, verificar que fondo sea sólido)
- [ ] **Feature Graphic** (1024×500 PNG o JPG)
  - Banner horizontal con logo + nombre de la app sobre fondo oscuro
- [ ] **Screenshots de teléfono** (mínimo 2, máximo 8)
  - Resolución recomendada: 1080×1920 (o cualquier proporción 16:9 vertical)
  - Capturar en dispositivo Android o usar emulador (Chrome DevTools mobile view)
  - Pantallas sugeridas: Login, Home Owner, Home Admin, Pagos, Reclamos
- [ ] **Screenshots de tablet** (opcional pero recomendado)
  - Proporción 16:9 horizontal, mínimo 1080×810

## 4. Información de la ficha (Play Console)

- [ ] **Nombre de app**: GestionAr (máx 30 caracteres)
- [ ] **Descripción corta** (máx 80 caracteres) — ver `listing.md`
- [ ] **Descripción completa** (máx 4000 caracteres) — ver `listing.md`
- [ ] **Categoría**: Business / Finance
- [x] **Email de soporte**: gestionar.app.info@gmail.com
- [ ] **Sitio web**: URL de la landing page o la app
- [x] **Política de privacidad**: URL pública `/privacidad` — ver `privacy-data.md`

## 5. Clasificación de contenido

- [ ] Completar cuestionario de clasificación de contenido en Play Console
  - GestionAr no contiene violencia, lenguaje adulto ni contenido para mayores
  - Clasificación esperada: **Everyone** (E) / Para todos los públicos

## 6. Data Safety (sección obligatoria desde 2022)

- [ ] Declarar datos recopilados — ver `privacy-data.md`
- [ ] Declarar si los datos se comparten con terceros
- [ ] Declarar si los datos se usan para publicidad personalizada (NO en este caso)
- [ ] Indicar si los datos pueden eliminarse bajo solicitud del usuario

## 7. Cuenta de Google Play

- [ ] Cuenta de desarrollador de Google Play ($25 USD, pago único)
  - Crear en: https://play.google.com/console/signup
- [ ] Aceptar acuerdo de distribución de Google Play

## 8. Publicación

- [ ] Crear app en Play Console → "Create app"
- [ ] Completar todos los campos de "Store listing"
- [ ] Subir `.aab` en "Production" → "Create new release" (o usar track "Internal testing" primero)
- [ ] Completar "App content" (privacidad, clasificación, Data Safety)
- [ ] Enviar para revisión
- [ ] Revisión tarda entre 1 y 7 días hábiles

## Verificación post-deploy (antes de enviar a revisión)

1. `/privacidad` en el dominio productivo → debe cargar la Política de Privacidad sin login
2. `/.well-known/assetlinks.json` en el dominio productivo → debe devolver JSON válido con SHA-256 real
3. Chrome DevTools → Application → Manifest → sin errores
4. Lighthouse PWA → "Installable: all checks passed"
5. PWA Builder → https://www.pwabuilder.com → score verde
6. Digital Asset Links Test → https://developers.google.com/digital-asset-links/tools/generator
7. Instalar APK en dispositivo → verificar que carga sin chrome toolbar (TWA validado)
