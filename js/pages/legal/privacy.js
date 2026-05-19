import { state } from '../../core/state.js';
import { PAGE_RENDERERS, showPage } from '../../core/router.js';
import { svgIcon } from '../../ui/icons.js';

const PRIVACY_META = {
  version: '1.0',
  updatedAt: '19 de mayo de 2026',
};

const PRIVACY_SECTIONS = [
  {
    title: '1. Responsable del tratamiento',
    paragraphs: [
      'GestionAr es una plataforma de gestión para consorcios, barrios privados, clubes, gimnasios, colegios y organizaciones similares.',
      'Responsable / Titular: Diego Sejas. Domicilio: Jose Antonio Miralla 2932.',
      'Email de contacto: gestionar.app.info@gmail.com.',
    ],
  },
  {
    title: '2. Información que recopilamos',
    paragraphs: [
      'Recopilamos y tratamos la información necesaria para prestar el servicio y permitir la administración de cada Organización.',
    ],
    bullets: [
      'Datos de cuenta: nombre, email, teléfono si fue informado, rol, organización y unidades o membresías asociadas.',
      'Datos de acceso y seguridad: credenciales protegidas, tokens de sesión, permisos y registros necesarios para proteger la cuenta.',
      'Datos operativos: pagos, saldos, deudas, comprobantes, recibos, reclamos, avisos, reservas, visitas, votos, documentos y otra información cargada por usuarios o administradores.',
      'Archivos adjuntos: imágenes, PDFs y otros documentos que el usuario o la Organización carguen en la plataforma.',
      'Datos técnicos: información básica de uso, errores, actividad dentro de la app y token de notificaciones push si el usuario otorga permiso.',
    ],
  },
  {
    title: '3. Cómo usamos la información',
    bullets: [
      'Prestar las funcionalidades de GestionAr y permitir el acceso seguro a la plataforma.',
      'Mostrar información administrativa, financiera y operativa correspondiente a cada Organización.',
      'Enviar avisos, emails, recordatorios y notificaciones push relacionados con el servicio.',
      'Procesar comprobantes, pagos, recibos, reclamos, visitas, reservas, votaciones, documentos y reportes.',
      'Mejorar la estabilidad, seguridad y funcionamiento de la plataforma.',
      'Cumplir obligaciones legales, administrativas, contables o de seguridad cuando corresponda.',
    ],
  },
  {
    title: '4. Con quién compartimos información',
    paragraphs: [
      'GestionAr no vende datos personales ni los comparte con terceros para publicidad personalizada.',
      'La información puede ser accesible para administradores autorizados de la Organización a la que pertenece el usuario, de acuerdo con su rol y permisos.',
    ],
    bullets: [
      'Proveedores de infraestructura, base de datos, hosting, monitoreo y seguridad necesarios para operar la plataforma.',
      'Cloudinary, para almacenamiento de archivos, comprobantes, recibos y documentos adjuntos.',
      'Firebase / Google, para notificaciones push cuando el usuario habilita ese permiso.',
      'Brevo u otros proveedores de email, para comunicaciones transaccionales del servicio.',
      'MercadoPago, cuando la Organización tenga habilitados pagos mediante Checkout Pro. GestionAr no almacena datos de tarjetas.',
    ],
  },
  {
    title: '5. Seguridad',
    paragraphs: [
      'Adoptamos medidas técnicas y organizativas razonables para proteger la información, incluyendo comunicaciones cifradas mediante HTTPS, contraseñas almacenadas con hash seguro y controles de acceso por usuario, rol y Organización.',
      'Ningún sistema informático puede garantizar seguridad absoluta. El usuario debe mantener sus credenciales en confidencialidad y avisar ante cualquier acceso no autorizado o actividad sospechosa.',
    ],
  },
  {
    title: '6. Conservación de datos',
    paragraphs: [
      'Conservamos la información mientras la cuenta esté activa, mientras la Organización utilice el servicio o durante el tiempo necesario para cumplir finalidades administrativas, técnicas, contables, legales o de seguridad.',
      'La eliminación de datos puede estar sujeta a obligaciones legales, contables, administrativas o de conservación de registros.',
    ],
  },
  {
    title: '7. Derechos de los usuarios',
    paragraphs: [
      'En Argentina, la Ley 25.326 reconoce derechos de acceso, rectificación, actualización, supresión y confidencialidad sobre los datos personales.',
      'El usuario puede solicitar acceso, corrección, actualización, exportación o eliminación de sus datos escribiendo a gestionar.app.info@gmail.com.',
    ],
  },
  {
    title: '8. Eliminación de cuenta y datos',
    paragraphs: [
      'Para solicitar la eliminación de cuenta o datos personales, el usuario debe escribir a gestionar.app.info@gmail.com indicando su nombre, email de cuenta y Organización asociada.',
      'GestionAr evaluará la solicitud y coordinará con la Organización cuando corresponda. La eliminación se realizará en un plazo razonable, salvo que exista una obligación legal, contable, administrativa, técnica o de seguridad que requiera conservar parte de la información.',
    ],
  },
  {
    title: '9. Menores de edad',
    paragraphs: [
      'GestionAr está destinada al uso administrativo de organizaciones. Si una Organización carga datos de menores de edad, será responsable de contar con autorización y base legal suficiente para ese tratamiento.',
    ],
  },
  {
    title: '10. Cambios en esta política',
    paragraphs: [
      'Podremos actualizar esta Política de Privacidad para reflejar cambios del servicio, mejoras de seguridad, nuevos proveedores o requisitos legales. La versión vigente estará disponible públicamente en esta página.',
    ],
  },
  {
    title: '11. Contacto',
    paragraphs: [
      'Para consultas sobre privacidad, datos personales, seguridad o eliminación de cuenta, escribinos a gestionar.app.info@gmail.com.',
    ],
  },
];

