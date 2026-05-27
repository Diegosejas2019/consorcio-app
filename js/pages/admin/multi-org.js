import { state }    from '../../core/state.js';
import { showPage }  from '../../core/router.js';
import { apiCall }   from '../../core/apiWrapper.js';
import { skeleton }  from '../../ui/skeleton.js';
import { toast }     from '../../ui/toast.js';

const SVG_BUILDINGS = `<svg width="16" height="16" fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><rect x="3" y="7" width="8" height="14"/><rect x="13" y="3" width="8" height="18"/><line x1="3" y1="21" x2="21" y2="21"/></svg>`;

function fmtMoney(n) {
  if (!n) return '$0';
  return '$' + Math.round(n).toLocaleString('es-AR');
}

function alertBadgeHtml(level) {
  if (level === 'critical') return `<span class="badge badge-danger">Crítico</span>`;
  if (level === 'warning')  return `<span class="badge badge-warning">Atención</span>`;
  return `<span class="badge badge-success">Normal</span>`;
}

function renditionBadgeHtml(status) {
  if (!status) return `<span class="text-muted" style="font-size:0.8rem">Sin generar</span>`;
  if (status === 'generated') return `<span class="badge badge-success">Generada</span>`;
  if (status === 'draft')     return `<span class="badge badge-warning">Borrador</span>`;
  if (status === 'archived')  return `<span class="badge badge-neutral" style="background:var(--surface-3);color:var(--muted);border:1px solid var(--border-md)">Archivada</span>`;
  return `<span class="badge badge-neutral">${status}</span>`;
}

function orgCardHtml(org) {
  const mid = org.membershipId;
  const debtorColor  = org.debtorsCount > 0  ? 'color:var(--danger)'  : '';
  const pendingColor = org.pendingPaymentsCount > 0 ? 'color:var(--warning)' : '';
  const claimColor   = org.openClaimsCount > 0  ? 'color:var(--warning)' : '';
  const unidentColor = org.pendingUnidentifiedPaymentsCount > 0 ? 'color:var(--warning)' : '';

  return `
    <div class="card" style="margin-bottom:0.75rem">
      <div class="card-header flex between center" style="gap:0.5rem">
        <span style="font-weight:700;color:var(--text-bright);font-size:1rem">${org.organizationName}</span>
        ${alertBadgeHtml(org.alertLevel)}
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:0.75rem;margin-bottom:1rem">
          <div class="stat-card">
            <div class="stat-label">Recaudado</div>
            <div class="stat-value" style="font-size:1.1rem">${fmtMoney(org.approvedPaymentsAmountCurrentPeriod)}</div>
            <div class="stat-sub">${org.periodLabel || org.period || '—'}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Pend. aprob.</div>
            <div class="stat-value" style="font-size:1.1rem;${pendingColor}">${org.pendingPaymentsCount}</div>
            <div class="stat-sub">pagos</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Deudores</div>
            <div class="stat-value" style="font-size:1.1rem;${debtorColor}">${org.debtorsCount}</div>
            <div class="stat-sub">de ${org.ownersCount}</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Reclamos</div>
            <div class="stat-value" style="font-size:1.1rem;${claimColor}">${org.openClaimsCount}</div>
            <div class="stat-sub">abiertos</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Sin ident.</div>
            <div class="stat-value" style="font-size:1.1rem;${unidentColor}">${org.pendingUnidentifiedPaymentsCount}</div>
            <div class="stat-sub">pagos</div>
          </div>
          <div class="stat-card">
            <div class="stat-label">Rendición</div>
            <div class="stat-value" style="font-size:0.85rem;display:flex;align-items:center;min-height:1.6rem">${renditionBadgeHtml(org.currentRenditionStatus)}</div>
            <div class="stat-sub">${org.period || '—'}</div>
          </div>
        </div>
        ${org.pendingAccessRequestsCount > 0 ? `
          <div style="margin-bottom:0.85rem;padding:0.5rem 0.75rem;background:var(--accent-lt);border-radius:8px;font-size:0.82rem;color:var(--text-bright)">
            ${SVG_BUILDINGS} ${org.pendingAccessRequestsCount} solicitud${org.pendingAccessRequestsCount > 1 ? 'es' : ''} de acceso pendiente${org.pendingAccessRequestsCount > 1 ? 's' : ''}
          </div>
        ` : ''}
        <div class="flex gap-2" style="flex-wrap:wrap">
          <button class="btn btn-primary btn-sm" onclick="multiOrgEnter('${mid}')">Entrar</button>
          <button class="btn btn-ghost btn-sm" onclick="multiOrgGoTo('${mid}','page-admin-payments','renderAdminPayments')">Pagos</button>
          <button class="btn btn-ghost btn-sm" onclick="multiOrgGoTo('${mid}','page-admin-delinquency','renderAdminDelinquency')">Morosidad</button>
          <button class="btn btn-ghost btn-sm" onclick="multiOrgGoTo('${mid}','page-admin-claims','renderAdminClaims')">Reclamos</button>
        </div>
      </div>
    </div>
  `;
}

export async function renderAdminMultiOrg() {
  const el = document.getElementById('page-admin-multi-org');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(5)}</div>`;

  try {
    const res  = await apiCall(() => api.admin.getMultiOrgSummary(), { loading: false });
    const orgs = res.data || [];

    if (!orgs.length) {
      el.innerHTML = `
        <div class="card"><div class="card-body">
          <p class="text-muted text-sm">No hay organizaciones disponibles.</p>
        </div></div>`;
      return;
    }

    el.innerHTML = `
      <div class="flex between center" style="margin-bottom:0.25rem">
        <h2 style="margin:0">Mis organizaciones</h2>
        <button class="btn btn-ghost btn-sm" onclick="renderAdminMultiOrg()">Actualizar</button>
      </div>
      <p class="text-muted text-sm" style="margin:0 0 0.75rem">${orgs.length} consorcio${orgs.length > 1 ? 's' : ''} administrado${orgs.length > 1 ? 's' : ''}</p>
      ${orgs.map(orgCardHtml).join('')}
    `;
  } catch {
    el.innerHTML = `
      <div class="card"><div class="card-body">
        <p class="text-muted text-sm">Error al cargar las organizaciones. Intentá nuevamente.</p>
        <button class="btn btn-ghost btn-sm" style="margin-top:0.5rem" onclick="renderAdminMultiOrg()">Reintentar</button>
      </div></div>`;
  }
}

window.renderAdminMultiOrg = renderAdminMultiOrg;

window.multiOrgEnter = async function(membershipId) {
  const currentId = state.membership?._id?.toString() || state.membership?.toString();
  if (currentId === membershipId) {
    showPage('page-admin-home');
    window.renderAdminHome?.();
    return;
  }
  await window.switchContext(membershipId);
};

window.multiOrgGoTo = async function(membershipId, pageId, renderFn) {
  const currentId = state.membership?._id?.toString() || state.membership?.toString();
  if (currentId === membershipId) {
    showPage(pageId);
    window[renderFn]?.();
    return;
  }
  localStorage.setItem('lastPage_admin', pageId);
  await window.switchContext(membershipId);
};
