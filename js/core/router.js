import { state } from './state.js';
import { updateOnlineStatus } from '../ui/offline.js';

// Poblado por app.js después de importar todos los módulos de páginas
export const PAGE_RENDERERS = {};

export function showPage(id) {
  window.navCloseSubmenu?.();
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    const pages = n.dataset.pages
      ? n.dataset.pages.split(',')
      : (n.dataset.page ? [n.dataset.page] : []);
    n.classList.toggle('active', pages.includes(id));
  });
  if (state.role) localStorage.setItem(`lastPage_${state.role}`, id);
  setTimeout(updateOnlineStatus, 0);
}

window.showPage = showPage;
