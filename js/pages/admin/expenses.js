import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { formatDate, errorState, downloadAttachment } from '../../ui/helpers.js';

const CAT_LABELS = {
  cleaning:       'Limpieza',
  security:       'Seguridad',
  maintenance:    'Mantenimiento',
  utilities:      'Servicios',
  administration: 'Administración',
  other:          'Otro',
};

const PAY_LABELS = {
  cash:        'Efectivo',
  transfer:    'Transferencia',
  mercadopago: 'MercadoPago',
};

const BILLING_LABELS = {
  fixed_total:    'Total fijo',
  per_unit:       'Por unidad',
  by_coefficient: 'Por coeficiente',
};

const expensesState = { all: [], page: 1, perPage: 15, filterMonth: '', filterCategory: '' };

// ── Render principal ──────────────────────────────────────────
export async function renderAdminExpenses() {
  const el = document.getElementById('page-admin-expenses');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const params = { limit: 200 };
    if (expensesState.filterMonth)    params.month    = expensesState.filterMonth;
    if (expensesState.filterCategory) params.category = expensesState.filterCategory;

    const res = await api.expenses.getAll(params);
    expensesState.all  = res.data.expenses;
    expensesState.page = 1;
    _renderExpensesView();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminExpenses()');
  }
}

function _attachmentButtons(expenseId, attachments) {
  if (!attachments?.length) return '';
  return attachments.map((a, i) =>
    `<button class="btn btn-sm btn-ghost" style="font-size:.72rem;padding:.2rem .45rem"
      onclick="downloadExpenseAttachment('${expenseId}',${i},'${(a.filename || 'comprobante').replace(/'/g, "\\'")}')">
      📎 ${a.filename ? _truncate(a.filename, 18) : `Archivo ${i + 1}`}
    </button>`
  ).join('');
}

function _truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

function _renderExpensesView() {
  const el    = document.getElementById('page-admin-expenses');
  const total = expensesState.all.length;
  const pages = Math.max(1, Math.ceil(total / expensesState.perPage));
  if (expensesState.page > pages) expensesState.page = pages;
  const start = (expensesState.page - 1) * expensesState.perPage;
  const slice = expensesState.all.slice(start, start + expensesState.perPage);

  const totalAmount = expensesState.all.reduce((s, e) => s + e.amount, 0);

  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between" style="align-items:center">
        <h1>Gastos</h1>
        <button class="btn btn-primary btn-sm" onclick="openNewExpenseModal()">+ Nuevo gasto</button>
      </div>

      <div class="owners-filter-bar">
        <input class="input" type="month" value="${expensesState.filterMonth}"
          oninput="expensesState.filterMonth=this.value;expensesState.page=1;renderAdminExpenses()">
        <select class="input" onchange="expensesState.filterCategory=this.value;expensesState.page=1;renderAdminExpenses()">
          <option value="">Todas las categorías</option>
          ${Object.entries(CAT_LABELS).map(([v, l]) =>
            `<option value="${v}" ${expensesState.filterCategory === v ? 'selected' : ''}>${l}</option>`
          ).join('')}
        </select>
        ${expensesState.filterMonth || expensesState.filterCategory ? `<button class="btn-clear-filter" onclick="expensesState.filterMonth='';expensesState.filterCategory='';expensesState.page=1;renderAdminExpenses()">✕ Limpiar</button>` : ''}
      </div>

      <div class="owners-meta">
        <span>${total} gasto${total !== 1 ? 's' : ''} · Total: <strong>$${totalAmount.toLocaleString('es-AR')}</strong></span>
        <span>Página ${expensesState.page} de ${pages}</span>
      </div>

      ${slice.length === 0 ? '<p class="text-muted text-sm" style="padding:1rem 0">Sin gastos registrados.</p>' : `
      <div class="table-wrap">
        <table class="table">
          <thead><tr>
            <th>Fecha</th><th>Descripción</th><th>Categoría</th><th>Proveedor</th>
            <th>Importe</th><th>Estado</th><th></th>
          </tr></thead>
          <tbody>
            ${slice.map(e => `
              <tr>
                <td style="white-space:nowrap">${formatDate(e.date)}</td>
                <td>
                  <div>${e.description}</div>
                  ${e.attachments?.length ? `<div class="flex gap-1" style="flex-wrap:wrap;margin-top:.25rem">${_attachmentButtons(e._id, e.attachments)}</div>` : ''}
                </td>
                <td>
                  <span class="badge badge-info">${CAT_LABELS[e.category] || e.category}</span>
                  ${e.expenseType === 'extraordinary' ? `<span class="badge badge-warning" style="margin-left:.25rem">Extraordinario</span>` : ''}
                  ${e.isChargeable ? `<span class="badge badge-success" style="margin-left:.25rem">Cobrable</span>${e.extraordinaryBillingMode && e.extraordinaryBillingMode !== 'fixed_total' ? `<span class="badge badge-info" style="margin-left:.25rem">${BILLING_LABELS[e.extraordinaryBillingMode] || ''}</span>` : ''}` : ''}
                </td>
                <td>${e.provider ? e.provider.name : '<span class="text-muted">—</span>'}</td>
                <td style="font-weight:600">$${e.amount.toLocaleString('es-AR')}</td>
                <td>${e.status === 'paid'
                  ? `<span class="badge badge-success">✓ Pagado</span>`
                  : `<span class="badge badge-warning">⏳ Pendiente</span>`}
                </td>
                <td>
                  <div class="flex gap-1">
                    ${e.status === 'pending' ? `<button class="btn btn-sm btn-ghost" onclick="markExpensePaid('${e._id}')">Marcar pagado</button>` : ''}
                    <button class="btn btn-sm btn-ghost" onclick="openEditExpenseModal('${e._id}')">Editar</button>
                    <button class="btn btn-sm btn-danger-ghost" onclick="deleteExpense('${e._id}','${e.description.replace(/'/g, "\\'")}')">✕</button>
                  </div>
                </td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`}

      ${pages > 1 ? `
      <div class="flex gap-2" style="justify-content:center">
        <button class="btn btn-sm btn-ghost" ${expensesState.page <= 1 ? 'disabled' : ''} onclick="expensesState.page--;_renderExpensesView()">‹ Ant</button>
        <span style="line-height:2rem">${expensesState.page} / ${pages}</span>
        <button class="btn btn-sm btn-ghost" ${expensesState.page >= pages ? 'disabled' : ''} onclick="expensesState.page++;_renderExpensesView()">Sig ›</button>
      </div>` : ''}
    </div>`;
}

