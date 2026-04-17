import { state } from '../../core/state.js';
import { showPage } from '../../core/router.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { formatMonth, errorState, downloadReceipt } from '../../ui/helpers.js';
import { CLAIM_CATEGORIES } from './claims.js';

export function renderAdminView() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  if (!state.user?.organization) {
    showPage('page-admin-settings');
    window.renderAdminSettings();
    return;
  }
  const saved = localStorage.getItem('lastPage_admin');
  const page  = saved && document.getElementById(saved) ? saved : 'page-admin-home';
  showPage(page);
  window.PAGE_RENDERERS[page]?.();
}

export async function renderAdminHome() {
  const el = document.getElementById('page-admin-home');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(5)}</div>`;
  try {
    const [statsRes, pendingRes, cfgRes, claimsRes] = await Promise.all([
      api.owners.getStats(),
      api.payments.getAll({ status: 'pending', limit: 20 }),
      api.config.get(),
      api.claims.getAll({ status: 'open', limit: 10 }),
    ]);

    const stats      = statsRes.data;
    const pending    = pendingRes.data.payments;
    const cfg        = cfgRes.data.config;
    const openClaims = claimsRes.data.claims;

    el.innerHTML = `
      <div class="flex col gap-3">
        <div>
          <p class="text-muted text-sm">Panel de</p>
          <h1>Administración</h1>
          <small>${cfg.consortiumName || 'Consorcio'} · ${cfg.expenseMonth || ''}</small>
        </div>

        <div class="stats-grid">
          <div class="stat-card stat-card-clickable" onclick="openStatDetail('pending')">
            <span class="stat-label">Pendientes</span>
            <span class="stat-value" style="color:var(--warning)">${stats.pendingPayments || 0}</span>
            <span class="stat-sub">por revisar ›</span>
          </div>
          <div class="stat-card stat-card-clickable" onclick="openStatDetail('compliance')">
            <span class="stat-label">Cumplimiento</span>
            <span class="stat-value" style="color:var(--success)">${stats.complianceRate || 0}%</span>
            <span class="stat-sub">${stats.upToDate || 0} de ${stats.totalOwners || 0} ›</span>
          </div>
          <div class="stat-card stat-card-clickable" onclick="openStatDetail('debtors')">
            <span class="stat-label">Morosos</span>
            <span class="stat-value" style="color:var(--danger)">${stats.debtors || 0}</span>
            <span class="stat-sub">propietarios ›</span>
          </div>
          <div class="stat-card stat-card-clickable" onclick="openStatDetail('collected')">
            <span class="stat-label">Recaudado</span>
            <span class="stat-value" style="color:var(--accent);font-size:1.3rem">$${((stats.totalCollected || 0) / 1000).toFixed(0)}k</span>
            <span class="stat-sub">histórico ›</span>
          </div>
        </div>

        <div class="card" style="background:var(--accent-lt);border:1px solid rgba(0,214,143,0.25)">
          <div class="card-body flex between" style="padding:.85rem 1rem;align-items:center;gap:1rem">
            <div>
              <p class="bold text-sm">Recordatorios de vencimiento</p>
              <small style="color:var(--muted)">Envía push a propietarios sin pago aprobado este mes</small>
            </div>
            <button class="btn btn-primary btn-sm" data-requires-network onclick="triggerReminders()" style="flex-shrink:0">
              Enviar ahora
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header flex between">
            <h3>Comprobantes Pendientes</h3>
            ${pending.length > 0 ? `<span class="badge badge-warning">${pending.length}</span>` : ''}
          </div>
          <div class="card-body flex col gap-2">
            ${pending.length === 0
              ? '<p class="text-muted text-sm">No hay comprobantes pendientes.</p>'
              : pending.map(p => `
                <div class="flex between" style="padding:.6rem 0;border-bottom:1px solid var(--border)">
                  <div>
                    <p class="bold text-sm">${p.owner?.name || '—'}</p>
                    <small>${p.owner?.unit || ''} · ${formatMonth(p.month)} · $${p.amount.toLocaleString('es-AR')}</small>
                    ${p.receipt?.url ? `<br><button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" style="font-size:.72rem;color:var(--accent);padding:0;background:none;border:none;cursor:pointer;text-decoration:underline">Ver comprobante ↗</button>` : ''}
                  </div>
                  <div class="flex gap-1">
                    <button class="btn btn-success btn-sm" data-requires-network onclick="approvePayment('${p._id}')">${SVG.check}</button>
                    <button class="btn btn-danger  btn-sm" data-requires-network onclick="openRejectModal('${p._id}')">${SVG.x}</button>
                  </div>
                </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header flex between">
            <h3>Reclamos Abiertos</h3>
            <div class="flex gap-1" style="align-items:center">
              ${openClaims.length > 0 ? `<span class="badge badge-warning">${openClaims.length}</span>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="showPage('page-admin-claims');renderAdminClaims()">Ver todos</button>
            </div>
          </div>
          <div class="card-body flex col gap-2">
            ${openClaims.length === 0
              ? '<p class="text-muted text-sm">No hay reclamos abiertos.</p>'
              : openClaims.map(c => `
                <div style="padding:.5rem 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:.5rem">
                  <div style="flex:1;min-width:0">
                    <p class="bold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title}</p>
                    <small style="color:var(--muted)">${c.owner?.name || '—'} · ${c.owner?.unit || ''} · ${CLAIM_CATEGORIES[c.category] || c.category}</small>
                  </div>
                  <button class="btn btn-success btn-sm" onclick="openResolveClaimModal('${c._id}','${c.title.replace(/'/g, '\\\'').replace(/"/g, '&quot;')}')">Resolver</button>
                </div>`).join('')}
          </div>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminHome()');
  }
}

window.renderAdminView = renderAdminView;
window.renderAdminHome = renderAdminHome;
