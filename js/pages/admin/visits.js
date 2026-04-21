import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { formatDate, errorState } from '../../ui/helpers.js';

export const VISIT_TYPES = {
  visit:    'Visita',
  provider: 'Proveedor',
  delivery: 'Delivery',
};

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

export async function renderAdminVisits() {
  const el = document.getElementById('page-admin-visits');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const statusFilter = document.getElementById('visit-filter-status')?.value || '';
    const dateFilter   = document.getElementById('visit-filter-date')?.value   || '';

    const params = { limit: 100 };
    if (statusFilter) params.status = statusFilter;
    if (dateFilter)   params.date   = dateFilter;

    const res    = await api.visits.getAll(params);
    const visits = res.data.visits;

    const renderCard = (v) => `
      <div style="background:var(--bg);border-radius:10px;padding:.85rem;display:flex;flex-direction:column;gap:.5rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
          <div style="flex:1;min-width:0">
            <p style="font-weight:600;font-size:.9rem;margin-bottom:.15rem">${v.name}</p>
            <p style="font-size:.75rem;color:var(--muted)">${v.owner?.name || '—'}${v.owner?.unit ? ' · ' + v.owner.unit : ''} · ${VISIT_TYPES[v.type] || v.type}</p>
            <p style="font-size:.75rem;color:var(--muted)">📅 ${formatDateTime(v.expectedDate)}</p>
          </div>
          ${visitStatusBadge(v.status)}
        </div>
        ${v.note ? `<p style="font-size:.8rem;color:var(--muted);font-style:italic">${v.note}</p>` : ''}
        <div class="flex gap-1" style="flex-wrap:wrap;align-items:center">
          ${v.status === 'pending' ? `
            <button class="btn btn-primary btn-sm" onclick="updateVisitStatus('${v._id}','approved')">Aprobar</button>
            <button class="btn btn-danger btn-sm"  onclick="updateVisitStatus('${v._id}','rejected')">Rechazar</button>` : ''}
          ${v.status === 'approved' ? `
            <button class="btn btn-success btn-sm" onclick="updateVisitStatus('${v._id}','inside')">Registrar ingreso</button>` : ''}
          ${v.status === 'inside' ? `
            <button class="btn btn-secondary btn-sm" onclick="updateVisitStatus('${v._id}','exited')">Registrar egreso</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="deleteVisit('${v._id}',true)" style="margin-left:auto;color:var(--muted)">${SVG.x}</button>
        </div>
      </div>`;

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
              <div class="card-body flex col gap-2">${pending.map(renderCard).join('')}</div>
            </div>` : ''}
          ${approved.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Aprobadas</h3>
                <span class="badge" style="background:#dbeafe;color:#1d4ed8">${approved.length}</span>
              </div>
              <div class="card-body flex col gap-2">${approved.map(renderCard).join('')}</div>
            </div>` : ''}
          ${inside.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Adentro ahora</h3>
                <span class="badge badge-success">${inside.length}</span>
              </div>
              <div class="card-body flex col gap-2">${inside.map(renderCard).join('')}</div>
            </div>` : ''}
          ${history.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Historial</h3>
                <span class="badge badge-neutral">${history.length}</span>
              </div>
              <div class="card-body flex col gap-2">${history.map(renderCard).join('')}</div>
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

window.renderAdminVisits = renderAdminVisits;
window.updateVisitStatus = updateVisitStatus;
window.deleteVisit       = deleteVisit;
