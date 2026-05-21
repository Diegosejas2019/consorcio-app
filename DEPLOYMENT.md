# GestionAr PWA - Flujo QA y Produccion

## Flujo de ramas

- `main`: produccion.
- `develop`: QA mediante Preview Deployment.
- `feature/<nombre>`: cambios nuevos desde `develop`.
- `hotfix/<nombre>`: correcciones urgentes desde `main`.

## Ambientes Vercel

Produccion:

- Production Branch: `main`.
- API por defecto: `https://consorcio-api-production.up.railway.app/api`.
- La TWA publicada en Play Store debe apuntar al dominio productivo.

QA:

- Preview Deployment desde `develop`.
- API QA esperada: `https://consorcio-api-qa.up.railway.app/api`.
- `api.js` detecta hosts con `develop`, `git-develop`, `qa` o `staging` y usa la API QA.
- Si se necesita override manual, definir `window.CONSORCIO_API_URL` antes de cargar `api.js`; ver `runtime-config.example.js`.

La PWA es vanilla y no tiene bundler. Archivos `.env.production` y `.env.qa` son plantillas documentales; Vercel no los inyecta automaticamente en el navegador.

## Flujo de trabajo

```bash
git checkout develop
git pull origin develop
git checkout -b feature/nombre-corto
npm test
```

Para pasar a QA, abrir PR hacia `develop`. Para produccion, validar QA y abrir PR desde `develop` hacia `main`.

## Rollback

- Vercel: usar rollback al deployment productivo anterior.
- Play Store/TWA: evitar cambios de dominio productivo sin una version preparada.
- Si hay hotfix, crear `hotfix/<nombre>` desde `main`, validar, mergear a `main` y luego a `develop`.

## Validacion

```bash
npm test
```

En QA, confirmar login, navegacion principal, cache offline basico y que `window.API_BASE` apunte a Railway QA.
