import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { formatDate, errorState } from '../../ui/helpers.js';

export const CLAIM_CATEGORIES = {
  infrastructure: 'Infraestructura',
  security:       'Seguridad',
  noise:          'Ruidos',
  cleaning:       'Limpieza',
  billing:        'Facturación',
  other:          'Otro',
};

export function claimStatusBadge(status) {
  if (status === 'open')        return `<span class="badge badge-warning">Abierto</span>`;
  if (status === 'in_progress') return `<span class="badge badge-neutral" style="background:var(--accent-lt,#ede9fe);color:var(--accent)">En proceso</span>`;
  if (status === 'resolved')    return `<span class="badge badge-success">Resuelto</span>`;
  return `<span class="badge">${status}</span>`;
}

export async function deleteClaim(id, isAdmin = false) {
  try {
    await api.claims.delete(id);
    toast('Reclamo eliminado.', 'success');
    if (isAdmin) window.renderAdminClaims();
    else window.renderOwnerClaims();
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function renderAdminClaims() {
  const el = document.getElementById('page-admin-claims');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const res    = await api.claims.getAll({ limit: 100 });
    const claims = res.data.claims;

    const open       = claims.filter(c => c.status === 'open');
    const inProgress = claims.filter(c => c.status === 'in_progress');
    const resolved   = claims.filter(c => c.status === 'resolved');

    const renderClaimCard = (c) => `
      <div style="background:var(--bg);border-radius:10px;padding:.85rem;display:flex;flex-direction:column;gap:.5rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
          <div style="flex:1;min-width:0">
            <p style="font-weight:600;font-size:.9rem;margin-bottom:.15rem">${c.title}</p>
            <p style="font-size:.75rem;color:var(--muted)">${c.owner?.name || '—'} · ${c.owner?.unit || ''} · ${CLAIM_CATEGORIES[c.category] || c.category}</p>
            <p style="font-size:.75rem;color:var(--muted)">${formatDate(c.createdAt)}</p>
          </div>
          ${claimStatusBadge(c.status)}
        </div>
        <p style="font-size:.83rem;color:var(--text);line-height:1.4">${c.body}</p>
        ${c.adminNote ? `<p style="font-size:.78rem;color:var(--muted);font-style:italic">Nota: ${c.adminNote}</p>` : ''}
        <div class="flex gap-1" style="flex-wrap:wrap">
          ${c.status !== 'in_progress' && c.status !== 'resolved' ? `<button class="btn btn-secondary btn-sm" onclick="updateClaimStatus('${c._id}','in_progress')">En proceso</button>` : ''}
          ${c.status !== 'resolved' ? `<button class="btn btn-success btn-sm" onclick="openResolveClaimModal('${c._id}','${c.title.replace(/'/g, '\\\'').replace(/"/g, '&quot;')}')">Resolver</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="deleteClaim('${c._id}',true)" style="margin-left:auto;color:var(--muted)">${SVG.x}</button>
        </div>
      </div>`;

    el.innerHTML = `
      <div class="flex col gap-3">
        <h1>Reclamos</h1>
        ${open.length === 0 && inProgress.length === 0 && resolved.length === 0
          ? '<div class="card"><div class="card-body"><p class="text-muted text-sm">No hay reclamos registrados.</p></div></div>'
          : `
          ${open.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Abiertos</h3><span class="badge badge-warning">${open.length}</span>
              </div>
              <div class="card-body flex col gap-2">${open.map(renderClaimCard).join('')}</div>
            </div>` : ''}
          ${inProgress.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>En proceso</h3><span class="badge badge-neutral">${inProgress.length}</span>
              </div>
              <div class="card-body flex col gap-2">${inProgress.map(renderClaimCard).join('')}</div>
            </div>` : ''}
          ${resolved.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Resueltos</h3><span class="badge badge-success">${resolved.length}</span>
              </div>
              <div class="card-body flex col gap-2">${resolved.map(renderClaimCard).join('')}</div>
            </div>` : ''}`}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminClaims()');
  }
}

export async function updateClaimStatus(id, status, adminNote) {
  try {
    await api.claims.updateStatus(id, status, adminNote);
    toast(status === 'resolved' ? 'Reclamo resuelto.' : 'Estado actualizado.', 'success');
    renderAdminClaims();
  } catch (err) {
    toast(err.message, 'error');
  }
}

export function openResolveClaimModal(id, title) {
  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.75rem">Resolver reclamo</h2>
    <p style="font-size:.85rem;color:var(--muted);margin-bottom:1rem">${title}</p>
    <div class="form-group">
      <label>Nota para el propietario (opcional)</label>
      <textarea class="input" id="resolve-note" placeholder="Ej: Se realizó la reparación el día..." rows="3"></textarea>
    </div>
    <div class="flex col gap-1 mt-3">
      <button class="btn btn-success w-full" onclick="confirmResolveClaim('${id}')">Marcar como resuelto</button>
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
    </div>`;
}

export async function confirmResolveClaim(id) {
  const note = document.getElementById('resolve-note')?.value?.trim();
  closeModal();
  await updateClaimStatus(id, 'resolved', note);
}

window.renderAdminClaims    = renderAdminClaims;
window.updateClaimStatus    = updateClaimStatus;
window.openResolveClaimModal = openResolveClaimModal;
window.confirmResolveClaim  = confirmResolveClaim;
window.deleteClaim          = deleteClaim;
