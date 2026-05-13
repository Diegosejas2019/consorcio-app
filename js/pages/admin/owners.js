import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { showLoading, setBtnLoading } from '../../ui/loading.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG, svgIcon } from '../../ui/icons.js';
import { formatMonth, statusBadge, errorState, downloadReceipt, downloadSystemReceipt, debounce, formatPhone, buildWhatsAppLink, escapeHtml } from '../../ui/helpers.js';
import { cache } from '../../core/state.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';

// ── Estado de la vista ────────────────────────────────────────
export const ownersListState = { all: [], page: 1, perPage: 10, filterName: '', filterUnit: '' };
export const _debouncedOwnerFilter = debounce(() => { ownersListState.page = 1; _renderOwnersView(); }, 350);

let _newOwnerCfg    = null;
let _ownerDetailCfg = null;
let _newOwnerUnits  = [];
let _newOwnerAvailableUnits = [];
let _newOwnerSelectedUnitIds = new Set();
let _newOwnerUnitFilter = '';
let _lastCheckedEmail = '';
let _emailCheckResult = null;
let _registerPaymentOwners = [];
let _registerPaymentSelectedOwnerId = '';
let _registerPaymentFile = null;
let _registerPaymentOwnerFee = 0;
let _registerPaymentBalanceAmount = 0;

let _editAddUnitOwnerId = '';
let _editAddUnitAvailable = [];
let _editAddUnitSelectedIds = new Set();
let _editAddUnitFilter = '';
let _editCurrentUnitIds = new Set();

const PAYMENT_FILE_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);

function _ownerUnitNames(owner) {
  if (!owner?.units?.length) return owner?.unit ? [owner.unit] : [];
  return owner.units.map(u => typeof u === 'string' ? u : u?.name).filter(Boolean);
}

function _ownerUnitDisplay(owner) {
  return _ownerUnitNames(owner).join(', ');
}

function _paymentPeriodLabel(payment) {
  if (payment.month) return formatMonth(payment.month);
  if (payment.type === 'balance') return 'Saldo anterior';
  if (payment.type === 'extraordinary') return 'Extraordinario';
  if (payment.type === 'installment') return 'Cuota plan de pagos';
  return 'Pago manual';
}

export async function renderOwnersList() {
  const el = document.getElementById('page-admin-owners');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const res = await getCachedOrFetch(
      'owners:list:limit=500',
      CACHE_TTL.OWNERS,
      () => api.owners.getAll({ limit: 500 })
    );
    ownersListState.all  = (res.data.owners || []).sort((a, b) =>
      _ownerUnitDisplay(a).localeCompare(_ownerUnitDisplay(b), undefined, { numeric: true, sensitivity: 'base' })
    );
    ownersListState.page = 1;
    _renderOwnersView();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnersList()');
  }
}

function _applyOwnersFilter() {
  const q    = ownersListState.filterName.toLowerCase().trim();
  const unit = ownersListState.filterUnit.toLowerCase().trim();
  return ownersListState.all.filter(o => {
    const matchName = !q    || o.name.toLowerCase().includes(q);
    const unitStr   = _ownerUnitDisplay(o);
    const matchUnit = !unit || unitStr.toLowerCase().includes(unit);
    return matchName && matchUnit;
  });
}

