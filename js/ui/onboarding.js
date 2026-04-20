/**
 * Onboarding no intrusivo.
 * Muestra hints flotantes la primera vez que el usuario visita cada página clave.
 * Usa localStorage para no repetir hints ya vistos.
 */

const HINTS = {
  owner: [
    { page: 'page-owner-home',    message: 'Acá podés ver tu estado de pago y avisos importantes' },
    { page: 'page-owner-pay',     message: 'Subí tu comprobante o pagá con MercadoPago desde acá' },
    { page: 'page-owner-history', message: 'Acá podés ver todos tus pagos anteriores' },
  ],
  admin: [
    { page: 'page-admin-home',    message: 'Resumen general de tu consorcio' },
    { page: 'page-admin-owners',  message: 'Gestioná los propietarios desde acá' },
    { page: 'page-admin-notices', message: 'Creá avisos para todos los usuarios' },
  ],
};

const DONE_KEY   = role   => `onboarding_${role}_done`;
const HINT_KEY   = pageId => `onboarding_hint_${pageId}`;

function isDone(role)         { return localStorage.getItem(DONE_KEY(role)) === 'true'; }
function isHintSeen(pageId)   { return localStorage.getItem(HINT_KEY(pageId)) === 'true'; }
function markHintSeen(pageId) { localStorage.setItem(HINT_KEY(pageId), 'true'); }
function markDone(role)       { localStorage.setItem(DONE_KEY(role), 'true'); }

function checkAllDone(role) {
  if ((HINTS[role] || []).every(h => isHintSeen(h.page))) markDone(role);
}

let _activeRole = null;
let _hooked     = false;

/**
 * Inicia el onboarding para el rol dado.
 * Si ya se completó para ese rol, no hace nada.
 * Engancha window.showPage para mostrar hints al navegar.
 *
 * @param {'owner'|'admin'} role
 */
export function runOnboarding(role) {
  if (!HINTS[role] || isDone(role)) return;
  _activeRole = role;

  // Solo enganchar una vez. El hook queda instalado pero se vuelve
  // no-op automáticamente cuando el onboarding del rol está completo.
  if (!_hooked) {
    _hooked = true;
    const _orig = window.showPage;
    window.showPage = function (id, ...args) {
      _orig(id, ...args);
      if (_activeRole && !isDone(_activeRole)) {
        _scheduleHint(id);
      }
    };
  }

  // Mostrar hint de la página ya activa (cargada antes de este hook)
  const activePage = document.querySelector('.page.active');
  if (activePage) {
    _scheduleHint(activePage.id);
  }
}

function _scheduleHint(pageId) {
  const hint = (HINTS[_activeRole] || []).find(h => h.page === pageId);
  if (!hint || isHintSeen(pageId)) return;

  // Pequeño delay para que el contenido de la página se renderice
  setTimeout(() => {
    showTooltip(document.getElementById(pageId), hint.message, () => {
      markHintSeen(pageId);
      checkAllDone(_activeRole);
    });
  }, 700);
}

/**
 * Muestra un tooltip flotante no intrusivo sobre la barra de navegación.
 *
 * @param {Element}  _targetEl  Elemento de referencia (reservado para uso futuro)
 * @param {string}   message    Mensaje a mostrar al usuario
 * @param {Function} onDismiss  Callback cuando se cierra el tooltip
 */
export function showTooltip(_targetEl, message, onDismiss) {
  document.querySelector('.ob-tooltip')?.remove();

  const el = document.createElement('div');
  el.className = 'ob-tooltip';
  el.setAttribute('role', 'status');
  el.setAttribute('aria-live', 'polite');
  el.innerHTML = `
    <span class="ob-tooltip__icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"/>
        <line x1="12" y1="8" x2="12" y2="12"/>
        <line x1="12" y1="16" x2="12.01" y2="16"/>
      </svg>
    </span>
    <p class="ob-tooltip__msg">${message}</p>
    <button class="ob-tooltip__btn" type="button">Entendido</button>
  `;
  document.body.appendChild(el);

  const timer = setTimeout(dismiss, 7000);

  el.querySelector('.ob-tooltip__btn').addEventListener('click', () => {
    clearTimeout(timer);
    dismiss();
  });

  function dismiss() {
    el.classList.add('ob-tooltip--hide');
    setTimeout(() => {
      el.remove();
      onDismiss?.();
    }, 280);
  }
}