// ── Descarga de adjunto via API (signed URL proxy) ────────────
export async function downloadExpenseAttachment(expenseId, index, filename) {
  await downloadAttachment(api.expenses.getAttachmentUrl(expenseId, index), filename);
}

// ── Eliminar adjunto individual ───────────────────────────────
export async function deleteExpenseAttachment(expenseId, index) {
  if (!confirm('¿Eliminar este adjunto?')) return;
  try {
    await api.expenses.deleteAttachment(expenseId, index);
    toast('Adjunto eliminado.', 'success');
    await renderAdminExpenses();
  } catch (err) {
    toast(err.message || 'Error al eliminar.', 'error');
  }
}

// ── Modal nuevo gasto ─────────────────────────────────────────
export async function openNewExpenseModal() {
  let providersHtml = '<option value="">Sin proveedor</option>';
  try {
    const res = await api.providers.getAll();
    providersHtml += res.data.providers.map(p =>
      `<option value="${p._id}">${p.name} (${CAT_LABELS[p.serviceType] || p.serviceType})</option>`
    ).join('');
  } catch { /* sin proveedores cargados */ }

  const today = new Date().toISOString().split('T')[0];

  openModal('modal-new-expense', `
    <h2 style="margin-bottom:1rem">Nuevo gasto</h2>
    <div class="flex col gap-2">
      <div>
        <label class="label">Descripción *</label>
        <input id="exp-desc" class="input" type="text" placeholder="Ej: Limpieza quincenal">
      </div>
      <div class="flex gap-2">
        <div style="flex:1">
          <label class="label">Categoría *</label>
          <select id="exp-cat" class="input">
            ${Object.entries(CAT_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1">
          <label class="label">Importe *</label>
          <input id="exp-amount" class="input" type="number" min="0" step="0.01" placeholder="0.00">
        </div>
      </div>
      <div class="flex gap-2">
        <div style="flex:1">
          <label class="label">Fecha *</label>
          <input id="exp-date" class="input" type="date" value="${today}">
        </div>
        <div style="flex:1">
          <label class="label">Proveedor</label>
          <select id="exp-provider" class="input">${providersHtml}</select>
        </div>
      </div>
      <div>
        <label class="label">Método de pago</label>
        <select id="exp-method" class="input">
          <option value="">Sin especificar</option>
          ${Object.entries(PAY_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label">Tipo de gasto</label>
        <select id="exp-type" class="input" onchange="toggleExpChargeable('exp')">
          <option value="ordinary">Ordinario</option>
          <option value="extraordinary">Extraordinario</option>
        </select>
      </div>
      <div id="exp-chargeable-wrap" class="hidden">
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
          <input type="checkbox" id="exp-chargeable" onchange="syncExpBillingWrap('exp')">
          <span class="text-sm">Cobrable a propietarios (aparece en pantalla de pago)</span>
        </label>
      </div>
      <div id="exp-billing-wrap" class="hidden flex col gap-2">
        <div>
          <label class="label">Forma de cobro</label>
          <select id="exp-billing-mode" class="input" onchange="toggleBillingMode('exp')">
            <option value="fixed_total">Monto total a repartir</option>
            <option value="per_unit">Monto por lote/unidad</option>
            <option value="by_coefficient">Según coeficiente</option>
          </select>
        </div>
        <div id="exp-unit-amount-wrap" class="hidden">
          <label class="label">Monto por unidad *</label>
          <input id="exp-unit-amount" class="input" type="number" min="0.01" step="0.01" placeholder="0.00">
        </div>
      </div>
      <div>
        <label class="label">Comprobantes (PDF o imagen)</label>
        <input id="exp-receipt" class="input" type="file" accept=".pdf,image/*" multiple>
        <p class="text-muted text-sm" style="margin-top:.2rem">Podés adjuntar varios archivos. Máx. 5 por vez, 10 MB c/u.</p>
      </div>
      <div class="flex gap-2" style="margin-top:.5rem">
        <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-new-expense')">Cancelar</button>
        <button id="btn-save-expense" class="btn btn-primary" style="flex:1" onclick="saveNewExpense()">Guardar</button>
      </div>
    </div>
  `);
}

