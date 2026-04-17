import { state } from './state.js';
import { updateOnlineStatus } from '../ui/offline.js';

// Poblado por app.js después de importar todos los módulos de páginas
export const PAGE_RENDERERS = {};

export function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === id);
  });
  if (state.role) localStorage.setItem(`lastPage_${state.role}`, id);
  setTimeout(updateOnlineStatus, 0);
}

window.showPage = showPage;
