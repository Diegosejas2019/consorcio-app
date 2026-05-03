import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState, downloadAttachment } from '../../ui/helpers.js';
import { svgIcon } from '../../ui/icons.js';
import { CLAIM_CATEGORIES, claimStatusBadge } from '../admin/claims.js';

let _selectedFiles = [];

function _claimTimeline(status) {
  const steps = ['Recibido', 'Asignado', 'En proceso', 'Resuelto'];
  const doneAt = { open: 0, in_progress: 2, resolved: 3 };
  const activeIdx = doneAt[status] ?? 0;
  return `<div class="timeline">
    ${steps.map((s, i) => `
      <div class="tl-step${i < activeIdx ? ' is-done' : i === activeIdx ? ' is-active' : ''}">
        <div class="tl-dot"></div>
        <span class="tl-label">${s}</span>
      </div>`).join('')}
  </div>`;
}

export async function renderOwnerClaims() {
  const el = document.getElementById('page-owner-claims');
  el.innerHTML = `<div style="padding:16px">${skeleton(3)}</div>`;
  try {
    const res    = await api.claims.getAll({ limit: 50 });
    const claims = res.data.claims;
    const open   = claims.filter(c => c.status === 'open').length;
    const inProg = claims.filter(c => c.status === 'in_progress').length;
    const done   = claims.filter(c => c.status === 'resolved').length;

    el.innerHTML = `
      <div style="padding:0 16px 32px">
        <div class="row-between" style="align-items:flex-end;padding-top:16px">
          <div>
            <p class="page-eyebrow">Comunidad</p>
            <h1 class="page-title">Mis Reclamos</h1>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openNewClaimModal()">+ Nuevo</button>
        </div>

        <div class="card" style="display:grid;grid-template-columns:repeat(3,1fr);text-align:center;padding:16px 8px;margin-top:16px">
          <div>
            <div class="h-amount" style="font-size:22px;color:var(--warning)">${open}</div>
            <div class="muted" style="font:var(--t-xs);margin-top:4px">Abiertos</div>
          </div>
          <div style="border-left:1px solid var(--border);border-right:1px solid var(--border)">
            <div class="h-amount" style="font-size:22px;color:var(--info)">${inProg}</div>
            <div class="muted" style="font:var(--t-xs);margin-top:4px">En proceso</div>
          </div>
          <div>
            <div class="h-amount" style="font-size:22px;color:var(--success)">${done}</div>
            <div class="muted" style="font:var(--t-xs);margin-top:4px">Resueltos</div>
          </div>
        </div>

        ${claims.length === 0 ? `
        <div class="empty" style="padding:32px 0">
          <div class="empty-icon">${svgIcon('wrench', 24)}</div>
          <p class="empty-title">Sin reclamos</p>
          <p class="empty-sub">No tenés reclamos registrados.</p>
          <button class="btn btn-primary" style="margin-top:16px" onclick="openNewClaimModal()">Crear reclamo</button>
        </div>` : `
        <div class="stack-2" style="margin-top:18px">
          ${claims.map(c => `
          <div class="card" style="padding:16px">
            <div class="row-between" style="margin-bottom:12px">
              <span class="badge badge-plain" style="font-size:.72rem">${CLAIM_CATEGORIES[c.category] || c.category}</span>
              ${claimStatusBadge(c.status)}
            </div>
            <div class="bright" style="font:var(--t-body-md);margin-bottom:4px">${c.title}</div>
            <div class="muted" style="font:var(--t-sm);margin-bottom:12px">${c.body.slice(0, 100)}${c.body.length > 100 ? '…' : ''}</div>
            ${_claimTimeline(c.status)}
            ${c.adminNote ? `<div style="margin-top:12px;padding:10px 12px;background:var(--info-bg);border-radius:8px;font:var(--t-sm);color:var(--info)">${svgIcon('info', 14)} ${c.adminNote}</div>` : ''}
            ${c.attachments?.length ? `<div class="flex gap-1" style="flex-wrap:wrap;margin-top:10px">${_claimAttachmentButtons(c._id, c.attachments)}</div>` : ''}
            <div class="row-between" style="margin-top:12px">
              <span class="muted" style="font:var(--t-xs)">${formatDate(c.createdAt)}</span>
              ${c.status === 'open' ? `<button class="btn btn-ghost" style="color:var(--danger);font-size:.72rem;padding:4px 10px" onclick="deleteClaim('${c._id}')">Eliminar</button>` : ''}
            </div>
          </div>`).join('')}
        </div>`}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerClaims()');
  }
}

export function openNewClaimModal() {
  _selectedFiles = [];
  const cats = Object.entries(CLAIM_CATEGORIES);
  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:16px">Nuevo Reclamo</h2>
    <div class="flex col gap-3">
      <div>
        <div class="field-label" style="margin-bottom:8px">Categoría</div>
        <div class="flex gap-1" style="flex-wrap:wrap" id="claim-chips">
          ${cats.map(([v, l], i) => `
            <button type="button" class="chip${i === 0 ? ' is-active' : ''}" data-cat="${v}" onclick="_selectClaimCat('${v}')">${l}</button>`).join('')}
        </div>
        <input type="hidden" id="claim-category" value="${cats[0][0]}">
      </div>
      <div class="field">
        <label class="field-label">Título</label>
        <input class="input" id="claim-title" placeholder="Ej: Pérdida de agua en pasillo" maxlength="150">
      </div>
      <div class="field">
        <label class="field-label">Descripción</label>
        <textarea class="input textarea" id="claim-body" placeholder="Describí el problema con el mayor detalle posible..." rows="4" maxlength="2000"></textarea>
      </div>
      <div>
        <label class="field-label">Adjuntos <span class="muted" style="font-size:.72rem">(opcional · máx. 3 · 10 MB c/u)</span></label>
        <input type="file" id="claim-files" accept="image/*,.pdf" multiple class="hidden" onchange="onClaimFilesChange(this.files)">
        <button type="button" class="btn btn-ghost btn-sm" style="margin-top:6px" onclick="document.getElementById('claim-files').click()">${svgIcon('clip', 14)} Adjuntar archivos</button>
        <div id="claim-files-preview"></div>
      </div>
      <button class="btn btn-primary btn-lg btn-block" id="btn-submit-claim" onclick="submitClaim()">Enviar reclamo</button>
      <button class="btn btn-ghost btn-block" onclick="closeModal()">Cancelar</button>
    </div>`;
}

export function _selectClaimCat(val) {
  document.getElementById('claim-category').value = val;
  document.querySelectorAll('#claim-chips .chip').forEach(b => b.classList.toggle('is-active', b.dataset.cat === val));
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
window._selectClaimCat         = _selectClaimCat;
