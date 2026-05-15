# GestionAr — Política de Privacidad y Data Safety

## Política de Privacidad (borrador)

> Este texto debe publicarse en una URL pública antes de enviar la app a revisión.
> Se puede alojar en la landing page (ej: `https://gestionar.ar/privacidad`) o en un servicio como GitHub Pages, Notion, etc.

---

### Política de Privacidad de GestionAr

**Última actualización:** [FECHA]

GestionAr ("la aplicación", "nosotros") es una plataforma de gestión para consorcios, barrios cerrados y edificios. Esta política describe cómo recopilamos, usamos y protegemos la información de nuestros usuarios.

#### 1. Información que recopilamos

Recopilamos la siguiente información cuando usás GestionAr:

- **Datos de cuenta**: nombre, dirección de email, contraseña (almacenada con hash seguro), número de unidad funcional.
- **Datos de uso**: páginas visitadas, acciones realizadas dentro de la app (solo para mejorar el servicio).
- **Comprobantes de pago**: imágenes y archivos PDF subidos por el usuario para registrar pagos de expensas.
- **Token de notificaciones push**: identificador de dispositivo para enviar notificaciones (solo si das permiso explícito).
- **Datos de visitantes**: nombre y fecha de visitas registradas por el propietario.

#### 2. Cómo usamos la información

- Para brindarte el servicio de gestión de tu consorcio o barrio.
- Para enviarte notificaciones sobre pagos, avisos y vencimientos (solo si otorgaste permiso).
- Para que el administrador de tu organización pueda gestionar pagos y comunicaciones.
- No usamos tus datos para publicidad personalizada ni los vendemos a terceros.

#### 3. Con quién compartimos la información

- **Administrador de tu organización**: tiene acceso a los datos de tu cuenta, pagos y reclamos dentro de tu consorcio o barrio.
- **MercadoPago**: si pagás con MercadoPago, tus datos de pago son procesados por Mercado Pago S.A. según sus propios términos de privacidad.
- **Firebase (Google)**: se usa para el envío de notificaciones push. Solo se comparte el token del dispositivo.
- **Cloudinary**: se usa para el almacenamiento seguro de archivos adjuntos (comprobantes, documentos).
- No compartimos datos con terceros para fines publicitarios.

#### 4. Seguridad

- Toda la comunicación entre la app y nuestros servidores usa HTTPS (cifrado TLS).
- Las contraseñas se almacenan con hash bcrypt.
- Los tokens de sesión tienen vencimiento de 7 días.

#### 5. Tus derechos

Podés solicitar en cualquier momento:
- Acceso a tus datos personales.
- Corrección de datos incorrectos.
- Eliminación de tu cuenta y datos asociados.
- Exportación de tu información.

Para ejercer estos derechos, contactanos en: [EMAIL DE SOPORTE]

#### 6. Retención de datos

Conservamos tus datos mientras tu cuenta esté activa. Si solicitás la eliminación de tu cuenta, tus datos personales serán eliminados en un plazo de 30 días, salvo obligación legal de retención.

#### 7. Contacto

Si tenés preguntas sobre esta política, escribinos a: [EMAIL DE SOPORTE]

---

## Data Safety — Declaración para Play Console

> Completar esta sección en Play Console → App Content → Data Safety.

### Datos recopilados y compartidos

| Tipo de dato | Recopilado | Compartido | Propósito | Opcional |
|--------------|-----------|------------|-----------|----------|
| Nombre | Sí | Con admin de la org | Funcionalidad de la app | No |
| Dirección de email | Sí | No (solo interno) | Autenticación | No |
| Identificador de usuario (ID) | Sí | Con admin de la org | Funcionalidad de la app | No |
| Archivos y documentos (comprobantes) | Sí | Con admin de la org | Funcionalidad de la app | Sí |
| Actividad en la app | Sí | No | Analytics internos | No |
| Token de dispositivo (push) | Sí | Con Firebase/Google | Notificaciones push | Sí (requiere permiso) |

### Preguntas clave del cuestionario Data Safety

**¿Tu app recopila o comparte datos de usuario?**
→ Sí

**¿Todos los datos de usuario están cifrados en tránsito?**
→ Sí (HTTPS/TLS)

**¿Los usuarios pueden solicitar la eliminación de sus datos?**
→ Sí (contactando al soporte)

**¿Los datos se usan para publicidad personalizada?**
→ No

**¿Los datos se comparten con terceros para fines publicitarios?**
→ No

**¿Los datos financieros se recopilan?**
→ Sí — imágenes de comprobantes de pago (archivos subidos por el usuario). No se recopilan datos de tarjeta de crédito ni información bancaria directamente; los pagos con tarjeta son procesados por MercadoPago.

### Notas adicionales para el cuestionario

- La app usa **Firebase Cloud Messaging (FCM)** para notificaciones push. El token de dispositivo se envía a Google solo si el usuario otorga permiso de notificaciones.
- Los pagos con tarjeta/débito se procesan a través de **MercadoPago Checkout Pro** (redirección externa). GestionAr no almacena datos de tarjetas.
- Los archivos subidos (comprobantes, documentos) se alojan en **Cloudinary** (Cloudinary Ltd., con servidores en múltiples regiones).
