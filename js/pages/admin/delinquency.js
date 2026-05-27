import { CACHE_TTL, getCachedOrFetch, stableParams } from '../../core/cacheHelpers.js';
import { skeleton } from '../../ui/skeleton.js';
import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { svgIcon } from '../../ui/icons.js';
import { debounce, escapeHtml, formatMonth } from '../../ui/helpers.js';
import { openRegisterPaymentModal } from './owners.js';
import { hasPermission } from '../../services/permissionService.js';

const STATUS_LABELS = {
  all: 'Todos',
  al_dia: 'Al día',
  deuda_leve: 'Deuda leve',
  deuda_media: 'Deuda media',
  deuda_alta: 'Deuda alta',
  mora_critica: 'Mora crítica',
};

const SORT_LABELS = {
  debt_desc: 'Mayor deuda',
  days_desc: 'Más atraso',
  name: 'Nombre',
  unit: 'Unidad',
  last_payment: 'Último pago',
};

const RISK_LABELS = {
  sin_deuda: 'Al día',
  bajo: 'Riesgo bajo',
  medio: 'Riesgo medio',
  alto: 'Riesgo alto',
  critico: 'Riesgo crítico',
};

const RISK_BADGE_CLASS = {
  sin_deuda: 'badge-success',
  bajo: 'badge-success',
  medio: 'badge-warning',
  alto: 'badge-danger',
  critico: 'badge-danger',
};

const SUGGESTED_ACTION_LABELS = {
  send_reminder: 'Enviar recordatorio',
  create_payment_plan: 'Crear plan de pago',
  review_pending_payment: 'Ver pago pendiente',
  review_payment_plan: 'Ver plan de pago',
  wait_for_response: 'Esperar respuesta',
  view_detail: 'Ver detalle',
  register_adjustment: 'Registrar ajuste',
};

export const delinquencyState = {
  page: 1,
  limit: 10,
  search: '',
  period: '',
  status: 'all',
  minDebt: '',
  maxDebt: '',
  minPeriods: '',
  minDaysOverdue: '',
  pendingReview: false,
  criticalOnly: false,
  hasActivePlan: '',
  reminderDays: '',
  sort: 'debt_desc',
  summary: null,
  aging: [],
  last: null,
};

const money = value => `$ ${Number(value || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const plainMoney = value => `$ ${Number(value || 0).toLocaleString('es-AR')}`;
const dateLabel = value => value ? new Date(value).toLocaleDateString('es-AR') : '-';
const jsString = value => String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\n/g, '\\n');

function timeAgo(date) {
  if (!date) return null;
  const days = Math.floor((Date.now() - new Date(date)) / 86400000);
  if (days === 0) return 'hoy';
  if (days === 1) return 'ayer';
  if (days < 30) return `hace ${days} días`;
  const months = Math.floor(days / 30);
  return `hace ${months} mes${months > 1 ? 'es' : ''}`;
}

export const debouncedDelinquencySearch = debounce(() => {
  delinquencyState.page = 1;
  renderAdminDelinquency(true);
}, 350);

function buildParams() {
  const params = {
    page: delinquencyState.page,
    limit: delinquencyState.limit,
    sort: delinquencyState.sort,
  };
  if (delinquencyState.search.trim()) params.search = delinquencyState.search.trim();
  if (delinquencyState.period) params.period = delinquencyState.period;
  if (delinquencyState.status !== 'all') params.status = delinquencyState.status;
  if (delinquencyState.minDebt) params.minDebt = delinquencyState.minDebt;
  if (delinquencyState.maxDebt) params.maxDebt = delinquencyState.maxDebt;
  if (delinquencyState.minPeriods) params.minPeriods = delinquencyState.minPeriods;
  if (delinquencyState.minDaysOverdue) params.minDaysOverdue = delinquencyState.minDaysOverdue;
  if (delinquencyState.pendingReview) params.pendingReview = true;
  if (delinquencyState.criticalOnly) params.criticalOnly = true;
  if (delinquencyState.hasActivePlan) params.hasActivePlan = delinquencyState.hasActivePlan;
  if (delinquencyState.reminderDays) params.reminderDays = delinquencyState.reminderDays;
  return params;
}

function statusBadge(status) {
  const cls = {
    al_dia: 'badge-success',
    deuda_leve: 'badge-warning',
    deuda_media: 'badge-warning',
    deuda_alta: 'badge-danger',
    mora_critica: 'badge-danger',
  }[status] || 'badge-neutral';
  return `<span class="badge ${cls}">${STATUS_LABELS[status] || status}</span>`;
}

function riskBadge(level) {
  if (!level || level === 'sin_deuda') return '';
  return `<span class="badge ${RISK_BADGE_CLASS[level] || 'badge-neutral'}">${RISK_LABELS[level] || level}</span>`;
}

function primaryActionLabel(suggestedActions = []) {
  const first = suggestedActions.find(a => a !== 'view_detail' && a !== 'register_adjustment');
  return first ? SUGGESTED_ACTION_LABELS[first] : null;
}

function pageButton(page, label = page, disabled = false) {
  return `<button class="pg-btn ${page === delinquencyState.page ? 'active' : ''}" onclick="delinquencyGoPage(${page})" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

