import { apiCall } from '../../core/apiWrapper.js';
import { skeleton } from '../../ui/skeleton.js';
import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { debounce, escapeHtml, formatDate } from '../../ui/helpers.js';

const STATUS_LABELS = {
  pending: 'Pendiente',
  partially_matched: 'Coincidencia parcial',
  associated: 'Asociado',
  rejected: 'Rechazado',
  archived: 'Archivado',
};

const STATUS_BADGES = {
  pending: 'badge-warning',
  partially_matched: 'badge-warning',
  associated: 'badge-success',
  rejected: 'badge-danger',
  archived: 'badge-neutral',
};

const METHOD_LABELS = {
  transferencia: 'Transferencia',
  deposito: 'Deposito',
  efectivo: 'Efectivo',
  mercadopago: 'MercadoPago',
  otro: 'Otro',
};

const state = {
  page: 1,
  limit: 20,
  status: 'pending',
  search: '',
  paymentMethod: '',
};

function money(value) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`;
}

function params() {
  const result = { page: state.page, limit: state.limit };
  if (state.status && state.status !== 'all') result.status = state.status;
  if (state.search.trim()) result.search = state.search.trim();
  if (state.paymentMethod) result.paymentMethod = state.paymentMethod;
  return result;
}

function badge(status) {
  return `<span class="badge ${STATUS_BADGES[status] || 'badge-neutral'}">${STATUS_LABELS[status] || status || 'Sin estado'}</span>`;
}

function renderPagination(pagination = {}) {
  const pages = Math.max(1, pagination.pages || 1);
  if (pages <= 1) return '';
  const current = pagination.page || state.page;
  return `
    <div class="pagination">
      <button class="pg-btn" onclick="adminUnidentifiedPaymentsPage(${current - 1})" ${current <= 1 ? 'disabled' : ''}>&lsaquo;</button>
      <span class="pg-ellipsis">Pagina ${current} de ${pages}</span>
      <button class="pg-btn" onclick="adminUnidentifiedPaymentsPage(${current + 1})" ${current >= pages ? 'disabled' : ''}>&rsaquo;</button>
    </div>`;
}

function renderCard(payment) {
  const id = payment._id || payment.id;
  const canAct = payment.status === 'pending';
  const attachments = payment.attachments?.length
    ? `<small class="text-muted">${payment.attachments.length} adjunto${payment.attachments.length !== 1 ? 's' : ''}</small>`
    : '<small class="text-muted">Sin adjuntos</small>';

  return `
    <article class="card" style="margin-bottom:.75rem">
      <div class="card-body" style="padding:1rem 1.25rem">
        <div class="flex between" style="align-items:flex-start;gap:1rem">
          <div style="min-width:0">
            <h3 style="margin:0 0 .25rem">${money(payment.amount)}</h3>
            <p class="text-sm text-muted" style="margin:0">
              ${escapeHtml(METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod || 'Metodo no indicado')}
              ${payment.reference ? ` - Ref. ${escapeHtml(payment.reference)}` : ''}
            </p>
          </div>
          ${badge(payment.status)}
        </div>

        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem;margin-top:.85rem">
          <div>
            <small class="text-muted">Fecha de pago</small>
            <p class="bold" style="margin:.15rem 0 0">${formatDate(payment.paymentDate)}</p>
          </div>
          <div>
            <small class="text-muted">Remitente</small>
            <p class="bold" style="margin:.15rem 0 0">${escapeHtml(payment.senderName || 'Sin identificar')}</p>
          </div>
          <div>
            <small class="text-muted">Cuenta</small>
            <p class="bold" style="margin:.15rem 0 0">${escapeHtml(payment.senderAccount || '-')}</p>
          </div>
          <div>
            <small class="text-muted">Creado</small>
            <p class="bold" style="margin:.15rem 0 0">${formatDate(payment.createdAt)}</p>
          </div>
        </div>

        ${payment.description ? `<p class="text-sm text-muted" style="margin:.85rem 0 0">${escapeHtml(payment.description)}</p>` : ''}

        <div class="flex between" style="gap:.75rem;margin-top:1rem;align-items:center;flex-wrap:wrap">
          ${attachments}
          <div class="flex gap-1" style="flex-wrap:wrap">
            <button class="btn btn-ghost btn-sm" onclick="adminUnidentifiedPaymentDetail('${id}')">Ver detalle</button>
            ${canAct ? `
              <button class="btn btn-secondary btn-sm" onclick="adminUnidentifiedPaymentReject('${id}')">Rechazar</button>
              <button class="btn btn-secondary btn-sm" onclick="adminUnidentifiedPaymentArchive('${id}')">Archivar</button>
              <button class="btn btn-danger btn-sm" onclick="adminUnidentifiedPaymentDelete('${id}')">Eliminar</button>
            ` : ''}
          </div>
        </div>
      </div>
    </article>`;
}

function renderList(response) {
  const el = document.getElementById('unidentified-payments-list');
  if (!el) return;
  const items = response?.data || [];
  const pagination = response?.pagination || {};

  if (!items.length) {
    el.innerHTML = `
      <div class="card">
        <div class="card-body" style="text-align:center;padding:2rem 1rem">
          <p class="text-muted text-sm">No hay pagos sin identificar para los filtros seleccionados.</p>
        </div>
      </div>`;
    return;
  }

  el.innerHTML = `
    <div class="owners-meta"><span>${pagination.total || items.length} registro${(pagination.total || items.length) !== 1 ? 's' : ''}</span></div>
    ${items.map(renderCard).join('')}
    ${renderPagination(pagination)}`;
}

async function loadList() {
  const el = document.getElementById('unidentified-payments-list');
  if (el) el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const response = await apiCall(() => api.unidentifiedPayments.list(params()), { silent: true });
    renderList(response);
  } catch (err) {
    if (el) {
      el.innerHTML = `
        <div style="text-align:center;padding:2rem;color:var(--danger)">
          <p class="bold">${escapeHtml(err.message || 'No se pudieron cargar los pagos sin identificar.')}</p>
          <button class="btn btn-ghost btn-sm mt-2" onclick="renderAdminUnidentifiedPayments()">Reintentar</button>
        </div>`;
    }
  }
}

export async function renderAdminUnidentifiedPayments() {
  const el = document.getElementById('page-admin-unidentified-payments');
  if (!el) return;

  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between" style="align-items:flex-start;gap:1rem">
        <div>
          <p class="page-eyebrow">Finanzas</p>
          <h1>Pagos sin identificar</h1>
          <p class="text-muted text-sm" style="margin:.1rem 0 0">Transferencias o ingresos que todavia no fueron asociados a un propietario.</p>
        </div>
        <button class="btn btn-primary btn-sm" onclick="adminUnidentifiedPaymentCreate()">+ Registrar</button>
      </div>

      <div class="admin-payments-filters">
        <input class="input" type="search" placeholder="Buscar remitente, referencia o descripcion"
          value="${escapeHtml(state.search)}"
          oninput="adminUnidentifiedPaymentsSearch(this.value)">
        <select class="select" onchange="stateUnidentifiedPayments.status=this.value;stateUnidentifiedPayments.page=1;renderAdminUnidentifiedPayments()">
          ${Object.entries({ all: 'Todos', ...STATUS_LABELS }).map(([value, label]) =>
            `<option value="${value}" ${state.status === value ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
        <select class="select" onchange="stateUnidentifiedPayments.paymentMethod=this.value;stateUnidentifiedPayments.page=1;renderAdminUnidentifiedPayments()">
          <option value="">Todos los metodos</option>
          ${Object.entries(METHOD_LABELS).map(([value, label]) =>
            `<option value="${value}" ${state.paymentMethod === value ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </div>

      <div id="unidentified-payments-list">${skeleton(4)}</div>
    </div>`;

  await loadList();
}

const debouncedSearch = debounce(() => {
  state.page = 1;
  renderAdminUnidentifiedPayments();
}, 350);

window.adminUnidentifiedPaymentsSearch = function(value) {
  state.search = value;
  debouncedSearch();
};

window.adminUnidentifiedPaymentsPage = function(page) {
  state.page = Math.max(1, page);
  renderAdminUnidentifiedPayments();
};

window.adminUnidentifiedPaymentCreate = function() {
  const today = new Date().toISOString().slice(0, 10);
  openModal(`
    <div style="max-width:520px;padding:1.5rem">
      <h2 style="margin:0 0 1rem">Registrar pago sin identificar</h2>
      <div class="form-group" style="margin-bottom:.85rem">
        <label>Importe</label>
        <input id="up-amount" class="input" type="number" min="1" step="0.01">
      </div>
      <div class="form-group" style="margin-bottom:.85rem">
        <label>Fecha de pago</label>
        <input id="up-date" class="input" type="date" value="${today}">
      </div>
      <div class="form-group" style="margin-bottom:.85rem">
        <label>Metodo</label>
        <select id="up-method" class="select">
          ${Object.entries(METHOD_LABELS).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group" style="margin-bottom:.85rem">
        <label>Referencia</label>
        <input id="up-reference" class="input" type="text">
      </div>
      <div class="form-group" style="margin-bottom:.85rem">
        <label>Remitente</label>
        <input id="up-sender" class="input" type="text">
      </div>
      <div class="form-group" style="margin-bottom:1rem">
        <label>Descripcion</label>
        <textarea id="up-description" class="input" rows="3"></textarea>
      </div>
      <div class="flex gap-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" onclick="adminUnidentifiedPaymentCreateConfirm()">Guardar</button>
      </div>
    </div>`);
};

window.adminUnidentifiedPaymentCreateConfirm = async function() {
  const amount = Number(document.getElementById('up-amount')?.value || 0);
  const paymentDate = document.getElementById('up-date')?.value;
  const paymentMethod = document.getElementById('up-method')?.value;
  const reference = document.getElementById('up-reference')?.value?.trim();
  const senderName = document.getElementById('up-sender')?.value?.trim();
  const description = document.getElementById('up-description')?.value?.trim();

  if (!amount || amount <= 0) return toast('Ingresa un importe valido.', 'error');
  if (!paymentDate) return toast('Ingresa la fecha de pago.', 'error');
  if (!paymentMethod) return toast('Selecciona el metodo de pago.', 'error');

  const formData = new FormData();
  formData.append('amount', String(amount));
  formData.append('paymentDate', paymentDate);
  formData.append('paymentMethod', paymentMethod);
  if (reference) formData.append('reference', reference);
  if (senderName) formData.append('senderName', senderName);
  if (description) formData.append('description', description);

  const response = await apiCall(() => api.unidentifiedPayments.create(formData));
  if (!response?.success) return;
  closeModal();
  toast(response.warning?.message || 'Pago registrado.', response.warning ? 'warning' : 'success');
  state.status = 'pending';
  state.page = 1;
  await renderAdminUnidentifiedPayments();
};

window.adminUnidentifiedPaymentDetail = async function(id) {
  openModal(`<div style="padding:1.5rem;color:var(--muted)">Cargando...</div>`);
  const response = await apiCall(() => api.unidentifiedPayments.getOne(id), { silent: true });
  const payment = response?.data;
  if (!payment) {
    closeModal();
    return toast('No se pudo cargar el pago.', 'error');
  }

  const suggestions = payment.status === 'pending'
    ? await apiCall(() => api.unidentifiedPayments.getSuggestions(id), { silent: true }).catch(() => null)
    : null;
  const suggestedItems = suggestions?.data?.suggestions || suggestions?.data || [];

  openModal(`
    <div style="max-width:640px;padding:1.5rem">
      <div class="flex between" style="gap:1rem;margin-bottom:1rem">
        <h2 style="margin:0">Pago sin identificar</h2>
        ${badge(payment.status)}
      </div>
      <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(150px,1fr));gap:.75rem;margin-bottom:1rem">
        <div class="card" style="padding:.85rem 1rem"><small class="text-muted">Importe</small><p class="bold" style="margin:.2rem 0 0">${money(payment.amount)}</p></div>
        <div class="card" style="padding:.85rem 1rem"><small class="text-muted">Fecha</small><p class="bold" style="margin:.2rem 0 0">${formatDate(payment.paymentDate)}</p></div>
        <div class="card" style="padding:.85rem 1rem"><small class="text-muted">Metodo</small><p class="bold" style="margin:.2rem 0 0">${escapeHtml(METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod)}</p></div>
        <div class="card" style="padding:.85rem 1rem"><small class="text-muted">Referencia</small><p class="bold" style="margin:.2rem 0 0">${escapeHtml(payment.reference || '-')}</p></div>
      </div>
      <p class="text-sm text-muted">${escapeHtml(payment.description || 'Sin descripcion.')}</p>
      ${suggestedItems.length ? `
        <h3 style="margin:1.25rem 0 .6rem">Sugerencias</h3>
        <div class="flex col gap-1">
          ${suggestedItems.slice(0, 5).map(item => `
            <div class="card" style="padding:.75rem 1rem">
              <strong>${escapeHtml(item.owner?.name || item.ownerName || 'Propietario sugerido')}</strong>
              <p class="text-sm text-muted" style="margin:.25rem 0 0">${escapeHtml(item.reason || item.matchReason || 'Posible coincidencia por importe o referencia.')}</p>
            </div>`).join('')}
        </div>` : ''}
      <div class="flex gap-1 mt-2">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cerrar</button>
      </div>
    </div>`);
};

window.adminUnidentifiedPaymentReject = function(id) {
  openModal(`
    <div style="max-width:420px;padding:1.5rem">
      <h2 style="margin:0 0 1rem">Rechazar pago</h2>
      <div class="form-group" style="margin-bottom:1rem">
        <label>Motivo</label>
        <textarea id="up-action-reason" class="input" rows="3"></textarea>
      </div>
      <div class="flex gap-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-danger w-full" onclick="adminUnidentifiedPaymentRejectConfirm('${id}')">Rechazar</button>
      </div>
    </div>`);
};

window.adminUnidentifiedPaymentRejectConfirm = async function(id) {
  const reason = document.getElementById('up-action-reason')?.value?.trim();
  if (!reason) return toast('Indica el motivo del rechazo.', 'error');
  const response = await apiCall(() => api.unidentifiedPayments.reject(id, reason));
  if (!response?.success) return;
  closeModal();
  toast('Pago rechazado.', 'success');
  await renderAdminUnidentifiedPayments();
};

window.adminUnidentifiedPaymentArchive = async function(id) {
  const reason = prompt('Motivo de archivo (opcional):') || '';
  const response = await apiCall(() => api.unidentifiedPayments.archive(id, reason));
  if (!response?.success) return;
  toast('Pago archivado.', 'success');
  await renderAdminUnidentifiedPayments();
};

window.adminUnidentifiedPaymentDelete = async function(id) {
  if (!confirm('Eliminar este pago sin identificar?')) return;
  const response = await apiCall(() => api.unidentifiedPayments.delete(id));
  if (!response?.success) return;
  toast('Pago eliminado.', 'success');
  await renderAdminUnidentifiedPayments();
};

window.renderAdminUnidentifiedPayments = renderAdminUnidentifiedPayments;
window.stateUnidentifiedPayments = state;
