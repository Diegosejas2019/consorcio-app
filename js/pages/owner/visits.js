import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState } from '../../ui/helpers.js';
import { VISIT_TYPES, visitStatusBadge } from '../admin/visits.js';

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

export async function renderOwnerVisits() {
  const el = document.getElementById('page-owner-visits');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res    = await api.visits.getMy();
    const visits = res.data.visits;

    el.innerHTML = `
      <div class="oh-wrap">
        <div class="oh-greeting oh-entry" style="--delay:0ms">
          <div>
            <p class="oh-greeting-sub">Control de acceso</p>
            <h1 class="oh-greeting-name">Mis Visitas</h1>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openNewVisitModal()">+ Nueva</button>
        </div>
        ${visits.length === 0
          ? `<div class="oc-empty oh-entry" style="--delay:60ms">
               <p class="oc-empty__icon">🚪</p>
               <p class="oc-empty__msg">No tenés visitas registradas.</p>
               <button class="btn btn-primary btn-sm" onclick="openNewVisitModal()">Registrar visita</button>
             </div>`
          : visits.map((v, i) => `
              <div class="oc-card oh-entry" style="--delay:${Math.min(i * 40 + 40, 220)}ms">
                <div class="oc-card__header">
                  <span class="oc-card__cat">${VISIT_TYPES[v.type] || v.type}</span>
                  ${visitStatusBadge(v.status)}
                </div>
                <h3 class="oc-card__title">${v.name}</h3>
                <p class="oc-card__body" style="font-size:.83rem;color:var(--muted)">
                  📅 ${formatDateTime(v.expectedDate)}
                </p>
                ${v.note ? `<p class="oc-card__body" style="font-size:.8rem;color:var(--muted);font-style:italic">${v.note}</p>` : ''}
                <div class="oc-card__footer">
                  <span class="oc-card__date">${formatDate(v.createdAt)}</span>
                  ${v.status === 'pending'
                    ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger);font-size:.75rem;padding:.3rem .6rem" onclick="deleteVisit('${v._id}')">Eliminar</button>`
                    : ''}
                </div>
              </div>`).join('')}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerVisits()');
  }
}

export function openNewVisitModal() {
  const minDate = new Date().toISOString().slice(0, 16);
  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nueva Visita</h2>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Nombre del visitante</label>
        <input class="input" id="visit-name" placeholder="Ej: Juan Pérez" maxlength="150">
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select class="input" id="visit-type">
          ${Object.entries(VISIT_TYPES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Fecha y hora esperada</label>
        <input class="input" type="datetime-local" id="visit-date" min="${minDate}">
      </div>
      <div class="form-group">
        <label>Nota (opcional)</label>
        <textarea class="input" id="visit-note" placeholder="Info adicional para el portero..." rows="2" maxlength="500"></textarea>
      </div>
      <button class="btn btn-primary w-full" id="btn-submit-visit" data-requires-network onclick="submitVisit()">Registrar visita</button>
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
    </div>`;
}

export async function submitVisit() {
  const name         = document.getElementById('visit-name')?.value?.trim();
  const type         = document.getElementById('visit-type')?.value;
  const expectedDate = document.getElementById('visit-date')?.value;
  const note         = document.getElementById('visit-note')?.value?.trim();

  if (!name)         { toast('El nombre del visitante es obligatorio.', 'error'); return; }
  if (!expectedDate) { toast('La fecha esperada es obligatoria.', 'error'); return; }

  const btn = document.getElementById('btn-submit-visit');
  setBtnLoading(btn, true);
  try {
    await api.visits.create({ name, type, expectedDate, note });
    closeModal();
    toast('Visita registrada correctamente.', 'success');
    renderOwnerVisits();
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

window.renderOwnerVisits = renderOwnerVisits;
window.openNewVisitModal = openNewVisitModal;
window.submitVisit       = submitVisit;
