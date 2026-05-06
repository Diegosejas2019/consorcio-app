import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { formatDate, errorState, buildWhatsAppLink, downloadAttachment } from '../../ui/helpers.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';

let _notices      = [];
let _noticeFiles  = [];

const TAG_ICON  = { info: '📢', warning: '⚠️', urgent: '🔴' };
const TAG_LABEL = { info: 'Informativo', warning: 'Advertencia', urgent: 'Urgente' };

function formatInboxDate(d) {
  if (!d) return '';
  const now  = new Date();
  const dt   = new Date(d);
  const diff = Math.floor((now - dt) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7)  return dt.toLocaleDateString('es-AR', { weekday: 'short' });
  return dt.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function noticeRow(n, i) {
  return `
    <div class="ni-row oh-entry" style="--delay:${Math.min(i * 30 + 40, 200)}ms"
         onclick="openAdminNotice('${n._id}')">
      <div class="ni-dot" style="visibility:hidden"></div>
      <div class="ni-avatar ni-avatar--${n.tag}">${TAG_ICON[n.tag] || '📢'}</div>
      <div class="ni-content">
        <div class="ni-content-top">
          <span class="ni-sender">Administración</span>
          <span class="ni-date">${formatInboxDate(n.createdAt)}</span>
        </div>
        <div class="ni-subject">${n.title}</div>
        <div class="ni-preview">${n.body.slice(0, 80)}${n.body.length > 80 ? '…' : ''}</div>
      </div>
      <button class="ni-delete-btn" title="Eliminar" onclick="deleteNotice(event, '${n._id}')">✕</button>
    </div>`;
}

export async function renderAdminNotices() {
  const el = document.getElementById('page-admin-notices');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res = await getCachedOrFetch(
      'notices:admin:limit=50',
      CACHE_TTL.NOTICES,
      () => api.notices.getAll({ limit: 50 })
    );
    _notices   = res.data.notices;
    _renderInbox();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminNotices()');
  }
}

function _renderInbox() {
  const el = document.getElementById('page-admin-notices');
  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="ni-inbox-header">
        <div class="ni-inbox-title-row">
          <h1 class="ni-inbox-title">Comunicados</h1>
          <button class="btn btn-primary btn-sm" onclick="openNewNoticeModal()">+ Nuevo</button>
        </div>
      </div>
      <div class="ni-inbox">
        ${_notices.length === 0
          ? '<p class="ni-empty">Sin comunicados publicados.</p>'
          : _notices.map((n, i) => noticeRow(n, i)).join('')}
      </div>
    </div>`;
}

export function openAdminNotice(id) {
  const notice = _notices.find(n => n._id === id);
  if (!notice) return;

  const pushStatus  = notice.pushSent
    ? `<span class="badge badge-success" style="font-size:.7rem">Push enviado</span>`
    : `<span class="badge" style="font-size:.7rem;background:var(--surface-3)">Sin push</span>`;
  const emailStatus = notice.emailSent
    ? `<span class="badge badge-success" style="font-size:.7rem">Email enviado</span>`
    : `<span class="badge" style="font-size:.7rem;background:var(--surface-3)">Sin email</span>`;

  const attachmentsHtml = notice.attachments?.length
    ? `<div class="flex gap-1" style="flex-wrap:wrap;margin-top:.5rem">${notice.attachments.map((a, i) =>
        `<button class="btn btn-sm btn-ghost" style="font-size:.75rem"
          onclick="downloadNoticeAttachment('${notice._id}',${i},'${(a.filename || 'adjunto').replace(/'/g, "\\'")}')">
          ${a.mimetype?.startsWith('image/') ? '🖼️' : '📄'} ${a.filename ? a.filename.slice(0, 22) : `Archivo ${i + 1}`}
        </button>`).join('')}</div>`
    : '';

  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <div class="ni-detail">
      <div class="ni-detail-top">
        <div class="ni-avatar ni-avatar--${notice.tag}" style="width:42px;height:42px;font-size:1.15rem;flex-shrink:0">${TAG_ICON[notice.tag] || '📢'}</div>
        <div style="flex:1;min-width:0">
          <div class="ni-detail-sender">${notice.author?.name || 'Administración'}</div>
          <div class="ni-detail-date">${formatDate(notice.createdAt)}</div>
        </div>
        <div style="display:flex;flex-direction:column;align-items:flex-end;gap:.3rem">
          <span class="ni-tag-pill ni-tag-pill--${notice.tag}">${TAG_LABEL[notice.tag] || notice.tag}</span>
          <div style="display:flex;gap:.3rem">${pushStatus}${emailStatus}</div>
        </div>
      </div>
      <div class="ni-detail-subject">${notice.title}</div>
      <div class="ni-detail-body">${_escapeHtml(notice.body)}</div>
      ${attachmentsHtml}
      <div class="ni-detail-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteNotice(null, '${notice._id}', true)">Eliminar</button>
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Cerrar</button>
      </div>
    </div>`;
  openModal();
}

