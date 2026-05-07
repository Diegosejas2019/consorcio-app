import { CACHE_TTL, getCachedOrFetch, stableParams } from '../../core/cacheHelpers.js';
import { skeleton } from '../../ui/skeleton.js';
import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { svgIcon } from '../../ui/icons.js';
import { debounce, downloadReceipt, escapeHtml, formatMonth } from '../../ui/helpers.js';
import { viewOwnerDetail, openRegisterPaymentModal } from './owners.js';

const STATUS_OPTIONS = {
  all: 'Todos',
  debtor: 'Morosos',
  up_to_date: 'Al dia',
  pending_review: 'Por aprobar',
};

const SORT_OPTIONS = {
  debt_first: 'Morosos primero',
  name: 'Nombre',
  unit: 'Unidad',
  last_payment: 'Ultimo pago',
};

const PERIOD_STATUS_LABELS = {
  paid: 'Pagado',
  pending: 'Pendiente',
  unpaid: 'Adeudado',
  not_chargeable: 'No corresponde',
};

const PAYMENT_TYPE_LABELS = {
  monthly: 'Mensual',
  extraordinary: 'Extraordinario',
  balance: 'Saldo anterior',
};

export const adminPaymentsState = {
  page: 1,
  limit: 10,
  search: '',
  period: '',
  status: 'all',
  sort: 'debt_first',
  last: null,
};

export const debouncedAdminPaymentsSearch = debounce(() => {
  adminPaymentsState.page = 1;
  renderAdminPayments();
}, 350);

const money = value => `$${Number(value || 0).toLocaleString('es-AR')}`;