function paginationView(pagination) {
  const pages = Math.max(1, pagination?.pages || 1);
  const current = pagination?.page || delinquencyState.page;
  if (pages <= 1) return '';
  const buttons = [pageButton(current - 1, '&lsaquo;', current <= 1)];
  for (let p = Math.max(1, current - 2); p <= Math.min(pages, current + 2); p++) buttons.push(pageButton(p));
  buttons.push(pageButton(current + 1, '&rsaquo;', current >= pages));
  return `<div class="pagination">${buttons.join('')}</div>`;
}

function renderSummary(summary = {}, aging = [], owners = []) {
  const riskCounts = { critico: 0, alto: 0, medio: 0, bajo: 0 };
  for (const o of owners) {
    if (riskCounts[o.riskLevel] !== undefined) riskCounts[o.riskLevel]++;
  }
  return `
    <div class="admin-payments-summary">
      <div><span>Deuda vencida</span><strong>${money(summary.totalDebt)}</strong></div>
      <div><span>Morosos</span><strong>${summary.delinquentOwners || 0}</strong></div>
      <div><span>Unidades con deuda</span><strong>${summary.delinquentUnits || 0}</strong></div>
      <div><span>Promedio</span><strong>${money(summary.averageDebt)}</strong></div>
      <div><span>Morosidad</span><strong>${summary.delinquencyRate || 0}%</strong></div>
      <div><span>Por aprobar</span><strong>${summary.pendingPaymentsCount || 0}</strong></div>
    </div>
    <div class="admin-payments-summary">
      ${aging.map(bucket => `
        <div><span>${escapeHtml(bucket.label)}</span><strong>${plainMoney(bucket.amount)}</strong><small>${bucket.owners} propietario${bucket.owners === 1 ? '' : 's'}</small></div>
      `).join('')}
    </div>
    ${owners.length ? `
    <div class="admin-payments-summary" style="border-top:1px solid var(--border);padding-top:.75rem">
      <div style="border-left:3px solid var(--danger)"><span>Riesgo crítico</span><strong>${riskCounts.critico}</strong></div>
      <div style="border-left:3px solid var(--danger)"><span>Riesgo alto</span><strong>${riskCounts.alto}</strong></div>
      <div style="border-left:3px solid var(--warning)"><span>Riesgo medio</span><strong>${riskCounts.medio}</strong></div>
      <div style="border-left:3px solid var(--success)"><span>Riesgo bajo</span><strong>${riskCounts.bajo}</strong></div>
    </div>` : ''}
  `;
}

