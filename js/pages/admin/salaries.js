import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { errorState } from '../../ui/helpers.js';

const ROLE_LABELS = {
  security:    'Seguridad',
  cleaning:    'Limpieza',
  admin:       'Administración',
  maintenance: 'Mantenimiento',
  other:       'Otro',
};

const STATUS_LABELS = { pending: 'Pendiente', paid: 'Pagado', cancelled: 'Cancelado' };
const STATUS_BADGE  = { pending: 'badge-yellow', paid: 'badge-green', cancelled: 'badge-gray' };

const salState = { all: [], employees: [], filterPeriod: '', filterStatus: '' };

export async function renderAdminSalaries() {
  const el = document.getElementById('page-admin-salaries');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const [salRes, empRes] = await Promise.all([
      api.salaries.getAll({ limit: 200, ...(salState.filterPeriod && { period: salState.filterPeriod }), ...(salState.filterStatus && { status: salState.filterStatus }) }),
      api.employees.getAll({ isActive: 'true' }),
    ]);
    salState.all       = salRes.data.salaries;
    salState.employees = empRes.data.employees;
    _renderSalariesView();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminSalaries()');
  }
}

function _roleLabel(emp) {
  if (!emp) return '—';
  return emp.role === 'other' && emp.customRole ? emp.customRole : (ROLE_LABELS[emp.role] || emp.role);
}

