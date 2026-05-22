import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { formatDate, errorState, downloadAttachment } from '../../ui/helpers.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';
import { hasPermission } from '../../services/permissionService.js';

let _notices = [];
let _templates = [];
let _owners = [];
let _units = [];
let _noticeFiles = [];
let _filters = { status: 'all', category: 'all', priority: 'all', search: '' };

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
const PRIORITY_LABEL = { low: 'Baja', normal: 'Normal', high: 'Alta', urgent: 'Urgente' };
const STATUS_LABEL = { draft: 'Borrador', scheduled: 'Programado', sent: 'Enviado', cancelled: 'Cancelado' };
const STATUS_BADGE = { draft: 'badge-neutral', scheduled: 'badge-warning', sent: 'badge-success', cancelled: 'badge-danger' };

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

function textPreview(value = '', len = 120) {
  const text = String(value);
  return esc(text.slice(0, len)) + (text.length > len ? '...' : '');
}

function normalizeNotice(n) {
  const priority = n.priority || (n.tag === 'urgent' ? 'urgent' : n.tag === 'warning' ? 'high' : 'normal');
  return {
    ...n,
    subject: n.subject || n.title,
    category: n.category || 'general',
    priority,
    status: n.status || 'sent',
    channels: { app: true, email: false, push: false, whatsapp: false, ...(n.channels || {}) },
    targetType: n.targetType || 'all',
    targetFilters: n.targetFilters || {},
  };
}

function filteredNotices() {
  const search = _filters.search.trim().toLowerCase();
  return _notices.filter(raw => {
    const n = normalizeNotice(raw);
    if (_filters.status !== 'all' && n.status !== _filters.status) return false;
    if (_filters.category !== 'all' && n.category !== _filters.category) return false;
    if (_filters.priority !== 'all' && n.priority !== _filters.priority) return false;
    if (search && !`${n.title} ${n.subject} ${n.body}`.toLowerCase().includes(search)) return false;
    return true;
  });
}

function counts() {
  return _notices.reduce((acc, raw) => {
    const n = normalizeNotice(raw);
    acc[n.status] = (acc[n.status] || 0) + 1;
    if (n.priority === 'urgent') acc.urgent += 1;
    return acc;
  }, { sent: 0, scheduled: 0, draft: 0, cancelled: 0, urgent: 0 });
}

async function loadAdminNoticeData(force = false) {
  const [noticesRes, templatesRes, ownersRes, unitsRes] = await Promise.all([
    getCachedOrFetch('notices:admin:v2:limit=200', CACHE_TTL.NOTICES, () => api.notices.getAll({ limit: 200 }), { skipCache: force }),
    api.noticeTemplates.getAll().catch(() => ({ data: { templates: [] } })),
    getCachedOrFetch('owners:notices:v2:limit=500', CACHE_TTL.OWNERS, () => api.owners.getAll({ limit: 500 }), { skipCache: force }),
    getCachedOrFetch('units:notices:v2:limit=500', CACHE_TTL.UNITS, () => api.units.getAll({ limit: 500 }), { skipCache: force }),
  ]);
  _notices = (noticesRes.data.notices || []).map(normalizeNotice);
  _templates = templatesRes.data.templates || [];
  _owners = ownersRes.data.owners || [];
  _units = unitsRes.data.units || [];
}

export async function renderAdminNotices(force = false) {
  const el = document.getElementById('page-admin-notices');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    await loadAdminNoticeData(force);
    _renderInbox();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminNotices()');
  }
}

