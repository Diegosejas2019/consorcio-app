import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState } from '../../ui/helpers.js';
import { CLAIM_CATEGORIES, claimStatusBadge } from '../admin/claims.js';

export async function renderOwnerClaims() {
  const el = document.getElementById('page-owner-claims');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res    = await api.claims.getAll({ limit: 50 });
    const claims = res.data.claims;

    el.innerHTML = `
      <div class="oh-wrap">
        <div class="oh-greeting oh-entry" style="--delay:0ms">
          <div>
            <p class="oh-greeting-sub">Soporte</p>
            <h1 class="oh-greeting-name">Mis Reclamos</h1>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openNewClaimModal()">+ Nuevo</button>
        </div>
        ${claims.length === 0
          ? `<div class="oc-empty oh-entry" style="--delay:60ms">
               <p class="oc-empty__icon">📝</p>
               <p class="oc-empty__msg">No tenés reclamos registrados.</p>
               <button class="btn btn-primary btn-sm" onclick="openNewClaimModal()">Crear primer reclamo</button>
             </div>`
          : claims.map((c, i) => `
              <div class="oc-card oh-entry" style="--delay:${Math.min(i * 40 + 40, 220)}ms">
                <div class="oc-card__header">
                  <span class="oc-card__cat">${CLAIM_CATEGORIES[c.category] || c.category}</span>
                  ${claimStatusBadge(c.status)}
                </div>
                <h3 class="oc-card__title">${c.title}</h3>
                <p class="oc-card__body">${c.body}</p>
                ${c.adminNote ? `<div class="oc-admin-note">💬 ${c.adminNote}</div>` : ''}
                <div class="oc-card__footer">
                  <span class="oc-card__date">${formatDate(c.createdAt)}</span>
                  ${c.status === 'open' ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger);font-size:.75rem;padding:.3rem .6rem" onclick="deleteClaim('${c._id}')">Eliminar</button>` : ''}
                </div>
              </div>`).join('')}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerClaims()');
  }
}

export function openNewClaimModal() {
  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nuevo Reclamo</h2>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Categoría</label>
        <select class="input" id="claim-category">
          ${Object.entries(CLAIM_CATEGORIES).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Título</label>
        <input class="input" id="claim-title" placeholder="Ej: Pérdida de agua en pasillo" maxlength="150">
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <textarea class="input" id="claim-body" placeholder="Describí el problema con el mayor detalle posible..." rows="4" maxlength="2000"></textarea>
      </div>
      <button class="btn btn-primary w-full" id="btn-submit-claim" data-requires-network onclick="submitClaim()">Enviar reclamo</button>
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
    </div>`;
}

export async function submitClaim() {
  const category = document.getElementById('claim-category')?.value;
  const title    = document.getElementById('claim-title')?.value?.trim();
  const body     = document.getElementById('claim-body')?.value?.trim();

  if (!title) { toast('El título es obligatorio.', 'error'); return; }
  if (!body)  { toast('La descripción es obligatoria.', 'error'); return; }

  const btn = document.getElementById('btn-submit-claim');
  setBtnLoading(btn, true);
  try {
    await api.claims.create({ category, title, body });
    closeModal();
    toast('Reclamo enviado correctamente.', 'success');
    renderOwnerClaims();
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

window.renderOwnerClaims = renderOwnerClaims;
window.openNewClaimModal = openNewClaimModal;
window.submitClaim       = submitClaim;