function _renderSalariesView() {
  const el    = document.getElementById('page-admin-salaries');
  const items = salState.all;
  const totalPending = items.filter(s => s.status === 'pending').reduce((a, s) => a + s.totalAmount, 0);
  const totalPaid    = items.filter(s => s.status === 'paid').reduce((a, s) => a + s.totalAmount, 0);

  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between" style="align-items:center">
        <h1>Sueldos</h1>
        <button class="btn btn-primary btn-sm" onclick="openNewSalaryModal()">+ Nueva liquidación</button>
      </div>

      <div class="owners-filter-bar">
        <input class="input" type="month" value="${salState.filterPeriod}"
          oninput="salState.filterPeriod=this.value;renderAdminSalaries()" placeholder="Período">
        <select class="input" onchange="salState.filterStatus=this.value;renderAdminSalaries()">
          <option value="">Todos los estados</option>
          ${Object.entries(STATUS_LABELS).map(([v, l]) =>
            `<option value="${v}" ${salState.filterStatus === v ? 'selected' : ''}>${l}</option>`
          ).join('')}
        </select>
        ${salState.filterPeriod || salState.filterStatus
          ? `<button class="btn-clear-filter" onclick="salState.filterPeriod='';salState.filterStatus='';renderAdminSalaries()">✕ Limpiar</button>`
          : ''}
      </div>

      <div class="owners-meta flex gap-3">
        <span>${items.length} liquidación${items.length !== 1 ? 'es' : ''}</span>
        ${totalPending > 0 ? `<span>Pendiente: <strong>$${totalPending.toLocaleString('es-AR')}</strong></span>` : ''}
        ${totalPaid    > 0 ? `<span>Pagado: <strong>$${totalPaid.toLocaleString('es-AR')}</strong></span>` : ''}
      </div>

      ${items.length === 0
        ? '<p class="text-muted text-sm" style="padding:1rem 0">Sin liquidaciones registradas.</p>'
        : `<div class="table-wrap">
            <table class="table">
              <thead><tr>
                <th>Período</th><th>Empleado</th><th>Rol</th><th>Base</th><th>Extras</th><th>Desc.</th><th>Total</th><th>Estado</th><th></th>
              </tr></thead>
              <tbody>
                ${items.map(s => `
                  <tr>
                    <td>${s.period}</td>
                    <td><strong>${s.employee?.name || '—'}</strong></td>
                    <td>${_roleLabel(s.employee)}</td>
                    <td>$${s.baseAmount.toLocaleString('es-AR')}</td>
                    <td>${s.extraAmount ? '$' + s.extraAmount.toLocaleString('es-AR') : '—'}</td>
                    <td>${s.deductions  ? '$' + s.deductions.toLocaleString('es-AR')  : '—'}</td>
                    <td><strong>$${s.totalAmount.toLocaleString('es-AR')}</strong></td>
                    <td><span class="badge ${STATUS_BADGE[s.status]}">${STATUS_LABELS[s.status]}</span></td>
                    <td class="actions" style="white-space:nowrap">
                      ${s.status === 'pending' ? `
                        <button class="btn btn-sm btn-ghost" onclick="openEditSalaryModal('${s._id}')">Editar</button>
                        <button class="btn btn-sm btn-primary" onclick="confirmMarkSalaryPaid('${s._id}','${(s.employee?.name||'').replace(/'/g,"\\'")}')">Pagado</button>
                      ` : ''}
                      ${s.status !== 'cancelled' ? `
                        <button class="btn btn-sm btn-danger-ghost" onclick="confirmCancelSalary('${s._id}','${(s.employee?.name||'').replace(/'/g,"\\'")}','${s.period}')">Cancelar</button>
                      ` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
      }
    </div>`;
}

function _salaryFormBody(s = {}) {
  const employees = salState.employees;
  return `
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Empleado *</label>
        <select class="input" id="sal-employee">
          <option value="">— Seleccioná —</option>
          ${employees.map(e =>
            `<option value="${e._id}" ${s.employee?._id === e._id || s.employeeId === e._id ? 'selected' : ''}>${e.name} (${_roleLabel(e)})</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Período *</label>
        <input class="input" type="month" id="sal-period" value="${s.period || ''}">
      </div>
      <div class="form-group">
        <label>Monto base *</label>
        <input class="input" type="number" id="sal-base" min="0" step="0.01" value="${s.baseAmount ?? ''}" oninput="updateSalaryTotal()">
      </div>
      <div class="form-group">
        <label>Extras</label>
        <input class="input" type="number" id="sal-extra" min="0" step="0.01" value="${s.extraAmount ?? 0}" oninput="updateSalaryTotal()">
      </div>
      <div class="form-group">
        <label>Descuentos</label>
        <input class="input" type="number" id="sal-deductions" min="0" step="0.01" value="${s.deductions ?? 0}" oninput="updateSalaryTotal()">
      </div>
      <div class="form-group">
        <label>Total</label>
        <div class="input" id="sal-total" style="background:var(--surface-2);font-weight:600">
          $${((s.baseAmount || 0) + (s.extraAmount || 0) - (s.deductions || 0)).toLocaleString('es-AR')}
        </div>
      </div>
      <div class="form-group">
        <label>Método de pago</label>
        <select class="input" id="sal-method">
          <option value="">— Sin especificar —</option>
          <option value="cash"     ${s.paymentMethod === 'cash'     ? 'selected' : ''}>Efectivo</option>
          <option value="transfer" ${s.paymentMethod === 'transfer' ? 'selected' : ''}>Transferencia</option>
        </select>
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea class="input" id="sal-notes" rows="2">${s.notes || ''}</textarea>
      </div>
    </div>`;
}

window.updateSalaryTotal = function() {
  const base = parseFloat(document.getElementById('sal-base')?.value) || 0;
  const extra = parseFloat(document.getElementById('sal-extra')?.value) || 0;
  const ded   = parseFloat(document.getElementById('sal-deductions')?.value) || 0;
  const total = base + extra - ded;
  const el = document.getElementById('sal-total');
  if (el) el.textContent = '$' + (total < 0 ? 0 : total).toLocaleString('es-AR');
};

window.openNewSalaryModal = function() {
  openModal({
    title: 'Nueva liquidación',
    body:  _salaryFormBody(),
    footer: `<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
             <button class="btn btn-primary" id="btn-save-sal" onclick="saveNewSalary()">Guardar</button>`,
  });
};

window.saveNewSalary = async function() {
  const btn = document.getElementById('btn-save-sal');
  if (btn) btn.disabled = true;
  try {
    const data = _collectSalaryForm();
    if (!data) { if (btn) btn.disabled = false; return; }
    await api.salaries.create(data);
    toast('Liquidación creada correctamente.', 'success');
    closeModal();
    await renderAdminSalaries();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

window.openEditSalaryModal = function(id) {
  const s = salState.all.find(x => x._id === id);
  if (!s) return;
  openModal({
    title: 'Editar liquidación',
    body:  _salaryFormBody(s),
    footer: `<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
             <button class="btn btn-primary" id="btn-save-sal" onclick="saveEditSalary('${id}')">Guardar</button>`,
  });
};

window.saveEditSalary = async function(id) {
  const btn = document.getElementById('btn-save-sal');
  if (btn) btn.disabled = true;
  try {
    const data = _collectSalaryForm(true);
    if (!data) { if (btn) btn.disabled = false; return; }
    await api.salaries.update(id, data);
    toast('Liquidación actualizada.', 'success');
    closeModal();
    await renderAdminSalaries();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

window.confirmMarkSalaryPaid = function(id, name) {
  openModal({
    title: 'Marcar como pagado',
    body:  `<p>¿Confirmás marcar el sueldo de <strong>${name}</strong> como pagado?</p>
            <div class="form-group" style="margin-top:.75rem">
              <label>Fecha de pago</label>
              <input class="input" type="date" id="sal-pay-date" value="${new Date().toISOString().slice(0,10)}">
            </div>`,
    footer: `<button class="btn btn-ghost" onclick="closeModal()">Cancelar</button>
             <button class="btn btn-primary" id="btn-pay-sal" onclick="markSalaryPaid('${id}')">Confirmar</button>`,
  });
};

window.markSalaryPaid = async function(id) {
  const btn = document.getElementById('btn-pay-sal');
  if (btn) btn.disabled = true;
  try {
    const paymentDate = document.getElementById('sal-pay-date')?.value;
    await api.salaries.update(id, { status: 'paid', ...(paymentDate && { paymentDate }) });
    toast('Sueldo marcado como pagado.', 'success');
    closeModal();
    await renderAdminSalaries();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

window.confirmCancelSalary = function(id, name, period) {
  openModal({
    title: 'Cancelar liquidación',
    body:  `<p>¿Confirmás cancelar el sueldo de <strong>${name}</strong> (${period})? Esta acción no se puede deshacer.</p>`,
    footer: `<button class="btn btn-ghost" onclick="closeModal()">No cancelar</button>
             <button class="btn btn-danger" id="btn-cancel-sal" onclick="cancelSalary('${id}')">Sí, cancelar</button>`,
  });
};

window.cancelSalary = async function(id) {
  const btn = document.getElementById('btn-cancel-sal');
  if (btn) btn.disabled = true;
  try {
    await api.salaries.delete(id);
    toast('Liquidación cancelada.', 'success');
    closeModal();
    await renderAdminSalaries();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

function _collectSalaryForm(editMode = false) {
  const employeeId  = document.getElementById('sal-employee')?.value;
  const period      = document.getElementById('sal-period')?.value;
  const baseAmount  = parseFloat(document.getElementById('sal-base')?.value);
  const extraAmount = parseFloat(document.getElementById('sal-extra')?.value) || 0;
  const deductions  = parseFloat(document.getElementById('sal-deductions')?.value) || 0;
  const notes       = document.getElementById('sal-notes')?.value.trim();
  const paymentMethod = document.getElementById('sal-method')?.value || undefined;

  if (!editMode && !employeeId) { toast('Seleccioná un empleado.', 'error'); return null; }
  if (!period)                  { toast('El período es obligatorio.', 'error'); return null; }
  if (isNaN(baseAmount) || baseAmount < 0) { toast('El monto base debe ser un número positivo.', 'error'); return null; }
  if (baseAmount + extraAmount - deductions < 0) { toast('El total no puede ser negativo.', 'error'); return null; }

  const data = { period, baseAmount, extraAmount, deductions, notes: notes || undefined, paymentMethod };
  if (!editMode) data.employeeId = employeeId;
  return data;
}

window.salState          = salState;
window.renderAdminSalaries = renderAdminSalaries;
