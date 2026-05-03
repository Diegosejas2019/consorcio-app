import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState } from '../../ui/helpers.js';
import { svgIcon } from '../../ui/icons.js';
import { VISIT_TYPES, visitStatusBadge } from '../admin/visits.js';

function formatDateTime(d) {
  if (!d) return '—';
  return new Date(d).toLocaleString('es-AR', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function _visitDotClass(status) {
  if (status === 'approved' || status === 'inside') return 's-success';
  if (status === 'pending')  return 's-warning';
  if (status === 'rejected') return 's-danger';
  return 's-muted';
}

export async function renderOwnerVisits() {
  const el = document.getElementById('page-owner-visits');
  el.innerHTML = `<div style="padding:16px">${skeleton(3)}</div>`;
  try {
    const res    = await api.visits.getMy();
    const visits = res.data.visits;

    el.innerHTML = `
      <div style="padding:0 16px 32px">
        <div class="row-between" style="align-items:flex-end;padding-top:16px">
          <div>
            <p class="page-eyebrow">Comunidad</p>
            <h1 class="page-title">Mis Visitas</h1>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openNewVisitModal()">${svgIcon('plus', 14)} Nueva</button>
        </div>

        ${visits.length === 0 ? `
        <div class="empty" style="padding:32px 0">
          <div class="empty-icon">${svgIcon('visit', 24)}</div>
          <p class="empty-title">Sin visitas</p>
          <p class="empty-sub">No tenés visitas registradas.</p>
          <button class="btn btn-primary" style="margin-top:16px" onclick="openNewVisitModal()">Registrar visita</button>
        </div>` : `
        <div class="card" style="padding:0;overflow:hidden;margin-top:18px">
          ${visits.map((v, i) => `
            ${i > 0 ? '<div style="height:1px;background:var(--border)"></div>' : ''}
            <div class="list-item" style="padding:14px 16px">
              <div class="dot-status ${_visitDotClass(v.status)}"></div>
              <div class="list-body">
                <div class="row-between">
                  <span class="list-title">${v.name}</span>
                  ${visitStatusBadge(v.status)}
                </div>
                <div class="row-between" style="margin-top:4px">
                  <span class="list-sub">${VISIT_TYPES[v.type] || v.type} · ${formatDateTime(v.expectedDate)}</span>
                  ${v.status === 'pending' ? `<button class="btn btn-ghost" style="color:var(--danger);font-size:.7rem;padding:3px 8px;height:auto" onclick="deleteVisit('${v._id}')">Eliminar</button>` : ''}
                </div>
                ${v.note ? `<div class="muted" style="font:var(--t-xs);margin-top:4px;font-style:italic">${v.note}</div>` : ''}
              </div>
            </div>`).join('')}
        </div>`}
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
