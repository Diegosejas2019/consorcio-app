import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState } from '../../ui/helpers.js';
import { svgIcon } from '../../ui/icons.js';

export function reservationStatusBadge(status) {
  if (status === 'pending')   return `<span class="badge" style="background:#e2e8f0;color:#64748b">Pendiente</span>`;
  if (status === 'approved')  return `<span class="badge badge-success">Aprobada</span>`;
  if (status === 'rejected')  return `<span class="badge badge-danger">Rechazada</span>`;
  if (status === 'cancelled') return `<span class="badge badge-neutral">Cancelada</span>`;
  return `<span class="badge">${status}</span>`;
}

function _resDotClass(status) {
  if (status === 'approved')  return 's-success';
  if (status === 'pending')   return 's-warning';
  if (status === 'rejected' || status === 'cancelled') return 's-danger';
  return 's-muted';
}

export async function renderOwnerReservations() {
  const el = document.getElementById('page-owner-reservations');
  el.innerHTML = `<div style="padding:16px">${skeleton(3)}</div>`;
  try {
    const res          = await api.reservations.getMine();
    const reservations = res.data.reservations;

    el.innerHTML = `
      <div style="padding:0 16px 32px">
        <div class="row-between" style="align-items:flex-end;padding-top:16px">
          <div>
            <p class="page-eyebrow">Comunidad</p>
            <h1 class="page-title">Mis Reservas</h1>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openNewReservationModal()">${svgIcon('plus', 14)} Nueva</button>
        </div>

        ${reservations.length === 0 ? `
        <div class="empty" style="padding:32px 0">
          <div class="empty-icon">${svgIcon('court', 24)}</div>
          <p class="empty-title">Sin reservas</p>
          <p class="empty-sub">No tenés reservas registradas.</p>
          <button class="btn btn-primary" style="margin-top:16px" onclick="openNewReservationModal()">Crear reserva</button>
        </div>` : `
        <div class="card" style="padding:0;overflow:hidden;margin-top:18px">
          ${reservations.map((r, i) => `
            ${i > 0 ? '<div style="height:1px;background:var(--border)"></div>' : ''}
            <div class="list-item" style="padding:14px 16px">
              <div class="dot-status ${_resDotClass(r.status)}"></div>
              <div class="list-body">
                <div class="row-between">
                  <span class="list-title">${r.space?.name || '—'}</span>
                  ${reservationStatusBadge(r.status)}
                </div>
                <div class="row-between" style="margin-top:4px">
                  <span class="list-sub">${svgIcon('calendar', 12)} ${r.date} · ${r.startTime}–${r.endTime}</span>
                  ${['pending', 'approved'].includes(r.status) ? `<button class="btn btn-ghost" style="color:var(--danger);font-size:.7rem;padding:3px 8px;height:auto" onclick="cancelOwnerReservation('${r._id}')">Cancelar</button>` : ''}
                </div>
                ${r.note ? `<div class="muted" style="font:var(--t-xs);margin-top:4px">${r.note}</div>` : ''}
              </div>
            </div>`).join('')}
        </div>`}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerReservations()');
  }
}

export async function openNewReservationModal() {
  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nueva Reserva</h2>
    <div class="flex col gap-2" id="reservation-form-inner">
      <p class="text-sm text-muted" style="text-align:center">Cargando espacios…</p>
    </div>`;

  let spaces = [];
  try {
    const res = await api.spaces.getAll();
    spaces = res.data.spaces;
  } catch (err) {
    document.getElementById('reservation-form-inner').innerHTML =
      `<p class="text-sm" style="color:var(--danger)">No se pudieron cargar los espacios.</p>
       <button class="btn btn-secondary w-full" onclick="closeModal()">Cerrar</button>`;
    return;
  }

  if (spaces.length === 0) {
    document.getElementById('reservation-form-inner').innerHTML =
      `<p class="text-sm text-muted" style="text-align:center">No hay espacios disponibles para reservar.</p>
       <button class="btn btn-secondary w-full" onclick="closeModal()">Cerrar</button>`;
    return;
  }

  const today = new Date().toISOString().slice(0, 10);

  document.getElementById('reservation-form-inner').innerHTML = `
    <div class="form-group">
      <label>Espacio</label>
      <select class="input" id="res-space">
        ${spaces.map(s => `<option value="${s._id}">${s.name}${s.capacity ? ` (cap. ${s.capacity})` : ''}${s.requiresApproval ? ' — requiere aprobación' : ''}</option>`).join('')}
      </select>
    </div>
    <div class="form-group">
      <label>Fecha</label>
      <input class="input" type="date" id="res-date" min="${today}" value="${today}">
    </div>
    <div class="flex gap-2">
      <div class="form-group" style="flex:1">
        <label>Hora inicio</label>
        <input class="input" type="time" id="res-start" value="09:00">
      </div>
      <div class="form-group" style="flex:1">
        <label>Hora fin</label>
        <input class="input" type="time" id="res-end" value="10:00">
      </div>
    </div>
    <div class="form-group">
      <label>Nota <span style="color:var(--muted);font-size:.8rem">(opcional)</span></label>
      <textarea class="input" id="res-note" placeholder="Ej: Cumpleaños familiar" rows="2" maxlength="500"></textarea>
    </div>
    <button class="btn btn-primary w-full" id="btn-submit-reservation" data-requires-network onclick="submitReservation()">Confirmar reserva</button>
    <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>`;
}

export async function submitReservation() {
  const spaceId   = document.getElementById('res-space')?.value;
  const date      = document.getElementById('res-date')?.value;
  const startTime = document.getElementById('res-start')?.value;
  const endTime   = document.getElementById('res-end')?.value;
  const note      = document.getElementById('res-note')?.value?.trim();

  if (!date)                    { toast('La fecha es obligatoria.', 'error'); return; }
  if (!startTime || !endTime)   { toast('Las horas son obligatorias.', 'error'); return; }
  if (endTime <= startTime)     { toast('La hora de fin debe ser posterior a la de inicio.', 'error'); return; }

  const today = new Date().toISOString().slice(0, 10);
  if (date < today)             { toast('No se permiten reservas en el pasado.', 'error'); return; }

  const btn = document.getElementById('btn-submit-reservation');
  setBtnLoading(btn, true);
  try {
    await api.reservations.create({ spaceId, date, startTime, endTime, note });
    closeModal();
    toast('Reserva creada correctamente.', 'success');
    renderOwnerReservations();
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

export async function cancelOwnerReservation(id) {
  try {
    await api.reservations.delete(id);
    toast('Reserva cancelada.', 'success');
    renderOwnerReservations();
  } catch (err) {
    toast(err.message, 'error');
  }
}

window.renderOwnerReservations  = renderOwnerReservations;
window.openNewReservationModal   = openNewReservationModal;
window.submitReservation         = submitReservation;
window.cancelOwnerReservation    = cancelOwnerReservation;
