import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { formatDate, errorState } from '../../ui/helpers.js';

let _notices = [];

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
    <div class="ni-row ni-tag-${n.tag} oh-entry" style="--delay:${Math.min(i * 30 + 40, 200)}ms"
         onclick="openAdminNotice('${n._id}')">
      <div class="ni-icon ni-icon--${n.tag}">${TAG_ICON[n.tag] || '📢'}</div>
      <div class="ni-content">
        <div class="ni-content-top">
          <span class="ni-title">${n.title}</span>
          <span class="ni-date">${formatInboxDate(n.createdAt)}</span>
        </div>
        <span class="ni-preview">${n.body.slice(0, 90)}${n.body.length > 90 ? '…' : ''}</span>
      </div>
      <button class="ni-delete-btn" title="Eliminar" onclick="deleteNotice(event, '${n._id}')">✕</button>
    </div>`;
}

export async function renderAdminNotices() {
  const el = document.getElementById('page-admin-notices');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res = await api.notices.getAll({ limit: 50 });
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
      <div class="flex between">
        <h1>Avisos</h1>
        <button class="btn btn-primary btn-sm" onclick="openNewNoticeModal()">+ Nuevo</button>
      </div>
      <div class="ni-inbox">
        ${_notices.length === 0
          ? '<p class="ni-empty">Sin avisos publicados.</p>'
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

  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <div class="ni-detail">
      <div class="ni-detail-tag-row">
        <span class="on-card__tag tag-${notice.tag}">${TAG_ICON[notice.tag]} ${TAG_LABEL[notice.tag] || notice.tag}</span>
        <div style="display:flex;gap:.4rem;flex-wrap:wrap">${pushStatus}${emailStatus}</div>
      </div>
      <div class="ni-detail-subject">${notice.title}</div>
      <div class="ni-detail-meta">
        <span>Autor: ${notice.author?.name || 'Admin'}</span>
        <span>Fecha: ${formatDate(notice.createdAt)}</span>
      </div>
      <div class="ni-detail-body">${_escapeHtml(notice.body)}</div>
      <div class="ni-detail-actions">
        <button class="btn btn-danger btn-sm" onclick="deleteNotice(null, '${notice._id}', true)">Eliminar</button>
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Cerrar</button>
      </div>
    </div>`;
  openModal();
}

export function openNewNoticeModal() {
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nuevo Aviso</h2>
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
      <div class="flex col gap-1" style="padding:.25rem 0">
        <label style="font-size:.85rem;display:flex;align-items:center;gap:.5rem;cursor:pointer">
          <input type="checkbox" id="n-push" checked> Enviar notificación push a propietarios
        </label>
        <label style="font-size:.85rem;display:flex;align-items:center;gap:.5rem;cursor:pointer">
          <input type="checkbox" id="n-email" checked> Enviar correo electrónico a propietarios
        </label>
      </div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" data-requires-network onclick="saveNotice()">Publicar</button>
      </div>
    </div>`;
  openModal();
}

export async function saveNotice() {
  const title     = document.getElementById('n-title')?.value.trim();
  const body      = document.getElementById('n-body')?.value.trim();
  const tag       = document.getElementById('n-tag')?.value;
  const sendPush  = document.getElementById('n-push')?.checked;
  const sendEmail = document.getElementById('n-email')?.checked;
  if (!title || !body) { toast('Completá todos los campos', 'error'); return; }
  try {
    await api.notices.create({ title, body, tag, sendPush, sendEmail });
    closeModal();
    toast('Aviso publicado', 'success');
    renderAdminNotices();
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
    toast('Aviso eliminado');
    renderAdminNotices();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function _escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

window.renderAdminNotices  = renderAdminNotices;
window.openAdminNotice     = openAdminNotice;
window.openNewNoticeModal  = openNewNoticeModal;
window.saveNotice          = saveNotice;
window.deleteNotice        = deleteNotice;
