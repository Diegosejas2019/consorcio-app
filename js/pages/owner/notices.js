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
  const unread = !n.isRead;
  return `
    <div class="ni-row${unread ? ' ni-row--unread' : ''} ni-tag-${n.tag} oh-entry"
         style="--delay:${Math.min(i * 30 + 40, 200)}ms"
         onclick="openOwnerNotice('${n._id}')">
      <div class="ni-icon ni-icon--${n.tag}">${TAG_ICON[n.tag] || '📢'}</div>
      <div class="ni-content">
        <div class="ni-content-top">
          <span class="ni-title">${n.title}</span>
          <span class="ni-date">${formatInboxDate(n.createdAt)}</span>
        </div>
        <span class="ni-preview">${n.body.slice(0, 90)}${n.body.length > 90 ? '…' : ''}</span>
      </div>
    </div>`;
}

export async function renderOwnerNotices() {
  const el = document.getElementById('page-owner-notices');
  el.innerHTML = `<div class="oh-wrap">${skeleton(4)}</div>`;
  try {
    const res = await api.notices.getAll({ limit: 50 });
    _notices   = res.data.notices;
    _renderInbox();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerNotices()');
  }
}

function _renderInbox() {
  const el      = document.getElementById('page-owner-notices');
  const unread  = _notices.filter(n => !n.isRead).length;

  el.innerHTML = `
    <div class="oh-wrap">
      <div class="oh-greeting oh-entry" style="--delay:0ms">
        <div>
          <p class="oh-greeting-sub">Comunicados</p>
          <h1 class="oh-greeting-name">Avisos</h1>
        </div>
        ${unread > 0 ? `<span class="oh-unit-chip">${unread} nuevo${unread > 1 ? 's' : ''}</span>` : ''}
      </div>
      <div class="ni-inbox oh-entry" style="--delay:60ms">
        ${_notices.length === 0
          ? '<p class="ni-empty">Sin avisos por el momento.</p>'
          : _notices.map((n, i) => noticeRow(n, i)).join('')}
      </div>
    </div>`;
}

export async function openOwnerNotice(id) {
  const notice = _notices.find(n => n._id === id);
  if (!notice) return;

  // Marcar como leído al abrir (fire and forget)
  if (!notice.isRead) {
    notice.isRead = true;
    api.notices.markRead(id).catch(() => {});
    // Actualizar la fila sin re-renderizar todo
    const row = document.querySelector(`.ni-row[onclick="openOwnerNotice('${id}')"]`);
    if (row) row.classList.remove('ni-row--unread');
    // Actualizar chip de no leídos
    _updateUnreadChip();
  }

  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <div class="ni-detail">
      <div class="ni-detail-tag-row">
        <span class="on-card__tag tag-${notice.tag}">${TAG_ICON[notice.tag]} ${TAG_LABEL[notice.tag] || notice.tag}</span>
      </div>
      <div class="ni-detail-subject">${notice.title}</div>
      <div class="ni-detail-meta">
        <span>De: Administración</span>
        <span>Fecha: ${formatDate(notice.createdAt)}</span>
      </div>
      <div class="ni-detail-body">${_escapeHtml(notice.body)}</div>
      <div class="ni-detail-actions">
        <button class="btn btn-ghost btn-sm" id="ni-toggle-btn"
                onclick="toggleOwnerNoticeRead('${id}')">
          ${notice.isRead ? 'Marcar como no leído' : 'Marcar como leído'}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Cerrar</button>
      </div>
    </div>`;
  openModal();
}

export async function toggleOwnerNoticeRead(id) {
  const notice = _notices.find(n => n._id === id);
  if (!notice) return;
  try {
    if (notice.isRead) {
      await api.notices.markUnread(id);
      notice.isRead = false;
    } else {
      await api.notices.markRead(id);
      notice.isRead = true;
    }
    // Actualizar fila
    const row = document.querySelector(`.ni-row[onclick="openOwnerNotice('${id}')"]`);
    if (row) row.classList.toggle('ni-row--unread', !notice.isRead);
    // Actualizar botón en el modal
    const btn = document.getElementById('ni-toggle-btn');
    if (btn) btn.textContent = notice.isRead ? 'Marcar como no leído' : 'Marcar como leído';
    // Actualizar chip
    _updateUnreadChip();
  } catch {
    toast('No se pudo actualizar el estado', 'error');
  }
}

function _updateUnreadChip() {
  const unread = _notices.filter(n => !n.isRead).length;
  const chip   = document.querySelector('#page-owner-notices .oh-unit-chip');
  if (chip) {
    chip.textContent = unread > 0 ? `${unread} nuevo${unread > 1 ? 's' : ''}` : '';
    chip.style.display = unread > 0 ? '' : 'none';
  }
}

function _escapeHtml(str) {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

window.renderOwnerNotices     = renderOwnerNotices;
window.openOwnerNotice        = openOwnerNotice;
window.toggleOwnerNoticeRead  = toggleOwnerNoticeRead;
