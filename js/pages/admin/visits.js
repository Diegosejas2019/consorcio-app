import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { formatDate, errorState } from '../../ui/helpers.js';
import { HELP_TEXTS } from '../../content/helpTexts.js';
import { state } from '../../core/state.js';
import { hasPermission } from '../../services/permissionService.js';

export const VISIT_TYPES = {
  visit:    'Visita',
  provider: 'Proveedor',
  delivery: 'Delivery',
};

const ACTION_LABELS = { check_in: 'Ingreso', check_out: 'Egreso' };

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export function visitStatusBadge(status) {
  if (status === 'pending')  return `<span class="badge" style="background:#e2e8f0;color:#64748b">Pendiente</span>`;
  if (status === 'approved') return `<span class="badge" style="background:#dbeafe;color:#1d4ed8">Aprobada</span>`;
  if (status === 'rejected') return `<span class="badge badge-danger">Rechazada</span>`;
  if (status === 'inside')   return `<span class="badge badge-success">Adentro</span>`;
  if (status === 'exited')   return `<span class="badge badge-neutral">Salió</span>`;
  return `<span class="badge">${status}</span>`;
}

export async function deleteVisit(id, isAdmin = false) {
  try {
    await api.visits.delete(id);
    toast('Visita eliminada.', 'success');
    if (isAdmin) window.renderAdminVisits();
    else window.renderOwnerVisits();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Check-in/out con modal de comentario ──────────────────────
function _openCheckModal(id, action) {
  const isIn   = action === 'check_in';
  const title  = isIn ? 'Registrar ingreso' : 'Registrar egreso';
  const btnLbl = isIn ? 'Confirmar ingreso' : 'Confirmar egreso';
  openModal(`
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">${title}</h2>
    <div class="flex col gap-2">
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:.4rem">
          Observación (opcional)
          <span class="has-tooltip" data-tooltip="${HELP_TEXTS.tooltips['visit-comment']}"><svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="13" height="13"><circle cx="12" cy="12" r="10"/><path d="M9.09 9a3 3 0 015.83 1c0 2-3 3-3 3"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg></span>
        </label>
        <textarea class="input" id="check-comment" rows="3" maxlength="500"
          placeholder="Ej: Ingresó con vehículo, dejó documento en portería…" style="resize:vertical"></textarea>
      </div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" onclick="window._confirmCheck('${id}','${action}')">
          ${btnLbl}
        </button>
      </div>
    </div>
  `);
}

window._confirmCheck = async function(id, action) {
  const comment = document.getElementById('check-comment')?.value.trim() || undefined;
  try {
    if (action === 'check_in') {
      await api.visits.checkIn(id, comment);
      toast('Ingreso registrado correctamente.', 'success');
    } else {
      await api.visits.checkOut(id, comment);
      toast('Egreso registrado correctamente.', 'success');
    }
    closeModal();
    window.renderAdminVisits();
  } catch (err) {
    toast(err.message, 'error');
  }
};

// ── Card de visita ────────────────────────────────────────────
function _renderCard(v, opts = {}) {
  const canCheckIn  = hasPermission('visits.checkIn');
  const canCheckOut = hasPermission('visits.checkOut');
  const canUpdate   = hasPermission('visits.update');
  const canDelete   = hasPermission('visits.delete');
  const isGuard     = state.adminRole === 'security_guard';

  const guardNoteBadge = v.guardNote
    ? `<div style="background:var(--accent-lt);border:1px solid rgba(156,242,123,0.2);border-radius:8px;padding:.5rem .7rem;font-size:.8rem;color:var(--text-bright);display:flex;gap:.4rem;align-items:flex-start">
        <span style="flex-shrink:0">📋</span>
        <span>${v.guardNote}</span>
       </div>`
    : '';

  const ownerInfo = v.owner
    ? `${v.owner.name || ''}${v.owner.unit ? ' · ' + v.owner.unit : ''}`
    : '—';

  return `
    <div style="background:var(--bg);border-radius:10px;padding:.85rem;display:flex;flex-direction:column;gap:.5rem">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
        <div style="flex:1;min-width:0">
          <p style="font-weight:600;font-size:.9rem;margin-bottom:.15rem">${v.name}</p>
          <p style="font-size:.75rem;color:var(--muted)">${ownerInfo} · ${VISIT_TYPES[v.type] || v.type}</p>
          <p style="font-size:.75rem;color:var(--muted)">📅 ${formatDateTime(v.expectedDate)}</p>
          ${v.note ? `<p style="font-size:.8rem;color:var(--muted);font-style:italic;margin-top:.2rem">${v.note}</p>` : ''}
        </div>
        ${visitStatusBadge(v.status)}
      </div>
      ${guardNoteBadge}
      <div class="flex gap-1" style="flex-wrap:wrap;align-items:center">
        ${v.status === 'pending' && canUpdate ? `
          <button class="btn btn-primary btn-sm" onclick="updateVisitStatus('${v._id}','approved')">Aprobar</button>
          <button class="btn btn-danger btn-sm"  onclick="updateVisitStatus('${v._id}','rejected')">Rechazar</button>` : ''}
        ${v.status === 'approved' && canCheckIn ? `
          <button class="btn btn-success btn-sm" onclick="window._openCheckModal('${v._id}','check_in')">Registrar ingreso</button>` : ''}
        ${v.status === 'inside' && canCheckOut ? `
          <button class="btn btn-secondary btn-sm" onclick="window._openCheckModal('${v._id}','check_out')">Registrar egreso</button>` : ''}
        ${!isGuard && canDelete ? `
          <button class="btn btn-ghost btn-sm" onclick="deleteVisit('${v._id}',true)" style="margin-left:auto;color:var(--muted)">${SVG.x}</button>` : ''}
      </div>
    </div>`;
}

window._openCheckModal = _openCheckModal;

// ── Vista vigilador: Visitas de hoy ──────────────────────────
async function _renderGuardView(el) {
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const res    = await api.visits.getToday();
    const visits = res.data.visits || [];

    const searchId = 'guard-search-' + Date.now();
    el.innerHTML = `
      <div class="flex col gap-3">
        <h1>Visitas de hoy</h1>
        <div class="card">
          <div class="card-body" style="padding:.85rem 1rem">
            <input class="input" id="${searchId}" placeholder="Buscar por nombre o propietario…"
              oninput="window._guardFilter()" style="width:100%">
          </div>
        </div>
        <div id="guard-cards" class="flex col gap-2">
          ${visits.length === 0
            ? `<div class="card"><div class="card-body"><p class="text-muted text-sm">No hay visitas registradas para hoy.</p></div></div>`
            : visits.map(v => _renderCard(v)).join('')}
        </div>
      </div>`;

    window._guardVisits  = visits;
    window._guardSearchId = searchId;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminVisits()');
  }
}

window._guardFilter = function() {
  const q     = document.getElementById(window._guardSearchId)?.value.toLowerCase().trim() || '';
  const cards = document.getElementById('guard-cards');
  if (!cards) return;
  const filtered = q
    ? (window._guardVisits || []).filter(v =>
        v.name?.toLowerCase().includes(q) ||
        v.owner?.name?.toLowerCase().includes(q) ||
        v.owner?.unit?.toLowerCase().includes(q))
    : (window._guardVisits || []);
  cards.innerHTML = filtered.length === 0
    ? `<div class="card"><div class="card-body"><p class="text-muted text-sm">Sin resultados.</p></div></div>`
    : filtered.map(v => _renderCard(v)).join('');
};

// ── Vista admin: todas las visitas ────────────────────────────
export async function renderAdminVisits() {
  const el = document.getElementById('page-admin-visits');
  if (!el) return;

  if (state.adminRole === 'security_guard') {
    return _renderGuardView(el);
  }

  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const statusFilter = document.getElementById('visit-filter-status')?.value || '';
    const dateFilter   = document.getElementById('visit-filter-date')?.value   || '';

    const params = { limit: 100 };
    if (statusFilter) params.status = statusFilter;
    if (dateFilter)   params.date   = dateFilter;

    const res    = await api.visits.getAll(params);
    const visits = res.data.visits;

    const pending  = visits.filter(v => v.status === 'pending');
    const approved = visits.filter(v => v.status === 'approved');
    const inside   = visits.filter(v => v.status === 'inside');
    const history  = visits.filter(v => v.status === 'rejected' || v.status === 'exited');

    el.innerHTML = `
      <div class="flex col gap-3">
        <h1>Visitas</h1>

        <div class="card">
          <div class="card-body" style="display:flex;gap:.75rem;flex-wrap:wrap;padding:.85rem 1rem">
            <select class="input" id="visit-filter-status" style="flex:1;min-width:130px" onchange="renderAdminVisits()">
              <option value="">Todos los estados</option>
              <option value="pending"  ${statusFilter === 'pending'  ? 'selected' : ''}>Pendientes</option>
              <option value="approved" ${statusFilter === 'approved' ? 'selected' : ''}>Aprobadas</option>
              <option value="rejected" ${statusFilter === 'rejected' ? 'selected' : ''}>Rechazadas</option>
              <option value="inside"   ${statusFilter === 'inside'   ? 'selected' : ''}>Adentro</option>
              <option value="exited"   ${statusFilter === 'exited'   ? 'selected' : ''}>Salieron</option>
            </select>
            <input class="input" type="date" id="visit-filter-date" style="flex:1;min-width:140px"
              value="${dateFilter}" oninput="renderAdminVisits()">
          </div>
        </div>

        ${visits.length === 0
          ? `<div class="card"><div class="card-body"><p class="text-muted text-sm">No hay visitas con esos filtros.</p></div></div>`
          : `
          ${pending.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Pendientes</h3>
                <span class="badge" style="background:#e2e8f0;color:#64748b">${pending.length}</span>
              </div>
              <div class="card-body flex col gap-2">${pending.map(v => _renderCard(v)).join('')}</div>
            </div>` : ''}
          ${approved.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Aprobadas</h3>
                <span class="badge" style="background:#dbeafe;color:#1d4ed8">${approved.length}</span>
              </div>
              <div class="card-body flex col gap-2">${approved.map(v => _renderCard(v)).join('')}</div>
            </div>` : ''}
          ${inside.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Adentro ahora</h3>
                <span class="badge badge-success">${inside.length}</span>
              </div>
              <div class="card-body flex col gap-2">${inside.map(v => _renderCard(v)).join('')}</div>
            </div>` : ''}
          ${history.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Historial</h3>
                <span class="badge badge-neutral">${history.length}</span>
              </div>
              <div class="card-body flex col gap-2">${history.map(v => _renderCard(v)).join('')}</div>
            </div>` : ''}`}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminVisits()');
  }
}

export async function updateVisitStatus(id, status) {
  const labels = {
    approved: 'Visita aprobada.',
    rejected: 'Visita rechazada.',
    inside:   'Ingreso registrado.',
    exited:   'Egreso registrado.',
  };
  try {
    await api.visits.updateStatus(id, status);
    toast(labels[status] || 'Estado actualizado.', 'success');
    renderAdminVisits();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Libro de visitas ──────────────────────────────────────────
window._logPage = window._logPage || 1;

export async function renderAdminVisitsLog() {
  const el = document.getElementById('page-admin-visits-log');
  if (!el) return;
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const dateFrom = document.getElementById('log-filter-from')?.value || '';
    const dateTo   = document.getElementById('log-filter-to')?.value   || '';
    const action   = document.getElementById('log-filter-action')?.value || '';

    const params = { page: window._logPage, limit: 50 };
    if (dateFrom) params.dateFrom = dateFrom;
    if (dateTo)   params.dateTo   = dateTo;
    if (action)   params.action   = action;

    const res        = await api.visits.getHistory(params);
    const logs       = res.data.logs || [];
    const pagination = res.pagination || {};

    const renderRow = (log) => {
      const ts      = formatDateTime(log.timestamp);
      const action  = ACTION_LABELS[log.action] || log.action;
      const clr     = log.action === 'check_in' ? 'var(--success)' : 'var(--muted)';
      return `
        <tr>
          <td style="font-size:.8rem;color:var(--muted)">${ts}</td>
          <td><span style="font-weight:600;color:${clr}">${action}</span></td>
          <td>${log.visitorName || '—'}</td>
          <td style="font-size:.8rem">${log.ownerName || '—'}${log.unitLabel ? ' · ' + log.unitLabel : ''}</td>
          <td style="font-size:.8rem;color:var(--muted)">${log.performedByName || log.performedBy?.name || '—'}</td>
          <td style="font-size:.8rem;color:var(--muted);font-style:italic">${log.comment || ''}</td>
        </tr>`;
    };

    el.innerHTML = `
      <div class="flex col gap-3">
        <h1>Libro de visitas</h1>
        <div class="card">
          <div class="card-body" style="display:flex;gap:.75rem;flex-wrap:wrap;padding:.85rem 1rem">
            <input class="input" type="date" id="log-filter-from" value="${dateFrom}"
              placeholder="Desde" style="flex:1;min-width:140px" oninput="window._logPage=1;renderAdminVisitsLog()">
            <input class="input" type="date" id="log-filter-to" value="${dateTo}"
              placeholder="Hasta" style="flex:1;min-width:140px" oninput="window._logPage=1;renderAdminVisitsLog()">
            <select class="input" id="log-filter-action" style="flex:1;min-width:130px" onchange="window._logPage=1;renderAdminVisitsLog()">
              <option value="">Ingresos y egresos</option>
              <option value="check_in"  ${action === 'check_in'  ? 'selected' : ''}>Solo ingresos</option>
              <option value="check_out" ${action === 'check_out' ? 'selected' : ''}>Solo egresos</option>
            </select>
          </div>
        </div>

        ${logs.length === 0
          ? `<div class="card"><div class="card-body"><p class="text-muted text-sm">No hay registros con esos filtros.</p></div></div>`
          : `
          <div class="card" style="overflow-x:auto">
            <table style="width:100%;border-collapse:collapse;font-size:.85rem">
              <thead>
                <tr style="border-bottom:1px solid var(--border)">
                  <th style="text-align:left;padding:.6rem .8rem;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Fecha/hora</th>
                  <th style="text-align:left;padding:.6rem .8rem;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Acción</th>
                  <th style="text-align:left;padding:.6rem .8rem;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Visitante</th>
                  <th style="text-align:left;padding:.6rem .8rem;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Propietario / Unidad</th>
                  <th style="text-align:left;padding:.6rem .8rem;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Registrado por</th>
                  <th style="text-align:left;padding:.6rem .8rem;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Observación</th>
                </tr>
              </thead>
              <tbody>
                ${logs.map(renderRow).join('')}
              </tbody>
            </table>
          </div>
          ${pagination.pages > 1 ? `
            <div class="flex gap-1" style="justify-content:center">
              <button class="btn btn-secondary btn-sm" ${window._logPage <= 1 ? 'disabled' : ''}
                onclick="window._logPage--;renderAdminVisitsLog()">Anterior</button>
              <span style="padding:.4rem .8rem;font-size:.85rem;color:var(--muted)">
                Pág. ${window._logPage} de ${pagination.pages}
              </span>
              <button class="btn btn-secondary btn-sm" ${window._logPage >= pagination.pages ? 'disabled' : ''}
                onclick="window._logPage++;renderAdminVisitsLog()">Siguiente</button>
            </div>` : ''}`}
      </div>`;

  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminVisitsLog()');
  }
}

window.renderAdminVisits    = renderAdminVisits;
window.renderAdminVisitsLog = renderAdminVisitsLog;
window.updateVisitStatus    = updateVisitStatus;
window.deleteVisit          = deleteVisit;