function renderSection(section) {
  const paragraphs = (section.paragraphs || []).map(text => `<p>${text}</p>`).join('');
  const bullets = section.bullets?.length
    ? `<ul>${section.bullets.map(item => `<li>${item}</li>`).join('')}</ul>`
    : '';

  return `
    <section class="legal-section">
      <h2>${section.title}</h2>
      ${paragraphs}
      ${bullets}
    </section>`;
}

function defaultPageForRole() {
  return state.role === 'admin' ? 'page-admin-home' : 'page-owner-home';
}

export function renderPrivacyPage() {
  const el = document.getElementById('page-privacy');
  if (!el) return;

  el.innerHTML = `
    <div class="legal-page">
      <div class="legal-actions legal-actions-top">
        <button class="btn btn-ghost" onclick="goBackFromPrivacy()">
          ${svgIcon('chevron-l', 16)} Volver
        </button>
      </div>

      <article class="legal-card">
        <header class="legal-header">
          <p class="page-eyebrow">Legal</p>
          <h1>Política de Privacidad</h1>
          <p class="legal-meta">Versión ${PRIVACY_META.version} - Última actualización: ${PRIVACY_META.updatedAt}</p>
        </header>

        <div class="legal-content">
          <section class="legal-section legal-intro">
            <p>Esta Política de Privacidad explica qué información recopilamos, cómo la usamos, con quiénes puede compartirse y qué derechos tienen los usuarios de GestionAr.</p>
            <p>Al utilizar GestionAr, el usuario reconoce que el tratamiento de datos es necesario para prestar el servicio de gestión administrativa y comunicación de su Organización.</p>
          </section>
          ${PRIVACY_SECTIONS.map(renderSection).join('')}
          <section class="legal-section legal-intro">
            <button class="legal-link" onclick="openTermsPage()">
              <span>${svgIcon('doc', 18)}</span>
              <span>Ver Términos y Condiciones</span>
              <span class="legal-link-arrow">${svgIcon('chevron-r', 16)}</span>
            </button>
          </section>
        </div>
      </article>

      <div class="legal-actions">
        <button class="btn btn-secondary w-full" onclick="goBackFromPrivacy()">
          ${svgIcon('chevron-l', 16)} Volver
        </button>
      </div>
    </div>`;
}

window.openPrivacyPage = function(source = 'app') {
  const activePage = document.querySelector('.page.active')?.id;
  window.__privacyReturnPage = source === 'login' || source === 'direct' ? 'login' : activePage;

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('reset-screen').style.display = 'none';
  document.getElementById('mp-result-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  document.body.classList.toggle('legal-public-mode', source === 'login' || source === 'direct' || !state.role);

  showPage('page-privacy');
  renderPrivacyPage();
  window.scrollTo({ top: 0 });
};

window.goBackFromPrivacy = function() {
  const returnPage = window.__privacyReturnPage;
  document.body.classList.remove('legal-public-mode');
  window.__privacyReturnPage = null;

  if (returnPage === 'login' || !state.role) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('app-shell').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    window.showLoginView?.();
    return;
  }

  const page = returnPage && returnPage !== 'page-privacy' && document.getElementById(returnPage)
    ? returnPage
    : defaultPageForRole();

  document.getElementById('app-shell').style.display = 'flex';
  showPage(page);
  PAGE_RENDERERS[page]?.();
};

window.renderPrivacyPage = renderPrivacyPage;
