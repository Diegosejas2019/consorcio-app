import { toast } from '../../ui/toast.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { errorState } from '../../ui/helpers.js';
import { reservationStatusBadge } from '../owner/reservations.js';

export async function renderAdminReservations() {
  const el = document.getElementById('page-admin-reservations');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    // Leer filtros guardados en el DOM (persisten si la página ya fue renderizada)
    const dateFilter   = document.getElementById('res-filter-date')?.value   || '';
    const statusFilter = document.getElementById('res-filter-status')?.value || '';

    const params = { limit: 100 };
    if (dateFilter)   params.date   = dateFilter;
    if (statusFilter) params.status = statusFilter;

    const res          = await api.reservations.getAll(params);
    const reservations = res.data.reservations;

    const today = new Date().toISOString().slice(0, 10);

    const renderCard = (r) => `
      <div style="background:var(--bg);border-radius:10px;padding:.85rem;display:flex;flex-direction:column;gap:.5rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
          <div style="flex:1;min-width:0">
            <p style="font-weight:600;font-size:.9rem;margin-bottom:.15rem">${r.space?.name || '—'}</p>
            <p style="font-size:.75rem;color:var(--muted)">${r.owner?.name || '—'}${r.owner?.unit ? ' · ' + r.owner.unit : ''}</p>
            <p style="font-size:.75rem;color:var(--muted)">📅 ${r.date} · ${r.startTime}–${r.endTime}</p>
          </div>
          ${reservationStatusBadge(r.status)}
        </div>
        ${r.note ? `<p style="font-size:.8rem;color:var(--muted);font-style:italic">${r.note}</p>` : ''}
        <div class="flex gap-1" style="flex-wrap:wrap;align-items:center">
          ${r.status === 'pending' ? `
            <button class="btn btn-success btn-sm" onclick="approveReservation('${r._id}')">Aprobar</button>
            <button class="btn btn-danger btn-sm"  onclick="rejectReservation('${r._id}')">Rechazar</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="deleteAdminReservation('${r._id}')" style="margin-left:auto;color:var(--muted)">${SVG.x}</button>
        </div>
      </div>`;

    const pending  = reservations.filter(r => r.status === 'pending');
    const upcoming = reservations.filter(r => r.status === 'approved' && r.date >= today);
    const past     = reservations.filter(r => r.status === 'approved' && r.date < today);
    const other    = reservations.filter(r => r.status === 'rejected' || r.status === 'cancelled');

    el.innerHTML = `
      <div class="flex col gap-3">
        <h1>Reservas</h1>

        <div class="card">
          <div class="card-body" style="display:flex;gap:.75rem;flex-wrap:wrap;padding:.85rem 1rem">
            <input class="input" type="date" id="res-filter-date" style="flex:1;min-width:140px"
              value="${dateFilter}" oninput="renderAdminReservations()">
            <select class="input" id="res-filter-status" style="flex:1;min-width:130px" onchange="renderAdminReservations()">
              <option value="">Todos los estados</option>
              <option value="pending"   ${statusFilter === 'pending'   ? 'selected' : ''}>Pendientes</option>
              <option value="approved"  ${statusFilter === 'approved'  ? 'selected' : ''}>Aprobadas</option>
              <option value="rejected"  ${statusFilter === 'rejected'  ? 'selected' : ''}>Rechazadas</option>
              <option value="cancelled" ${statusFilter === 'cancelled' ? 'selected' : ''}>Canceladas</option>
            </select>
          </div>
        </div>

        ${reservations.length === 0
          ? `<div class="card"><div class="card-body"><p class="text-muted text-sm">No hay reservas con esos filtros.</p></div></div>`
          : `
          ${pending.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Pendientes</h3>
                <span class="badge" style="background:#e2e8f0;color:#64748b">${pending.length}</span>
              </div>
              <div class="card-body flex col gap-2">${pending.map(renderCard).join('')}</div>
            </div>` : ''}
          ${upcoming.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Próximas aprobadas</h3>
                <span class="badge badge-success">${upcoming.length}</span>
              </div>
              <div class="card-body flex col gap-2">${upcoming.map(renderCard).join('')}</div>
            </div>` : ''}
          ${past.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Historial</h3>
                <span class="badge badge-neutral">${past.length}</span>
              </div>
              <div class="card-body flex col gap-2">${past.map(renderCard).join('')}</div>
            </div>` : ''}
          ${other.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Rechazadas / Canceladas</h3>
                <span class="badge badge-neutral">${other.length}</span>
              </div>
              <div class="card-body flex col gap-2">${other.map(renderCard).join('')}</div>
            </div>` : ''}`}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminReservations()');
  }
}

export async function approveReservation(id) {
  try {
    await api.reservations.updateStatus(id, 'approved');
    toast('Reserva aprobada.', 'success');
    renderAdminReservations();
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function rejectReservation(id) {
  try {
    await api.reservations.updateStatus(id, 'rejected');
    toast('Reserva rechazada.', 'success');
    renderAdminReservations();
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function deleteAdminReservation(id) {
  try {
    await api.reservations.delete(id);
    toast('Reserva eliminada.', 'success');
    renderAdminReservations();
  } catch (err) {
    toast(err.message, 'error');
  }
}

window.renderAdminReservations  = renderAdminReservations;
window.approveReservation       = approveReservation;
window.rejectReservation        = rejectReservation;
window.deleteAdminReservation   = deleteAdminReservation;
