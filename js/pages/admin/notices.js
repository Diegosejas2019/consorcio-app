import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { tagLabel, formatDate, errorState } from '../../ui/helpers.js';

export async function renderAdminNotices() {
  const el = document.getElementById('page-admin-notices');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res = await api.notices.getAll({ limit: 30 });
    el.innerHTML = `
      <div class="flex col gap-3">
        <div class="flex between">
          <h1>Avisos</h1>
          <button class="btn btn-primary btn-sm" onclick="openNewNoticeModal()">+ Nuevo</button>
        </div>
        <div class="flex col gap-2">
          ${res.data.notices.map(n => `
            <div class="notice-card">
              <div class="flex between">
                <span class="notice-tag tag-${n.tag}">${tagLabel(n.tag)}</span>
                <button class="btn-icon" style="font-size:.75rem" onclick="deleteNotice('${n._id}')">🗑</button>
              </div>
              <h3>${n.title}</h3>
              <p class="text-sm text-muted">${n.body.slice(0, 100)}${n.body.length > 100 ? '…' : ''}</p>
              <span class="notice-date">${formatDate(n.createdAt)}</span>
            </div>`).join('') || '<p class="text-muted text-sm">Sin avisos.</p>'}
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminNotices()');
  }
}

export function openNewNoticeModal() {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nuevo Aviso</h2>
    <div class="flex col gap-2">
      <div class="form-group"><label>Título</label><input class="input" id="n-title" placeholder="Título del aviso"></div>
      <div class="form-group"><label>Mensaje</label><textarea class="input" id="n-body" style="min-height:110px" placeholder="Contenido del comunicado..."></textarea></div>
      <div class="form-group">
        <label>Tipo</label>
        <select class="select" id="n-tag">
          <option value="info">📢 Informativo</option>
          <option value="warning">⚠ Advertencia</option>
          <option value="urgent">🔴 Urgente</option>
        </select>
      </div>
      <label style="font-size:.85rem;display:flex;align-items:center;gap:.5rem;cursor:pointer">
        <input type="checkbox" id="n-push" checked> Enviar push notification a propietarios
      </label>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" data-requires-network onclick="saveNotice()">Publicar</button>
      </div>
    </div>`;
  openModal();
}

export async function saveNotice() {
  const title    = document.getElementById('n-title')?.value.trim();
  const body     = document.getElementById('n-body')?.value.trim();
  const tag      = document.getElementById('n-tag')?.value;
  const sendPush = document.getElementById('n-push')?.checked;
  if (!title || !body) { toast('Completá todos los campos', 'error'); return; }
  try {
    await api.notices.create({ title, body, tag, sendPush });
    closeModal();
    toast('Aviso publicado', 'success');
    renderAdminNotices();
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function deleteNotice(id) {
  if (!confirm('¿Eliminar este aviso?')) return;
  try {
    await api.notices.delete(id);
    toast('Aviso eliminado');
    renderAdminNotices();
  } catch (err) {
    toast(err.message, 'error');
  }
}

window.renderAdminNotices  = renderAdminNotices;
window.openNewNoticeModal  = openNewNoticeModal;
window.saveNotice          = saveNotice;
window.deleteNotice        = deleteNotice;