export async function saveNewExpense() {
  const desc        = document.getElementById('exp-desc')?.value.trim();
  const cat         = document.getElementById('exp-cat')?.value;
  const amount      = parseFloat(document.getElementById('exp-amount')?.value);
  const date        = document.getElementById('exp-date')?.value;
  const provider    = document.getElementById('exp-provider')?.value;
  const method      = document.getElementById('exp-method')?.value;
  const expType     = document.getElementById('exp-type')?.value || 'ordinary';
  const isChargeable  = expType === 'extraordinary' && document.getElementById('exp-chargeable')?.checked;
  const billingMode   = isChargeable ? (document.getElementById('exp-billing-mode')?.value || 'fixed_total') : 'fixed_total';
  const isPerUnit     = isChargeable && billingMode === 'per_unit';
  const unitAmountVal = isPerUnit ? parseFloat(document.getElementById('exp-unit-amount')?.value || 0) : 0;
  const files         = document.getElementById('exp-receipt')?.files;

  if (!desc || !cat || !date) return toast('Completá los campos obligatorios.', 'warning');
  if (isPerUnit && !(unitAmountVal > 0)) return toast('El monto por unidad debe ser mayor a 0.', 'warning');
  if (!isPerUnit && !(amount > 0)) return toast('El importe debe ser mayor a 0.', 'warning');

  const btn = document.getElementById('btn-save-expense');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    let body;
    if (files?.length) {
      const fd = new FormData();
      fd.append('description', desc);
      fd.append('category', cat);
      fd.append('amount', isPerUnit ? 0 : amount);
      fd.append('date', date);
      if (provider) fd.append('provider', provider);
      if (method)   fd.append('paymentMethod', method);
      fd.append('expenseType', expType);
      fd.append('isChargeable', isChargeable);
      if (isChargeable) fd.append('extraordinaryBillingMode', billingMode);
      if (isPerUnit)    fd.append('unitAmount', unitAmountVal);
      Array.from(files).forEach(f => fd.append('attachments', f));
      body = fd;
    } else {
      body = { description: desc, category: cat, amount: isPerUnit ? 0 : amount, date, expenseType: expType, isChargeable,
               ...(provider && { provider }), ...(method && { paymentMethod: method }),
               ...(isChargeable && { extraordinaryBillingMode: billingMode }),
               ...(isPerUnit && { unitAmount: unitAmountVal }) };
    }

    await api.expenses.create(body);
    closeModal('modal-new-expense');
    toast('Gasto registrado.', 'success');
    await renderAdminExpenses();
  } catch (err) {
    toast(err.message || 'Error al guardar.', 'error');
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

// ── Marcar como pagado ────────────────────────────────────────
export function markExpensePaid(id) {
  openModal('modal-mark-paid', `
    <h2 style="margin-bottom:1rem">Marcar como pagado</h2>
    <div class="flex col gap-2">
      <div>
        <label class="label">Método de pago</label>
        <select id="paid-method" class="input">
          <option value="">Sin especificar</option>
          ${Object.entries(PAY_LABELS).map(([v, l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="flex gap-2" style="margin-top:.5rem">
        <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-mark-paid')">Cancelar</button>
        <button id="btn-confirm-paid" class="btn btn-primary" style="flex:1" onclick="confirmMarkPaid('${id}')">Confirmar</button>
      </div>
    </div>
  `);
}

export async function confirmMarkPaid(id) {
  const method = document.getElementById('paid-method')?.value;
  const btn    = document.getElementById('btn-confirm-paid');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    await api.expenses.markAsPaid(id, method ? { paymentMethod: method } : {});
    closeModal('modal-mark-paid');
    toast('Gasto marcado como pagado.', 'success');
    await renderAdminExpenses();
  } catch (err) {
    toast(err.message || 'Error.', 'error');
    btn.disabled = false; btn.textContent = 'Confirmar';
  }
}

