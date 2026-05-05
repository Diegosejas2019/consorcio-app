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
import './js/ui/supportReport.js';

// ── Services ──────────────────────────────────────────────────
import './js/services/indexedDbService.js';
import './js/services/offlineQueue.js';
import './js/services/featureService.js';
import './js/services/authService.js';
import './js/services/pushService.js';
import './js/services/mercadopagoService.js';
import './js/services/paymentsService.js';
import './js/services/configService.js';

// ── Admin pages ───────────────────────────────────────────────
import { renderAdminHome }         from './js/pages/admin/home.js';
import { renderAdminDashboard }    from './js/pages/admin/dashboard.js';
import { renderOwnersList }        from './js/pages/admin/owners.js';
import { renderAdminUnits }        from './js/pages/admin/units.js';
import { renderAdminNotices }      from './js/pages/admin/notices.js';
import { renderAdminClaims }       from './js/pages/admin/claims.js';
import { renderAdminSettings }     from './js/services/configService.js';
import { renderAdminExpenses }     from './js/pages/admin/expenses.js';
import { renderAdminProviders }    from './js/pages/admin/providers.js';
import { renderAdminReport }       from './js/pages/admin/report.js';
import { renderAdminVotes }        from './js/pages/admin/votes.js';
import { renderAdminVisits }       from './js/pages/admin/visits.js';
import { renderAdminReservations } from './js/pages/admin/reservations.js';
import { renderAdminSpaces }       from './js/pages/admin/spaces.js';
import { renderAdminSupport }      from './js/pages/admin/support.js';
import { renderAdminEmployees }    from './js/pages/admin/employees.js';
import { renderAdminSalaries }     from './js/pages/admin/salaries.js';

// ── Owner pages ───────────────────────────────────────────────
import { renderOwnerHome }         from './js/pages/owner/home.js';
import { renderUploadPage }        from './js/pages/owner/pay.js';
import { renderOwnerHistory }      from './js/pages/owner/history.js';
import { renderOwnerNotices }      from './js/pages/owner/notices.js';
import { renderOwnerClaims }       from './js/pages/owner/claims.js';
import { renderOwnerExpenses }     from './js/pages/owner/expenses.js';
import { renderOwnerVotes }        from './js/pages/owner/votes.js';
import { renderOwnerVisits }       from './js/pages/owner/visits.js';
import { renderOwnerProfile }      from './js/pages/owner/profile.js';
import { renderOwnerReservations } from './js/pages/owner/reservations.js';
import { renderPaymentResult }     from './js/pages/owner/pago-resultado.js';
import { renderTermsPage }         from './js/pages/legal/terms.js';

// ── Registrar renderers en el router ─────────────────────────
PAGE_RENDERERS['page-admin-home']      = () => renderAdminHome();
PAGE_RENDERERS['page-admin-dashboard'] = () => renderAdminDashboard();
PAGE_RENDERERS['page-admin-owners']    = () => renderOwnersList();
PAGE_RENDERERS['page-admin-units']     = () => renderAdminUnits();
PAGE_RENDERERS['page-admin-notices']   = () => renderAdminNotices();
PAGE_RENDERERS['page-admin-claims']    = () => renderAdminClaims();
PAGE_RENDERERS['page-admin-settings']  = () => renderAdminSettings();
PAGE_RENDERERS['page-admin-expenses']  = () => renderAdminExpenses();
PAGE_RENDERERS['page-admin-providers'] = () => renderAdminProviders();
PAGE_RENDERERS['page-admin-report']    = () => renderAdminReport();
PAGE_RENDERERS['page-admin-votes']     = () => renderAdminVotes();
PAGE_RENDERERS['page-admin-visits']        = () => renderAdminVisits();
PAGE_RENDERERS['page-admin-reservations']  = () => renderAdminReservations();
PAGE_RENDERERS['page-admin-spaces']        = () => renderAdminSpaces();
PAGE_RENDERERS['page-admin-support']       = () => renderAdminSupport();
PAGE_RENDERERS['page-admin-employees']     = () => renderAdminEmployees();
PAGE_RENDERERS['page-admin-salaries']      = () => renderAdminSalaries();
PAGE_RENDERERS['page-owner-home']          = () => renderOwnerHome();
PAGE_RENDERERS['page-owner-pay']       = () => renderUploadPage();
PAGE_RENDERERS['page-owner-history']   = () => renderOwnerHistory();
PAGE_RENDERERS['page-owner-notices']   = () => renderOwnerNotices();
PAGE_RENDERERS['page-owner-claims']    = () => renderOwnerClaims();
PAGE_RENDERERS['page-owner-expenses']  = () => renderOwnerExpenses();
PAGE_RENDERERS['page-owner-votes']     = () => renderOwnerVotes();
PAGE_RENDERERS['page-owner-visits']    = () => renderOwnerVisits();
PAGE_RENDERERS['page-owner-profile']       = () => renderOwnerProfile();
PAGE_RENDERERS['page-owner-reservations']    = () => renderOwnerReservations();
PAGE_RENDERERS['page-owner-pago-resultado']  = () => renderPaymentResult();
PAGE_RENDERERS['page-terms']                 = () => renderTermsPage();

// Exponer PAGE_RENDERERS globalmente (usado en admin/home.js y owner/home.js)
window.PAGE_RENDERERS = PAGE_RENDERERS;

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {});
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