export function _renderOwnersView() {
  const el       = document.getElementById('page-admin-owners');
  const focused  = document.activeElement?.id;
  const filtered = _applyOwnersFilter();
  const total    = filtered.length;
  const pages    = Math.max(1, Math.ceil(total / ownersListState.perPage));
  if (ownersListState.page > pages) ownersListState.page = pages;
  const start    = (ownersListState.page - 1) * ownersListState.perPage;
  const slice    = filtered.slice(start, start + ownersListState.perPage);
  const hasFilter = ownersListState.filterName || ownersListState.filterUnit;

  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between">
        <h1>Propietarios</h1>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-sm" onclick="downloadOwnersExcel()">Exportar Excel</button>
          <button class="btn btn-ghost btn-sm" onclick="openBulkOwnerModal()">Carga masiva</button>
          <button class="btn btn-primary btn-sm" onclick="openNewOwnerModal()">+ Agregar</button>
        </div>
      </div>

      <div class="owners-filter-bar">
        <input id="owners-filter-name" class="input" type="search" placeholder="🔍 Buscar por nombre…"
          value="${ownersListState.filterName}"
          oninput="ownersListState.filterName=this.value;_debouncedOwnerFilter()">
        <input id="owners-filter-unit" class="input" type="search" placeholder="🏠 Lote / Unidad…"
          value="${ownersListState.filterUnit}"
          oninput="ownersListState.filterUnit=this.value;_debouncedOwnerFilter()">
        ${hasFilter ? `<button class="btn-clear-filter" onclick="ownersListState.filterName='';ownersListState.filterUnit='';ownersListState.page=1;_renderOwnersView()">✕ Limpiar</button>` : ''}
      </div>

      <div class="owners-meta">
        <span>${total === ownersListState.all.length
          ? `${total} propietario${total !== 1 ? 's' : ''}`
          : `${total} resultado${total !== 1 ? 's' : ''} de ${ownersListState.all.length}`}
        </span>
        <span>Página ${ownersListState.page} de ${pages}</span>
      </div>

      <div class="card">
        <div class="card-body flex col" style="gap:0">
          ${slice.length === 0
            ? `<div style="text-align:center;padding:2rem 1rem">
                <div style="font-size:2rem;margin-bottom:.5rem">🔍</div>
                <p class="text-muted text-sm">No se encontraron propietarios con ese criterio.</p>
                <button class="btn btn-ghost btn-sm" style="margin-top:.75rem"
                  onclick="ownersListState.filterName='';ownersListState.filterUnit='';_renderOwnersView()">
                  Limpiar filtros
                </button>
               </div>`
            : slice.map(o => `
              <div class="owner-row">
                <div class="owner-avatar">${o.name.split(' ').slice(0, 2).map(w => w[0]).join('')}</div>
                <div class="owner-info">
                  <p class="name">${_highlightMatch(o.name, ownersListState.filterName)}</p>
                  <p class="unit">${_highlightMatch(_ownerUnitDisplay(o) || '—', ownersListState.filterUnit)}${o.phone ? ` · ${escapeHtml(o.phone)}` : ''}</p>
                </div>
                <div class="flex col" style="align-items:flex-end;gap:.25rem">
                  <span class="badge ${(o.totalOwed||0)>0 && !o.hasActivePlan ? 'badge-danger' : ((o.totalOwed||0)>0 && o.hasActivePlan ? 'badge-warning' : 'badge-success')}">${(o.totalOwed||0)>0 && !o.hasActivePlan ? 'Deuda' : ((o.totalOwed||0)>0 && o.hasActivePlan ? 'Plan' : 'Al día')}</span>
                  ${o.lastPayment ? `<small>${formatMonth(o.lastPayment.month)}</small>` : '<small class="text-muted">Sin pagos</small>'}
                </div>
                ${o.phone ? `<button class="btn btn-ghost btn-sm" style="color:#25D366" onclick="openWhatsAppOwnerModal('${o.name.replace(/'/g, "\\'")}','${o.phone}')" title="Enviar WhatsApp">💬</button>` : ''}
                <button class="btn btn-ghost btn-sm" onclick="viewOwnerDetail('${o._id}')">Ver</button>
              </div>`).join('')}
        </div>
      </div>

      ${pages > 1 ? `<div class="pagination">${_buildPagination(ownersListState.page, pages)}</div>` : ''}
    </div>`;

  if (focused === 'owners-filter-name' || focused === 'owners-filter-unit') {
    const input = document.getElementById(focused);
    if (input) { input.focus(); const len = input.value.length; input.setSelectionRange(len, len); }
  }
}

function _highlightMatch(text, query) {
  const safeText = escapeHtml(text);
  if (!query || !text) return safeText;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return safeText.replace(new RegExp(`(${escaped})`, 'gi'),
    '<mark style="background:var(--accent-lt);color:var(--accent);border-radius:3px;padding:0 2px">$1</mark>');
}

function _buildPagination(current, total) {
  const btns = [];
  btns.push(`<button class="pg-btn" onclick="ownersGoPage(${current - 1})" ${current === 1 ? 'disabled' : ''}>&lsaquo;</button>`);
  const range = _pageRange(current, total);
  let last = 0;
  for (const p of range) {
    if (p - last > 1) btns.push(`<span class="pg-ellipsis">…</span>`);
    btns.push(`<button class="pg-btn ${p === current ? 'active' : ''}" onclick="ownersGoPage(${p})">${p}</button>`);
    last = p;
  }
  btns.push(`<button class="pg-btn" onclick="ownersGoPage(${current + 1})" ${current === total ? 'disabled' : ''}>&rsaquo;</button>`);
  return btns.join('');
}

function _pageRange(current, total) {
  const delta = 1;
  const range = new Set([1, total]);
  for (let i = Math.max(2, current - delta); i <= Math.min(total - 1, current + delta); i++) range.add(i);
  return [...range].sort((a, b) => a - b);
}

export function ownersGoPage(p) {
  ownersListState.page = p;
  _renderOwnersView();
  document.getElementById('page-admin-owners').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// ── Detalle de propietario ────────────────────────────────────
export async function viewOwnerDetail(ownerId) {
  openModal();
  document.getElementById('modal').innerHTML = `<div class="modal-handle"></div>${skeleton(4)}`;
  try {
    const [ownerRes, unitsRes, debtItemsRes] = await Promise.all([
      getCachedOrFetch(`owners:detail:${ownerId}`, CACHE_TTL.OWNERS, () => api.owners.getOne(ownerId)),
      getCachedOrFetch(`units:owner:${ownerId}`, CACHE_TTL.UNITS, () => api.units.getAll({ ownerId })),
      api.debtItems.getByOwner(ownerId).catch(() => ({ data: { debtItems: [] } })),
    ]);
    const owner     = ownerRes.data.owner;
    const payments  = ownerRes.data.payments || [];
    const units     = unitsRes.data.units || [];
    const debtItems = debtItemsRes.data?.debtItems || [];

    const unitsHtml = _renderUnitsSection(ownerId, units);

    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      <div class="flex between" style="margin-bottom:1.25rem">
        <div>
          <h2>${owner.name}</h2>
          <small>${[owner.phone, owner.email].filter(Boolean).join(' · ')}</small>
        </div>
        <span class="badge ${(owner.totalOwed || 0) > 0 ? 'badge-danger' : 'badge-success'}">${(owner.totalOwed || 0) > 0 ? 'Deudor' : 'Al día'}</span>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:.75rem;margin-bottom:.5rem" class="flex between">
        <span class="text-sm text-muted">Saldo</span>
        <span class="bold" style="color:${(owner.totalOwed || 0) > 0 ? 'var(--danger)' : 'var(--success)'}">
          ${(owner.totalOwed || 0) > 0 ? '-' : ''}$${(owner.totalOwed || 0).toLocaleString('es-AR')}
        </span>
      </div>
      ${owner.startBillingPeriod ? `
      <div style="background:var(--bg);border-radius:8px;padding:.75rem;margin-bottom:1rem" class="flex between">
        <span class="text-sm text-muted">Inicio de cobro</span>
        <span class="bold">${formatMonth(owner.startBillingPeriod)}</span>
      </div>` : ''}

      ${unitsHtml}

      <h3 style="margin-bottom:.75rem">Historial de Pagos</h3>
      ${payments.length === 0
        ? '<p class="text-muted text-sm">Sin pagos registrados.</p>'
        : `<div class="table-wrap"><table>
            <thead><tr><th>Período</th><th>Importe</th><th>Estado</th><th></th></tr></thead>
            <tbody>${payments.map(p => `
              <tr>
                <td>${_paymentPeriodLabel(p)}</td>
                <td>$${p.amount.toLocaleString('es-AR')}</td>
                <td>${statusBadge(p.status)}</td>
                <td>
                  ${p.status === 'approved' ? `<button class="btn btn-ghost btn-sm" onclick="downloadSystemReceipt('${p._id}')" title="Descargar recibo" style="padding:.3rem .5rem">${svgIcon('doc', 14)}</button>` : ''}
                  ${p.receipt?.url ? `<button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" title="Descargar comprobante" style="padding:.3rem .5rem">${SVG.download}</button>` : ''}
                </td>
              </tr>`).join('')}
            </tbody>
          </table></div>`}

      ${_renderDebtItemsSection(ownerId, debtItems)}

      <div class="flex gap-1 mt-3" style="flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
        <button class="btn btn-ghost" onclick="openEditOwnerModal('${owner._id}', '${owner.name.replace(/'/g, "\\'")}', '${owner.phone || ''}', '${owner.startBillingPeriod || ''}', ${owner.balance || 0})">Editar</button>
        <button class="btn btn-ghost" onclick="openNotifyOwnerModal('${owner._id}', '${owner.name.replace(/'/g, "\\'")}')">Notificar</button>
        ${owner.phone ? `<button class="btn btn-ghost" style="color:#25D366" onclick="openWhatsAppOwnerModal('${owner.name.replace(/'/g, "\\'")}','${owner.phone}')">💬 WhatsApp</button>` : ''}
        <button class="btn btn-primary" onclick="openRegisterPaymentModal('${owner._id}', '${owner.name.replace(/'/g, "\\'")}')">Registrar pago</button>
        <button class="btn btn-ghost" onclick="toggleDebt('${owner._id}', ${owner.isDebtor})">
          ${owner.isDebtor ? 'Al día' : 'Moroso'}
        </button>
        <button class="btn btn-danger" onclick="confirmDeleteOwner('${owner._id}', '${owner.name.replace(/'/g, "\\'")}')">Eliminar</button>
      </div>`;
  } catch (err) {
    document.getElementById('modal').innerHTML = `<div class="modal-handle"></div><p style="color:var(--danger)">${err.message}</p>`;
  }
}

// ── Sección de deudas adicionales ──────────────────────────────
function _debtItemTypeLabel(type) {
  return type === 'previous_balance' ? 'Saldo anterior' : 'Ajuste manual';
}

function _debtItemStatusBadge(status) {
  const map = {
    pending:               '<span class="badge badge-warning">Pendiente</span>',
    cancelled:             '<span class="badge badge-danger">Anulado</span>',
    paid:                  '<span class="badge badge-success">Pagado</span>',
    includedInPaymentPlan: '<span class="badge badge-neutral">En plan de pagos</span>',
  };
  return map[status] || `<span class="badge">${status}</span>`;
}

function _renderDebtItemsSection(ownerId, debtItems) {
  const rows = debtItems.map(d => `
    <tr>
      <td>${_debtItemTypeLabel(d.type)}</td>
      <td>${escapeHtml(d.description)}</td>
      <td>$${Number(d.amount).toLocaleString('es-AR')} ${d.currency}</td>
      <td>${d.originDate ? new Date(d.originDate).toLocaleDateString('es-AR') : '—'}</td>
      <td>${d.dueDate ? new Date(d.dueDate).toLocaleDateString('es-AR') : '—'}</td>
      <td>${_debtItemStatusBadge(d.status)}</td>
      <td>
        ${d.status === 'pending'
          ? `<button class="btn btn-ghost btn-sm" style="color:var(--danger)" onclick="promptCancelDebtItem('${d._id}', '${ownerId}')">Anular</button>`
          : ''}
      </td>
    </tr>`).join('');

  return `
    <div style="margin-top:1.5rem;margin-bottom:.5rem">
      <div class="flex between" style="align-items:center;margin-bottom:.75rem">
        <h3>Saldos anteriores y ajustes</h3>
        <button class="btn btn-ghost btn-sm" onclick="openDebtItemModal('${ownerId}')">+ Agregar</button>
      </div>
      ${debtItems.length === 0
        ? '<p class="text-muted text-sm">Sin deudas adicionales registradas.</p>'
        : `<div class="table-wrap"><table>
            <thead><tr><th>Tipo</th><th>Descripción</th><th>Importe</th><th>Fecha origen</th><th>Vencimiento</th><th>Estado</th><th></th></tr></thead>
            <tbody>${rows}</tbody>
          </table></div>`}
    </div>`;
}

// ── Modal crear deuda adicional ────────────────────────────────
export function openDebtItemModal(ownerId) {
  const html = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1.25rem">Agregar saldo / ajuste</h2>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Tipo</label>
        <select class="select" id="di-type">
          <option value="previous_balance">Saldo anterior</option>
          <option value="manual_adjustment">Ajuste manual</option>
        </select>
      </div>
      <div class="form-group">
        <label>Descripción *</label>
        <input class="input" type="text" id="di-description" placeholder="Ej: Saldo migrado desde administración anterior">
      </div>
      <div class="flex gap-1">
        <div class="form-group" style="flex:1">
          <label>Importe *</label>
          <input class="input" type="number" id="di-amount" min="0.01" step="0.01" placeholder="0">
        </div>
        <div class="form-group" style="flex:1">
          <label>Moneda *</label>
          <select class="select" id="di-currency">
            <option value="ARS">ARS</option>
            <option value="USD">USD</option>
          </select>
        </div>
      </div>
      <div class="flex gap-1">
        <div class="form-group" style="flex:1">
          <label>Fecha de origen</label>
          <input class="input" type="date" id="di-origin-date">
        </div>
        <div class="form-group" style="flex:1">
          <label>Fecha de vencimiento</label>
          <input class="input" type="date" id="di-due-date">
        </div>
      </div>
    </div>
    <div class="flex gap-1 mt-3">
      <button class="btn btn-secondary" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-debt-item" onclick="submitDebtItem('${ownerId}')">Guardar</button>
    </div>`;
  document.getElementById('modal').innerHTML = html;
}