// ── Eliminar gasto ────────────────────────────────────────────
export function deleteExpense(id, desc) {
  openModal('modal-del-expense', `
    <h2 style="margin-bottom:.5rem">Eliminar gasto</h2>
    <p class="text-muted" style="margin-bottom:1rem">¿Eliminar "<strong>${desc}</strong>"? Esta acción no se puede deshacer.</p>
    <div class="flex gap-2">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-del-expense')">Cancelar</button>
      <button id="btn-del-exp" class="btn btn-danger" style="flex:1" onclick="confirmDeleteExpense('${id}')">Eliminar</button>
    </div>
  `);
}

export async function confirmDeleteExpense(id) {
  const btn = document.getElementById('btn-del-exp');
  btn.disabled = true; btn.textContent = 'Eliminando…';
  try {
    await api.expenses.delete(id);
    closeModal('modal-del-expense');
    toast('Gasto eliminado.', 'success');
    await renderAdminExpenses();
  } catch (err) {
    toast(err.message || 'Error.', 'error');
    btn.disabled = false; btn.textContent = 'Eliminar';
  }
}

// ── Editar gasto ──────────────────────────────────────────────
export async function openEditExpenseModal(id) {
  const expense = expensesState.all.find(e => e._id === id);
  if (!expense) return toast('Gasto no encontrado.', 'error');

  let providersHtml = '<option value="">Sin proveedor</option>';
  try {
    const res = await api.providers.getAll();
    const currentProviderId = expense.provider?._id || expense.provider;
    providersHtml += res.data.providers.map(p =>
      `<option value="${p._id}" ${currentProviderId === p._id ? 'selected' : ''}>${p.name} (${CAT_LABELS[p.serviceType] || p.serviceType})</option>`
    ).join('');
  } catch { /* sin proveedores */ }

  const dateStr = expense.date ? expense.date.split('T')[0] : '';

  const existingAttachments = expense.attachments?.length
    ? `<div style="margin-bottom:.5rem">
        <p class="text-sm text-muted" style="margin-bottom:.3rem">Adjuntos actuales:</p>
        <div class="flex col gap-1">
          ${expense.attachments.map((a, i) => `
            <div class="flex between" style="align-items:center;gap:.5rem">
              <button class="btn btn-ghost btn-sm" style="font-size:.72rem;padding:.2rem .5rem;text-align:left"
                onclick="downloadExpenseAttachment('${expense._id}',${i},'${(a.filename || 'comprobante').replace(/'/g, "\\'")}')">
                📎 ${a.filename ? _truncate(a.filename, 30) : `Archivo ${i + 1}`}
              </button>
              <button class="btn btn-danger-ghost btn-sm" style="font-size:.7rem;padding:.15rem .4rem"
                onclick="deleteExpenseAttachment('${expense._id}',${i})">✕</button>
            </div>`).join('')}
        </div>
      </div>`
    : '';

  openModal('modal-edit-expense', `
    <h2 style="margin-bottom:1rem">Editar gasto</h2>
    <div class="flex col gap-2">
      <div>
        <label class="label">Descripción *</label>
        <input id="ee-desc" class="input" type="text" value="${expense.description.replace(/"/g, '&quot;')}">
      </div>
      <div class="flex gap-2">
        <div style="flex:1">
          <label class="label">Categoría *</label>
          <select id="ee-cat" class="input">
            ${Object.entries(CAT_LABELS).map(([v, l]) => `<option value="${v}" ${expense.category === v ? 'selected' : ''}>${l}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1">
          <label class="label">Importe *</label>
          <input id="ee-amount" class="input" type="number" min="0" step="0.01" value="${expense.amount}">
        </div>
      </div>
      <div class="flex gap-2">
        <div style="flex:1">
          <label class="label">Fecha *</label>
          <input id="ee-date" class="input" type="date" value="${dateStr}">
        </div>
        <div style="flex:1">
          <label class="label">Proveedor</label>
          <select id="ee-provider" class="input">${providersHtml}</select>
        </div>
      </div>
      <div>
        <label class="label">Método de pago</label>
        <select id="ee-method" class="input">
          <option value="">Sin especificar</option>
          ${Object.entries(PAY_LABELS).map(([v, l]) => `<option value="${v}" ${expense.paymentMethod === v ? 'selected' : ''}>${l}</option>`).join('')}
        </select>
      </div>
      <div>
        <label class="label">Tipo de gasto</label>
        <select id="ee-type" class="input" onchange="toggleExpChargeable('ee')">
          <option value="ordinary" ${expense.expenseType !== 'extraordinary' ? 'selected' : ''}>Ordinario</option>
          <option value="extraordinary" ${expense.expenseType === 'extraordinary' ? 'selected' : ''}>Extraordinario</option>
        </select>
      </div>
      <div id="ee-chargeable-wrap" ${expense.expenseType !== 'extraordinary' ? 'class="hidden"' : ''}>
        <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer">
          <input type="checkbox" id="ee-chargeable" ${expense.isChargeable ? 'checked' : ''} onchange="syncExpBillingWrap('ee')">
          <span class="text-sm">Cobrable a propietarios (aparece en pantalla de pago)</span>
        </label>
      </div>
      <div id="ee-billing-wrap" ${!expense.isChargeable ? 'class="hidden"' : 'class="flex col gap-2"'}>
        <div>
          <label class="label">Forma de cobro</label>
          <select id="ee-billing-mode" class="input" onchange="toggleBillingMode('ee')">
            <option value="fixed_total" ${(expense.extraordinaryBillingMode || 'fixed_total') === 'fixed_total' ? 'selected' : ''}>Monto total a repartir</option>
            <option value="per_unit" ${expense.extraordinaryBillingMode === 'per_unit' ? 'selected' : ''}>Monto por lote/unidad</option>
            <option value="by_coefficient" ${expense.extraordinaryBillingMode === 'by_coefficient' ? 'selected' : ''}>Según coeficiente</option>
          </select>
        </div>
        <div id="ee-unit-amount-wrap" ${expense.extraordinaryBillingMode !== 'per_unit' ? 'class="hidden"' : ''}>
          <label class="label">Monto por unidad *</label>
          <input id="ee-unit-amount" class="input" type="number" min="0.01" step="0.01" value="${expense.unitAmount || ''}" placeholder="0.00">
        </div>
      </div>
      <div>
        <label class="label">Agregar comprobantes</label>
        ${existingAttachments}
        <input id="ee-receipt" class="input" type="file" accept=".pdf,image/*" multiple>
        <p class="text-muted text-sm" style="margin-top:.2rem">Los archivos nuevos se agregan a los existentes.</p>
      </div>
      <div class="flex gap-2" style="margin-top:.5rem">
        <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-edit-expense')">Cancelar</button>
        <button id="btn-update-expense" class="btn btn-primary" style="flex:1" onclick="saveEditExpense('${id}')">Guardar</button>
      </div>
    </div>
  `);
}

export async function saveEditExpense(id) {
  const desc        = document.getElementById('ee-desc')?.value.trim();
  const cat         = document.getElementById('ee-cat')?.value;
  const amount      = parseFloat(document.getElementById('ee-amount')?.value);
  const date        = document.getElementById('ee-date')?.value;
  const provider    = document.getElementById('ee-provider')?.value;
  const method      = document.getElementById('ee-method')?.value;
  const expType     = document.getElementById('ee-type')?.value || 'ordinary';
  const isChargeable  = expType === 'extraordinary' && document.getElementById('ee-chargeable')?.checked;
  const billingMode   = isChargeable ? (document.getElementById('ee-billing-mode')?.value || 'fixed_total') : 'fixed_total';
  const isPerUnit     = isChargeable && billingMode === 'per_unit';
  const unitAmountVal = isPerUnit ? parseFloat(document.getElementById('ee-unit-amount')?.value || 0) : 0;
  const files         = document.getElementById('ee-receipt')?.files;

  if (!desc || !cat || !date) return toast('Completá los campos obligatorios.', 'warning');
  if (isPerUnit && !(unitAmountVal > 0)) return toast('El monto por unidad debe ser mayor a 0.', 'warning');
  if (!isPerUnit && !(amount > 0)) return toast('El importe debe ser mayor a 0.', 'warning');

  const btn = document.getElementById('btn-update-expense');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    let body;
    if (files?.length) {
      const fd = new FormData();
      fd.append('description', desc);
      fd.append('category', cat);
      fd.append('amount', isPerUnit ? 0 : amount);
      fd.append('date', date);
      if (provider) fd.append('provider', provider);
      if (method)   fd.append('paymentMethod', method);
      fd.append('expenseType', expType);
      fd.append('isChargeable', isChargeable);
      if (isChargeable) fd.append('extraordinaryBillingMode', billingMode);
      if (isPerUnit)    fd.append('unitAmount', unitAmountVal);
      Array.from(files).forEach(f => fd.append('attachments', f));
      body = fd;
    } else {
      body = { description: desc, category: cat, amount: isPerUnit ? 0 : amount, date, expenseType: expType, isChargeable,
               ...(provider && { provider }), ...(method && { paymentMethod: method }),
               ...(isChargeable && { extraordinaryBillingMode: billingMode }),
               ...(isPerUnit && { unitAmount: unitAmountVal }) };
    }

    await api.expenses.update(id, body);
    closeModal('modal-edit-expense');
    toast('Gasto actualizado.', 'success');
    await renderAdminExpenses();
  } catch (err) {
    toast(err.message || 'Error al guardar.', 'error');
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

// ── Toggle cobrable / billing mode (show/hide según tipo y modo) ─
export function toggleExpChargeable(prefix) {
  const type = document.getElementById(`${prefix}-type`)?.value;
  const isExtraordinary = type === 'extraordinary';
  document.getElementById(`${prefix}-chargeable-wrap`)
    ?.classList.toggle('hidden', !isExtraordinary);
  if (!isExtraordinary) {
    document.getElementById(`${prefix}-billing-wrap`)?.classList.add('hidden');
  } else {
    syncExpBillingWrap(prefix);
  }
}

export function syncExpBillingWrap(prefix) {
  const isChargeable = document.getElementById(`${prefix}-chargeable`)?.checked;
  const wrap = document.getElementById(`${prefix}-billing-wrap`);
  if (!wrap) return;
  if (isChargeable) {
    wrap.classList.remove('hidden');
    wrap.classList.add('flex', 'col', 'gap-2');
  } else {
    wrap.classList.add('hidden');
    wrap.classList.remove('flex', 'col', 'gap-2');
  }
  toggleBillingMode(prefix);
}

export function toggleBillingMode(prefix) {
  const mode = document.getElementById(`${prefix}-billing-mode`)?.value;
  document.getElementById(`${prefix}-unit-amount-wrap`)
    ?.classList.toggle('hidden', mode !== 'per_unit');
}

// ── Exponer globalmente ───────────────────────────────────────
window.renderAdminExpenses        = renderAdminExpenses;
window.toggleExpChargeable        = toggleExpChargeable;
window.syncExpBillingWrap         = syncExpBillingWrap;
window.toggleBillingMode          = toggleBillingMode;
window.openNewExpenseModal        = openNewExpenseModal;
window.saveNewExpense             = saveNewExpense;
window.markExpensePaid            = markExpensePaid;
window.confirmMarkPaid            = confirmMarkPaid;
window.deleteExpense              = deleteExpense;
window.confirmDeleteExpense       = confirmDeleteExpense;
window.openEditExpenseModal       = openEditExpenseModal;
window.saveEditExpense            = saveEditExpense;
window.downloadExpenseAttachment  = downloadExpenseAttachment;
window.deleteExpenseAttachment    = deleteExpenseAttachment;
window.expensesState              = expensesState;
window._renderExpensesView        = _renderExpensesView;
