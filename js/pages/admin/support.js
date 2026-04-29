import { toast } from '../../ui/toast.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { formatDate, errorState } from '../../ui/helpers.js';

const TYPE_LABELS = {
  bug: 'Error en la app',
  question: 'Consulta',
  payment_issue: 'Problema con pago',
  suggestion: 'Sugerencia',
  other: 'Otro',
};

const STATUS_LABELS = {
  open: 'Abierto',
  in_progress: 'En proceso',
  resolved: 'Resuelto',
  closed: 'Cerrado',
};

const PRIORITY_LABELS = {
  low: 'Baja',
  medium: 'Media',
  high: 'Alta',
};

const _filters = {
  status: '',
  type: '',
  priority: '',
  search: '',
};

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusBadge(status) {
  if (status === 'open') return '<span class="badge badge-warning">Abierto</span>';
  if (status === 'in_progress') return '<span class="badge badge-neutral">En proceso</span>';
  if (status === 'resolved') return '<span class="badge badge-success">Resuelto</span>';
  if (status === 'closed') return '<span class="badge badge-neutral">Cerrado</span>';
  return `<span class="badge">${esc(status)}</span>`;
}

function filterParams() {
  return Object.fromEntries(Object.entries(_filters).filter(([, value]) => value));
}

function renderOptions(labels, selected, emptyLabel) {
  return `<option value="">${emptyLabel}</option>` +
    Object.entries(labels).map(([value, label]) =>
      `<option value="${value}" ${selected === value ? 'selected' : ''}>${label}</option>`
    ).join('');
}

function renderTicketCard(ticket) {
  const user = ticket.userId;
  const route = ticket.context?.route || '-';
  return `
    <div class="support-ticket-card">
      <div class="support-ticket-head">
        <div style="min-width:0">
          <p class="support-ticket-title">${esc(ticket.title)}</p>
          <p class="support-ticket-meta">${esc(TYPE_LABELS[ticket.type] || ticket.type)} - ${esc(user?.name || 'Usuario')} - ${formatDate(ticket.createdAt)}</p>
          <p class="support-ticket-meta">${esc(route)}</p>
        </div>
        ${statusBadge(ticket.status)}
      </div>
      <p class="support-ticket-description">${esc(ticket.description)}</p>
      <div class="support-ticket-controls">
        <label>
          Estado
          <select class="input" id="support-status-${ticket._id}">
            ${Object.entries(STATUS_LABELS).map(([value, label]) =>
              `<option value="${value}" ${ticket.status === value ? 'selected' : ''}>${label}</option>`
            ).join('')}
          </select>
        </label>
        <label>
          Prioridad
          <select class="input" id="support-priority-${ticket._id}">
            ${Object.entries(PRIORITY_LABELS).map(([value, label]) =>
              `<option value="${value}" ${ticket.priority === value ? 'selected' : ''}>${label}</option>`
            ).join('')}
          </select>
        </label>
      </div>
      <div class="form-group">
        <label>Respuesta del administrador</label>
        <textarea class="input" id="support-response-${ticket._id}" rows="3" maxlength="3000" placeholder="Escribi una respuesta o nota interna...">${esc(ticket.adminResponse || '')}</textarea>
      </div>
      <button class="btn btn-primary btn-sm" id="btn-save-support-${ticket._id}" onclick="updateSupportTicket('${ticket._id}')">Guardar cambios</button>
    </div>`;
}

export async function renderAdminSupport() {
  const el = document.getElementById('page-admin-support');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;

  try {
    const res = await api.supportTickets.getAll(filterParams());
    const tickets = res.data.tickets;

    el.innerHTML = `
      <div class="flex col gap-3">
        <div class="flex between" style="align-items:flex-start;gap:1rem;flex-wrap:wrap">
          <div>
            <h1>Soporte</h1>
            <p class="text-sm text-muted">Tickets reportados por usuarios de la organizacion.</p>
          </div>
          <span class="badge badge-neutral">${tickets.length} tickets</span>
        </div>
        <div class="card">
          <div class="card-body support-filters">
            <select class="input" id="support-filter-status" onchange="setSupportFilter('status', this.value)">
              ${renderOptions(STATUS_LABELS, _filters.status, 'Todos los estados')}
            </select>
            <select class="input" id="support-filter-type" onchange="setSupportFilter('type', this.value)">
              ${renderOptions(TYPE_LABELS, _filters.type, 'Todos los tipos')}
            </select>
            <select class="input" id="support-filter-priority" onchange="setSupportFilter('priority', this.value)">
              ${renderOptions(PRIORITY_LABELS, _filters.priority, 'Todas las prioridades')}
            </select>
            <input class="input" id="support-filter-search" value="${esc(_filters.search)}" placeholder="Buscar..." onkeydown="if(event.key==='Enter') setSupportFilter('search', this.value)">
            <button class="btn btn-secondary btn-sm" onclick="setSupportFilter('search', document.getElementById('support-filter-search').value)">Buscar</button>
          </div>
        </div>
        ${tickets.length
          ? `<div class="flex col gap-2">${tickets.map(renderTicketCard).join('')}</div>`
          : '<div class="card"><div class="card-body"><p class="text-muted text-sm">No hay tickets para mostrar.</p></div></div>'}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminSupport()');
  }
}

export function setSupportFilter(key, value) {
  _filters[key] = value.trim();
  renderAdminSupport();
}

export async function updateSupportTicket(id) {
  const btn = document.getElementById(`btn-save-support-${id}`);
  setBtnLoading(btn, true);

  try {
    await api.supportTickets.update(id, {
      status: document.getElementById(`support-status-${id}`)?.value,
      priority: document.getElementById(`support-priority-${id}`)?.value,
      adminResponse: document.getElementById(`support-response-${id}`)?.value?.trim() || '',
    });
    toast('Ticket actualizado correctamente.', 'success');
    renderAdminSupport();
  } catch (err) {
    toast(err.message || 'No se pudo actualizar el ticket.', 'error');
    setBtnLoading(btn, false);
  }
}

window.renderAdminSupport = renderAdminSupport;
window.setSupportFilter = setSupportFilter;
window.updateSupportTicket = updateSupportTicket;
