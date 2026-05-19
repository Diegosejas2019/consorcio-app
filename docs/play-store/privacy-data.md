# GestionAr — Política de Privacidad y Data Safety

## Política de Privacidad

> Publicada dentro de la PWA en `/privacidad`.
> URL final: dominio productivo de `consorcio-app` + `/privacidad`.

---

### Política de Privacidad de GestionAr

**Última actualización:** 19/05/2026

GestionAr ("la aplicación", "nosotros") es una plataforma de gestión para consorcios, barrios cerrados y edificios. Esta política describe cómo recopilamos, usamos y protegemos la información de nuestros usuarios.

#### 1. Responsable del tratamiento

- **Responsable / Titular**: Diego Sejas.
- **Domicilio**: Jose Antonio Miralla 2932.
- **Email de contacto**: gestionar.app.info@gmail.com.

#### 2. Información que recopilamos

Recopilamos la siguiente información cuando usás GestionAr:

- **Datos de cuenta**: nombre, dirección de email, teléfono si fue informado, contraseña (almacenada con hash seguro), organización y unidad funcional o membresía asociada.
- **Datos operativos**: pagos, saldos, deudas, comprobantes, recibos, reclamos, avisos, reservas, visitas, votos, documentos y otra información cargada por usuarios o administradores.
- **Archivos adjuntos**: imágenes, PDFs y otros documentos que el usuario o la organización carguen en la plataforma.
- **Datos de uso y seguridad**: páginas visitadas, acciones realizadas dentro de la app, errores y registros necesarios para mejorar estabilidad y proteger el servicio.
- **Token de notificaciones push**: identificador de dispositivo para enviar notificaciones (solo si das permiso explícito).

#### 3. Cómo usamos la información

- Para brindarte el servicio de gestión de tu consorcio o barrio.
- Para enviarte notificaciones sobre pagos, avisos y vencimientos (solo si otorgaste permiso).
- Para que el administrador de tu organización pueda gestionar pagos y comunicaciones.
- Para procesar comprobantes, recibos, reclamos, visitas, reservas, votaciones, documentos y reportes.
- Para mejorar la seguridad, estabilidad y funcionamiento de la plataforma.
- No usamos tus datos para publicidad personalizada ni los vendemos a terceros.

#### 4. Con quién compartimos la información

- **Administrador de tu organización**: tiene acceso a los datos de tu cuenta, pagos y reclamos dentro de tu consorcio o barrio.
- **Firebase (Google)**: se usa para el envío de notificaciones push. Solo se comparte el token del dispositivo.
- **Cloudinary**: se usa para el almacenamiento seguro de archivos adjuntos (comprobantes, documentos).
- **Brevo u otros proveedores de email**: se usan para comunicaciones transaccionales del servicio.
- **MercadoPago**: si tu organización habilita pagos con MercadoPago, el pago se procesa mediante Checkout Pro. GestionAr no almacena datos de tarjetas.
- No compartimos datos con terceros para fines publicitarios.

#### 5. Seguridad

- Toda la comunicación entre la app y nuestros servidores usa HTTPS (cifrado TLS).
- Las contraseñas se almacenan con hash bcrypt.
- Los tokens de sesión tienen vencimiento de 7 días.
- La plataforma aplica controles de acceso por organización, usuario, rol y permisos.

#### 6. Tus derechos

Podés solicitar en cualquier momento:
- Acceso a tus datos personales.
- Corrección de datos incorrectos.
- Eliminación de tu cuenta y datos asociados.
- Exportación de tu información.

Para ejercer estos derechos, contactanos en: gestionar.app.info@gmail.com

#### 7. Retención de datos

Conservamos tus datos mientras tu cuenta esté activa, mientras tu organización utilice el servicio o durante el tiempo necesario para cumplir finalidades administrativas, técnicas, contables, legales o de seguridad.

#### 8. Eliminación de cuenta y datos

Para solicitar la eliminación de cuenta o datos personales, escribinos a gestionar.app.info@gmail.com indicando nombre, email de cuenta y organización asociada. La eliminación puede estar sujeta a obligaciones legales, contables, administrativas, técnicas o de conservación de registros.

#### 9. Contacto

Si tenés preguntas sobre esta política, escribinos a: gestionar.app.info@gmail.com

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
- Los archivos subidos (comprobantes, documentos) se alojan en **Cloudinary** (Cloudinary Ltd., con servidores en múltiples regiones).
- Los pagos con tarjeta/débito se procesan a través de **MercadoPago Checkout Pro** cuando la organización lo habilita. GestionAr no almacena datos de tarjetas.
