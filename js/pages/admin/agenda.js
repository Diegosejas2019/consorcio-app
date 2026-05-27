/* ═══════════════════════════════════════════════════════════════
   GestionAr — Admin: Agenda de vencimientos (Etapa 6)
   ═══════════════════════════════════════════════════════════════ */

import { apiCall }               from '../../core/apiWrapper.js';
import { toast }                 from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton }              from '../../ui/skeleton.js';
import { formatDate, errorState } from '../../ui/helpers.js';
import { getCachedOrFetch, CACHE_TTL, invalidateAppCaches } from '../../core/cacheHelpers.js';

const TYPE_LABELS = {
  expense_due:                  'Gasto pendiente',
  payment_pending:              'Pagos por aprobar',
  unidentified_payment_pending: 'Pagos sin identificar',
  claim_stale:                  'Reclamo sin respuesta',
  salary_due:                   'Sueldo pendiente',
  rendition_due:                'Rendición no generada',
  access_request_pending:       'Solicitudes de acceso',
  admin_task:                   'Tarea',
};

const TYPE_BADGE = {
  expense_due:                  'badge-warning',
  payment_pending:              'badge-danger',
  unidentified_payment_pending: 'badge-warning',
  claim_stale:                  'badge-warning',
  salary_due:                   'badge-danger',
  rendition_due:                'badge-neutral',
  access_request_pending:       'badge-neutral',
  admin_task:                   'badge-partial',
};

const PRIORITY_BADGE = { high: 'badge-danger', medium: 'badge-warning', low: 'badge-neutral' };
const PRIORITY_LABEL = { high: 'Alta', medium: 'Media', low: 'Baja' };

const TYPE_ACTION_ONCLICK = {
  expense_due:                  "showPage('page-admin-expenses');renderAdminExpenses()",
  payment_pending:              "showPage('page-admin-payments');renderAdminPayments()",
  unidentified_payment_pending: "showPage('page-admin-unidentified-payments');renderAdminUnidentifiedPayments()",
  claim_stale:                  "showPage('page-admin-claims');renderAdminClaims()",
  salary_due:                   "showPage('page-admin-salaries');renderAdminSalaries()",
  rendition_due:                "showPage('page-admin-report');renderAdminReport()",
  access_request_pending:       "showPage('page-admin-access-requests');renderAdminAccessRequests()",
};

const TYPE_ACTION_LABEL = {
  expense_due:                  'Ver gastos',
  payment_pending:              'Ver pagos',
  unidentified_payment_pending: 'Ver no identificados',
  claim_stale:                  'Ver reclamos',
  salary_due:                   'Ver sueldos',
  rendition_due:                'Ver rendición',
  access_request_pending:       'Ver solicitudes',
};

let _filter = 'all';

export async function renderAdminAgenda() {
  const el = document.getElementById('page-admin-agenda');
  if (!el) return;

  el.innerHTML = `<div class="flex col gap-3">${skeleton(5)}</div>`;

  try {
    const res = await getCachedOrFetch('agenda:', CACHE_TTL.AGENDA, () => api.agenda.get());
    _renderView(el, res.data);
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminAgenda()');
  }
}

function _renderView(el, data) {
  const { items = [], summary = {} } = data;
  const filtered = _filter === 'all' ? items : items.filter(i => i.priority === _filter);

  el.innerHTML = `
    <div class="flex col gap-3">

      <div class="flex between" style="flex-wrap:wrap;gap:0.75rem;align-items:center">
        <h1 style="margin:0">Agenda</h1>
        <button class="btn btn-primary btn-sm" onclick="window._agendaOpenNewTask()">+ Tarea manual</button>
      </div>

      <div class="flex" style="gap:0.5rem;flex-wrap:wrap">
        ${_chip('all',    'Total',    summary.total  || 0, summary.high > 0 ? 'alert' : summary.total > 0 ? 'warn' : '')}
        ${_chip('high',   'Urgentes', summary.high   || 0, 'alert')}
        ${_chip('medium', 'Medias',   summary.medium || 0, 'warn')}
        ${_chip('low',    'Bajas',    summary.low    || 0, '')}
      </div>

      ${filtered.length === 0
        ? `<div class="card"><div class="card-body" style="text-align:center;color:var(--muted);padding:2rem 1.5rem">
             Sin pendientes en esta categoría.
           </div></div>`
        : `<div class="flex col gap-2">${filtered.map(_renderItem).join('')}</div>`
      }

      <div style="font-size:0.75rem;color:var(--muted)">Período ${summary.period || '—'}</div>

    </div>
  `;
}

function _chip(key, label, count, modifier) {
  const isActive = _filter === key;
  return `
    <div class="hero-chip${modifier ? ' ' + modifier : ''}${isActive ? ' active' : ''}"
         style="cursor:pointer;min-width:80px"
         onclick="window._agendaSetFilter('${key}')">
      <span class="chip-num">${count}</span>
      <span class="chip-lbl">${label}</span>
    </div>
  `;
}

