import { state } from '../../core/state.js';
import { PAGE_RENDERERS, showPage } from '../../core/router.js';
import { svgIcon } from '../../ui/icons.js';

const TERMS_META = {
  version: '1.0',
  updatedAt: '05 de mayo de 2026',
};

const TERMS_SECTIONS = [
  {
    title: '1. Definiciones',
    paragraphs: ['A los efectos de estos Términos y Condiciones, se entenderá por:'],
    bullets: [
      'GestionAr: la plataforma tecnológica que permite gestionar organizaciones, usuarios, pagos, avisos, reclamos, gastos, documentos, visitas, reservas, votaciones, empleados y otras funcionalidades relacionadas.',
      'Organización: entidad, consorcio, barrio privado, club, gimnasio, colegio u otra institución que utiliza GestionAr para administrar información, miembros, pagos y comunicaciones.',
      'Administrador: usuario autorizado por una Organización para gestionar información, propietarios/socios, pagos, gastos, avisos, reclamos, documentación y demás módulos disponibles.',
      'Propietario, socio, miembro u owner: usuario vinculado a una Organización que puede consultar información, realizar pagos, cargar comprobantes, leer avisos, crear reclamos, participar en votaciones, registrar visitas, reservar espacios y acceder a documentación habilitada.',
      'Usuario: toda persona que accede o utiliza la plataforma, ya sea como administrador, propietario, socio, miembro, empleado o cualquier otro rol habilitado.',
      'Contenido: toda información, archivo, comprobante, documento, imagen, PDF, aviso, reclamo, comentario, registro, dato o material cargado en la plataforma.',
    ],
  },
  {
    title: '2. Objeto de la plataforma',
    paragraphs: [
      'GestionAr es una herramienta tecnológica de gestión administrativa y comunicación. Su objetivo es facilitar a las Organizaciones la administración de miembros, propietarios, socios o unidades; pagos, cuotas, expensas o conceptos similares; comprobantes y recibos internos; gastos ordinarios y extraordinarios; avisos, comunicaciones, reclamos, solicitudes, documentación, visitas, reservas, votaciones, empleados, colaboradores, pagos internos y reportes administrativos o financieros.',
      'GestionAr no reemplaza el asesoramiento contable, legal, laboral, fiscal o profesional que pudiera corresponder a cada Organización.',
    ],
  },
  {
    title: '3. Alcance del servicio',
    paragraphs: [
      'GestionAr provee una plataforma informática para que cada Organización administre su propia información. La carga, veracidad, actualización, legalidad y uso de la información ingresada en la plataforma es responsabilidad de los administradores designados por cada Organización.',
      'GestionAr no participa en las decisiones internas de las Organizaciones, ni valida la legitimidad de los cobros, gastos, reclamos, documentos, votaciones, reservas, sueldos, comunicaciones o cualquier otra información cargada por administradores o usuarios.',
    ],
  },
  {
    title: '4. Registro y acceso',
    paragraphs: [
      'Para utilizar GestionAr, los usuarios deberán contar con credenciales de acceso válidas.',
      'GestionAr podrá suspender o restringir el acceso de usuarios u Organizaciones en caso de detectar uso indebido, actividad sospechosa, incumplimiento de estos Términos o requerimiento de la Organización correspondiente.',
    ],
    bullets: [
      'Proporcionar información verdadera, actualizada y completa.',
      'Mantener la confidencialidad de sus credenciales.',
      'No compartir usuario y contraseña con terceros.',
      'Notificar cualquier uso no autorizado de su cuenta.',
      'Utilizar la plataforma de forma lícita y conforme a estos Términos.',
    ],
  },
  {
    title: '5. Roles y permisos',
    paragraphs: [
      'GestionAr cuenta con distintos tipos de usuarios y permisos. Los administradores pueden gestionar información de la Organización según las funcionalidades habilitadas. Los propietarios, socios o miembros pueden acceder únicamente a la información que corresponda a su perfil y a la documentación o módulos que la Organización haya habilitado.',
      'La plataforma aplica controles de acceso por Organización y por rol. Sin embargo, cada Organización es responsable de asignar correctamente usuarios, roles y permisos.',
    ],
  },
  {
    title: '6. Uso permitido',
    paragraphs: [
      'Los usuarios se comprometen a utilizar GestionAr exclusivamente para fines lícitos y relacionados con la administración o participación dentro de su Organización.',
      'Está prohibido:',
    ],
    bullets: [
      'Usar la plataforma para fines ilegales, fraudulentos o no autorizados.',
      'Cargar información falsa, ofensiva, discriminatoria, injuriante o contraria a la ley.',
      'Intentar acceder a información de otras Organizaciones o usuarios sin autorización.',
      'Interferir con el funcionamiento de la plataforma o vulnerar medidas de seguridad.',
      'Subir archivos con virus, malware o contenido dañino.',
      'Utilizar la plataforma para enviar spam o comunicaciones no solicitadas.',
      'Suplantar la identidad de otra persona.',
      'Copiar, modificar, revender o explotar comercialmente la plataforma sin autorización.',
    ],
  },
  {
    title: '7. Pagos, cuotas, expensas y comprobantes',
    paragraphs: [
      'GestionAr permite a las Organizaciones registrar conceptos de pago, períodos, cuotas, expensas, gastos extraordinarios, saldos, comprobantes, recibos internos y estados de pago.',
      'Los montos, vencimientos, recargos, períodos habilitados, aprobación o rechazo de pagos y cualquier criterio administrativo son definidos por cada Organización.',
      'GestionAr no determina la existencia, legitimidad o exigibilidad de una deuda. La plataforma solo refleja la información cargada o aprobada por la Organización.',
      'Cuando se utilicen medios de pago externos, como MercadoPago u otros servicios, el procesamiento del pago estará sujeto también a los términos, condiciones y políticas de dichos proveedores.',
      'Los comprobantes cargados por los usuarios deberán ser veraces y corresponder al pago informado. La Organización podrá aprobarlos, rechazarlos o solicitar aclaraciones según sus propios criterios administrativos.',
    ],
  },
  {
    title: '8. Recibos y constancias',
    paragraphs: [
      'GestionAr puede generar recibos, constancias o comprobantes internos vinculados a pagos aprobados.',
      'Salvo indicación expresa en contrario, dichos documentos tienen carácter administrativo interno y no necesariamente constituyen factura fiscal, recibo laboral legal ni comprobante impositivo válido.',
      'La emisión de facturas fiscales, recibos legales, liquidaciones laborales, certificaciones contables u otros documentos exigidos por normativa específica será responsabilidad de cada Organización, salvo que GestionAr incorpore expresamente una funcionalidad legal o fiscal validada para tal fin.',
    ],
  },
  {
    title: '9. Gastos y reportes',
    paragraphs: [
      'Los administradores pueden registrar gastos, proveedores, comprobantes, categorías, pagos y reportes financieros.',
      'La exactitud, integridad y respaldo documental de dichos registros es responsabilidad de la Organización y de sus administradores. GestionAr no audita ni certifica la información financiera cargada en la plataforma.',
    ],
  },
  {
    title: '10. Reclamos, avisos y comunicaciones',
    paragraphs: [
      'Los usuarios pueden recibir avisos y comunicaciones de su Organización y, cuando esté habilitado, crear reclamos o solicitudes.',
      'Los mensajes, avisos, notas administrativas, respuestas a reclamos y comunicaciones cargadas en GestionAr son responsabilidad de quienes las emiten.',
      'GestionAr podrá facilitar el envío de notificaciones por email, push u otros canales, pero no garantiza la recepción inmediata o efectiva por parte del destinatario, ya que ello puede depender de servicios externos, conectividad, configuración del dispositivo o permisos del usuario.',
    ],
  },
  {
    title: '11. Documentación de la Organización',
    paragraphs: [
      'Las Organizaciones pueden cargar documentación propia, como reglamentos, mapas, normas de convivencia, actas, pólizas, instructivos, contratos, documentos administrativos u otros archivos.',
      'Los propietarios, socios o miembros solo podrán acceder a los documentos que la Organización haya marcado como visibles para ellos. GestionAr no valida el contenido, vigencia o legalidad de la documentación cargada por cada Organización.',
    ],
    bullets: [
      'La Organización es responsable de la legalidad, vigencia, actualización y veracidad del contenido cargado.',
      'La Organización debe configurar correctamente la visibilidad de los documentos.',
      'La Organización declara contar con autorización para publicar o compartir dichos documentos.',
    ],
  },
  {
    title: '12. Visitas, reservas y espacios comunes',
    paragraphs: [
      'Cuando la funcionalidad esté habilitada, los usuarios podrán registrar visitas, solicitar autorizaciones de ingreso o reservar espacios comunes.',
      'Las condiciones de aprobación, rechazo, uso, horarios, cupos, sanciones, permisos o restricciones serán definidas por cada Organización.',
      'GestionAr no garantiza disponibilidad de espacios, autorización de visitas ni cumplimiento de normas internas. La plataforma solo facilita el registro y seguimiento de dichas solicitudes.',
    ],
  },
  {
    title: '13. Votaciones',
    paragraphs: [
      'GestionAr puede permitir la creación y participación en votaciones internas.',
      'Las votaciones realizadas en la plataforma tendrán el alcance que cada Organización determine. Salvo que se establezca expresamente lo contrario y se cumplan los requisitos legales aplicables, las votaciones en GestionAr no reemplazan asambleas, procedimientos formales ni actos jurídicos exigidos por normativa vigente.',
      'La Organización es responsable de definir reglas, participantes habilitados, validez, efectos y comunicación de los resultados.',
    ],
  },
  {
    title: '14. Empleados, sueldos y pagos internos',
    paragraphs: [
      'GestionAr puede incluir funcionalidades para registrar empleados, colaboradores, pagos internos, sueldos administrativos o constancias internas.',
      'Salvo implementación específica y validada, estas funcionalidades no constituyen liquidación legal completa de haberes, recibo de sueldo legal, declaración laboral, previsional, sindical, fiscal o contable.',
      'Cada Organización será responsable de cumplir con las obligaciones laborales, previsionales, fiscales y contables que correspondan.',
    ],
  },
  {
    title: '15. Archivos y almacenamiento',
    paragraphs: [
      'La plataforma puede permitir la carga de archivos, imágenes, documentos PDF, comprobantes y otros contenidos.',
      'El usuario y/o la Organización declaran tener derecho a cargar, almacenar y compartir dichos archivos.',
      'GestionAr podrá establecer límites de tamaño, formato, cantidad y tipo de archivo. También podrá rechazar o eliminar archivos que incumplan estos Términos, representen riesgos de seguridad o sean requeridos por autoridad competente.',
      'Los archivos pueden almacenarse mediante proveedores externos de infraestructura o almacenamiento en la nube.',
    ],
  },
  {
    title: '16. Servicios de terceros',
    paragraphs: [
      'GestionAr puede utilizar servicios de terceros para prestar sus funcionalidades, entre ellos infraestructura y hosting, base de datos, almacenamiento de archivos, envío de emails, notificaciones push, procesamiento de pagos, monitoreo de errores y otros servicios tecnológicos necesarios para operar la plataforma.',
      'El uso de dichos servicios puede estar sujeto a sus propios términos, condiciones y políticas de privacidad.',
      'GestionAr no será responsable por interrupciones, errores, cambios, caídas, demoras o incidentes atribuibles exclusivamente a proveedores externos.',
    ],
  },
  {
    title: '17. Disponibilidad del servicio',
    paragraphs: [
      'GestionAr procurará mantener la plataforma disponible y operativa. Sin embargo, no garantiza disponibilidad ininterrumpida, libre de errores o permanente.',
      'El servicio puede verse afectado por mantenimiento programado o no programado, fallas técnicas, conectividad, incidentes de proveedores externos, actualizaciones, casos fortuitos o fuerza mayor, y restricciones legales o de seguridad.',
      'GestionAr podrá modificar, suspender o discontinuar funcionalidades cuando resulte necesario para mejorar el servicio, preservar la seguridad o cumplir obligaciones legales.',
    ],
  },
  {
    title: '18. Responsabilidades del usuario',
    paragraphs: [
      'El usuario es responsable por el uso que haga de la plataforma, la información que cargue, la veracidad de sus datos, la custodia de sus credenciales, el cumplimiento de normas internas de su Organización y la revisión de pagos, documentos, avisos, reclamos, reservas y cualquier información disponible en su cuenta.',
      'El usuario deberá informar a su Organización o a GestionAr ante cualquier error, acceso indebido, información incorrecta o uso no autorizado.',
    ],
  },
  {
    title: '19. Responsabilidades de la Organización',
    paragraphs: [
      'Cada Organización es responsable por la administración de sus usuarios, la carga y actualización de datos, la definición de montos, vencimientos y conceptos de pago, la aprobación o rechazo de pagos, la gestión de reclamos, la documentación compartida, el tratamiento de datos personales de sus miembros, la legalidad de sus comunicaciones, el cumplimiento de obligaciones fiscales, contables, laborales, administrativas y legales, y la asignación correcta de roles y permisos.',
    ],
  },
  {
    title: '20. Limitación de responsabilidad',
    paragraphs: [
      'GestionAr es una herramienta tecnológica de apoyo a la gestión. En la máxima medida permitida por la ley aplicable, GestionAr no será responsable por información incorrecta cargada por usuarios o administradores, decisiones tomadas por las Organizaciones, conflictos entre usuarios o terceros, errores administrativos de la Organización, deudas, pagos, rechazos o aprobaciones definidos por la Organización, contenido de documentos cargados por la Organización, falta de recepción de notificaciones por causas ajenas, fallas de servicios externos, pérdidas indirectas, lucro cesante, daño reputacional o consecuencias derivadas del uso de la plataforma.',
    ],
  },
  {
    title: '21. Propiedad intelectual',
    paragraphs: [
      'GestionAr, su marca, diseño, código, estructura, funcionalidades, interfaces, textos, logos y elementos visuales pertenecen a sus titulares o licenciantes.',
      'El uso de la plataforma no otorga al usuario derechos de propiedad intelectual sobre GestionAr.',
      'Los usuarios y Organizaciones conservan los derechos que pudieran corresponder sobre la información y archivos que carguen, pero autorizan a GestionAr a almacenarlos, procesarlos y mostrarlos en la medida necesaria para prestar el servicio.',
    ],
  },
  {
    title: '22. Datos personales y privacidad',
    paragraphs: [
      'GestionAr trata datos personales de acuerdo con su Política de Privacidad y la normativa aplicable.',
      'En Argentina, la Ley 25.326 reconoce derechos sobre los datos personales, incluyendo acceso, rectificación, actualización, supresión y confidencialidad. La AAIP informa que el derecho de acceso puede solicitarse gratuitamente cada seis meses y que los pedidos de rectificación, actualización o supresión deben ser respondidos en los plazos previstos por la normativa.',
      'El uso de GestionAr implica el tratamiento de datos necesarios para prestar el servicio, tales como datos de identificación, contacto, organización, pagos, comprobantes, reclamos, visitas, reservas, documentos y registros de actividad.',
    ],
  },
  {
    title: '23. Seguridad',
    paragraphs: [
      'GestionAr adopta medidas razonables de seguridad técnica y organizativa para proteger la información. La normativa argentina exige garantizar seguridad y confidencialidad de los datos personales mediante medidas técnicas y organizativas adecuadas.',
      'Sin perjuicio de ello, ningún sistema informático puede garantizar seguridad absoluta. Los usuarios deberán colaborar utilizando contraseñas seguras, evitando compartir credenciales y notificando accesos indebidos o incidentes.',
    ],
  },
  {
    title: '24. Baja, suspensión o eliminación de cuentas',
    paragraphs: [
      'GestionAr o la Organización podrán suspender, restringir o dar de baja cuentas de usuario cuando el usuario deje de pertenecer a la Organización, exista incumplimiento de estos Términos, se detecte uso indebido o actividad sospechosa, sea requerido por autoridad competente, sea necesario por razones de seguridad o la Organización solicite la baja.',
      'La eliminación de datos podrá estar sujeta a obligaciones legales, contables, administrativas, técnicas o de conservación de registros.',
    ],
  },
  {
    title: '25. Modificaciones de los Términos',
    paragraphs: [
      'GestionAr podrá modificar estos Términos y Condiciones en cualquier momento. Cuando los cambios sean relevantes, podrá informar a los usuarios por medios razonables, como avisos dentro de la app, email o notificación.',
      'La continuidad en el uso de la plataforma luego de la publicación de cambios implica aceptación de la versión vigente.',
    ],
  },
  {
    title: '26. Legislación aplicable y jurisdicción',
    paragraphs: [
      'Estos Términos se regirán por las leyes de la República Argentina.',
      'Ante cualquier controversia derivada del uso de GestionAr, las partes procurarán resolverla de buena fe. En caso de no ser posible, serán competentes los tribunales que correspondan según la normativa aplicable y el domicilio legal que se defina para el titular de la plataforma.',
    ],
  },
  {
    title: '27. Contacto',
    paragraphs: [
      'Para consultas relacionadas con estos Términos y Condiciones, privacidad, soporte o uso de la plataforma, el usuario podrá comunicarse a gestionar.app.info@gmail.com.',
      'Responsable / Titular: Diego Sejas. Domicilio: Jose Antonio Miralla 2932.',
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

export function renderTermsPage() {
  const el = document.getElementById('page-terms');
  if (!el) return;

  el.innerHTML = `
    <div class="legal-page">
      <div class="legal-actions legal-actions-top">
        <button class="btn btn-ghost" onclick="goBackFromTerms()">
          ${svgIcon('chevron-l', 16)} Volver
        </button>
      </div>

      <article class="legal-card">
        <header class="legal-header">
          <p class="page-eyebrow">Legal</p>
          <h1>Términos y Condiciones</h1>
          <p class="legal-meta">Versión ${TERMS_META.version} · Última actualización: ${TERMS_META.updatedAt}</p>
        </header>

        <div class="legal-content">
          <section class="legal-section legal-intro">
            <p>Bienvenido/a a GestionAr. Estos Términos y Condiciones regulan el acceso y uso de la plataforma GestionAr, una aplicación web progresiva destinada a facilitar la administración de organizaciones como consorcios, barrios privados, clubes, gimnasios, colegios y otras entidades similares.</p>
            <p>Al acceder, registrarse o utilizar GestionAr, el usuario declara haber leído, comprendido y aceptado estos Términos y Condiciones. Si no está de acuerdo con ellos, deberá abstenerse de utilizar la plataforma.</p>
          </section>
          ${TERMS_SECTIONS.map(renderSection).join('')}
        </div>
      </article>

      <div class="legal-actions">
        <button class="btn btn-secondary w-full" onclick="goBackFromTerms()">
          ${svgIcon('chevron-l', 16)} Volver
        </button>
      </div>
    </div>`;
}

window.openTermsPage = function(source = 'app') {
  const activePage = document.querySelector('.page.active')?.id;
  window.__termsReturnPage = source === 'login' ? 'login' : activePage;

  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('reset-screen').style.display = 'none';
  document.getElementById('mp-result-screen').style.display = 'none';
  document.getElementById('app-shell').style.display = 'flex';
  document.body.classList.toggle('legal-public-mode', source === 'login' || !state.role);

  showPage('page-terms');
  renderTermsPage();
  window.scrollTo({ top: 0 });
};

window.goBackFromTerms = function() {
  const returnPage = window.__termsReturnPage;
  document.body.classList.remove('legal-public-mode');
  window.__termsReturnPage = null;

  if (returnPage === 'login' || !state.role) {
    document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
    document.getElementById('app-shell').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    window.showLoginView?.();
    return;
  }

  const page = returnPage && returnPage !== 'page-terms' && document.getElementById(returnPage)
    ? returnPage
    : defaultPageForRole();

  document.getElementById('app-shell').style.display = 'flex';
  showPage(page);
  PAGE_RENDERERS[page]?.();
};

window.renderTermsPage = renderTermsPage;