function _renderInbox() {
  const el = document.getElementById('page-admin-notices');
  const c = counts();
  const list = filteredNotices();
  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="ni-inbox-header">
        <div class="ni-inbox-title-row">
          <div>
            <h1 class="ni-inbox-title">Comunicados</h1>
            <p class="text-sm text-muted">${_notices.length} comunicados - ${_templates.length} plantillas</p>
          </div>
          <div class="flex gap-1">
            <button class="btn btn-secondary btn-sm" onclick="renderAdminNotices(true)">Actualizar</button>
            ${hasPermission('notices.create') ? '<button class="btn btn-ghost btn-sm" onclick="openTemplateModal()">Plantilla</button>' : ''}
            ${hasPermission('notices.create') ? '<button class="btn btn-primary btn-sm" onclick="openNoticeEditor()">+ Nuevo</button>' : ''}
          </div>
        </div>
      </div>

      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(130px,1fr));gap:.75rem">
        ${stat('Enviados', c.sent)}
        ${stat('Programados', c.scheduled)}
        ${stat('Borradores', c.draft)}
        ${stat('Urgentes', c.urgent)}
      </div>

      <div class="card">
        <div class="card-body" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem">
          ${selectHtml('notice-filter-status', 'Estado', [['all','Todos'], ['sent','Enviados'], ['scheduled','Programados'], ['draft','Borradores'], ['cancelled','Cancelados']], _filters.status, "setNoticeFilter('status', this.value)")}
          ${selectHtml('notice-filter-category', 'Categoria', [['all','Todas'], ...Object.entries(CATEGORY_LABEL)], _filters.category, "setNoticeFilter('category', this.value)")}
          ${selectHtml('notice-filter-priority', 'Prioridad', [['all','Todas'], ...Object.entries(PRIORITY_LABEL)], _filters.priority, "setNoticeFilter('priority', this.value)")}
          <div class="form-group">
            <label>Buscar</label>
            <input class="input" value="${esc(_filters.search)}" placeholder="Titulo, asunto o texto" oninput="setNoticeFilter('search', this.value)">
          </div>
        </div>
      </div>

      <div class="ni-inbox">
        ${list.length === 0
          ? '<p class="ni-empty">No hay comunicados para los filtros seleccionados.</p>'
          : list.map(noticeRow).join('')}
      </div>
    </div>`;
}

function stat(label, value) {
  return `<div class="stat-card"><span class="stat-label">${label}</span><strong class="stat-value">${value}</strong></div>`;
}

function selectHtml(id, label, options, value, onchange) {
  return `<div class="form-group">
    <label>${label}</label>
    <select class="select" id="${id}" onchange="${onchange}">
      ${options.map(([val, text]) => `<option value="${esc(val)}" ${val === value ? 'selected' : ''}>${esc(text)}</option>`).join('')}
    </select>
  </div>`;
}

function noticeRow(raw) {
  const n = normalizeNotice(raw);
  const when = n.status === 'scheduled' ? n.scheduledAt : (n.sentAt || n.createdAt);
  const channels = [
    n.channels.app ? 'App' : '',
    n.channels.email ? 'Email' : '',
    n.channels.push ? 'Push' : '',
    n.channels.whatsapp ? 'WhatsApp futuro' : '',
  ].filter(Boolean).join(' / ');
  return `
    <div class="ni-row oh-entry" onclick="openAdminNotice('${n._id}')">
      <div class="ni-dot" style="background:${n.priority === 'urgent' ? 'var(--danger)' : 'var(--accent)'}"></div>
      <div class="ni-content">
        <div class="ni-content-top">
          <span class="ni-sender">${esc(n.subject || n.title)}</span>
          <span class="ni-date">${formatDate(when)}</span>
        </div>
        <div class="ni-subject">${esc(n.title)}</div>
        <div class="ni-preview">${textPreview(n.body, 100)}</div>
        <div class="flex gap-1 mt-1" style="flex-wrap:wrap">
          <span class="badge ${STATUS_BADGE[n.status] || 'badge-neutral'}">${STATUS_LABEL[n.status] || n.status}</span>
          <span class="badge badge-neutral">${CATEGORY_LABEL[n.category] || n.category}</span>
          <span class="badge ${n.priority === 'urgent' ? 'badge-danger' : n.priority === 'high' ? 'badge-warning' : 'badge-neutral'}">${PRIORITY_LABEL[n.priority]}</span>
          <span class="text-sm text-muted">${channels}</span>
        </div>
      </div>
      <div class="flex gap-1" onclick="event.stopPropagation()">
        ${['draft', 'scheduled'].includes(n.status) && hasPermission('notices.update') ? `<button class="btn btn-ghost btn-sm" onclick="openNoticeEditor('${n._id}')">Editar</button>` : ''}
        <button class="btn btn-ghost btn-sm" onclick="duplicateNotice('${n._id}')">Duplicar</button>
        ${n.status !== 'sent' && n.status !== 'cancelled' && hasPermission('notices.update') ? `<button class="btn btn-primary btn-sm" onclick="sendNoticeNow('${n._id}')">Enviar</button>` : ''}
      </div>
    </div>`;
}

export function setNoticeFilter(key, value) {
  _filters[key] = value;
  _renderInbox();
}

function ownerOptions(selected = []) {
  const set = new Set((selected || []).map(String));
  return _owners.map(o => `<option value="${o._id}" ${set.has(String(o._id)) ? 'selected' : ''}>${esc(o.name)}${o.email ? ` - ${esc(o.email)}` : ''}</option>`).join('');
}

function unitOptions(selected = []) {
  const set = new Set((selected || []).map(String));
  return _units.map(u => `<option value="${u._id}" ${set.has(String(u._id)) ? 'selected' : ''}>${esc(u.name)}${u.owner?.name ? ` - ${esc(u.owner.name)}` : ''}</option>`).join('');
}

function editorHtml(existing = null) {
  const n = existing ? normalizeNotice(existing) : {
    title: '', subject: '', body: '', category: 'general', priority: 'normal', status: 'draft',
    targetType: 'all', targetFilters: {}, channels: { app: true, email: false, push: false, whatsapp: false },
  };
  const isEdit = !!existing;
  return `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.75rem">${isEdit ? 'Editar comunicado' : 'Nuevo comunicado'}</h2>
    <div class="flex col gap-2">
      ${_templates.length ? `<div class="form-group">
        <label>Plantilla</label>
        <select class="select" id="n-template" onchange="applyNoticeTemplate(this.value)">
          <option value="">Sin plantilla</option>
          ${_templates.map(t => `<option value="${t._id}">${esc(t.title)}</option>`).join('')}
        </select>
      </div>` : ''}
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        <div class="form-group"><label>Titulo</label><input class="input" id="n-title" maxlength="150" value="${esc(n.title)}"></div>
        <div class="form-group"><label>Asunto</label><input class="input" id="n-subject" maxlength="180" value="${esc(n.subject || n.title)}"></div>
      </div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        ${selectHtml('n-category', 'Categoria', Object.entries(CATEGORY_LABEL), n.category, '')}
        ${selectHtml('n-priority', 'Prioridad', Object.entries(PRIORITY_LABEL), n.priority, '')}
      </div>
      <div class="form-group"><label>Mensaje</label><textarea class="input" id="n-body" style="min-height:120px" maxlength="5000">${esc(n.body)}</textarea></div>
      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
        ${selectHtml('n-target-type', 'Destinatarios', [['all','Todos los propietarios'], ['debtors','Morosos'], ['specific_units','Unidades especificas'], ['specific_users','Propietarios especificos']], n.targetType, "toggleTargetSelectors()")}
        <div class="form-group"><label>Programar</label><input class="input" id="n-scheduled-at" type="datetime-local" value="${toLocalInput(n.scheduledAt)}"></div>
      </div>
      <div id="n-target-units" class="form-group" style="display:${n.targetType === 'specific_units' ? 'flex' : 'none'}">
        <label>Unidades</label><select class="select" id="n-unit-ids" multiple size="5">${unitOptions(n.targetFilters?.unitIds)}</select>
      </div>
      <div id="n-target-users" class="form-group" style="display:${n.targetType === 'specific_users' ? 'flex' : 'none'}">
        <label>Propietarios</label><select class="select" id="n-user-ids" multiple size="5">${ownerOptions(n.targetFilters?.userIds)}</select>
      </div>
      <div class="form-group">
        <label>Canales</label>
        <div class="flex gap-1" style="flex-wrap:wrap">
          <label class="badge badge-success"><input type="checkbox" checked disabled> App</label>
          <label class="badge badge-neutral"><input type="checkbox" id="n-email" ${n.channels.email ? 'checked' : ''}> Email opcional</label>
          <label class="badge badge-neutral"><input type="checkbox" id="n-push" ${n.channels.push ? 'checked' : ''}> Push opcional</label>
          <label class="badge badge-neutral"><input type="checkbox" id="n-whatsapp" ${n.channels.whatsapp ? 'checked' : ''}> WhatsApp futuro</label>
        </div>
      </div>
      <div class="form-group">
        <label>Adjuntos <span class="text-muted">(opcional, max. 3)</span></label>
        <input type="file" id="n-files" accept="image/*,.pdf" multiple style="display:none" onchange="onNoticeFilesChange(this.files)">
        <button type="button" class="btn btn-ghost btn-sm" onclick="document.getElementById('n-files').click()">Adjuntar archivos</button>
        <div id="n-files-preview">${existingAttachmentsHtml(n)}</div>
      </div>
      <div class="card" style="background:var(--surface-2)">
        <div class="card-body">
          <p class="text-sm text-muted">Preview</p>
          <h3 id="n-preview-title">${esc(n.title || 'Titulo del comunicado')}</h3>
          <p id="n-preview-body" class="text-sm">${textPreview(n.body || 'Contenido del comunicado...', 280)}</p>
        </div>
      </div>
      <div class="flex gap-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-ghost w-full" data-requires-network onclick="saveNoticeFromEditor('${isEdit ? n._id : ''}', 'draft')">Guardar borrador</button>
        <button class="btn btn-ghost w-full" data-requires-network onclick="saveNoticeFromEditor('${isEdit ? n._id : ''}', 'schedule')">Programar</button>
        <button class="btn btn-primary w-full" data-requires-network onclick="saveNoticeFromEditor('${isEdit ? n._id : ''}', 'send')">Enviar ahora</button>
      </div>
    </div>`;
}

function existingAttachmentsHtml(n) {
  return n.attachments?.length
    ? `<div class="flex gap-1 mt-1" style="flex-wrap:wrap">${n.attachments.map((a, i) => `<span class="badge badge-neutral">${esc(a.filename || `Adjunto ${i + 1}`)}</span>`).join('')}</div>`
    : '';
}

function toLocalInput(value) {
  if (!value) return '';
  const d = new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const pad = n => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

function selectedValues(id) {
  return Array.from(document.getElementById(id)?.selectedOptions || []).map(o => o.value);
}

function readEditorPayload(action) {
  const title = document.getElementById('n-title')?.value.trim();
  const body = document.getElementById('n-body')?.value.trim();
  const scheduledAt = document.getElementById('n-scheduled-at')?.value;
  const targetType = document.getElementById('n-target-type')?.value || 'all';
  if (!title || !body) throw new Error('Completa titulo y mensaje.');
  if (action === 'schedule' && !scheduledAt) throw new Error('Elegi una fecha futura para programar.');
  if (scheduledAt && new Date(scheduledAt) <= new Date()) throw new Error('La fecha de programacion debe ser futura.');
  const targetFilters = {
    unitIds: targetType === 'specific_units' ? selectedValues('n-unit-ids') : [],
    userIds: targetType === 'specific_users' ? selectedValues('n-user-ids') : [],
    onlyWithDebt: targetType === 'debtors',
    includeInactive: false,
  };
  if (targetType === 'specific_units' && !targetFilters.unitIds.length) throw new Error('Selecciona al menos una unidad.');
  if (targetType === 'specific_users' && !targetFilters.userIds.length) throw new Error('Selecciona al menos un propietario.');
  if (targetType === 'all' && action === 'send' && !confirm('Vas a enviar este comunicado a todos los propietarios.')) {
    throw new Error('__cancel__');
  }
  return {
    title,
    subject: document.getElementById('n-subject')?.value.trim() || title,
    body,
    category: document.getElementById('n-category')?.value || 'general',
    priority: document.getElementById('n-priority')?.value || 'normal',
    targetType,
    targetFilters,
    channels: {
      app: true,
      email: document.getElementById('n-email')?.checked || false,
      push: document.getElementById('n-push')?.checked || false,
      whatsapp: document.getElementById('n-whatsapp')?.checked || false,
    },
    scheduledAt: scheduledAt || undefined,
    status: action === 'draft' ? 'draft' : action === 'schedule' ? 'scheduled' : 'sent',
    action: action === 'send' ? 'send' : action,
  };
}

function payloadToRequest(payload) {
  if (!_noticeFiles.length) return payload;
  const fd = new FormData();
  Object.entries(payload).forEach(([key, value]) => {
    if (value === undefined) return;
    fd.append(key, typeof value === 'object' ? JSON.stringify(value) : String(value));
  });
  _noticeFiles.forEach(file => fd.append('attachments', file));
  return fd;
}

export function openNoticeEditor(id = '') {
  _noticeFiles = [];
  const notice = id ? _notices.find(n => n._id === id) : null;
  openModal(editorHtml(notice), undefined, { closeOnBackdrop: false });
  ['n-title', 'n-body'].forEach(id => document.getElementById(id)?.addEventListener('input', updateNoticePreview));
}

export function toggleTargetSelectors() {
  const target = document.getElementById('n-target-type')?.value;
  const units = document.getElementById('n-target-units');
  const users = document.getElementById('n-target-users');
  if (units) units.style.display = target === 'specific_units' ? 'flex' : 'none';
  if (users) users.style.display = target === 'specific_users' ? 'flex' : 'none';
}

export function updateNoticePreview() {
  const title = document.getElementById('n-title')?.value || 'Titulo del comunicado';
  const body = document.getElementById('n-body')?.value || 'Contenido del comunicado...';
  const t = document.getElementById('n-preview-title');
  const b = document.getElementById('n-preview-body');
  if (t) t.textContent = title;
  if (b) b.textContent = body.length > 280 ? body.slice(0, 280) + '...' : body;
}

export function applyNoticeTemplate(id) {
  const template = _templates.find(t => t._id === id);
  if (!template) return;
  document.getElementById('n-title').value = template.title || '';
  document.getElementById('n-subject').value = template.subject || template.title || '';
  document.getElementById('n-body').value = template.body || '';
  document.getElementById('n-category').value = template.category || 'general';
  updateNoticePreview();
}

export async function saveNoticeFromEditor(id, action) {
  let payload;
  try {
    payload = readEditorPayload(action);
  } catch (err) {
    if (err.message !== '__cancel__') toast(err.message, 'error');
    return;
  }
  try {
    const requestPayload = payloadToRequest(payload);
    if (id) await api.notices.update(id, requestPayload);
    else await api.notices.create(requestPayload);
    closeModal();
    toast(action === 'draft' ? 'Borrador guardado' : action === 'schedule' ? 'Comunicado programado' : 'Comunicado enviado', 'success');
    await renderAdminNotices(true);
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function sendNoticeNow(id) {
  if (!confirm('Enviar este comunicado ahora?')) return;
  try {
    await api.notices.sendNow(id);
    toast('Comunicado enviado', 'success');
    await renderAdminNotices(true);
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function cancelNotice(id) {
  if (!confirm('Cancelar este comunicado programado?')) return;
  try {
    await api.notices.cancel(id);
    toast('Comunicado cancelado', 'success');
    await renderAdminNotices(true);
  } catch (err) {
    toast(err.message, 'error');
  }
}

export function duplicateNotice(id) {
  const n = _notices.find(item => item._id === id);
  if (!n) return;
  openNoticeEditor('');
  setTimeout(() => {
    document.getElementById('n-title').value = `${n.title} (copia)`;
    document.getElementById('n-subject').value = n.subject || n.title;
    document.getElementById('n-body').value = n.body || '';
    document.getElementById('n-category').value = n.category || 'general';
    document.getElementById('n-priority').value = n.priority || 'normal';
    updateNoticePreview();
  }, 0);
}

export async function openAdminNotice(id) {
  const n = _notices.find(item => item._id === id);
  if (!n) return;
  let statsHtml = '<p class="text-sm text-muted">Cargando metricas...</p>';
  openModal(detailHtml(n, statsHtml));
  try {
    const res = await api.notices.stats(id);
    statsHtml = statsBlock(res.data.stats);
    openModal(detailHtml(n, statsHtml));
  } catch {
    statsHtml = '<p class="text-sm text-muted">No se pudieron cargar las metricas.</p>';
    openModal(detailHtml(n, statsHtml));
  }
}

function detailHtml(raw, statsHtml) {
  const n = normalizeNotice(raw);
  const attachments = n.attachments?.length
    ? `<div class="flex gap-1" style="flex-wrap:wrap;margin-top:.75rem">${n.attachments.map((a, i) =>
      `<button class="btn btn-sm btn-ghost" onclick="downloadNoticeAttachment('${n._id}',${i},'${esc(a.filename || 'adjunto')}')">${esc(a.filename || `Adjunto ${i + 1}`)}</button>`).join('')}</div>`
    : '<p class="text-sm text-muted">Sin adjuntos.</p>';
  return `
    <div class="modal-handle"></div>
    <div class="ni-detail">
      <div class="ni-detail-top">
        <div style="flex:1;min-width:0">
          <div class="ni-detail-sender">${esc(n.subject || n.title)}</div>
          <div class="ni-detail-date">${formatDate(n.sentAt || n.scheduledAt || n.createdAt)}</div>
        </div>
        <span class="badge ${STATUS_BADGE[n.status] || 'badge-neutral'}">${STATUS_LABEL[n.status]}</span>
      </div>
      <div class="ni-detail-subject">${esc(n.title)}</div>
      <div class="ni-detail-body">${esc(n.body).replace(/\n/g, '<br>')}</div>
      ${attachments}
      <div class="card mt-2"><div class="card-body">${statsHtml}</div></div>
      <div class="ni-detail-actions">
        ${['draft', 'scheduled'].includes(n.status) && hasPermission('notices.update') ? `<button class="btn btn-ghost btn-sm" onclick="closeModal();openNoticeEditor('${n._id}')">Editar</button>` : ''}
        ${n.status === 'scheduled' && hasPermission('notices.update') ? `<button class="btn btn-danger btn-sm" onclick="cancelNotice('${n._id}')">Cancelar</button>` : ''}
        ${n.status !== 'sent' && n.status !== 'cancelled' && hasPermission('notices.update') ? `<button class="btn btn-primary btn-sm" onclick="sendNoticeNow('${n._id}')">Enviar ahora</button>` : ''}
        ${hasPermission('notices.delete') ? `<button class="btn btn-danger btn-sm" onclick="deleteNotice('${n._id}')">Eliminar</button>` : ''}
        <button class="btn btn-secondary btn-sm" onclick="closeModal()">Cerrar</button>
      </div>
    </div>`;
}

function statsBlock(stats) {
  return `
    <h3>Lectura</h3>
    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:.5rem;margin:.75rem 0">
      ${stat('Destinatarios', stats.totalRecipients)}
      ${stat('Leidos', stats.readCount)}
      ${stat('No leidos', stats.unreadCount)}
      ${stat('% lectura', `${stats.readPercentage}%`)}
    </div>
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem">
      ${readerList('Leidos', stats.read)}
      ${readerList('No leidos', stats.unread)}
    </div>`;
}

function readerList(title, list = []) {
  return `<div><p class="text-sm bold">${title}</p><div style="max-height:150px;overflow:auto">${list.slice(0, 50).map(r =>
    `<p class="text-sm text-muted">${esc(r.name || r.email || 'Usuario')}${r.unitName ? ` - ${esc(r.unitName)}` : ''}</p>`).join('') || '<p class="text-sm text-muted">Sin registros.</p>'}</div></div>`;
}

export async function deleteNotice(id) {
  if (!confirm('Eliminar este comunicado?')) return;
  try {
    await api.notices.delete(id);
    closeModal();
    toast('Comunicado eliminado', 'success');
    await renderAdminNotices(true);
  } catch (err) {
    toast(err.message, 'error');
  }
}

export function openTemplateModal(id = '') {
  const t = id ? _templates.find(item => item._id === id) : null;
  openModal(`
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">${t ? 'Editar plantilla' : 'Nueva plantilla'}</h2>
    <div class="flex col gap-2">
      <div class="form-group"><label>Titulo</label><input class="input" id="tpl-title" value="${esc(t?.title || '')}"></div>
      <div class="form-group"><label>Asunto</label><input class="input" id="tpl-subject" value="${esc(t?.subject || '')}"></div>
      ${selectHtml('tpl-category', 'Categoria', Object.entries(CATEGORY_LABEL), t?.category || 'general', '')}
      <div class="form-group"><label>Mensaje</label><textarea class="input" id="tpl-body" style="min-height:120px">${esc(t?.body || '')}</textarea></div>
      <div class="flex gap-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        ${t ? `<button class="btn btn-danger w-full" onclick="deleteTemplate('${t._id}')">Eliminar</button>` : ''}
        <button class="btn btn-primary w-full" onclick="saveTemplate('${id}')">Guardar</button>
      </div>
      ${_templates.length && !t ? `<div class="card"><div class="card-body"><h3>Plantillas existentes</h3>${_templates.map(item => `<button class="btn btn-ghost btn-sm" style="margin:.2rem" onclick="openTemplateModal('${item._id}')">${esc(item.title)}</button>`).join('')}</div></div>` : ''}
    </div>`);
}

export async function saveTemplate(id = '') {
  const payload = {
    title: document.getElementById('tpl-title')?.value.trim(),
    subject: document.getElementById('tpl-subject')?.value.trim(),
    category: document.getElementById('tpl-category')?.value || 'general',
    body: document.getElementById('tpl-body')?.value.trim(),
  };
  if (!payload.title || !payload.subject || !payload.body) {
    toast('Completa titulo, asunto y mensaje.', 'error');
    return;
  }
  try {
    if (id) await api.noticeTemplates.update(id, payload);
    else await api.noticeTemplates.create(payload);
    closeModal();
    toast('Plantilla guardada', 'success');
    await renderAdminNotices(true);
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function deleteTemplate(id) {
  if (!confirm('Eliminar esta plantilla?')) return;
  try {
    await api.noticeTemplates.delete(id);
    closeModal();
    toast('Plantilla eliminada', 'success');
    await renderAdminNotices(true);
  } catch (err) {
    toast(err.message, 'error');
  }
}

export function onNoticeFilesChange(fileList) {
  const incoming = Array.from(fileList || []);
  const remaining = 3 - _noticeFiles.length;
  if (remaining <= 0) {
    toast('Maximo 3 archivos permitidos.', 'warning');
    return;
  }
  _noticeFiles = _noticeFiles.concat(incoming.slice(0, remaining));
  if (incoming.length > remaining) toast('Se agregaron solo los primeros archivos hasta completar 3.', 'warning');
  document.getElementById('n-files').value = '';
  renderFilePreview();
}

export function removeNoticeFile(index) {
  _noticeFiles.splice(index, 1);
  renderFilePreview();
}

function renderFilePreview() {
  const el = document.getElementById('n-files-preview');
  if (!el) return;
  el.innerHTML = _noticeFiles.length
    ? `<div class="flex gap-1 mt-1" style="flex-wrap:wrap">${_noticeFiles.map((f, i) =>
      `<span class="badge badge-neutral">${esc(f.name)} <button type="button" onclick="removeNoticeFile(${i})" style="background:none;border:0;color:inherit">x</button></span>`).join('')}</div>`
    : '';
}

export async function downloadNoticeAttachment(noticeId, index, filename) {
  await downloadAttachment(api.notices.getAttachmentUrl(noticeId, index), filename);
}

window.renderAdminNotices = renderAdminNotices;
window.setNoticeFilter = setNoticeFilter;
window.openNoticeEditor = openNoticeEditor;
window.saveNoticeFromEditor = saveNoticeFromEditor;
window.openAdminNotice = openAdminNotice;
window.sendNoticeNow = sendNoticeNow;
window.cancelNotice = cancelNotice;
window.deleteNotice = deleteNotice;
window.duplicateNotice = duplicateNotice;
window.toggleTargetSelectors = toggleTargetSelectors;
window.applyNoticeTemplate = applyNoticeTemplate;
window.updateNoticePreview = updateNoticePreview;
window.openTemplateModal = openTemplateModal;
window.saveTemplate = saveTemplate;
window.deleteTemplate = deleteTemplate;
window.onNoticeFilesChange = onNoticeFilesChange;
window.removeNoticeFile = removeNoticeFile;
window.downloadNoticeAttachment = downloadNoticeAttachment;