function _renderItem(item) {
  const typeBadge     = TYPE_BADGE[item.type]     || 'badge-neutral';
  const typeLabel     = TYPE_LABELS[item.type]    || item.type;
  const priorityBadge = PRIORITY_BADGE[item.priority] || 'badge-neutral';
  const priorityLabel = PRIORITY_LABEL[item.priority] || item.priority;
  const actionOnclick = TYPE_ACTION_ONCLICK[item.type];
  const actionLabel   = TYPE_ACTION_LABEL[item.type];
  const isTask        = item.type === 'admin_task';
  const idStr         = String(item.id);

  return `
    <div class="card card-sm">
      <div class="card-body" style="padding:0.85rem 1.1rem">
        <div class="flex between" style="gap:0.75rem;align-items:flex-start">
          <div style="flex:1;min-width:0">
            <div style="display:flex;gap:0.4rem;flex-wrap:wrap;margin-bottom:0.35rem">
              <span class="badge ${typeBadge}" style="font-size:0.68rem">${typeLabel}</span>
              <span class="badge ${priorityBadge}" style="font-size:0.68rem">${priorityLabel}</span>
            </div>
            <div style="font-weight:600;color:var(--text-bright);font-size:0.9rem;margin-bottom:0.15rem">${item.title}</div>
            ${item.subtitle ? `<div style="font-size:0.78rem;color:var(--muted)">${item.subtitle}</div>` : ''}
            ${item.date ? `<div style="font-size:0.75rem;color:var(--muted);margin-top:0.2rem">${formatDate(item.date)}</div>` : ''}
          </div>
          <div style="display:flex;gap:0.4rem;flex-shrink:0;flex-wrap:wrap;justify-content:flex-end">
            ${actionOnclick ? `<button class="btn btn-ghost btn-sm" onclick="${actionOnclick}">${actionLabel}</button>` : ''}
            ${isTask ? `
              <button class="btn btn-success btn-sm" data-requires-network
                      onclick="window._agendaCompleteTask('${idStr}')" title="Completar">✓</button>
              <button class="btn btn-danger btn-sm" data-requires-network
                      onclick="window._agendaDeleteTask('${idStr}')" title="Eliminar">✕</button>
            ` : ''}
          </div>
        </div>
      </div>
    </div>
  `;
}

// ── Funciones globales ────────────────────────────────────────

window._agendaSetFilter = function(filter) {
  _filter = filter;
  const el = document.getElementById('page-admin-agenda');
  if (!el) return;
  const cached = window.cache?.get('agenda:');
  if (cached) {
    _renderView(el, cached.data);
  } else {
    renderAdminAgenda();
  }
};

window._agendaOpenNewTask = function() {
  openModal(`
    <div style="padding:1.5rem;max-width:420px">
      <h3 style="margin:0 0 1rem">Nueva tarea manual</h3>
      <div class="flex col gap-2">
        <div class="form-group">
          <label>Título</label>
          <input class="input" id="_at-title" placeholder="Ej: Llamar al proveedor de limpieza" maxlength="200">
        </div>
        <div class="form-group">
          <label>Notas (opcional)</label>
          <textarea class="input" id="_at-notes" rows="2" maxlength="1000" placeholder="Detalles adicionales…"></textarea>
        </div>
        <div class="form-group">
          <label>Vencimiento (opcional)</label>
          <input class="input" type="date" id="_at-due">
        </div>
        <div class="form-group">
          <label>Prioridad</label>
          <select class="input" id="_at-priority">
            <option value="medium">Media</option>
            <option value="high">Alta</option>
            <option value="low">Baja</option>
          </select>
        </div>
        <div class="flex gap-2" style="justify-content:flex-end;margin-top:0.5rem">
          <button class="btn btn-secondary btn-sm" onclick="closeModal()">Cancelar</button>
          <button class="btn btn-primary btn-sm" data-requires-network onclick="window._agendaSubmitTask()">Guardar</button>
        </div>
      </div>
    </div>
  `);
};

window._agendaSubmitTask = async function() {
  const title    = document.getElementById('_at-title')?.value?.trim();
  const notes    = document.getElementById('_at-notes')?.value?.trim();
  const dueDate  = document.getElementById('_at-due')?.value;
  const priority = document.getElementById('_at-priority')?.value;

  if (!title) {
    toast('El título es obligatorio.', 'warning');
    return;
  }

  await apiCall(() => api.agenda.createTask({
    title,
    notes:   notes   || undefined,
    dueDate: dueDate || undefined,
    priority,
  }));
  toast('Tarea creada.', 'success');

  closeModal();
  invalidateAppCaches('agenda');
  renderAdminAgenda();
};

window._agendaCompleteTask = async function(id) {
  await apiCall(() => api.agenda.completeTask(id));
  toast('Tarea completada.', 'success');
  invalidateAppCaches('agenda');
  renderAdminAgenda();
};

window._agendaDeleteTask = async function(id) {
  if (!confirm('¿Eliminar esta tarea?')) return;
  await apiCall(() => api.agenda.deleteTask(id));
  toast('Tarea eliminada.', 'success');
  invalidateAppCaches('agenda');
  renderAdminAgenda();
};
