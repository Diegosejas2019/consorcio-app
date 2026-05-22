import { toast } from '../../ui/toast.js';
import { openModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { formatDate, errorState, downloadAttachment } from '../../ui/helpers.js';
import { svgIcon } from '../../ui/icons.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';

let _notices = [];
let _noticeFilter = 'all';
let _noticeSearch = '';
let _noticeCategory = 'all';

const TAG_ICON = { info: 'megaphone', warning: 'alert', urgent: 'bell' };
const TAG_LABEL = { info: 'Informativo', warning: 'Advertencia', urgent: 'Urgente' };
const TAG_BADGE = { info: 'badge-info', warning: 'badge-warning', urgent: 'badge-danger' };
const CATEGORY_LABEL = {
  general: 'General',
  mantenimiento: 'Mantenimiento',
  corte_servicio: 'Corte de servicio',
  expensas: 'Expensas',
  asamblea: 'Asamblea',
  mora: 'Mora',
  seguridad: 'Seguridad',
  emergencia: 'Emergencia',
  otro: 'Otro',
};

function normalizeNotice(n = {}) {
  const priority = n.priority || (n.tag === 'urgent' ? 'urgent' : n.tag === 'warning' ? 'high' : 'normal');
  const tag = n.tag || (priority === 'urgent' ? 'urgent' : priority === 'high' ? 'warning' : 'info');
  return {
    ...n,
    tag,
    subject: n.subject || n.title,
    category: n.category || 'general',
    priority,
    status: n.status || 'sent',
  };
}

function _relDate(d) {
  if (!d) return '';
  const diff = Math.floor((Date.now() - new Date(d)) / 86400000);
  if (diff === 0) return 'Hoy';
  if (diff === 1) return 'Ayer';
  if (diff < 7) return new Date(d).toLocaleDateString('es-AR', { weekday: 'short' });
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit' });
}

function _escapeHtml(str = '') {
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function _noticeCard(raw) {
  const n = normalizeNotice(raw);
  const unread = !n.isRead;
  const icon = TAG_ICON[n.tag] || 'megaphone';
  const badge = TAG_BADGE[n.tag] || '';
  const label = TAG_LABEL[n.tag] || n.tag;
  const urgentClass = n.priority === 'urgent' ? ' notice--urgent' : '';
  return `
    <div class="notice${unread ? ' is-unread' : ''}${urgentClass}" onclick="openOwnerNotice('${n._id}')">
      <div class="notice-side">${svgIcon(icon, 20)}</div>
      <div class="notice-body">
        <div class="row-between" style="gap:8px">
          <span class="badge ${badge}" style="font-size:.7rem">${label}</span>
          <span class="muted" style="font:var(--t-xs);flex-shrink:0">${_relDate(n.sentAt || n.createdAt)}</span>
        </div>
        <div class="notice-title">${_escapeHtml(n.title)}</div>
        <div class="notice-text">${_escapeHtml(String(n.body || '').slice(0, 120))}${String(n.body || '').length > 120 ? '...' : ''}</div>
        <div class="row-between" style="margin-top:8px">
          <span class="muted" style="font:var(--t-xs)">${CATEGORY_LABEL[n.category] || n.category}</span>
          <button class="btn btn-ghost" style="font-size:.7rem;padding:2px 8px;height:auto"
            onclick="event.stopPropagation();toggleOwnerNoticeRead('${n._id}')">
            ${unread ? 'Marcar leido' : 'Marcar no leido'}
          </button>
        </div>
      </div>
    </div>`;
}

export function switchNoticeFilter(f) {
  _noticeFilter = f;
  document.querySelectorAll('#notice-seg .seg-btn').forEach(b => b.classList.toggle('is-active', b.dataset.f === f));
  _updateNoticeList();
}

export function setOwnerNoticeSearch(value) {
  _noticeSearch = value || '';
  _updateNoticeList();
}

export function setOwnerNoticeCategory(value) {
  _noticeCategory = value || 'all';
  _updateNoticeList();
}

async function _markAllRead() {
  const unread = _notices.filter(n => !n.isRead);
  if (!unread.length) return;
  await Promise.all(unread.map(n => api.notices.markRead(n._id).catch(() => {})));
  unread.forEach(n => { n.isRead = true; });
  _renderInbox();
}

export async function renderOwnerNotices() {
  const el = document.getElementById('page-owner-notices');
  el.innerHTML = `<div style="padding:16px">${skeleton(4)}</div>`;
  try {
    const res = await getCachedOrFetch(
      'notices:owner:limit=100',
      CACHE_TTL.NOTICES,
      () => api.notices.getAll({ limit: 100 })
    );
    _notices = (res.data.notices || []).map(normalizeNotice);
    _noticeFilter = 'all';
    _noticeSearch = '';
    _noticeCategory = 'all';
    _renderInbox();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerNotices()');
  }
}

function _renderInbox() {
  const el = document.getElementById('page-owner-notices');
  const unread = _notices.filter(n => !n.isRead).length;
  el.innerHTML = `
    <div style="padding:0 16px 32px">
      <div class="row-between" style="align-items:flex-end;padding-top:16px">
        <div>
          <p class="page-eyebrow">Comunidad</p>
          <h1 class="page-title">Comunicados</h1>
        </div>
        ${unread > 0 ? `<span class="badge badge-accent">${unread} sin leer</span>` : ''}
      </div>

      <div class="row-between" style="margin-top:18px;align-items:center">
        <div class="seg" id="notice-seg" style="flex:1;margin-right:10px">
          <button class="seg-btn is-active" data-f="all" onclick="switchNoticeFilter('all')">Todos</button>
          <button class="seg-btn" data-f="unread" onclick="switchNoticeFilter('unread')">No leidos</button>
          <button class="seg-btn" data-f="urgent" onclick="switchNoticeFilter('urgent')">Urgentes</button>
        </div>
        ${unread > 0 ? `<button class="btn btn-ghost" style="font-size:.75rem;white-space:nowrap;padding:6px 12px" onclick="markAllNoticesRead()">Marcar todos</button>` : ''}
      </div>

      <div style="display:grid;grid-template-columns:1fr 150px;gap:10px;margin-top:12px">
        <input class="input" placeholder="Buscar comunicado" value="${_escapeHtml(_noticeSearch)}" oninput="setOwnerNoticeSearch(this.value)">
        <select class="select" onchange="setOwnerNoticeCategory(this.value)">
          <option value="all">Todas</option>
          ${Object.entries(CATEGORY_LABEL).map(([key, label]) => `<option value="${key}" ${_noticeCategory === key ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>

      <div class="stack-2" style="margin-top:16px" id="notice-list">
        ${_filteredNoticeCards()}
      </div>
    </div>`;
}

function _filteredNoticeCards() {
  let list = _notices;
  if (_noticeFilter === 'unread') list = list.filter(n => !n.isRead);
  if (_noticeFilter === 'urgent') list = list.filter(n => n.priority === 'urgent' || n.tag === 'urgent');
  if (_noticeCategory !== 'all') list = list.filter(n => n.category === _noticeCategory);
  const search = _noticeSearch.trim().toLowerCase();
  if (search) list = list.filter(n => `${n.title} ${n.subject} ${n.body}`.toLowerCase().includes(search));

  if (list.length === 0) {
    return `<div class="empty" style="padding:32px 0">
      <div class="empty-icon">${svgIcon('megaphone', 24)}</div>
      <p class="empty-title">Sin comunicados</p>
      <p class="empty-sub">No hay comunicados en esta categoria.</p>
    </div>`;
  }
  return list.map(_noticeCard).join('');
}

function _updateNoticeList() {
  const el = document.getElementById('notice-list');
  if (el) el.innerHTML = _filteredNoticeCards();
}

export async function openOwnerNotice(id) {
  const notice = normalizeNotice(_notices.find(n => n._id === id));
  if (!notice?._id) return;
  const icon = TAG_ICON[notice.tag] || 'megaphone';

  if (!notice.isRead) {
    const stored = _notices.find(n => n._id === id);
    if (stored) stored.isRead = true;
    api.notices.markRead(id).catch(() => {});
    _updateNoticeList();
  }

  openModal(`
    <div class="modal-handle"></div>
    <div class="ni-detail">
      <div class="ni-detail-top">
        <div class="ni-avatar ni-avatar--${notice.tag}" style="width:42px;height:42px;font-size:1.15rem;flex-shrink:0">${svgIcon(icon, 20)}</div>
        <div style="flex:1;min-width:0">
          <div class="ni-detail-sender">Administracion</div>
          <div class="ni-detail-date">${formatDate(notice.sentAt || notice.createdAt)}</div>
        </div>
        <span class="ni-tag-pill ni-tag-pill--${notice.tag}">${TAG_LABEL[notice.tag] || notice.tag}</span>
      </div>
      <div class="ni-detail-subject">${_escapeHtml(notice.title)}</div>
      <p class="text-sm text-muted" style="margin-top:-.35rem;margin-bottom:.6rem">${CATEGORY_LABEL[notice.category] || notice.category}</p>
      <div class="ni-detail-body">${_escapeHtml(notice.body)}</div>
      ${notice.attachments?.length ? `<div class="flex gap-1" style="flex-wrap:wrap;margin-top:.75rem">${notice.attachments.map((a, i) =>
        `<button class="btn btn-sm btn-ghost" style="font-size:.75rem"
          onclick="downloadOwnerNoticeAttachment('${notice._id}',${i},'${(a.filename || 'adjunto').replace(/'/g, "\\'")}')">
          ${a.filename ? _escapeHtml(a.filename.slice(0, 22)) : `Archivo ${i + 1}`}
        </button>`).join('')}</div>` : ''}
      <div class="ni-detail-actions">
        <button class="btn btn-ghost btn-sm" id="ni-toggle-btn"
                onclick="toggleOwnerNoticeRead('${id}')">
          ${notice.isRead ? 'Marcar como no leido' : 'Marcar como leido'}
        </button>
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Cerrar</button>
      </div>
    </div>`);
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
    const btn = document.getElementById('ni-toggle-btn');
    if (btn) btn.textContent = notice.isRead ? 'Marcar como no leido' : 'Marcar como leido';
    _updateNoticeList();
  } catch {
    toast('No se pudo actualizar el estado', 'error');
  }
}

export async function markAllNoticesRead() {
  await _markAllRead();
  toast('Todos los comunicados marcados como leidos', 'success');
}

export async function downloadOwnerNoticeAttachment(noticeId, index, filename) {
  await downloadAttachment(api.notices.getAttachmentUrl(noticeId, index), filename);
}

window.renderOwnerNotices = renderOwnerNotices;
window.openOwnerNotice = openOwnerNotice;
window.toggleOwnerNoticeRead = toggleOwnerNoticeRead;
window.downloadOwnerNoticeAttachment = downloadOwnerNoticeAttachment;
window.switchNoticeFilter = switchNoticeFilter;
window.markAllNoticesRead = markAllNoticesRead;
window.setOwnerNoticeSearch = setOwnerNoticeSearch;
window.setOwnerNoticeCategory = setOwnerNoticeCategory;