function renderFilters() {
  return `
    <div class="admin-payments-filters">
      <input id="delinq-search" class="input" type="search" placeholder="Buscar propietario, email o unidad"
        value="${escapeHtml(delinquencyState.search)}"
        oninput="delinquencyState.search=this.value;debouncedDelinquencySearch()">
      <input class="input" type="month" value="${escapeHtml(delinquencyState.period)}"
        onchange="delinquencyState.period=this.value;delinquencyState.page=1;renderAdminDelinquency(true)">
      <select class="select" onchange="delinquencyState.status=this.value;delinquencyState.page=1;renderAdminDelinquency(true)">
        ${Object.entries(STATUS_LABELS).map(([value, label]) => `<option value="${value}" ${delinquencyState.status === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <select class="select" onchange="delinquencyState.sort=this.value;delinquencyState.page=1;renderAdminDelinquency(true)">
        ${Object.entries(SORT_LABELS).map(([value, label]) => `<option value="${value}" ${delinquencyState.sort === value ? 'selected' : ''}>${label}</option>`).join('')}
      </select>
      <input class="input" type="number" min="0" placeholder="Deuda mínima" value="${escapeHtml(delinquencyState.minDebt)}"
        onchange="delinquencyState.minDebt=this.value;delinquencyState.page=1;renderAdminDelinquency(true)">
      <input class="input" type="number" min="0" placeholder="Días atraso mín." value="${escapeHtml(delinquencyState.minDaysOverdue)}"
        onchange="delinquencyState.minDaysOverdue=this.value;delinquencyState.page=1;renderAdminDelinquency(true)">
      <select class="select" onchange="delinquencyState.hasActivePlan=this.value;delinquencyState.page=1;renderAdminDelinquency(true)">
        <option value="" ${delinquencyState.hasActivePlan === '' ? 'selected' : ''}>Plan de pago: todos</option>
        <option value="yes" ${delinquencyState.hasActivePlan === 'yes' ? 'selected' : ''}>Con plan activo</option>
        <option value="no" ${delinquencyState.hasActivePlan === 'no' ? 'selected' : ''}>Sin plan activo</option>
      </select>
      <input class="input" type="number" min="0" placeholder="Sin recordatorio (días)" value="${escapeHtml(delinquencyState.reminderDays)}"
        onchange="delinquencyState.reminderDays=this.value;delinquencyState.page=1;renderAdminDelinquency(true)"
        title="Mostrar propietarios sin recordatorio en los últimos N días">
      <label class="check-row"><input type="checkbox" ${delinquencyState.pendingReview ? 'checked' : ''} onchange="delinquencyState.pendingReview=this.checked;delinquencyState.page=1;renderAdminDelinquency(true)"> Por aprobar</label>
      <label class="check-row"><input type="checkbox" ${delinquencyState.criticalOnly ? 'checked' : ''} onchange="delinquencyState.criticalOnly=this.checked;delinquencyState.page=1;renderAdminDelinquency(true)"> Críticos</label>
    </div>
  `;
}

function renderOwnerCard(owner) {
  const units = (owner.units || []).join(', ') || '-';
  const primaryAction = primaryActionLabel(owner.suggestedActions);
  const reminderText = owner.lastReminderAt ? `Recordatorio: ${timeAgo(owner.lastReminderAt)}` : null;
  return `
    <article class="admin-payment-card${owner.pendingPaymentsCount > 0 ? ' has-pending-review' : ''}">
      <div class="admin-payment-owner">
        <div class="owner-avatar">${escapeHtml((owner.name || '?').slice(0, 1).toUpperCase())}</div>
        <div class="owner-info">
          <p class="name">${escapeHtml(owner.name || '-')}</p>
          <p class="unit">${escapeHtml(units)}${owner.email ? ` - ${escapeHtml(owner.email)}` : ''}</p>
        </div>
        <div class="admin-payment-owner-side">
          ${statusBadge(owner.status)}
          ${riskBadge(owner.riskLevel)}
          <strong class="${owner.totalOwed > 0 ? 'debt' : 'ok'}">${money(owner.totalOwed)}</strong>
        </div>
      </div>
      <div class="admin-payment-grid">
        <div>
          <span class="admin-payment-label">Períodos adeudados</span>
          <div class="admin-payment-tags is-debt">
            ${(owner.unpaidPeriods || []).length ? owner.unpaidPeriods.slice(0, 5).map(p => `<span>${formatMonth(p)}</span>`).join('') : '<em>Sin períodos</em>'}
          </div>
        </div>
        <div>
          <span class="admin-payment-label">Atraso y estado</span>
          <div class="admin-payment-tags">
            <span>${owner.daysOverdue || 0} días</span>
            ${owner.pendingPaymentsCount > 0 ? `<span>${owner.pendingPaymentsCount} por aprobar</span>` : ''}
            ${owner.hasActivePlan ? `<span class="badge badge-success" style="font-size:.7rem">Plan activo</span>` : ''}
            ${owner.overdueInstallmentsCount > 0 ? `<span class="badge badge-danger" style="font-size:.7rem">${owner.overdueInstallmentsCount} cuota${owner.overdueInstallmentsCount > 1 ? 's' : ''} vencida${owner.overdueInstallmentsCount > 1 ? 's' : ''}</span>` : ''}
            ${reminderText ? `<span style="color:var(--muted);font-size:.75rem">${escapeHtml(reminderText)}</span>` : ''}
          </div>
        </div>
      </div>
      <div class="admin-payment-footer">
        <span>
          ${owner.oldestPeriod ? `Más antiguo: ${formatMonth(owner.oldestPeriod)}` : 'Sin deuda mensual vencida'}
          ${primaryAction ? `<span style="color:var(--accent);font-size:.75rem;margin-left:.5rem">→ ${escapeHtml(primaryAction)}</span>` : ''}
        </span>
        <div>
          <button class="btn btn-ghost btn-sm" onclick="openDelinquencyDetail('${owner.id}')">Detalle</button>
          ${hasPermission('payments.remind') && owner.totalOwed > 0 ? `<button class="btn btn-ghost btn-sm" onclick="openDebtReminder('${owner.id}')">Recordar</button>` : ''}
          ${hasPermission('payments.register') ? `<button class="btn btn-primary btn-sm" onclick="openRegisterPaymentModal('${owner.id}','${jsString(owner.name)}')">Registrar pago</button>` : ''}
        </div>
      </div>
    </article>
  `;
}

function renderView(result) {
  const el = document.getElementById('page-admin-delinquency');
  const owners = result.data?.owners || [];
  const pagination = result.pagination || { total: 0, page: 1, pages: 1, limit: delinquencyState.limit };
  delinquencyState.last = result;
  el.innerHTML = `
    <div class="admin-payments-page">
      <div class="flex between admin-payments-head">
        <div>
          <p class="page-eyebrow">Finanzas</p>
          <h1>Morosidad</h1>
          <p class="text-muted text-sm">Ranking de propietarios con deuda exigible y scoring de riesgo.</p>
        </div>
        <div style="display:flex;gap:.5rem;align-items:center;flex-wrap:wrap">
          <button class="btn btn-ghost btn-sm" onclick="downloadDelinquencyCsv()">${svgIcon('download', 15)} CSV</button>
          <button class="btn btn-ghost btn-sm" onclick="renderAdminDelinquency(true)">${svgIcon('refresh-cw', 15)} Actualizar</button>
        </div>
      </div>
      ${renderSummary(delinquencyState.summary, delinquencyState.aging, owners)}
      ${renderFilters()}
      <div class="admin-payments-list">
        ${owners.length ? owners.map(renderOwnerCard).join('') : `
          <div class="card"><div class="card-body" style="text-align:center;padding:2rem 1rem">
            <p class="text-muted text-sm">No hay resultados para los filtros seleccionados.</p>
          </div></div>`}
      </div>
      ${paginationView(pagination)}
    </div>
  `;
}

export async function renderAdminDelinquency(force = false) {
  const el = document.getElementById('page-admin-delinquency');
  if (!el) return;
  if (!delinquencyState.last || force) el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  const params = buildParams();
  try {
    const [summaryRes, agingRes, ownersRes] = await Promise.all([
      getCachedOrFetch(`delinquency:summary:${stableParams(params)}`, CACHE_TTL.PAYMENTS_SHORT, () => api.delinquency.summary(params), { skipCache: force }),
      getCachedOrFetch(`delinquency:aging:${stableParams(params)}`, CACHE_TTL.PAYMENTS_SHORT, () => api.delinquency.aging(params), { skipCache: force }),
      getCachedOrFetch(`delinquency:owners:${stableParams(params)}`, CACHE_TTL.PAYMENTS_SHORT, () => api.delinquency.owners(params), { skipCache: force }),
    ]);
    delinquencyState.summary = summaryRes.data?.summary || {};
    delinquencyState.aging = agingRes.data?.buckets || [];
    renderView(ownersRes);
  } catch (err) {
    el.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--danger)">
      <p class="bold">${escapeHtml(err.message || 'No se pudo cargar morosidad.')}</p>
      <button class="btn btn-ghost btn-sm mt-2" onclick="renderAdminDelinquency(true)">Reintentar</button>
    </div>`;
  }
}