export async function submitDebtItem(ownerId) {
  const type        = document.getElementById('di-type')?.value;
  const description = document.getElementById('di-description')?.value?.trim();
  const amount      = parseFloat(document.getElementById('di-amount')?.value);
  const currency    = document.getElementById('di-currency')?.value;
  const originDate  = document.getElementById('di-origin-date')?.value;
  const dueDate     = document.getElementById('di-due-date')?.value;

  if (!description) return toast('La descripción es obligatoria.', 'error');
  if (!amount || amount <= 0) return toast('El importe debe ser mayor a cero.', 'error');
  if (!currency) return toast('Seleccioná una moneda.', 'error');

  const btn = document.getElementById('btn-save-debt-item');
  setBtnLoading(btn, true);
  try {
    await api.debtItems.create(ownerId, {
      type, description, amount, currency,
      originDate: originDate || undefined,
      dueDate:    dueDate    || undefined,
    });
    toast('Deuda adicional registrada correctamente.', 'success');
    cache.del(`owners:detail:${ownerId}`);
    viewOwnerDetail(ownerId);
  } catch (err) {
    toast(err.message, 'error');
    setBtnLoading(btn, false);
  }
}

export async function promptCancelDebtItem(debtItemId, ownerId) {
  const reason = window.prompt('Motivo de anulación (obligatorio):');
  if (reason === null) return;
  if (!reason.trim()) return toast('El motivo de anulación es obligatorio.', 'error');
  try {
    await api.debtItems.cancel(debtItemId, reason.trim());
    toast('Deuda anulada correctamente.', 'success');
    cache.del(`owners:detail:${ownerId}`);
    viewOwnerDetail(ownerId);
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Sección de unidades dentro del modal de detalle ───────────
function _renderUnitsSection(ownerId, units) {
  _editCurrentUnitIds = new Set(units.map(u => u._id));
  const totalFee = units.reduce((sum, u) => sum + (u.finalFee || 0), 0);
  const unitRows = units.map(u => `
    <div class="flex between" style="padding:.5rem 0;border-bottom:1px solid var(--border)">
      <span class="text-sm">${escapeHtml(u.name)}</span>
      <div class="flex gap-1" style="align-items:center">
        <span class="text-sm bold">$${(u.finalFee || 0).toLocaleString('es-AR')}</span>
        <button class="btn btn-ghost btn-sm" style="padding:.2rem .45rem;color:var(--danger)"
          onclick="deleteUnit('${u._id}', '${ownerId}')" title="Eliminar unidad">×</button>
      </div>
    </div>`).join('');

  return `
    <div style="margin-bottom:1rem">
      <div class="flex between" style="margin-bottom:.5rem;align-items:center">
        <h3>Unidades</h3>
        <button class="btn btn-ghost btn-sm" onclick="openAddUnitForm('${ownerId}')">+ Agregar</button>
      </div>
      <div id="units-section-${ownerId}">
        ${units.length === 0
          ? '<p class="text-muted text-sm">Sin unidades asignadas.</p>'
          : `${unitRows}
             <div class="flex between" style="padding:.5rem 0;font-size:.82rem;color:var(--text-muted)">
               <span>Total mensual</span>
               <span class="bold" style="color:var(--text)">$${totalFee.toLocaleString('es-AR')}</span>
             </div>`}
      </div>
      <div id="add-unit-form-${ownerId}" style="display:none;margin-top:.75rem">
        <div id="add-unit-selector-${ownerId}"></div>
        <div class="flex gap-1" style="margin-top:.6rem">
          <button class="btn btn-secondary btn-sm" onclick="cancelAddUnit('${ownerId}')">Cancelar</button>
          <button class="btn btn-primary btn-sm" onclick="submitAddUnit('${ownerId}')">Guardar</button>
        </div>
      </div>
    </div>`;
}

export async function openAddUnitForm(ownerId) {
  _editAddUnitOwnerId = ownerId;
  _editAddUnitSelectedIds = new Set();
  _editAddUnitFilter = '';
  const form = document.getElementById(`add-unit-form-${ownerId}`);
  if (!form) return;
  form.style.display = '';
  const selector = document.getElementById(`add-unit-selector-${ownerId}`);
  if (selector) selector.innerHTML = '<p class="text-muted text-sm">Cargando unidades…</p>';
  try {
    const res = await api.units.getAll();
    const allUnits = res.data.units || [];
    _editAddUnitAvailable = allUnits
      .filter(u => !u.owner && u.status !== 'occupied' && !_editCurrentUnitIds.has(u._id))
      .sort((a, b) => String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' }));
  } catch {
    _editAddUnitAvailable = [];
  }
  _renderEditAddUnitSelect(ownerId);
}

function _renderEditAddUnitSelect(ownerId) {
  const selector = document.getElementById(`add-unit-selector-${ownerId}`);
  if (!selector) return;
  const filter = _editAddUnitFilter.trim().toLowerCase();
  const visible = filter
    ? _editAddUnitAvailable.filter(u => String(u.name || '').toLowerCase().includes(filter))
    : _editAddUnitAvailable;
  const selected = _editAddUnitAvailable.filter(u => _editAddUnitSelectedIds.has(u._id));

  selector.innerHTML = `
    <div style="border:1px solid var(--border);border-radius:10px;padding:.65rem;background:var(--surface,#111b16)">
      <input class="input" type="search" placeholder="Buscar unidad..."
        value="${escapeHtml(_editAddUnitFilter)}"
        oninput="filterEditOwnerUnits(this.value)"
        style="height:40px;margin-bottom:.55rem">
      <div style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:${selected.length ? '.55rem' : '0'}">
        ${selected.map(u => `<button type="button" class="chip is-active" onclick="toggleEditOwnerUnit('${u._id}')" style="min-height:32px">${escapeHtml(u.name)} &times;</button>`).join('')}
      </div>
      <div style="display:grid;gap:.4rem;max-height:200px;overflow:auto;padding-right:.15rem">
        ${visible.length
          ? visible.map(u => {
              const sel = _editAddUnitSelectedIds.has(u._id);
              return `<button type="button" onclick="toggleEditOwnerUnit('${u._id}')"
                style="display:flex;align-items:center;gap:.65rem;width:100%;min-height:44px;text-align:left;padding:.6rem .7rem;border:1px solid ${sel ? 'var(--primary)' : 'var(--border)'};border-radius:8px;background:${sel ? 'var(--accent-lt,rgba(156,242,123,.12))' : 'var(--bg)'};color:var(--text)">
                <input type="checkbox" ${sel ? 'checked' : ''} tabindex="-1" style="width:18px;height:18px;accent-color:var(--primary);pointer-events:none;flex-shrink:0">
                <span style="font-weight:${sel ? '700' : '500'}">${escapeHtml(u.name)}</span>
              </button>`;
            }).join('')
          : `<div style="padding:.75rem;text-align:center;color:var(--text-muted);font-size:.85rem">
              ${_editAddUnitAvailable.length ? 'No hay unidades con ese filtro.' : 'No hay unidades disponibles.'}
            </div>`}
      </div>
    </div>
    <small class="text-muted" style="display:block;margin-top:.4rem">${_editAddUnitAvailable.length} disponible${_editAddUnitAvailable.length !== 1 ? 's' : ''}.</small>`;
}

export function toggleEditOwnerUnit(unitId) {
  if (_editAddUnitSelectedIds.has(unitId)) _editAddUnitSelectedIds.delete(unitId);
  else _editAddUnitSelectedIds.add(unitId);
  _renderEditAddUnitSelect(_editAddUnitOwnerId);
}

export function filterEditOwnerUnits(value) {
  _editAddUnitFilter = value;
  _renderEditAddUnitSelect(_editAddUnitOwnerId);
}

export function cancelAddUnit(ownerId) {
  const form = document.getElementById(`add-unit-form-${ownerId}`);
  if (form) form.style.display = 'none';
  _editAddUnitSelectedIds = new Set();
}

export async function submitAddUnit(ownerId) {
  const newIds = [..._editAddUnitSelectedIds];
  if (!newIds.length) { toast('Seleccioná al menos una unidad', 'error'); return; }
  const unitIds = [..._editCurrentUnitIds, ...newIds];
  try {
    await api.owners.update(ownerId, { unitIds });
    toast('Unidad/s agregada/s', 'success');
    cache.del('units:available');
    cache.del(`units:owner:${ownerId}`);
    cache.del(`owners:detail:${ownerId}`);
    viewOwnerDetail(ownerId);
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function deleteUnit(unitId, ownerId) {
  try {
    await api.units.delete(unitId);
    toast('Unidad eliminada', 'success');
    cache.del(`units:owner:${ownerId}`);
    cache.del(`owners:detail:${ownerId}`);
    viewOwnerDetail(ownerId);
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function toggleDebt(ownerId, currentDebt) {
  try {
    await api.owners.update(ownerId, { isDebtor: !currentDebt, balance: !currentDebt ? -15000 : 0 });
    closeModal();
    toast('Propietario actualizado', 'success');
    renderOwnersList();
  } catch (err) {
    toast(err.message, 'error');
  }
}

export function confirmDeleteOwner(ownerId, ownerName) {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.5rem">Eliminar propietario</h2>
    <p class="text-sm" style="margin-bottom:1.25rem">¿Estás seguro de que querés eliminar a <strong>${ownerName}</strong>? Esta acción desactivará su cuenta y no podrá iniciar sesión.</p>
    <div class="flex gap-1">
      <button class="btn btn-secondary w-full" onclick="viewOwnerDetail('${ownerId}')">Cancelar</button>
      <button class="btn btn-danger w-full" onclick="deleteOwner('${ownerId}')">Eliminar</button>
    </div>`;
  openModal();
}

export async function deleteOwner(ownerId) {
  try {
    await api.owners.delete(ownerId);
    closeModal();
    toast('Propietario eliminado', 'success');
    renderOwnersList();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Notificar propietario ─────────────────────────────────────
export function openNotifyOwnerModal(id, name) {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.25rem">Enviar notificación</h2>
    <p class="text-sm text-muted" style="margin-bottom:1rem">Para: ${name}</p>
    <div class="flex col gap-2">
      <div class="form-group"><label>Título</label><input class="input" id="notif-title" placeholder="Ej: Aviso importante"></div>
      <div class="form-group"><label>Mensaje</label><textarea class="input" id="notif-body" style="min-height:90px" placeholder="Escribí el mensaje..."></textarea></div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="viewOwnerDetail('${id}')">Cancelar</button>
        <button class="btn btn-primary w-full" onclick="sendOwnerNotification('${id}')">Enviar</button>
      </div>
    </div>`;
  openModal();
}

export async function sendOwnerNotification(id) {
  const title = document.getElementById('notif-title')?.value.trim();
  const body  = document.getElementById('notif-body')?.value.trim();
  if (!title || !body) { toast('Completá título y mensaje', 'error'); return; }
  try {
    showLoading(true);
    await api.owners.notify(id, title, body);
    closeModal();
    toast('Notificación enviada', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Editar propietario ────────────────────────────────────────
export function openEditOwnerModal(id, name, phone, startBillingPeriod = '', balance = 0) {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Editar Propietario</h2>
    <div class="flex col gap-2">
      <div class="form-group"><label>Nombre completo</label><input class="input" id="eo-name" value="${name}"></div>
      <div class="form-group"><label>Teléfono</label><input class="input" type="tel" id="eo-phone" value="${phone}" placeholder="1122334455"></div>
      <div class="form-group">
        <label>Inicio de cobro (YYYY-MM)</label>
        <input class="input" id="eo-start-billing" value="${startBillingPeriod}" placeholder="Ej: 2026-04">
        <small class="text-muted" style="display:block;margin-top:.25rem">Período desde el que el propietario puede registrar pagos.</small>
      </div>
      <div class="form-group">
        <label>Saldo anterior / deuda inicial ($)</label>
        <input class="input" type="number" id="eo-balance" value="${Math.abs(balance)}" min="0" placeholder="0">
        <small class="text-muted" style="display:block;margin-top:.25rem">
          ${balance < 0 ? `Deuda actual: $${Math.abs(balance).toLocaleString('es-AR')}. ` : ''}Ingresá el monto de deuda pendiente (0 = sin deuda).
        </small>
      </div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="viewOwnerDetail('${id}')">Cancelar</button>
        <button class="btn btn-primary w-full" data-requires-network onclick="saveEditOwner('${id}')">Guardar</button>
      </div>
    </div>`;
  openModal();
}

export async function saveEditOwner(id) {
  const name               = document.getElementById('eo-name')?.value.trim();
  const phone              = document.getElementById('eo-phone')?.value.trim();
  const startBillingPeriod = document.getElementById('eo-start-billing')?.value.trim();
  const debtInput          = Number(document.getElementById('eo-balance')?.value || 0);
  if (!name) { toast('El nombre es obligatorio', 'error'); return; }
  if (startBillingPeriod && !/^\d{4}-\d{2}$/.test(startBillingPeriod)) {
    toast('El inicio de cobro debe tener formato YYYY-MM (ej: 2026-04)', 'error');
    return;
  }
  const update = { name, phone, balance: debtInput > 0 ? -debtInput : 0, isDebtor: debtInput > 0 };
  if (startBillingPeriod) update.startBillingPeriod = startBillingPeriod;
  try {
    await api.owners.update(id, update);
    toast('Propietario actualizado', 'success');
    viewOwnerDetail(id);
    renderOwnersList();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Unidades en formulario nuevo propietario ─────────────────
function _renderNewOwnerUnits() {
  const container = document.getElementById('no-units-container');
  if (!container) return;
  container.innerHTML = `
    ${_newOwnerUnits.map((u, i) => `
      <div class="flex between" style="padding:.4rem .5rem;background:var(--bg);border-radius:6px;margin-bottom:.3rem">
        <span class="text-sm">${escapeHtml(u.name)}</span>
        <button class="btn btn-ghost btn-sm" style="padding:.15rem .4rem;color:var(--danger)" onclick="removeNewOwnerUnit(${i})">×</button>
      </div>`).join('')}
    <div class="flex gap-1" style="margin-top:${_newOwnerUnits.length ? '.4rem' : '0'}">
      <input class="input" id="no-unit-input" placeholder="Ej: Lote 12" style="flex:1"
        onkeydown="if(event.key==='Enter'){event.preventDefault();addNewOwnerUnit()}">
      <button class="btn btn-ghost btn-sm" onclick="addNewOwnerUnit()">+ Agregar</button>
    </div>`;
}

export function addNewOwnerUnit() {
  const input = document.getElementById('no-unit-input');
  const name = input?.value.trim();
  if (!name) return;
  _newOwnerUnits.push({ name });
  _renderNewOwnerUnits();
}

export function removeNewOwnerUnit(index) {
  _newOwnerUnits.splice(index, 1);
  _renderNewOwnerUnits();
}

function _renderNewOwnerUnitSelect() {
  const container = document.getElementById('no-units-container');
  if (!container) return;
  const orderedUnits = [..._newOwnerAvailableUnits].sort((a, b) =>
    String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
  );
  const availableUnits = orderedUnits.filter(u => !u.owner && u.status !== 'occupied');
  const occupiedCount = orderedUnits.length - availableUnits.length;
  const filter = _newOwnerUnitFilter.trim().toLowerCase();
  const visibleUnits = filter
    ? availableUnits.filter(unit => String(unit.name || '').toLowerCase().includes(filter))
    : availableUnits;
  const selectedUnits = orderedUnits.filter(unit => _newOwnerSelectedUnitIds.has(unit._id));

  container.innerHTML = `
    <div style="border:1px solid var(--border);border-radius:10px;padding:.65rem;background:var(--surface,#111b16)">
      <input class="input" id="no-unit-search" type="search" placeholder="Buscar unidad..."
        value="${escapeHtml(_newOwnerUnitFilter)}"
        oninput="filterNewOwnerUnits(this.value)"
        style="height:40px;margin-bottom:.55rem">

      <div id="no-unit-selected" style="display:flex;gap:.4rem;flex-wrap:wrap;margin-bottom:${selectedUnits.length ? '.55rem' : '0'}">
        ${selectedUnits.map(unit => `
          <button type="button" class="chip is-active" onclick="toggleNewOwnerUnit('${unit._id}')" style="min-height:32px">
            ${escapeHtml(unit.name)} &times;
          </button>`).join('')}
      </div>

      <div style="display:grid;gap:.4rem;max-height:220px;overflow:auto;padding-right:.15rem">
        ${visibleUnits.length
          ? visibleUnits.map(unit => {
              const selected = _newOwnerSelectedUnitIds.has(unit._id);
              return `
                <button type="button" onclick="toggleNewOwnerUnit('${unit._id}')"
                  style="display:flex;align-items:center;gap:.65rem;width:100%;min-height:44px;text-align:left;padding:.6rem .7rem;border:1px solid ${selected ? 'var(--primary)' : 'var(--border)'};border-radius:8px;background:${selected ? 'var(--accent-lt,rgba(156,242,123,.12))' : 'var(--bg)'};color:var(--text)">
                  <input type="checkbox" ${selected ? 'checked' : ''} tabindex="-1"
                    style="width:18px;height:18px;accent-color:var(--primary);pointer-events:none;flex-shrink:0">
                  <span style="font-weight:${selected ? '700' : '500'}">${escapeHtml(unit.name)}</span>
                </button>`;
            }).join('')
          : `<div style="padding:.75rem;text-align:center;color:var(--text-muted);font-size:.85rem">
              ${availableUnits.length ? 'No hay unidades disponibles con ese filtro.' : 'No hay unidades disponibles.'}
            </div>`}
      </div>
    </div>
    <small class="text-muted" style="display:block;margin-top:.4rem">
      ${orderedUnits.length === 0
        ? 'No hay unidades cargadas.'
        : `${availableUnits.length} disponible${availableUnits.length !== 1 ? 's' : ''}${occupiedCount ? ` · ${occupiedCount} ocupada${occupiedCount !== 1 ? 's' : ''}` : ''}.`}
    </small>`;
}

function _selectedNewOwnerUnitIds() {
  return [..._newOwnerSelectedUnitIds];
}

export function toggleNewOwnerUnit(unitId) {
  if (_newOwnerSelectedUnitIds.has(unitId)) _newOwnerSelectedUnitIds.delete(unitId);
  else _newOwnerSelectedUnitIds.add(unitId);
  _renderNewOwnerUnitSelect();
}

export function filterNewOwnerUnits(value) {
  _newOwnerUnitFilter = value || '';
  _renderNewOwnerUnitSelect();
  const input = document.getElementById('no-unit-search');
  if (input) {
    input.focus();
    const len = input.value.length;
    input.setSelectionRange(len, len);
  }
}

// ── Nuevo propietario ─────────────────────────────────────────
export async function openNewOwnerModal() {
  _newOwnerCfg = cache.get('config');
  const loadConfig = _newOwnerCfg
    ? Promise.resolve(_newOwnerCfg)
    : getCachedOrFetch('config:api', CACHE_TTL.CONFIG, () => api.config.get()).then(res => {
        _newOwnerCfg = res.data.config;
        cache.set('config', _newOwnerCfg);
        return _newOwnerCfg;
      }).catch(() => null);
  const loadUnits = getCachedOrFetch('units:available', CACHE_TTL.UNITS, () => api.units.getAll())
    .then(res => res.data.units || [])
    .catch(() => []);
  const [, units] = await Promise.all([loadConfig, loadUnits]);

  _newOwnerUnits    = [];
  _newOwnerAvailableUnits = units;
  _newOwnerSelectedUnitIds = new Set();
  _newOwnerUnitFilter = '';
  _lastCheckedEmail = '';
  _emailCheckResult = null;
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nuevo Propietario</h2>
    <div class="flex col gap-2">
      <div class="form-group"><label>Nombre completo</label><input class="input" id="no-name" placeholder="María García"></div>
      <div class="form-group">
        <label>Email</label>
        <input class="input" type="email" id="no-email" placeholder="propietario@mail.com"
          onblur="checkNewOwnerEmail()">
        <small id="no-email-hint" style="display:none;margin-top:.25rem"></small>
      </div>
      <div class="form-group" id="no-pass-group">
        <label>Contraseña temporal</label>
        <input class="input" id="no-pass" placeholder="Mín. 6 caracteres">
      </div>
      <div class="form-group">
        <label>Unidades</label>
        <div id="no-units-container"></div>
      </div>
      <div class="form-group"><label>Teléfono</label><input class="input" id="no-phone" placeholder="1122334455"></div>
      <div class="form-group">
        <label>Deuda inicial / saldo anterior ($)</label>
        <input class="input" type="number" id="no-initial-debt" value="0" min="0" placeholder="0">
        <small class="text-muted" style="display:block;margin-top:.25rem">Usá este campo si el propietario ingresa con deuda previa.</small>
      </div>
      <div class="form-group">
        <label style="display:flex;align-items:center;gap:.6rem;cursor:pointer;font-weight:500">
          <input type="checkbox" id="no-charge-current" checked style="width:16px;height:16px;flex-shrink:0">
          ¿Cobrar mes en curso?
        </label>
        <small class="text-muted" style="display:block;margin-top:.25rem">
          Si se desactiva, el cobro comenzará el mes siguiente.
        </small>
      </div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cerrar</button>
        <button class="btn btn-primary w-full" id="no-submit-btn" data-requires-network onclick="saveNewOwner()">Crear</button>
      </div>
    </div>`;
  openModal(null, undefined, { closeOnBackdrop: false });
  _renderNewOwnerUnitSelect();
}

export async function checkNewOwnerEmail() {
  const emailInput = document.getElementById('no-email');
  const hint       = document.getElementById('no-email-hint');
  const passGroup  = document.getElementById('no-pass-group');
  const passInput  = document.getElementById('no-pass');
  const submitBtn  = document.getElementById('no-submit-btn');
  const email      = emailInput?.value.trim();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return;
  if (email === _lastCheckedEmail) return;

  hint.style.display = '';
  hint.style.color   = 'var(--text-muted)';
  hint.textContent   = 'Verificando…';

  try {
    const res         = await api.owners.checkEmail(email);
    _lastCheckedEmail = email;
    _emailCheckResult = res;

    hint.textContent = res.message;

    if (!res.canAddToCurrentOrganization) {
      // Ya pertenece a la org — bloquear
      hint.style.color    = 'var(--danger)';
      submitBtn.disabled  = true;
      passGroup.style.display = '';
      passInput.required  = false;
    } else if (res.exists) {
      // Existe en otra org — ocultar contraseña
      hint.style.color        = 'var(--success,#16a34a)';
      passGroup.style.display = 'none';
      passInput.value         = '';
      passInput.required      = false;
      submitBtn.disabled      = false;
    } else {
      // Nuevo usuario — pedir contraseña
      hint.style.color        = 'var(--text-muted)';
      passGroup.style.display = '';
      passInput.required      = true;
      submitBtn.disabled      = false;
    }
  } catch {
    hint.textContent   = '';
    hint.style.display = 'none';
    _emailCheckResult  = null;
  }
}


export async function saveNewOwner() {
  const name   = document.getElementById('no-name')?.value.trim();
  const email  = document.getElementById('no-email')?.value.trim();
  const pass   = document.getElementById('no-pass')?.value.trim();
  const phone  = document.getElementById('no-phone')?.value.trim();
  const initialDebtAmount = Number(document.getElementById('no-initial-debt')?.value || 0);
  if (!name || !email) { toast('Nombre y email son obligatorios', 'error'); return; }

  // Si el email cambió después del último check, re-verificar
  if (email !== _lastCheckedEmail) {
    await checkNewOwnerEmail();
  }
  if (_emailCheckResult && !_emailCheckResult.canAddToCurrentOrganization) {
    toast('Este usuario ya pertenece a esta organización.', 'error');
    return;
  }
  // Si es usuario nuevo, la contraseña es obligatoria
  const isNewUser = !_emailCheckResult || !_emailCheckResult.exists;
  if (isNewUser && !pass) {
    toast('La contraseña es obligatoria para nuevos propietarios.', 'error');
    return;
  }

  const unitIds = _selectedNewOwnerUnitIds();
  const chargeCurrentMonth = document.getElementById('no-charge-current')?.checked !== false;

  try {
    await api.owners.create({ name, email, password: pass, phone, initialDebtAmount, chargeCurrentMonth, unitIds });
    toast('Propietario creado exitosamente', 'success');
    renderOwnersList();
    if (phone) {
      openWelcomeWhatsAppModal({ name, phone }, email);
    } else {
      closeModal();
    }
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Registrar pago manual (admin) ────────────────────────────
export async function openRegisterPaymentModalLegacy(ownerId, ownerName) {
  _ownerDetailCfg = cache.get('config');
  if (!_ownerDetailCfg) {
    try {
      const res = await getCachedOrFetch('config:api', CACHE_TTL.CONFIG, () => api.config.get());
      _ownerDetailCfg = res.data.config;
      cache.set('config', _ownerDetailCfg);
    } catch { _ownerDetailCfg = null; }
  }

  const cfg        = _ownerDetailCfg || {};
  const monthlyFee = cfg.monthlyFee || 0;
  const periods    = cfg.paymentPeriods || [];
  const now        = new Date();
  const currentCode = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const periodOptions = periods.length
    ? periods.map(p => `<option value="${p}" ${p === currentCode ? 'selected' : ''}>${formatMonth(p)}</option>`).join('')
    : (() => {
        const opts = [];
        for (let i = 0; i < 6; i++) {
          const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
          const code  = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
          const label = formatMonth(code);
          opts.push(`<option value="${code}" ${i === 0 ? 'selected' : ''}>${label}</option>`);
        }
        return opts.join('');
      })();

  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.25rem">Registrar pago</h2>
    <p class="text-sm text-muted" style="margin-bottom:1rem">Para: ${ownerName}</p>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Período</label>
        <select class="select" id="rp-month">${periodOptions}</select>
      </div>
      <div class="form-group">
        <label>Importe ($)</label>
        <input class="input" type="number" id="rp-amount" value="${monthlyFee || ''}" placeholder="${monthlyFee || ''}" min="1">
      </div>
      <div class="form-group">
        <label>Nota (opcional)</label>
        <input class="input" id="rp-note" placeholder="Ej: Pago en efectivo">
      </div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="viewOwnerDetail('${ownerId}')">Cancelar</button>
        <button class="btn btn-primary w-full" data-requires-network onclick="submitRegisterPayment('${ownerId}')">Registrar</button>
      </div>
    </div>`;
  openModal();
}

export async function submitRegisterPaymentLegacy(ownerId) {
  const month  = document.getElementById('rp-month')?.value;
  const amount = document.getElementById('rp-amount')?.value;
  const note   = document.getElementById('rp-note')?.value?.trim();

  if (!month)               { toast('Seleccioná el período', 'error'); return; }
  if (!amount || amount < 1) { toast('Ingresá un importe válido', 'error'); return; }

  const formData = new FormData();
  formData.append('month',   month);
  formData.append('amount',  amount);
  formData.append('ownerId', ownerId);
  if (note) formData.append('ownerNote', note);

  try {
    await api.payments.create(formData);
    toast('Pago registrado correctamente', 'success');
    viewOwnerDetail(ownerId);
    window.gestionarInvalidateCaches?.('payments');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Descargar plantilla Excel (generada en el cliente) ────────
// Registrar pago manual con conceptos (admin)
function _money(value) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`;
}

function _registerPaymentOwnerOptions() {
  return _registerPaymentOwners
    .map(owner => {
      const id = owner._id || owner.id;
      const label = [owner.name, _ownerUnitDisplay(owner)].filter(Boolean).join(' - ');
      return `<option value="${id}" ${String(id) === String(_registerPaymentSelectedOwnerId) ? 'selected' : ''}>${escapeHtml(label)}</option>`;
    })
    .join('');
}

function _selectedRegisterPaymentOwner() {
  return _registerPaymentOwners.find(owner => String(owner._id || owner.id) === String(_registerPaymentSelectedOwnerId));
}

function _renderRegisterPaymentShell(bodyHtml = '') {
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.25rem">Registrar pago</h2>
    <p class="text-sm text-muted" style="margin-bottom:1rem">Selecciona el propietario y los conceptos a registrar.</p>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Propietario</label>
        <select class="select" id="rp-owner" onchange="loadRegisterPaymentOwner(this.value)">
          <option value="">Seleccionar propietario</option>
          ${_registerPaymentOwnerOptions()}
        </select>
      </div>
      <div id="rp-owner-context">
        ${bodyHtml || '<div class="empty" style="padding:1rem 0"><p class="empty-title">Selecciona un propietario</p><p class="empty-sub">Los conceptos disponibles se cargaran despues de elegirlo.</p></div>'}
      </div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cerrar</button>
      </div>
    </div>`;
  openModal();
}

function _renderRegisterPaymentLoading() {
  const target = document.getElementById('rp-owner-context');
  if (target) target.innerHTML = `<div class="flex col gap-2">${skeleton(4)}</div>`;
}

function _registerPaymentCard({ type, value, amount, title, subtitle, badge, selected = false }) {
  return `
    <label class="period-card${selected ? ' is-selected' : ''}" data-type="${type}" data-value="${escapeHtml(value)}" data-amount="${amount}" onclick="toggleRegisterPaymentCard(this)">
      <span class="pc-check${selected ? ' is-on' : ''}">${selected ? svgIcon('check', 12) : ''}</span>
      <div style="flex:1;min-width:0">
        <div class="row" style="gap:6px">
          <span class="bright" style="font:var(--t-body-md)">${escapeHtml(title)}</span>
          ${badge}
        </div>
        <div class="muted" style="font:var(--t-sm);margin-top:2px">${escapeHtml(subtitle)}</div>
      </div>
      <span class="bright tnum" style="font:var(--t-body-md)">${_money(amount)}</span>
    </label>`;
}

function _renderRegisterPaymentContext({ cfg, available, payments, units, owner: freshOwner }) {
  const owner = freshOwner || _selectedRegisterPaymentOwner();
  const monthlyFee = cfg?.monthlyFee || 0;
  _registerPaymentOwnerFee = units.length > 0
    ? units.reduce((sum, unit) => sum + Number(unit.finalFee ?? monthlyFee), 0)
    : monthlyFee;

  const pendingBalance = payments.some(payment => payment.type === 'balance' && payment.status === 'pending');
  _registerPaymentBalanceAmount = owner?.balance < 0 && !pendingBalance ? Math.abs(Number(owner.balance || 0)) : 0;
  const periods = (available.periods || []).map((period, index) => ({ period, selected: index === 0 }));
  const extras = (available.extraordinary || []).map(extra => ({
    id: extra.id || extra._id,
    title: extra.title || extra.description || 'Concepto extraordinario',
    amount: Number(extra.amount || 0),
  }));

  const cards = [
    _registerPaymentBalanceAmount > 0 ? _registerPaymentCard({
      type: 'balance',
      value: 'initial-balance',
      amount: _registerPaymentBalanceAmount,
      title: 'Saldo anterior',
      subtitle: 'Deuda pendiente del propietario',
      badge: '<span class="badge badge-danger">Saldo</span>',
    }) : '',
    ...periods.map(item => _registerPaymentCard({
      type: 'period',
      value: item.period,
      amount: _registerPaymentOwnerFee,
      title: formatPeriodLabel(item.period),
      subtitle: 'Expensa ordinaria pendiente',
      badge: '<span class="badge badge-accent">Periodo</span>',
      selected: item.selected,
    })),
    ...extras.map(extra => _registerPaymentCard({
      type: 'extra',
      value: extra.id,
      amount: extra.amount,
      title: extra.title,
      subtitle: 'Concepto extraordinario cobrable',
      badge: '<span class="badge badge-warning">Extra</span>',
    })),
  ].filter(Boolean).join('');

  const target = document.getElementById('rp-owner-context');
  if (!target) return;
  target.innerHTML = `
    <div class="card" style="padding:14px">
      <div class="row-between" style="align-items:flex-start;gap:12px">
        <div style="min-width:0">
          <p class="bright" style="font-weight:700">${escapeHtml(owner?.name || '')}</p>
          <p class="text-sm text-muted">${escapeHtml(owner?.email || '')}</p>
          <p class="text-sm text-muted">${escapeHtml(_ownerUnitDisplay(owner) || 'Sin unidades asignadas')}</p>
        </div>
        <span class="badge ${owner?.balance < 0 ? 'badge-danger' : 'badge-success'}">${owner?.balance < 0 ? `Debe ${_money(Math.abs(owner.balance))}` : 'Sin saldo anterior'}</span>
      </div>
    </div>

    <div class="section-head" style="margin-top:14px">
      <h3>Conceptos a registrar</h3>
      <span class="muted" style="font:var(--t-xs)" id="rp-count">0 conceptos</span>
    </div>
    ${cards ? `<div class="stack-2" id="rp-cards-list">${cards}</div>` : `
      <div class="empty" style="padding:1.25rem 0">
        <p class="empty-title">No hay conceptos pendientes</p>
        <p class="empty-sub">Este propietario no tiene periodos, extraordinarios ni saldo anterior disponibles.</p>
      </div>`}

    ${cards ? `
    <div class="card" style="margin-top:14px;padding:14px">
      <div class="row-between">
        <div>
          <div class="muted" style="font:var(--t-xs);letter-spacing:.12em;text-transform:uppercase">Total a registrar</div>
          <div class="muted" style="font:var(--t-xs);margin-top:4px" id="rp-count-label">0 conceptos</div>
        </div>
        <span class="h-amount tnum accent" style="font-size:30px" id="rp-total">$0</span>
      </div>
    </div>
    <div class="form-group" style="margin-top:14px">
      <label>Comprobante opcional</label>
      <p class="text-sm text-muted" style="margin:.25rem 0 .6rem">Podés registrar el pago sin comprobante si fue recibido en efectivo u otro medio externo.</p>
      <div class="upload-area" id="rp-upload-zone" onclick="document.getElementById('rp-file').click()">
        <div style="width:46px;height:46px;border-radius:50%;background:var(--accent-lt);color:var(--accent);display:grid;place-items:center">${svgIcon('upload', 22)}</div>
        <div class="bright" style="font-weight:700;margin-top:8px">Adjuntar comprobante</div>
        <div class="muted text-sm">PDF o imagen - max. 10 MB</div>
      </div>
      <input type="file" id="rp-file" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic" class="hidden" onchange="handleRegisterPaymentFile(event)">
      <div id="rp-file-preview" class="hidden"></div>
    </div>
    <div class="form-group">
      <label>Nota (opcional)</label>
      <textarea class="input textarea" id="rp-note" placeholder="Ej: Pago recibido en efectivo"></textarea>
    </div>
    <button class="btn btn-primary btn-lg w-full" id="rp-submit" data-requires-network onclick="submitRegisterPayment()">
      ${svgIcon('check', 18)} Registrar pago
    </button>` : ''}
  `;
  updateRegisterPaymentTotal();
}

export async function openRegisterPaymentModal(ownerId) {
  _registerPaymentFile = null;
  _registerPaymentSelectedOwnerId = ownerId || '';

  if (!ownersListState.all.length) {
    _renderRegisterPaymentShell(`<div class="flex col gap-2">${skeleton(4)}</div>`);
    try {
      const res = await getCachedOrFetch(
        'owners:list:limit=500',
        CACHE_TTL.OWNERS,
        () => api.owners.getAll({ limit: 500 })
      );
      ownersListState.all = res.data.owners || [];
    } catch (err) {
      document.getElementById('rp-owner-context').innerHTML = errorState(err.message);
      return;
    }
  }

  _registerPaymentOwners = ownersListState.all;
  _renderRegisterPaymentShell();
  if (_registerPaymentSelectedOwnerId) {
    await loadRegisterPaymentOwner(_registerPaymentSelectedOwnerId);
  }
}

export async function loadRegisterPaymentOwner(ownerId) {
  _registerPaymentSelectedOwnerId = ownerId || '';
  _registerPaymentFile = null;
  if (!_registerPaymentSelectedOwnerId) {
    _renderRegisterPaymentShell();
    return;
  }

  _renderRegisterPaymentLoading();
  try {
    const [cfgRes, availableRes, paymentsRes, unitsRes, ownerRes] = await Promise.all([
      api.config.get(),
      api.payments.getAvailableItems({ ownerId: _registerPaymentSelectedOwnerId }),
      api.payments.getAll({ ownerId: _registerPaymentSelectedOwnerId, limit: 50 }),
      api.units.getAll({ ownerId: _registerPaymentSelectedOwnerId }),
      api.owners.getOne(_registerPaymentSelectedOwnerId),
    ]);
    _renderRegisterPaymentContext({
      cfg:       cfgRes.data.config || {},
      available: availableRes.data || {},
      payments:  paymentsRes.data.payments || [],
      units:     unitsRes.data.units || [],
      owner:     ownerRes.data.owner || null,
    });
  } catch (err) {
    const target = document.getElementById('rp-owner-context');
    if (target) target.innerHTML = errorState(err.message, `loadRegisterPaymentOwner('${_registerPaymentSelectedOwnerId}')`);
  }
}

export function toggleRegisterPaymentCard(el) {
  const card = el.closest('.period-card') || el;
  const isOn = card.classList.toggle('is-selected');
  const check = card.querySelector('.pc-check');
  if (check) {
    check.classList.toggle('is-on', isOn);
    check.innerHTML = isOn ? svgIcon('check', 12) : '';
  }
  updateRegisterPaymentTotal();
}

export function updateRegisterPaymentTotal() {
  const selected = [...document.querySelectorAll('#rp-cards-list .period-card.is-selected')];
  const total = selected.reduce((sum, card) => sum + Number(card.dataset.amount || 0), 0);
  const count = selected.length;
  const totalEl = document.getElementById('rp-total');
  const countEl = document.getElementById('rp-count');
  const labelEl = document.getElementById('rp-count-label');
  if (totalEl) totalEl.textContent = _money(total);
  if (countEl) countEl.textContent = `${count} concepto${count !== 1 ? 's' : ''}`;
  if (labelEl) labelEl.textContent = count > 0 ? `${count} concepto${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}` : '0 conceptos';
}

export function handleRegisterPaymentFile(event) {
  const file = event.target.files?.[0];
  if (!file) return;
  if (!PAYMENT_FILE_TYPES.has(file.type)) {
    toast('Solo se aceptan PDF o imagenes JPG, PNG, WebP o HEIC.', 'error');
    clearRegisterPaymentFile();
    return;
  }
  if (file.size > 10 * 1024 * 1024) {
    toast('El comprobante no puede superar los 10 MB.', 'error');
    clearRegisterPaymentFile();
    return;
  }
  _registerPaymentFile = file;
  document.getElementById('rp-upload-zone')?.classList.add('hidden');
  const preview = document.getElementById('rp-file-preview');
  if (!preview) return;
  preview.classList.remove('hidden');
  preview.innerHTML = `
    <div class="upload-preview">
      <div class="upload-preview-icon">${file.type.startsWith('image/') ? SVG.upload : SVG.pdf}</div>
      <div style="flex:1;min-width:0">
        <p class="bold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${escapeHtml(file.name)}</p>
        <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
      </div>
      <button class="btn-icon" onclick="clearRegisterPaymentFile()" title="Quitar">x</button>
    </div>`;
}

export function clearRegisterPaymentFile() {
  _registerPaymentFile = null;
  const input = document.getElementById('rp-file');
  if (input) input.value = '';
  document.getElementById('rp-file-preview')?.classList.add('hidden');
  document.getElementById('rp-upload-zone')?.classList.remove('hidden');
}

export async function submitRegisterPayment() {
  const ownerId = document.getElementById('rp-owner')?.value;
  const selected = [...document.querySelectorAll('#rp-cards-list .period-card.is-selected')];
  const periods = selected.filter(card => card.dataset.type === 'period').map(card => card.dataset.value);
  const extras = selected.filter(card => card.dataset.type === 'extra').map(card => card.dataset.value);
  const hasBalance = selected.some(card => card.dataset.type === 'balance');
  const total = selected.reduce((sum, card) => sum + Number(card.dataset.amount || 0), 0);
  const note = document.getElementById('rp-note')?.value?.trim();

  if (!ownerId) {
    toast('Selecciona un propietario.', 'error');
    return;
  }
  if (selected.length === 0) {
    toast('Seleccioná al menos un período, concepto extraordinario o saldo a registrar.', 'error');
    return;
  }
  if (hasBalance && (periods.length > 0 || extras.length > 0)) {
    toast('El saldo anterior debe registrarse en un pago separado.', 'error');
    return;
  }
  if (total <= 0) {
    toast('El importe debe ser mayor a cero.', 'error');
    return;
  }

  const formData = new FormData();
  formData.append('ownerId', ownerId);
  if (hasBalance) {
    formData.append('balanceAmount', String(_registerPaymentBalanceAmount));
  } else {
    periods.forEach(period => formData.append('periods', period));
    if (periods.length === 1) formData.append('month', periods[0]);
    if (periods.length > 0) formData.append('amount', String(_registerPaymentOwnerFee));
    extras.forEach(id => formData.append('extraordinaryIds', id));
  }
  if (note) formData.append('ownerNote', note);
  if (_registerPaymentFile) formData.append('receipt', _registerPaymentFile);

  const btn = document.getElementById('rp-submit');
  setBtnLoading(btn, true);
  try {
    const res = await api.payments.create(formData);
    const payment = res.data.payment || res.data.payments?.[0];
    const status = payment?.status || 'pending';
    toast(
      status === 'approved'
        ? 'Pago registrado y aprobado correctamente.'
        : status === 'pending'
          ? 'Pago registrado correctamente y quedó pendiente de aprobación.'
          : 'Pago registrado correctamente.',
      'success'
    );
    _registerPaymentFile = null;
    window.gestionarInvalidateCaches?.('payments');
    window.gestionarInvalidateCaches?.('owners');
    await viewOwnerDetail(ownerId);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

// Descargar plantilla Excel (generada en el cliente)
export function downloadBulkTemplate() {
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([
    ['nombre', 'email', 'contraseña', 'unidad', 'telefono', 'saldo', 'moroso'],
    ['María García', 'maria@mail.com', 'clave123', 'Lote 12', '1122334455', '0', 'no'],
    ['Juan Pérez',   'juan@mail.com',  'clave456', 'Casa 5A', '',           '0', 'no'],
  ]);
  XLSX.utils.book_append_sheet(wb, ws, 'Propietarios');
  XLSX.writeFile(wb, 'plantilla_propietarios.xlsx');
}

// ── Carga masiva desde Excel ──────────────────────────────────
export function openBulkOwnerModal() {
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.25rem">Carga masiva de propietarios</h2>
    <p class="text-sm text-muted" style="margin-bottom:1rem">
      Subí un archivo <strong>.xlsx</strong> con los datos de los propietarios.
      Cada fila que falle no interrumpe el resto.
    </p>
    <div style="background:var(--bg);border-radius:8px;padding:.75rem;margin-bottom:1rem;font-size:.82rem">
      <p style="font-weight:600;margin-bottom:.35rem">Columnas esperadas:</p>
      <code style="display:block;white-space:pre-wrap;color:var(--accent)">nombre · email · contraseña · unidad · telefono · saldo · moroso</code>
      <p style="margin-top:.5rem;color:var(--text-muted)"><em>nombre, email y contraseña son obligatorios.</em></p>
    </div>
    <button class="btn btn-ghost btn-sm" style="margin-bottom:1rem;display:inline-flex;align-items:center;gap:.35rem" onclick="downloadBulkTemplate()">
      ${SVG.download} Descargar plantilla
    </button>
    <div class="form-group">
      <label>Archivo Excel (.xlsx)</label>
      <input class="input" type="file" id="bulk-file" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet">
    </div>
    <div id="bulk-results" style="display:none"></div>
    <div class="flex gap-1 mt-2">
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary w-full" onclick="submitBulkOwners()">Importar</button>
    </div>`;
  openModal();
}

export async function submitBulkOwners() {
  const input = document.getElementById('bulk-file');
  if (!input?.files?.length) { toast('Seleccioná un archivo .xlsx', 'error'); return; }

  const formData = new FormData();
  formData.append('file', input.files[0]);

  try {
    showLoading(true);
    const res = await api.owners.bulkCreate(formData);
    const { created, errors, owners, failed } = res.data;
    showLoading(false);

    const resultsEl = document.getElementById('bulk-results');
    resultsEl.style.display = '';
    resultsEl.innerHTML = `
      <div style="border-radius:8px;overflow:hidden;margin-bottom:.75rem">
        <div style="display:flex;gap:.5rem;padding:.6rem .75rem;background:var(--success-lt,#d1fae5);color:var(--success)">
          <strong>${created}</strong> propietario${created !== 1 ? 's' : ''} creado${created !== 1 ? 's' : ''}
        </div>
        ${errors > 0 ? `
        <div style="padding:.6rem .75rem;background:var(--danger-lt,#fee2e2);color:var(--danger)">
          <strong>${errors}</strong> fila${errors !== 1 ? 's' : ''} con error:
          <ul style="margin:.4rem 0 0 1.1rem;font-size:.82rem">
            ${failed.map(f => `<li>Fila ${f.row}${f.email ? ` (${f.email})` : ''}: ${f.reason}</li>`).join('')}
          </ul>
        </div>` : ''}
      </div>`;

    if (created > 0) {
      toast(`${created} propietario${created !== 1 ? 's' : ''} importado${created !== 1 ? 's' : ''}`, 'success');
      renderOwnersList();
    }

    // Quitar botón importar si ya se procesó
    document.querySelector('#modal .btn-primary[onclick="submitBulkOwners()"]')?.remove();
  } catch (err) {
    showLoading(false);
    toast(err.message, 'error');
  }
}

// ── WhatsApp ──────────────────────────────────────────────────
export function openWhatsAppOwnerModal(name, phone) {
  if (!phone || !formatPhone(phone)) { toast('El propietario no tiene teléfono registrado', 'warning'); return; }
  const cfg = cache.get('config');
  const orgName = cfg?.consortiumName || 'la administración';
  const firstName = name.split(' ')[0];
  const defaultMsg = `Hola ${firstName}, te contacto desde la administración de ${orgName}.`;
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.25rem">Enviar WhatsApp</h2>
    <p class="text-sm text-muted" style="margin-bottom:1rem">Para: ${name} · ${phone}</p>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Mensaje</label>
        <textarea class="input" id="wa-msg" style="min-height:100px">${defaultMsg}</textarea>
      </div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" style="background:#25D366;border-color:#25D366" onclick="sendWhatsAppOwner('${phone.replace(/'/g, "\\'")}')">Abrir WhatsApp</button>
      </div>
    </div>`;
  openModal();
}

export function sendWhatsAppOwner(phone) {
  const msg = document.getElementById('wa-msg')?.value.trim();
  if (!msg) { toast('El mensaje no puede estar vacío', 'warning'); return; }
  window.open(buildWhatsAppLink(phone, msg), '_blank');
  closeModal();
}

export function openWelcomeWhatsAppModal(owner, email) {
  const cfg = cache.get('config');
  const orgName = cfg?.consortiumName || 'tu consorcio';
  const appUrl = window.location.origin;
  const firstName = owner.name.split(' ')[0];
  const defaultMsg = `👋 Hola ${firstName}\n\nTe damos la bienvenida a ${orgName}.\n\nPodés acceder a la app desde:\n${appUrl}\n\nEmail: ${email}\n\n¡Saludos!`;
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.25rem">Enviar bienvenida por WhatsApp</h2>
    <p class="text-sm text-muted" style="margin-bottom:1rem">Para: ${owner.name} · ${owner.phone}</p>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Mensaje</label>
        <textarea class="input" id="wa-welcome-msg" style="min-height:150px">${defaultMsg}</textarea>
      </div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Omitir</button>
        <button class="btn btn-primary w-full" style="background:#25D366;border-color:#25D366" onclick="sendWelcomeWhatsApp('${owner.phone.replace(/'/g, "\\'")}')">Enviar por WhatsApp</button>
      </div>
    </div>`;
  openModal();
}

export function sendWelcomeWhatsApp(phone) {
  const msg = document.getElementById('wa-welcome-msg')?.value.trim();
  if (!msg) { toast('El mensaje no puede estar vacío', 'warning'); return; }
  window.open(buildWhatsAppLink(phone, msg), '_blank');
  closeModal();
}

// ── Exportar listado a Excel ──────────────────────────────────
export function downloadOwnersExcel() {
  const owners = ownersListState.all;
  if (!owners.length) return toast('No hay propietarios para exportar.', 'warning');

  const rows = owners.map(o => ({
    Nombre:         o.name,
    Email:          o.email || '',
    Unidades:       _ownerUnitDisplay(o),
    Teléfono:       o.phone || '',
    Estado:         o.isDebtor ? 'Moroso' : 'Al día',
    Saldo:          o.balance || 0,
    'Último pago':  o.lastPayment?.month || '',
  }));

  const ws = XLSX.utils.json_to_sheet(rows);
  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, 'Propietarios');
  XLSX.writeFile(wb, 'propietarios.xlsx');
}

window.renderOwnersList       = renderOwnersList;
window._renderOwnersView      = _renderOwnersView;
window.ownersListState        = ownersListState;
window._debouncedOwnerFilter  = _debouncedOwnerFilter;
window.ownersGoPage           = ownersGoPage;
window.viewOwnerDetail        = viewOwnerDetail;
window.toggleDebt             = toggleDebt;
window.confirmDeleteOwner     = confirmDeleteOwner;
window.deleteOwner            = deleteOwner;
window.openNotifyOwnerModal   = openNotifyOwnerModal;
window.sendOwnerNotification  = sendOwnerNotification;
window.openEditOwnerModal     = openEditOwnerModal;
window.saveEditOwner          = saveEditOwner;
window.openNewOwnerModal           = openNewOwnerModal;
window.checkNewOwnerEmail          = checkNewOwnerEmail;
window.saveNewOwner                = saveNewOwner;
window.openRegisterPaymentModal    = openRegisterPaymentModal;
window.loadRegisterPaymentOwner    = loadRegisterPaymentOwner;
window.toggleRegisterPaymentCard   = toggleRegisterPaymentCard;
window.updateRegisterPaymentTotal  = updateRegisterPaymentTotal;
window.handleRegisterPaymentFile   = handleRegisterPaymentFile;
window.clearRegisterPaymentFile    = clearRegisterPaymentFile;
window.submitRegisterPayment       = submitRegisterPayment;
window.downloadBulkTemplate        = downloadBulkTemplate;
window.openBulkOwnerModal          = openBulkOwnerModal;
window.submitBulkOwners            = submitBulkOwners;
// Unidades (modal detalle)
window.openAddUnitForm      = openAddUnitForm;
window.cancelAddUnit        = cancelAddUnit;
window.submitAddUnit        = submitAddUnit;
window.deleteUnit           = deleteUnit;
window.toggleEditOwnerUnit  = toggleEditOwnerUnit;
window.filterEditOwnerUnits = filterEditOwnerUnits;
// Unidades (formulario nuevo propietario)
window.addNewOwnerUnit    = addNewOwnerUnit;
window.removeNewOwnerUnit = removeNewOwnerUnit;
window.toggleNewOwnerUnit = toggleNewOwnerUnit;
window.filterNewOwnerUnits = filterNewOwnerUnits;
// WhatsApp
window.openWhatsAppOwnerModal  = openWhatsAppOwnerModal;
window.sendWhatsAppOwner       = sendWhatsAppOwner;
window.openWelcomeWhatsAppModal = openWelcomeWhatsAppModal;
window.sendWelcomeWhatsApp     = sendWelcomeWhatsApp;
window.downloadOwnersExcel     = downloadOwnersExcel;
// Deudas adicionales
window.openDebtItemModal      = openDebtItemModal;
window.submitDebtItem         = submitDebtItem;
window.promptCancelDebtItem   = promptCancelDebtItem;
