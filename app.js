/* ═══════════════════════════════════════════════
   GestionAr — Entry point (ES module)
   ═══════════════════════════════════════════════ */

// ── Core ──────────────────────────────────────────────────────
import './js/core/state.js';
import { PAGE_RENDERERS } from './js/core/router.js';
import './js/core/apiWrapper.js';

// ── UI ────────────────────────────────────────────────────────
import './js/ui/toast.js';
import './js/ui/modal.js';
import './js/ui/loading.js';
import './js/ui/skeleton.js';
import './js/ui/offline.js';
import './js/ui/pwa.js';

// ── Services ──────────────────────────────────────────────────
import './js/services/authService.js';
import './js/services/pushService.js';
import './js/services/mercadopagoService.js';
import './js/services/paymentsService.js';
import './js/services/configService.js';

// ── Admin pages ───────────────────────────────────────────────
import { renderAdminHome }      from './js/pages/admin/home.js';
import { renderAdminDashboard } from './js/pages/admin/dashboard.js';
import { renderOwnersList }     from './js/pages/admin/owners.js';
import { renderAdminNotices }   from './js/pages/admin/notices.js';
import { renderAdminClaims }    from './js/pages/admin/claims.js';
import { renderAdminSettings }  from './js/services/configService.js';

// ── Owner pages ───────────────────────────────────────────────
import { renderOwnerHome }    from './js/pages/owner/home.js';
import { renderUploadPage }   from './js/pages/owner/pay.js';
import { renderOwnerHistory } from './js/pages/owner/history.js';
import { renderOwnerNotices } from './js/pages/owner/notices.js';
import { renderOwnerClaims }  from './js/pages/owner/claims.js';

// ── Registrar renderers en el router ─────────────────────────
PAGE_RENDERERS['page-admin-home']      = () => renderAdminHome();
PAGE_RENDERERS['page-admin-dashboard'] = () => renderAdminDashboard();
PAGE_RENDERERS['page-admin-owners']    = () => renderOwnersList();
PAGE_RENDERERS['page-admin-notices']   = () => renderAdminNotices();
PAGE_RENDERERS['page-admin-claims']    = () => renderAdminClaims();
PAGE_RENDERERS['page-admin-settings']  = () => renderAdminSettings();
PAGE_RENDERERS['page-owner-home']      = () => renderOwnerHome();
PAGE_RENDERERS['page-owner-pay']       = () => renderUploadPage();
PAGE_RENDERERS['page-owner-history']   = () => renderOwnerHistory();
PAGE_RENDERERS['page-owner-notices']   = () => renderOwnerNotices();
PAGE_RENDERERS['page-owner-claims']    = () => renderOwnerClaims();

// Exponer PAGE_RENDERERS globalmente (usado en admin/home.js y owner/home.js)
window.PAGE_RENDERERS = PAGE_RENDERERS;

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