export function openNewNoticeModal() {
  _noticeFiles = [];
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nuevo Comunicado</h2>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Título</label>
        <input class="input" id="n-title" placeholder="Título del aviso" maxlength="150">
      </div>
      <div class="form-group">
        <label>Mensaje</label>
        <textarea class="input" id="n-body" style="min-height:110px" placeholder="Contenido del comunicado..." maxlength="2000"></textarea>
      </div>
      <div class="form-group">
        <label>Tipo</label>
        <select class="select" id="n-tag">
          <option value="info">📢 Informativo</option>
          <option value="warning">⚠️ Advertencia</option>
          <option value="urgent">🔴 Urgente</option>
        </select>
      </div>
      <div class="form-group">
        <label>Adjuntos <span class="text-muted" style="font-size:.8rem">(opcional · máx. 3 · 10 MB c/u)</span></label>
        <input type="file" id="n-files" accept="image/*,.pdf" multiple style="display:none"
          onchange="onNoticeFilesChange(this.files)">
        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('n-files').click()">📎 Adjuntar archivos</button>
        <div id="n-files-preview"></div>
      </div>
      <div class="flex col gap-1" style="padding:.25rem 0">
        <label style="font-size:.85rem;display:flex;align-items:center;gap:.5rem;cursor:pointer">
          <input type="checkbox" id="n-push" checked> Enviar notificación push a propietarios
        </label>
        <label style="font-size:.85rem;display:flex;align-items:center;gap:.5rem;cursor:pointer">
          <input type="checkbox" id="n-email" checked> Enviar correo electrónico a propietarios
        </label>
        <label style="font-size:.85rem;display:flex;align-items:center;gap:.5rem;cursor:pointer">
          <input type="checkbox" id="n-whatsapp"> <span>💬 Enviar por WhatsApp <span class="text-muted">(manual)</span></span>
        </label>
      </div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" data-requires-network onclick="saveNotice()">Publicar</button>
      </div>
    </div>`;
  openModal();
}

function _noticeFilePreviewHtml(files) {
  return files.map((f, i) => {
    const isImg = f.type.startsWith('image/');
    const size  = f.size < 1024 * 1024 ? `${(f.size / 1024).toFixed(0)} KB` : `${(f.size / 1024 / 1024).toFixed(1)} MB`;
    return `<div style="display:inline-flex;align-items:center;gap:.3rem;background:var(--surface-2);border-radius:6px;padding:.2rem .5rem;font-size:.75rem;margin:.1rem">
      ${isImg ? '🖼️' : '📄'}
      <span>${f.name.length > 20 ? f.name.slice(0, 19) + '…' : f.name}</span>
      <span style="color:var(--muted)">${size}</span>
      <button type="button" onclick="removeNoticeFile(${i})" style="background:none;border:none;cursor:pointer;color:var(--muted);padding:0;line-height:1">✕</button>
    </div>`;
  }).join('');
}

function _renderNoticeFilePreview() {
  const el = document.getElementById('n-files-preview');
  if (!el) return;
  el.innerHTML = _noticeFiles.length
    ? `<div style="flex-wrap:wrap;margin-top:.3rem;display:flex">${_noticeFilePreviewHtml(_noticeFiles)}</div>`
    : '';
}

export function onNoticeFilesChange(fileList) {
  const incoming  = Array.from(fileList);
  const remaining = 3 - _noticeFiles.length;
  if (remaining <= 0) { toast('Máximo 3 archivos permitidos.', 'warning'); return; }
  _noticeFiles = _noticeFiles.concat(incoming.slice(0, remaining));
  if (incoming.length > remaining) toast('Se agregaron solo los primeros archivos hasta completar 3.', 'warning');
  document.getElementById('n-files').value = '';
  _renderNoticeFilePreview();
}

export function removeNoticeFile(index) {
  _noticeFiles.splice(index, 1);
  _renderNoticeFilePreview();
}

export async function saveNotice() {
  const title        = document.getElementById('n-title')?.value.trim();
  const body         = document.getElementById('n-body')?.value.trim();
  const tag          = document.getElementById('n-tag')?.value;
  const sendPush     = document.getElementById('n-push')?.checked;
  const sendEmail    = document.getElementById('n-email')?.checked;
  const sendWhatsApp = document.getElementById('n-whatsapp')?.checked;
  if (!title || !body) { toast('Completá todos los campos', 'error'); return; }
  try {
    let payload;
    if (_noticeFiles.length > 0) {
      payload = new FormData();
      payload.append('title', title);
      payload.append('body', body);
      payload.append('tag', tag);
      payload.append('sendPush', sendPush);
      payload.append('sendEmail', sendEmail);
      _noticeFiles.forEach(f => payload.append('attachments', f));
    } else {
      payload = { title, body, tag, sendPush, sendEmail };
    }
    await api.notices.create(payload);
    if (sendWhatsApp) {
      await _openNoticeWhatsAppModal(title, body);
    } else {
      closeModal();
      toast('Comunicado publicado', 'success');
      renderAdminNotices();
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function deleteNotice(event, id, fromModal = false) {
  if (event) event.stopPropagation();
  if (!confirm('¿Eliminar este aviso?')) return;
  try {
    await api.notices.delete(id);
    if (fromModal) closeModal();
    toast('Comunicado eliminado');
    renderAdminNotices();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── WhatsApp ──────────────────────────────────────────────────
async function _openNoticeWhatsAppModal(title, body) {
  const appUrl = window.location.origin;
  const defaultMsg = `📢 Nuevo comunicado\n\n${title}\n\n${body}\n\nAbrí la app:\n${appUrl}`;

  let owners = [];
  try {
    const res = await getCachedOrFetch(
      'owners:notices-whatsapp:limit=500',
      CACHE_TTL.OWNERS,
      () => api.owners.getAll({ limit: 500 })
    );
    owners = (res.data.owners || []).filter(o => o.phone);
  } catch { /* silent — mostrar igual el modal */ }

  toast('Comunicado publicado', 'success');
  renderAdminNotices();

  if (owners.length === 0) {
    closeModal();
    toast('No hay propietarios con teléfono registrado', 'warning');
    return;
  }

  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.25rem">Enviar comunicado por WhatsApp</h2>
    <p class="text-sm text-muted" style="margin-bottom:1rem">${owners.length} propietario${owners.length !== 1 ? 's' : ''} con teléfono</p>
    <div class="form-group" style="margin-bottom:.75rem">
      <label>Mensaje (editable)</label>
      <textarea class="input" id="wa-notice-msg" style="min-height:120px">${defaultMsg}</textarea>
    </div>
    <div style="max-height:240px;overflow-y:auto;margin-bottom:1rem;border:1px solid var(--border);border-radius:8px">
      ${owners.map(o => `
        <div class="flex between" style="padding:.6rem .75rem;border-bottom:1px solid var(--border);align-items:center;gap:.5rem">
          <div style="min-width:0">
            <p class="text-sm bold" style="overflow:hidden;text-overflow:ellipsis;white-space:nowrap">${o.name}</p>
            <p class="text-sm text-muted">${o.phone}</p>
          </div>
          <button class="btn btn-ghost btn-sm" style="color:#25D366;white-space:nowrap;flex-shrink:0" onclick="sendNoticeWhatsApp('${o.phone.replace(/'/g, "\\'")}')">💬 Enviar</button>
        </div>`).join('')}
    </div>
    <button class="btn btn-secondary w-full" onclick="closeModal()">Cerrar</button>`;
  openModal();
}

export function sendNoticeWhatsApp(phone) {
  const msg = document.getElementById('wa-notice-msg')?.value.trim();
  if (!msg) { toast('El mensaje no puede estar vacío', 'warning'); return; }
  window.open(buildWhatsAppLink(phone, msg), '_blank');
}

function _escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

export async function downloadNoticeAttachment(noticeId, index, filename) {
  await downloadAttachment(api.notices.getAttachmentUrl(noticeId, index), filename);
}

window.renderAdminNotices         = renderAdminNotices;
window.openAdminNotice            = openAdminNotice;
window.openNewNoticeModal         = openNewNoticeModal;
window.saveNotice                 = saveNotice;
window.deleteNotice               = deleteNotice;
window.sendNoticeWhatsApp         = sendNoticeWhatsApp;
window.onNoticeFilesChange        = onNoticeFilesChange;
window.removeNoticeFile           = removeNoticeFile;
window.downloadNoticeAttachment   = downloadNoticeAttachment;
