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

function greetingLabel() {
  const h = new Date().getHours();
  const greeting = h < 12 ? 'BUENOS DÍAS' : h < 20 ? 'BUENAS TARDES' : 'BUENAS NOCHES';
  const fecha = new Date().toLocaleDateString('es-AR', { weekday: 'short', day: 'numeric', month: 'short' }).toUpperCase();
  return `${greeting} · ${fecha}`;
}

function initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0]).join('').toUpperCase() || '?';
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

    const firstName     = (state.user?.name || '').split(' ')[0] || 'Admin';
    const compRate      = stats.complianceRate || 0;
    const unpaiedCount  = Math.max(0, (stats.totalOwners || 0) - (stats.upToDate || 0));
    const pendingCount  = stats.pendingPayments || 0;
    const debtorCount   = stats.debtors || 0;
    const claimCount    = openClaims.length;
    const periodLabel   = (cfg.expenseMonth || '').toUpperCase();

    el.innerHTML = `
      <div class="flex col gap-3">

        <!-- Greeting -->
        <div class="home-greeting">
          <div class="hello">${greetingLabel()}</div>
          <h1>Hola, <em>${firstName}</em> 👋</h1>
          <div class="org-line">
            <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            ${cfg.consortiumName || 'Consorcio'}
            <span style="color:var(--border-md)">·</span>
            ${stats.totalOwners || 0} propietarios
          </div>
        </div>

        <!-- Hero estado -->
        <div class="hero-status">
          <div class="hero-top">
            <div class="hero-label"><span class="pulse"></span> ESTADO DEL CONSORCIO</div>
            ${periodLabel ? `<div class="hero-period">${periodLabel}</div>` : ''}
          </div>
          <div class="hero-main">
            <div class="hero-percent">${compRate}<span class="pct">%</span></div>
            <div class="hero-desc"><strong>${stats.upToDate || 0} de ${stats.totalOwners || 0}</strong> propietarios al día este mes</div>
          </div>
          <div class="hero-bar"><div class="fill" style="width:${compRate}%"></div></div>
          <div class="hero-chips">
            <div class="hero-chip warn" onclick="openStatDetail('pending')" title="Ver pagos pendientes">
              <span class="chip-num">${pendingCount}</span>
              <span class="chip-lbl">Por revisar</span>
            </div>
            <div class="hero-chip alert" onclick="openStatDetail('debtors')" title="Ver morosos">
              <span class="chip-num">${debtorCount}</span>
              <span class="chip-lbl">Morosos</span>
            </div>
            <div class="hero-chip" onclick="showPage('page-admin-claims');renderAdminClaims()" title="Ver reclamos">
              <span class="chip-num">${claimCount}</span>
              <span class="chip-lbl">Reclamos</span>
            </div>
          </div>
        </div>

        <!-- Acciones rápidas -->
        <div>
          <div class="section-label">
            <h2>Acciones rápidas</h2>
            ${pendingCount + debtorCount > 0 ? `<span class="caption">${pendingCount + debtorCount} PENDIENTES</span>` : ''}
          </div>
          <div class="quick-actions">
            <button class="quick-action warn" onclick="openStatDetail('pending')">
              ${pendingCount > 0 ? `<span class="qa-badge">${pendingCount}</span>` : ''}
              <div class="qa-ico">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><polyline points="9 15 11 17 15 13"/></svg>
              </div>
              <div class="qa-title">Comprobantes por revisar</div>
              <div class="qa-sub">Aprobá o rechazá pagos</div>
            </button>
            <button class="quick-action alert" onclick="openStatDetail('debtors')">
              ${debtorCount > 0 ? `<span class="qa-badge">${debtorCount}</span>` : ''}
              <div class="qa-ico">
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
              </div>
              <div class="qa-title">Gestionar morosos</div>
              <div class="qa-sub">Seguimiento y acuerdos</div>
            </button>
            <button class="quick-action wide" onclick="showPage('page-admin-notices');renderAdminNotices()">
              <div class="qa-ico">
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9"/><path d="M13.73 21a2 2 0 0 1-3.46 0"/></svg>
              </div>
              <div class="qa-body">
                <div class="qa-title">Nuevo aviso o comunicado</div>
                <div class="qa-sub">Crear aviso de corte, evento o noticia</div>
              </div>
              <svg class="qa-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
            </button>
          </div>
        </div>

        <!-- Recordatorio push -->
        <div class="reminder-card">
          <span class="reminder-tag">RECORDATORIO PUSH</span>
          <div class="big"><em>${unpaiedCount} propietario${unpaiedCount !== 1 ? 's' : ''}</em> sin pago<br>aprobado este mes</div>
          <p>Enviá un recordatorio automático a quienes todavía no subieron comprobante.</p>
          <button class="reminder-btn" data-requires-network onclick="triggerReminders()">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="22" y1="2" x2="11" y2="13"/><polygon points="22 2 15 22 11 13 2 9 22 2"/></svg>
            Enviar recordatorios ahora
          </button>
        </div>

        <!-- Comprobantes pendientes -->
        ${pending.length > 0 ? `
        <div>
          <div class="section-label">
            <h2>Comprobantes por revisar</h2>
          </div>
          <div class="pending-section">
            <div class="pending-section-head">
              <h3>${pending.length} esperando aprobación <span class="badge-new">NUEVOS</span></h3>
              <span class="pending-view-all" onclick="openStatDetail('pending')">Ver todos →</span>
            </div>
            ${pending.slice(0, 5).map(p => `
              <div class="pending-row" ${p.receipt?.url ? `onclick="downloadReceipt('${p._id}')" style="cursor:pointer"` : ''}>
                <div class="pending-ava">${initials(p.owner?.name)}</div>
                <div class="pending-info">
                  <div class="pending-name">${p.owner?.name || '—'}</div>
                  <div class="pending-meta">
                    <span>${p.owner?.unit || ''}</span>
                    <span>·</span>
                    <span>${formatMonth(p.month)}</span>
                    <span>·</span>
                    <span class="amt">$${p.amount.toLocaleString('es-AR')}</span>
                  </div>
                </div>
                <div class="pending-actions" onclick="event.stopPropagation()">
                  <button class="pa-btn ok" data-requires-network onclick="approvePayment('${p._id}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
                  </button>
                  <button class="pa-btn no" data-requires-network onclick="openRejectModal('${p._id}')">
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                  </button>
                </div>
              </div>`).join('')}
          </div>
        </div>` : ''}

        <!-- Reclamos abiertos (solo si existen) -->
        ${openClaims.length > 0 ? `
        <div class="card">
          <div class="card-header flex between">
            <h3>Reclamos Abiertos</h3>
            <div class="flex gap-1" style="align-items:center">
              <span class="badge badge-warning">${openClaims.length}</span>
              <button class="btn btn-ghost btn-sm" onclick="showPage('page-admin-claims');renderAdminClaims()">Ver todos</button>
            </div>
          </div>
          <div class="card-body flex col gap-2">
            ${openClaims.map(c => `
              <div style="padding:.5rem 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:.5rem">
                <div style="flex:1;min-width:0">
                  <p class="bold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title}</p>
                  <small style="color:var(--muted)">${c.owner?.name || '—'} · ${c.owner?.unit || ''} · ${CLAIM_CATEGORIES[c.category] || c.category}</small>
                </div>
                <button class="btn btn-success btn-sm" onclick="openResolveClaimModal('${c._id}','${c.title.replace(/'/g, '\\\'').replace(/"/g, '&quot;')}')">Resolver</button>
              </div>`).join('')}
          </div>
        </div>` : ''}

        <div class="last-updated">
          <span class="tick"></span>
          Actualizado hace instantes
        </div>

      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminHome()');
  }
}

window.renderAdminView = renderAdminView;
window.renderAdminHome = renderAdminHome;