const jsString = value => String(value ?? '')
  .replace(/\\/g, '\\\\')
  .replace(/'/g, "\\'")
  .replace(/\n/g, ' ');

function ownerUnits(owner) {
  return (owner.units?.length ? owner.units : (owner.unit ? [owner.unit] : []))
    .filter(Boolean)
    .join(', ');
}

function periodStatusBadge(status) {
  const cls = {
    paid: 'badge-success',
    pending: 'badge-warning',
    unpaid: 'badge-danger',
    not_chargeable: 'badge-neutral',
  }[status] || 'badge-neutral';
  return `<span class="badge ${cls}">${PERIOD_STATUS_LABELS[status] || status}</span>`;
}

function paymentPeriodLabel(payment) {
  if (payment.month) return formatMonth(payment.month);
  return PAYMENT_TYPE_LABELS[payment.type] || 'Pago manual';
}

function paymentTypeLabel(payment) {
  return PAYMENT_TYPE_LABELS[payment.type] || payment.type || 'Mensual';
}

function buildParams() {
  const params = {
    page: adminPaymentsState.page,
    limit: adminPaymentsState.limit,
    status: adminPaymentsState.status,
    sort: adminPaymentsState.sort,
  };
  if (adminPaymentsState.search.trim()) params.search = adminPaymentsState.search.trim();
  if (adminPaymentsState.period.trim()) params.period = adminPaymentsState.period.trim();
  return params;
}

function pageButton(page, label = page, disabled = false) {
  return `<button class="pg-btn ${page === adminPaymentsState.page ? 'active' : ''}" onclick="adminPaymentsGoPage(${page})" ${disabled ? 'disabled' : ''}>${label}</button>`;
}

function renderPagination(pagination) {
  const pages = Math.max(1, pagination?.pages || 1);
  const current = pagination?.page || adminPaymentsState.page;
  if (pages <= 1) return '';

  const buttons = [pageButton(current - 1, '&lsaquo;', current <= 1)];
  const range = new Set([1, pages]);
  for (let i = Math.max(2, current - 1); i <= Math.min(pages - 1, current + 1); i++) range.add(i);

  let last = 0;
  [...range].sort((a, b) => a - b).forEach(page => {
    if (page - last > 1) buttons.push('<span class="pg-ellipsis">...</span>');
    buttons.push(pageButton(page));
    last = page;
  });
  buttons.push(pageButton(current + 1, '&rsaquo;', current >= pages));
  return `<div class="pagination">${buttons.join('')}</div>`;
}

function renderPendingPayments(owner) {
  if (!owner.pendingPayments?.length) {
    return '<p class="admin-payments-empty-line">Sin comprobantes pendientes.</p>';
  }

  return owner.pendingPayments.map(payment => `
    <div class="admin-payment-pending">
      <div>
        <strong>${paymentPeriodLabel(payment)}</strong>
        <span>${money(payment.amount)} - ${paymentTypeLabel(payment)}</span>
      </div>
      <div class="admin-payment-actions">
        ${payment.hasReceipt ? `
          <button class="icon-btn" title="Ver comprobante" onclick="downloadReceipt('${payment.id}')">
            ${svgIcon('doc', 16)}
          </button>` : ''}
        <button class="icon-btn is-success" title="Aprobar" data-requires-network onclick="adminPaymentsApprove('${payment.id}')">
          ${svgIcon('check', 16)}
        </button>
        <button class="icon-btn is-danger" title="Rechazar" data-requires-network onclick="adminPaymentsOpenReject('${payment.id}', '${jsString(owner.name)}')">
          ${svgIcon('x', 16)}
        </button>
      </div>
    </div>
  `).join('');
}

function renderOwnerCard(owner) {
  const units = ownerUnits(owner) || 'Sin unidad';
  const totalOwed = Number(owner.totalOwed || 0);
  const hasDebt = totalOwed > 0;
  const initial = (owner.name || '?').trim().slice(0, 1).toUpperCase();
  const visiblePaid = owner.paidPeriods?.slice(-4).reverse() || [];
  const visibleUnpaid = owner.unpaidPeriods?.slice(0, 4) || [];

  return `
    <article class="admin-payment-card">
      <div class="admin-payment-owner">
        <div class="owner-avatar">${initial}</div>
        <div class="owner-info">
          <p class="name">${escapeHtml(owner.name)}</p>
          <p class="unit">${escapeHtml(units)}${owner.email ? ` - ${escapeHtml(owner.email)}` : ''}</p>
        </div>
        <div class="admin-payment-owner-side">
          <span class="badge ${hasDebt ? 'badge-danger' : 'badge-success'}">${hasDebt ? 'Moroso' : 'Al dia'}</span>
          <strong class="${hasDebt ? 'debt' : 'ok'}">${money(totalOwed)}</strong>
        </div>
      </div>

      ${adminPaymentsState.period ? `
        <div class="admin-payment-period-state">
          <span>${formatMonth(adminPaymentsState.period)}</span>
          ${periodStatusBadge(owner.selectedPeriodStatus)}
        </div>` : ''}

      <div class="admin-payment-grid">
        <div>
          <span class="admin-payment-label">Periodos pagados</span>
          <div class="admin-payment-tags">
            ${visiblePaid.length ? visiblePaid.map(p => `<span>${formatMonth(p)}</span>`).join('') : '<em>Ninguno</em>'}
          </div>
        </div>
        <div>
          <span class="admin-payment-label">Periodos adeudados</span>
          <div class="admin-payment-tags is-debt">
            ${visibleUnpaid.length ? visibleUnpaid.map(p => `<span>${formatMonth(p)}</span>`).join('') : '<em>Sin deuda mensual</em>'}
          </div>
        </div>
      </div>

      <div class="admin-payment-pending-wrap">
        <div class="admin-payment-label">Comprobantes por aprobar</div>
        ${renderPendingPayments(owner)}
      </div>

      <div class="admin-payment-footer">
        <span>${owner.lastPayment ? `Ultimo pago: ${paymentPeriodLabel(owner.lastPayment)} - ${money(owner.lastPayment.amount)}` : 'Sin pagos aprobados'}</span>
        <div>
          <button class="btn btn-ghost btn-sm" onclick="viewOwnerDetail('${owner.id}')">Ver detalle</button>
          <button class="btn btn-primary btn-sm" onclick="openRegisterPaymentModal('${owner.id}', '${jsString(owner.name)}')">Registrar pago</button>
        </div>
      </div>
    </article>
  `;
}

function renderSummary(owners, pagination) {
  const debtors = owners.filter(owner => Number(owner.totalOwed || 0) > 0).length;
  const pending = owners.reduce((sum, owner) => sum + Number(owner.pendingPaymentsCount || 0), 0);
  const totalOwed = owners.reduce((sum, owner) => sum + Number(owner.totalOwed || 0), 0);
  return `
    <div class="admin-payments-summary">
      <div><span>Resultados</span><strong>${pagination.total || 0}</strong></div>
      <div><span>Morosos en pagina</span><strong>${debtors}</strong></div>
      <div><span>Por aprobar</span><strong>${pending}</strong></div>
      <div><span>Deuda visible</span><strong>${money(totalOwed)}</strong></div>
    </div>
  `;
}

function renderAdminPaymentsView(res) {
  const el = document.getElementById('page-admin-payments');
  const owners = res.data?.owners || [];
  const pagination = res.pagination || { total: 0, page: 1, pages: 1, limit: adminPaymentsState.limit };
  adminPaymentsState.last = res;

  el.innerHTML = `
    <div class="admin-payments-page">
      <div class="flex between admin-payments-head">
        <div>
          <p class="page-eyebrow">Administracion</p>
          <h1>Pagos</h1>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="renderAdminPayments(true)">
          ${svgIcon('refresh-cw', 15)} Actualizar
        </button>
      </div>

      <div class="admin-payments-filters">
        <input id="admin-payments-search" class="input" type="search" placeholder="Buscar propietario, email o unidad"
          value="${escapeHtml(adminPaymentsState.search)}"
          oninput="adminPaymentsState.search=this.value;debouncedAdminPaymentsSearch()">
        <input id="admin-payments-period" class="input" type="month"
          value="${escapeHtml(adminPaymentsState.period)}"
          onchange="adminPaymentsState.period=this.value;adminPaymentsState.page=1;renderAdminPayments(true)">
        <select class="select" onchange="adminPaymentsState.status=this.value;adminPaymentsState.page=1;renderAdminPayments(true)">
          ${Object.entries(STATUS_OPTIONS).map(([value, label]) =>
            `<option value="${value}" ${adminPaymentsState.status === value ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
        <select class="select" onchange="adminPaymentsState.sort=this.value;adminPaymentsState.page=1;renderAdminPayments(true)">
          ${Object.entries(SORT_OPTIONS).map(([value, label]) =>
            `<option value="${value}" ${adminPaymentsState.sort === value ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
      </div>

      ${renderSummary(owners, pagination)}

      <div class="admin-payments-list">
        ${owners.length
          ? owners.map(renderOwnerCard).join('')
          : `<div class="card"><div class="card-body" style="text-align:center;padding:2rem 1rem">
              <p class="text-muted text-sm">No hay propietarios para los filtros seleccionados.</p>
             </div></div>`}
      </div>

      ${renderPagination(pagination)}
    </div>
  `;

  const search = document.getElementById('admin-payments-search');
  if (search && document.activeElement?.id === 'admin-payments-search') {
    search.focus();
    search.setSelectionRange(search.value.length, search.value.length);
  }
}

export async function renderAdminPayments(force = false) {
  const el = document.getElementById('page-admin-payments');
  if (!el) return;
  if (!adminPaymentsState.last || force) {
    el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  }

  const params = buildParams();
  const key = `admin-payments:${stableParams(params)}`;
  try {
    const res = await getCachedOrFetch(
      key,
      CACHE_TTL.PAYMENTS_SHORT,
      () => api.payments.getAdminOwners(params),
      { skipCache: force }
    );
    renderAdminPaymentsView(res);
  } catch (err) {
    el.innerHTML = `<div style="text-align:center;padding:2rem;color:var(--danger)">
      <p class="bold">${escapeHtml(err.message)}</p>
      <button class="btn btn-ghost btn-sm mt-2" onclick="renderAdminPayments(true)">Reintentar</button>
    </div>`;
  }
}

export function adminPaymentsGoPage(page) {
  adminPaymentsState.page = Math.max(1, page);
  renderAdminPayments(true);
  document.getElementById('page-admin-payments')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

export async function adminPaymentsApprove(paymentId) {
  try {
    await api.payments.approve(paymentId);
    window.gestionarInvalidateCaches?.('payments');
    toast('Pago aprobado', 'success');
    renderAdminPayments(true);
  } catch (err) {
    toast(err.message || 'No se pudo aprobar el pago.', 'error');
  }
}

export function adminPaymentsOpenReject(paymentId, ownerName = '') {
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.5rem">Rechazar comprobante</h2>
    <p class="text-sm text-muted" style="margin-bottom:1rem">${ownerName ? `Para: ${ownerName}` : 'Indica el motivo para notificar al propietario.'}</p>
    <div class="form-group">
      <label>Motivo</label>
      <textarea class="input" id="admin-payment-reject-note" rows="4" maxlength="500" placeholder="Ej: Importe incorrecto o imagen ilegible"></textarea>
    </div>
    <div class="flex gap-1 mt-2">
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger w-full" data-requires-network onclick="adminPaymentsConfirmReject('${paymentId}')">Rechazar</button>
    </div>
  `;
  openModal();
}

export async function adminPaymentsConfirmReject(paymentId) {
  const note = document.getElementById('admin-payment-reject-note')?.value.trim();
  if (!note) return toast('Indica el motivo del rechazo.', 'error');
  try {
    await api.payments.reject(paymentId, note);
    closeModal();
    window.gestionarInvalidateCaches?.('payments');
    toast('Comprobante rechazado', 'success');
    renderAdminPayments(true);
  } catch (err) {
    toast(err.message || 'No se pudo rechazar el comprobante.', 'error');
  }
}

window.renderAdminPayments = renderAdminPayments;
window.adminPaymentsState = adminPaymentsState;
window.debouncedAdminPaymentsSearch = debouncedAdminPaymentsSearch;
window.adminPaymentsGoPage = adminPaymentsGoPage;
window.adminPaymentsApprove = adminPaymentsApprove;
window.adminPaymentsOpenReject = adminPaymentsOpenReject;
window.adminPaymentsConfirmReject = adminPaymentsConfirmReject;
window.viewOwnerDetail = viewOwnerDetail;
window.openRegisterPaymentModal = openRegisterPaymentModal;
window.downloadReceipt = downloadReceipt;
