import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { formatDate, errorState } from '../../ui/helpers.js';

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
                <td>${e.description}</td>
                <td><span class="badge badge-info">${CAT_LABELS[e.category] || e.category}</span></td>
                <td>${e.provider ? e.provider.name : '<span class="text-muted">—</span>'}</td>
                <td style="font-weight:600">$${e.amount.toLocaleString('es-AR')}</td>
                <td>${e.status === 'paid'
                  ? `<span class="badge badge-success">✓ Pagado</span>`
                  : `<span class="badge badge-warning">⏳ Pendiente</span>`}
                </td>
                <td>
                  <div class="flex gap-1">
                    ${e.status === 'pending' ? `<button class="btn btn-sm btn-ghost" onclick="markExpensePaid('${e._id}')">Marcar pagado</button>` : ''}
                    ${e.receipt?.url ? `<a class="btn btn-sm btn-ghost" href="${e.receipt.url}" target="_blank">Ver comprobante</a>` : ''}
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
          <input id="exp-amount" class="input" type="number" min="0.01" step="0.01" placeholder="0.00">
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
        <label class="label">Comprobante (PDF o imagen)</label>
        <input id="exp-receipt" class="input" type="file" accept=".pdf,image/*">
      </div>
      <div class="flex gap-2" style="margin-top:.5rem">
        <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-new-expense')">Cancelar</button>
        <button id="btn-save-expense" class="btn btn-primary" style="flex:1" onclick="saveNewExpense()">Guardar</button>
      </div>
    </div>
  `);
}

export async function saveNewExpense() {
  const desc     = document.getElementById('exp-desc')?.value.trim();
  const cat      = document.getElementById('exp-cat')?.value;
  const amount   = parseFloat(document.getElementById('exp-amount')?.value);
  const date     = document.getElementById('exp-date')?.value;
  const provider = document.getElementById('exp-provider')?.value;
  const method   = document.getElementById('exp-method')?.value;
  const file     = document.getElementById('exp-receipt')?.files[0];

  if (!desc || !cat || !amount || !date) {
    return toast('Completá los campos obligatorios.', 'warning');
  }

  const btn = document.getElementById('btn-save-expense');
  btn.disabled = true; btn.textContent = 'Guardando…';

  try {
    let body;
    if (file) {
      const fd = new FormData();
      fd.append('description', desc);
      fd.append('category', cat);
      fd.append('amount', amount);
      fd.append('date', date);
      if (provider)  fd.append('provider', provider);
      if (method)    fd.append('paymentMethod', method);
      fd.append('receipt', file);
      body = fd;
    } else {
      body = { description: desc, category: cat, amount, date,
               ...(provider && { provider }), ...(method && { paymentMethod: method }) };
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

// ── Exponer globalmente ───────────────────────────────────────
window.renderAdminExpenses   = renderAdminExpenses;
window.openNewExpenseModal   = openNewExpenseModal;
window.saveNewExpense        = saveNewExpense;
window.markExpensePaid       = markExpensePaid;
window.confirmMarkPaid       = confirmMarkPaid;
window.deleteExpense         = deleteExpense;
window.confirmDeleteExpense  = confirmDeleteExpense;
window.expensesState         = expensesState;
window._renderExpensesView   = _renderExpensesView;
