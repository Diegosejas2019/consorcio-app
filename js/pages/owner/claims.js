import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState, downloadAttachment } from '../../ui/helpers.js';
import { CLAIM_CATEGORIES, claimStatusBadge } from '../admin/claims.js';

let _selectedFiles = [];

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
                ${c.attachments?.length ? `<div class="flex gap-1" style="flex-wrap:wrap;margin-top:.25rem">${_claimAttachmentButtons(c._id, c.attachments)}</div>` : ''}
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
  _selectedFiles = [];
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
      <div class="form-group">
        <label>Adjuntos <span class="text-muted" style="font-size:.8rem">(opcional · máx. 3 archivos · 10 MB c/u)</span></label>
        <input class="input" type="file" id="claim-files" accept="image/*,.pdf" multiple style="display:none"
          onchange="onClaimFilesChange(this.files)">
        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('claim-files').click()">📎 Seleccionar archivos</button>
        <div id="claim-files-preview"></div>
      </div>
      <button class="btn btn-primary w-full" id="btn-submit-claim" onclick="submitClaim()">Enviar reclamo</button>
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
    </div>`;
}

function _truncateFilename(str, max = 20) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function _formatSize(bytes) {
  return bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(0)} KB` : `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function _renderFilePreview() {
  const el = document.getElementById('claim-files-preview');
  if (!el) return;
  if (!_selectedFiles.length) { el.innerHTML = ''; return; }
  el.innerHTML = `<div class="flex gap-1" style="flex-wrap:wrap;margin-top:.4rem">${
    _selectedFiles.map((f, i) => {
      const isImg = f.type.startsWith('image/');
      return `<div style="display:flex;align-items:center;gap:.3rem;background:var(--surface-2);border-radius:6px;padding:.2rem .5rem;font-size:.75rem">
        ${isImg ? '🖼️' : '📄'}
        <span>${_truncateFilename(f.name)}</span>
        <span style="color:var(--muted)">${_formatSize(f.size)}</span>
        <button type="button" onclick="removeClaimFile(${i})" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:0;line-height:1">✕</button>
      </div>`;
    }).join('')
  }</div>`;
}

export function onClaimFilesChange(fileList) {
  const incoming = Array.from(fileList);
  const remaining = 3 - _selectedFiles.length;
  if (remaining <= 0) { toast('Máximo 3 archivos permitidos.', 'warning'); return; }
  _selectedFiles = _selectedFiles.concat(incoming.slice(0, remaining));
  if (incoming.length > remaining) toast('Se agregaron solo los primeros archivos hasta completar 3.', 'warning');
  document.getElementById('claim-files').value = '';
  _renderFilePreview();
}

export function removeClaimFile(index) {
  _selectedFiles.splice(index, 1);
  _renderFilePreview();
}

function _claimAttachmentButtons(claimId, attachments) {
  return attachments.map((a, i) =>
    `<button class="btn btn-sm btn-ghost" style="font-size:.72rem;padding:.2rem .45rem"
      onclick="downloadClaimAttachment('${claimId}',${i},'${(a.filename || 'adjunto').replace(/'/g, "\\'")}')">
      ${a.mimetype?.startsWith('image/') ? '🖼️' : '📄'} ${_truncateFilename(a.filename || `Archivo ${i + 1}`, 18)}
    </button>`
  ).join('');
}

export async function downloadClaimAttachment(claimId, index, filename) {
  await downloadAttachment(api.claims.getAttachmentUrl(claimId, index), filename);
}

export async function submitClaim() {
  const category = document.getElementById('claim-category')?.value;
  const title    = document.getElementById('claim-title')?.value?.trim();
  const body     = document.getElementById('claim-body')?.value?.trim();

  if (!title) { toast('El título es obligatorio.', 'error'); return; }
  if (!body)  { toast('La descripción es obligatoria.', 'error'); return; }

  if (_selectedFiles.length > 0 && !navigator.onLine) {
    toast('Los reclamos con archivos requieren conexión a internet.', 'warning');
    return;
  }

  const btn = document.getElementById('btn-submit-claim');
  setBtnLoading(btn, true);
  try {
    let payload;
    if (_selectedFiles.length > 0) {
      payload = new FormData();
      payload.append('category', category);
      payload.append('title', title);
      payload.append('body', body);
      _selectedFiles.forEach(f => payload.append('attachments', f));
    } else {
      payload = { category, title, body };
    }
    await api.claims.create(payload);
    closeModal();
    toast('Reclamo enviado correctamente.', 'success');
    renderOwnerClaims();
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

window.renderOwnerClaims       = renderOwnerClaims;
window.openNewClaimModal       = openNewClaimModal;
window.submitClaim             = submitClaim;
window.onClaimFilesChange      = onClaimFilesChange;
window.removeClaimFile         = removeClaimFile;
window.downloadClaimAttachment = downloadClaimAttachment;
