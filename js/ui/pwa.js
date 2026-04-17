import { toast } from './toast.js';
import { openModal, closeModal } from './modal.js';

let _installPrompt = null;
const INSTALL_DISMISSED_KEY = 'install_dismissed_until';

export const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const installDismissed = () => {
  const until = localStorage.getItem(INSTALL_DISMISSED_KEY);
  return until && Date.now() < parseInt(until, 10);
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _installPrompt = e;
});

window.addEventListener('appinstalled', () => {
  _installPrompt = null;
  hideInstallBanner();
  toast('App instalada correctamente.', 'success');
});

export function showInstallBanner() {
  if (isStandalone() || installDismissed()) return;
  document.getElementById('install-banner')?.classList.remove('hidden');
}

export function hideInstallBanner() {
  document.getElementById('install-banner')?.classList.add('hidden');
}

export async function handleInstallClick() {
  if (_installPrompt) {
    _installPrompt.prompt();
    const { outcome } = await _installPrompt.userChoice;
    if (outcome === 'accepted') {
      _installPrompt = null;
      hideInstallBanner();
    }
  } else {
    hideInstallBanner();
    _showInstallInstructionsModal();
  }
}

export function dismissInstallBanner() {
  hideInstallBanner();
  localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function _showInstallInstructionsModal() {
  const ua = navigator.userAgent;
  let instructions;
  if (/iphone|ipad|ipod/i.test(ua)) {
    instructions = 'En Safari, tocá el botón <strong>Compartir ⬆️</strong> en la barra inferior y luego <strong>"Agregar a pantalla de inicio"</strong>.';
  } else if (/firefox/i.test(ua)) {
    instructions = 'En Firefox, abrí el menú <strong>⋮</strong> y tocá <strong>"Instalar"</strong>.';
  } else {
    instructions = 'Abrí el menú del navegador <strong>⋮</strong> y buscá <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla de inicio"</strong>.';
  }
  openModal(`
    <div style="text-align:center;padding:.5rem 0">
      <img src="icons/icon-192.png" alt="" style="width:64px;height:64px;border-radius:16px;margin-bottom:1rem">
      <h2 style="margin-bottom:.75rem">Instalar GestionAr</h2>
      <p style="color:var(--muted);font-size:.9rem;line-height:1.7">${instructions}</p>
      <button class="btn btn-primary w-full" style="margin-top:1.5rem" onclick="closeModal()">Entendido</button>
    </div>`);
}

window.handleInstallClick   = handleInstallClick;
window.dismissInstallBanner = dismissInstallBanner;
