import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState } from '../../ui/helpers.js';

export function reservationStatusBadge(status) {
  if (status === 'pending')   return `<span class="badge" style="background:#e2e8f0;color:#64748b">Pendiente</span>`;
  if (status === 'approved')  return `<span class="badge badge-success">Aprobada</span>`;
  if (status === 'rejected')  return `<span class="badge badge-danger">Rechazada</span>`;
  if (status === 'cancelled') return `<span class="badge badge-neutral">Cancelada</span>`;
  return `<span class="badge">${status}</span>`;
}

export async function renderOwnerReservations() {
  const el = document.getElementById('page-owner-reservations');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res          = await api.reservations.getMine();
    const reservations = res.data.reservations;

    el.innerHTML = `
      <div class="oh-wrap">
        <div class="oh-greeting oh-entry" style="--delay:0ms">
          <div>
            <p class="oh-greeting-sub">Espacios</p>
            <h1 class="oh-greeting-name">Mis Reservas</h1>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openNewReservationModal()">+ Nueva</button>
        </div>
        ${reservations.length === 0
          ? `<div class="oc-empty oh-entry" style="--delay:60ms">
               <p class="oc-empty__icon">🏢</p>
               <p class="oc-empty__msg">No tenés reservas registradas.</p>
               <button class="btn btn-primary btn-sm" onclick="openNewReservationModal()">Crear primera reserva</button>
             </div>`
          : reservations.map((r, i) => `
              <div class="oc-card oh-entry" style="--delay:${Math.min(i * 40 + 40, 220)}ms">
                <div class="oc-card__header">
                  <span class="oc-card__cat">${r.space?.name || '—'}</span>
                  ${reservationStatusBadge(r.status)}
                </div>
                <p style="font-size:.9rem;font-weight:600;margin:.25rem 0">
                  📅 ${r.date} · ${r.startTime}–${r.endTime}
                </p>
                ${r.note ? `<p class="oc-card__body">${r.note}</p>` : ''}
                <div class="oc-card__footer">
                  <span class="oc-card__date">${formatDate(r.createdAt)}</span>
                  ${['pending', 'approved'].includes(r.status)
                    ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger);font-size:.75rem;padding:.3rem .6rem" onclick="cancelOwnerReservation('${r._id}')">Cancelar</button>`
                    : ''}
                </div>
              </div>`).join('')}
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