export function delinquencyGoPage(page) {
  delinquencyState.page = Math.max(1, page);
  renderAdminDelinquency(true);
  document.getElementById('page-admin-delinquency')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function buildSuggestedActionsHtml(summary, ownerId) {
  const actions = summary.suggestedActions || [];
  if (!actions.length) return '';
  const buttons = actions
    .filter(a => a !== 'view_detail')
    .map(action => {
      if (action === 'send_reminder' && hasPermission('payments.remind')) {
        return `<button class="btn btn-primary btn-sm" onclick="openDebtReminder('${ownerId}');closeModal()">Enviar recordatorio</button>`;
      }
      if (action === 'create_payment_plan') {
        return `<button class="btn btn-ghost btn-sm" onclick="closeModal();showPage('page-admin-payment-plans')">Crear plan de pago</button>`;
      }
      if (action === 'review_pending_payment') {
        return `<button class="btn btn-ghost btn-sm" onclick="closeModal();showPage('page-admin-payments')">Ver pago pendiente</button>`;
      }
      if (action === 'review_payment_plan') {
        return `<button class="btn btn-ghost btn-sm" onclick="closeModal();showPage('page-admin-payment-plans')">Ver plan de pago</button>`;
      }
      if (action === 'wait_for_response') {
        return `<span class="text-muted text-sm" style="align-self:center">Recordatorio reciente — esperar respuesta</span>`;
      }
      if (action === 'register_adjustment' && hasPermission('debt.write')) {
        return `<button class="btn btn-ghost btn-sm" onclick="closeModal()">Registrar ajuste</button>`;
      }
      return null;
    })
    .filter(Boolean);

  if (!buttons.length) return '';
  return `
    <div style="margin-top:1rem">
      <p class="text-sm" style="font-weight:600;margin-bottom:.5rem">Acciones sugeridas</p>
      <div class="flex gap-1" style="flex-wrap:wrap">${buttons.join('')}</div>
    </div>
  `;
}

export async function openDelinquencyDetail(ownerId) {
  try {
    const res = await api.delinquency.owner(ownerId);
    const detail = res.data?.detail;
    if (!detail) return toast('No se encontró el detalle.', 'error');
    const summary = detail.summary;
    const rows = [...(detail.periodDetails || []), ...(detail.balanceItems || []), ...(detail.extraordinaryItems || []), ...(detail.debtItems || [])];
    const riskLevel = summary.riskLevel;
    const riskReasons = summary.riskReasons || [];
    const riskScore = summary.riskScore || 0;
    const reminderAgo = timeAgo(summary.lastReminderAt);
    const remindersCount = summary.remindersCount || 0;

    const riskSection = riskLevel && riskLevel !== 'sin_deuda' ? `
      <div class="card" style="margin:1rem 0">
        <div class="card-header" style="padding:.75rem 1rem">
          <span class="text-sm" style="font-weight:600">Análisis de riesgo</span>
        </div>
        <div class="card-body" style="padding:.75rem 1rem">
          <div class="flex gap-1" style="align-items:center;margin-bottom:.5rem">
            ${riskBadge(riskLevel)}
            <span class="text-muted text-sm">Score: ${riskScore}</span>
          </div>
          ${riskReasons.length ? `<ul style="margin:.5rem 0 0 1rem;padding:0;font-size:.82rem;color:var(--text)">${riskReasons.map(r => `<li>${escapeHtml(r)}</li>`).join('')}</ul>` : ''}
        </div>
      </div>` : '';

    const reminderSection = `
      <div style="margin-top:.5rem;font-size:.82rem;color:var(--muted)">
        ${remindersCount > 0
          ? `${remindersCount} recordatorio${remindersCount > 1 ? 's' : ''} enviado${remindersCount > 1 ? 's' : ''} — último: ${reminderAgo || dateLabel(summary.lastReminderAt)}`
          : 'Sin recordatorios registrados'}
      </div>`;

    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      <h2>${escapeHtml(detail.owner.name)}</h2>
      <p class="text-sm text-muted">${(detail.units || []).map(u => escapeHtml(u.name)).join(', ') || 'Sin unidad'} - ${escapeHtml(detail.owner.email || '')}</p>
      <div class="admin-payments-summary" style="margin:1rem 0">
        <div><span>Deuda total</span><strong>${money(summary.totalOwed)}</strong></div>
        <div><span>Períodos</span><strong>${summary.periodsCount || 0}</strong></div>
        <div><span>Atraso</span><strong>${summary.daysOverdue || 0} días</strong></div>
      </div>
      ${riskSection}
      ${buildSuggestedActionsHtml(summary, ownerId)}
      ${reminderSection}
      <div class="table-scroll" style="margin-top:1rem">
        <table class="table">
          <thead><tr><th>Concepto</th><th>Período</th><th>Vencimiento</th><th>Saldo</th><th>Estado</th></tr></thead>
          <tbody>${rows.map(row => `
            <tr>
              <td>${escapeHtml(row.concept || '-')}</td>
              <td>${row.period ? formatMonth(row.period) : '-'}</td>
              <td>${row.dueDate ? dateLabel(row.dueDate) : 'sin vencimiento definido'}</td>
              <td>${money(row.balance)}</td>
              <td>${escapeHtml(row.status || '-')} ${row.daysOverdue ? `(${row.daysOverdue} días)` : ''}</td>
            </tr>
          `).join('') || '<tr><td colspan="5">Sin deuda exigible.</td></tr>'}</tbody>
        </table>
      </div>
      <div class="flex gap-1 mt-2">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cerrar</button>
        <button class="btn btn-ghost w-full" onclick="downloadOwnerDebtCsv('${ownerId}')">Descargar CSV</button>
        ${hasPermission('payments.remind') && summary.totalOwed > 0 ? `<button class="btn btn-primary w-full" onclick="openDebtReminder('${ownerId}')">Recordar</button>` : ''}
      </div>
    `;
    openModal();
  } catch (err) {
    toast(err.message || 'No se pudo cargar el detalle.', 'error');
  }
}

export async function openDebtReminder(ownerId) {
  try {
    const res = await api.delinquency.owner(ownerId);
    const detail = res.data?.detail;
    const summary = detail.summary;
    const periods = (summary.unpaidPeriods || []).join(', ') || 'saldo pendiente';
    const message = `Hola ${detail.owner.name},\nTe informamos que registrás una deuda pendiente de ${money(summary.totalOwed)} correspondiente a ${periods}.\nPodés consultar el detalle y regularizar tu situación desde GestionAr.\n\nMuchas gracias.`;
    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      <h2>Enviar recordatorio</h2>
      <p class="text-sm text-muted">Se generará un comunicado interno solo para ${escapeHtml(detail.owner.name)}.</p>
      <div class="form-group">
        <label>Canal</label>
        <select id="debt-reminder-channel" class="input">
          <option value="app">Comunicado interno</option>
          <option value="manual">Registro manual</option>
          <option value="email" disabled>Email próximamente</option>
          <option value="whatsapp" disabled>WhatsApp próximamente</option>
        </select>
      </div>
      <div class="form-group">
        <label>Mensaje</label>
        <textarea id="debt-reminder-message" class="input" rows="8">${escapeHtml(message)}</textarea>
      </div>
      <div class="flex gap-1 mt-2">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" data-requires-network onclick="sendDebtReminder('${ownerId}')">Enviar</button>
      </div>
    `;
    openModal();
  } catch (err) {
    toast(err.message || 'No se pudo preparar el recordatorio.', 'error');
  }
}

export async function sendDebtReminder(ownerId) {
  const channel = document.getElementById('debt-reminder-channel')?.value || 'app';
  const message = document.getElementById('debt-reminder-message')?.value.trim();
  if (!message) return toast('El mensaje es obligatorio.', 'error');
  try {
    await api.delinquency.reminder(ownerId, { channel, message });
    closeModal();
    window.gestionarInvalidateCaches?.('delinquency');
    toast(channel === 'app' ? 'Recordatorio enviado.' : 'Recordatorio registrado.', 'success');
    renderAdminDelinquency(true);
  } catch (err) {
    toast(err.message || 'No se pudo enviar el recordatorio.', 'error');
  }
}

export function downloadDelinquencyCsv() {
  window.open(api.delinquency.exportUrl(buildParams()), '_blank');
}

export function downloadOwnerDebtCsv(ownerId) {
  window.open(api.delinquency.ownerExportUrl(ownerId), '_blank');
}

window.renderAdminDelinquency = renderAdminDelinquency;
window.delinquencyState = delinquencyState;
window.debouncedDelinquencySearch = debouncedDelinquencySearch;
window.delinquencyGoPage = delinquencyGoPage;
window.openDelinquencyDetail = openDelinquencyDetail;
window.openDebtReminder = openDebtReminder;
window.sendDebtReminder = sendDebtReminder;
window.downloadDelinquencyCsv = downloadDelinquencyCsv;
window.downloadOwnerDebtCsv = downloadOwnerDebtCsv;
window.openRegisterPaymentModal = openRegisterPaymentModal;
