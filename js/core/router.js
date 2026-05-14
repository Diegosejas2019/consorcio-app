import { state } from './state.js';
import { updateOnlineStatus } from '../ui/offline.js';
import { isFeatureEnabled, PAGE_FEATURE_MAP } from '../services/featureService.js';
import { canAccessPage } from '../services/permissionService.js';
import { toast } from '../ui/toast.js';

// Poblado por app.js después de importar todos los módulos de páginas
export const PAGE_RENDERERS = {};
const PUBLIC_PAGES = new Set(['page-terms']);
const PASSWORD_CHANGE_PAGES = new Set(['page-change-temp-password', 'page-terms']);

export function showPage(id) {
  window.navCloseSubmenu?.();

  if (state.user?.mustChangePassword && !PASSWORD_CHANGE_PAGES.has(id)) {
    toast('Debés cambiar tu contraseña temporal antes de continuar.', 'warning');
    id = 'page-change-temp-password';
  }

  if (!canAccessPage(id)) {
    toast('No tenés permisos para acceder a esta sección.', 'warning');
    return;
  }

  // Verificar feature flag antes de renderizar
  const feature = PAGE_FEATURE_MAP[id];
  if (feature && !isFeatureEnabled(feature)) {
    toast('Funcionalidad no disponible', 'warning');
    return;
  }

  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    const pages = n.dataset.pages
      ? n.dataset.pages.split(',')
      : (n.dataset.page ? [n.dataset.page] : []);
    n.classList.toggle('active', pages.includes(id));
  });
  document.querySelectorAll('.bn-item').forEach(n => {
    const pages = n.dataset.pages
      ? n.dataset.pages.split(',')
      : (n.dataset.page ? [n.dataset.page] : []);
    n.classList.toggle('is-active', pages.includes(id));
  });
  if (state.role && !PUBLIC_PAGES.has(id)) localStorage.setItem(`lastPage_${state.role}`, id);
  setTimeout(updateOnlineStatus, 0);
}

window.showPage = showPage;
