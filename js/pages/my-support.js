import { toast } from '../ui/toast.js';
import { skeleton } from '../ui/skeleton.js';
import { formatDate, errorState } from '../ui/helpers.js';

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

function esc(value = '') {
  return String(value)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function statusBadge(status) {
  if (status === 'open')        return '<span class="badge badge-warning">Abierto</span>';
  if (status === 'in_progress') return '<span class="badge badge-neutral">En proceso</span>';
  if (status === 'resolved')    return '<span class="badge badge-success">Resuelto</span>';
  if (status === 'closed')      return '<span class="badge badge-neutral">Cerrado</span>';
  return `<span class="badge">${esc(status)}</span>`;
}

function priorityBadge(priority) {
  if (priority === 'high') return '<span class="badge badge-danger">Alta</span>';
  if (priority === 'low')  return '<span class="badge" style="opacity:.7">Baja</span>';
  return '';
}

function renderTicket(ticket) {
  const desc = ticket.description?.length > 120
    ? esc(ticket.description.slice(0, 120)) + '…'
    : esc(ticket.description || '');

  const resolvedLine = (ticket.status === 'resolved' || ticket.status === 'closed') && ticket.resolvedAt
    ? `<p class="text-sm text-muted" style="margin-top:.25rem">Resuelto el ${formatDate(ticket.resolvedAt)}</p>`
    : '';

  const responseLine = ticket.adminResponse
    ? `<div class="my-support-response">
        <p class="text-sm" style="font-weight:600;margin-bottom:.25rem">Respuesta de soporte:</p>
        <p class="text-sm">${esc(ticket.adminResponse)}</p>
       </div>`
    : '';

  return `
    <div class="support-ticket-card">
      <div class="support-ticket-head">
        <div style="min-width:0">
          <p class="support-ticket-title">${esc(ticket.title)}</p>
          <p class="support-ticket-meta">${esc(TYPE_LABELS[ticket.type] || ticket.type)} · ${formatDate(ticket.createdAt)}</p>
          ${resolvedLine}
        </div>
        <div class="flex col" style="align-items:flex-end;gap:.25rem">
          ${statusBadge(ticket.status)}
          ${priorityBadge(ticket.priority)}
        </div>
      </div>
      <p class="support-ticket-description">${desc}</p>
      ${responseLine}
    </div>`;
}

export async function renderMySupport() {
  const el = document.getElementById('page-my-support');
  if (!el) return;
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;

  try {
    const res = await api.supportTickets.getMy();
    const tickets = res.data?.tickets || res.data || [];

    el.innerHTML = `
      <div class="flex col gap-3">
        <div class="flex between" style="align-items:flex-start;gap:1rem;flex-wrap:wrap">
          <div>
            <h1>Mis tickets de soporte</h1>
            <p class="text-sm text-muted">Consultas y reportes enviados al equipo de GestionAr.</p>
          </div>
          <button class="btn btn-primary btn-sm" onclick="openSupportTicketModal()">+ Nuevo reporte</button>
        </div>

        <div class="card" style="background:rgba(156,242,123,0.04);border-color:rgba(156,242,123,0.15)">
          <div class="card-body" style="padding:.85rem 1.1rem">
            <p class="text-sm" style="color:var(--text)">
              <strong>¿Problema con el consorcio?</strong> Usá la sección
              <button class="btn btn-ghost btn-sm" style="display:inline;padding:0 .3rem" onclick="showPage('page-owner-claims');renderOwnerClaims?.()">Reclamos</button>
              para comunicarte con tu administrador.
              Los tickets de soporte son exclusivamente para problemas técnicos con la aplicación GestionAr.
            </p>
          </div>
        </div>

        ${tickets.length
          ? `<div class="flex col gap-2">${tickets.map(renderTicket).join('')}</div>`
          : `<div class="card"><div class="card-body">
               <p class="text-muted text-sm">Todavía no enviaste ningún ticket de soporte técnico a GestionAr.</p>
               <button class="btn btn-secondary btn-sm" style="margin-top:.75rem" onclick="openSupportTicketModal()">Reportar un problema</button>
             </div></div>`}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderMySupport()');
  }
}

window.renderMySupport = renderMySupport;
