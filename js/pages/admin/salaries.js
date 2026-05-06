import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { errorState, escapeHtml } from '../../ui/helpers.js';

const ROLE_LABELS = {
  security: 'Seguridad',
  cleaning: 'Limpieza',
  admin: 'Administracion',
  maintenance: 'Mantenimiento',
  other: 'Otro',
};

const STATUS_LABELS = {
  pending: 'Pendiente',
  partially_paid: 'Parcialmente pagado',
  paid: 'Pagado',
  cancelled: 'Cancelado',
};

const STATUS_BADGE = {
  pending: 'badge-warning',
  partially_paid: 'badge-partial',
  paid: 'badge-success',
  cancelled: 'badge-neutral',
};

const PAYMENT_TYPE_LABELS = {
  advance: 'Adelanto',
  salary_payment: 'Pago de sueldo',
  adjustment: 'Ajuste',
};

const PAYMENT_METHOD_LABELS = {
  cash: 'Efectivo',
  transfer: 'Transferencia',
};

const salState = {
  all: [],
  employees: [],
  filterPeriod: '',
  filterStatus: '',
  openMovementsSalaryId: null,
};

export async function renderAdminSalaries() {
  const el = document.getElementById('page-admin-salaries');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const [salRes, empRes] = await Promise.all([
      api.salaries.getAll({
        limit: 200,
        ...(salState.filterPeriod && { period: salState.filterPeriod }),
        ...(salState.filterStatus && { status: salState.filterStatus }),
      }),
      api.employees.getAll({ isActive: 'true' }),
    ]);
    salState.all = salRes.data.salaries;
    salState.employees = empRes.data.employees;
    _renderSalariesView();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminSalaries()');
  }
}

function _roleLabel(emp) {
  if (!emp) return '-';
  return emp.role === 'other' && emp.customRole ? emp.customRole : (ROLE_LABELS[emp.role] || emp.role);
}

function _money(value) {
  return `$${Number(value || 0).toLocaleString('es-AR')}`;
}

function _dateLabel(value) {
  if (!value) return '-';
  return new Date(value).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function _salaryPaidAmount(salary) {
  if (salary.paidAmount !== undefined && salary.paidAmount !== null) return Number(salary.paidAmount) || 0;
  return salary.status === 'paid' ? Number(salary.totalAmount || 0) : 0;
}

function _salaryRemainingAmount(salary) {
  if (salary.remainingAmount !== undefined && salary.remainingAmount !== null) return Number(salary.remainingAmount) || 0;
  return salary.status === 'paid' ? 0 : Math.max(Number(salary.totalAmount || 0) - _salaryPaidAmount(salary), 0);
}

function _progressPct(salary) {
  const total = Number(salary.totalAmount || 0);
  if (total <= 0) return 0;
  return Math.min(100, Math.max(0, (_salaryPaidAmount(salary) / total) * 100));
}

function _salaryStatusBadge(status) {
  return `<span class="badge ${STATUS_BADGE[status] || 'badge-neutral'}">${STATUS_LABELS[status] || status}</span>`;
}

function _getSalary(id) {
  return salState.all.find(salary => salary._id === id);
}

function _renderSalariesView() {
  const el = document.getElementById('page-admin-salaries');
  const items = salState.all;
  const totalPending = items
    .filter(salary => salary.status === 'pending' || salary.status === 'partially_paid')
    .reduce((sum, salary) => sum + _salaryRemainingAmount(salary), 0);
  const totalPaid = items.reduce((sum, salary) => sum + _salaryPaidAmount(salary), 0);

  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between" style="align-items:center">
        <h1>Sueldos</h1>
        <button class="btn btn-primary btn-sm" onclick="openNewSalaryModal()">+ Nueva liquidacion</button>
      </div>

      <div class="owners-filter-bar">
        <input class="input" type="month" value="${escapeHtml(salState.filterPeriod)}"
          oninput="salState.filterPeriod=this.value;renderAdminSalaries()" placeholder="Periodo">
        <select class="input" onchange="salState.filterStatus=this.value;renderAdminSalaries()">
          <option value="">Todos los estados</option>
          ${Object.entries(STATUS_LABELS).map(([value, label]) =>
            `<option value="${value}" ${salState.filterStatus === value ? 'selected' : ''}>${label}</option>`
          ).join('')}
        </select>
        ${salState.filterPeriod || salState.filterStatus
          ? `<button class="btn-clear-filter" onclick="salState.filterPeriod='';salState.filterStatus='';renderAdminSalaries()">Limpiar</button>`
          : ''}
      </div>

      <div class="owners-meta flex gap-3">
        <span>${items.length} liquidacion${items.length !== 1 ? 'es' : ''}</span>
        ${totalPending > 0 ? `<span>Pendiente: <strong>${_money(totalPending)}</strong></span>` : ''}
        ${totalPaid > 0 ? `<span>Pagado: <strong>${_money(totalPaid)}</strong></span>` : ''}
      </div>

      ${items.length === 0
        ? '<p class="text-muted text-sm" style="padding:1rem 0">Sin liquidaciones registradas.</p>'
        : `<div class="table-wrap">
            <table class="table">
              <thead><tr>
                <th>Periodo</th><th>Empleado</th><th>Rol</th><th>Total</th><th>Pagado</th><th>Pendiente</th><th>Estado</th><th></th>
              </tr></thead>
              <tbody>
                ${items.map(salary => {
                  const canPay = salary.status !== 'paid' && salary.status !== 'cancelled' && _salaryRemainingAmount(salary) > 0;
                  const canEdit = salary.status !== 'paid' && salary.status !== 'cancelled';
                  return `
                    <tr>
                      <td>${escapeHtml(salary.period)}</td>
                      <td><strong>${escapeHtml(salary.employee?.name || '-')}</strong></td>
                      <td>${escapeHtml(_roleLabel(salary.employee))}</td>
                      <td>
                        <strong>${_money(salary.totalAmount)}</strong>
                        <div class="salary-progress" aria-hidden="true"><span style="width:${_progressPct(salary)}%"></span></div>
                      </td>
                      <td>${_money(_salaryPaidAmount(salary))}</td>
                      <td>${_money(_salaryRemainingAmount(salary))}</td>
                      <td>${_salaryStatusBadge(salary.status)}</td>
                      <td class="actions salary-actions">
                        ${canEdit ? `<button class="btn btn-sm btn-ghost" onclick="openEditSalaryModal('${salary._id}')">Editar</button>` : ''}
                        ${canPay ? `<button class="btn btn-sm btn-secondary" onclick="openSalaryPaymentModal('${salary._id}','advance')">Adelanto</button>` : ''}
                        ${canPay ? `<button class="btn btn-sm btn-primary" onclick="openSalaryPaymentModal('${salary._id}','salary_payment')">Registrar pago</button>` : ''}
                        <button class="btn btn-sm btn-ghost" onclick="openSalaryMovementsModal('${salary._id}')">Movimientos</button>
                        ${salary.status !== 'cancelled' ? `<button class="btn btn-sm btn-danger" onclick="confirmCancelSalary('${salary._id}')">Cancelar</button>` : ''}
                      </td>
                    </tr>`;
                }).join('')}
              </tbody>
            </table>
          </div>`}
    </div>`;
}

function _salaryFormBody(salary = {}) {
  return `
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Empleado *</label>
        <select class="input" id="sal-employee" ${salary._id ? 'disabled' : ''}>
          <option value="">Selecciona</option>
          ${salState.employees.map(employee =>
            `<option value="${employee._id}" ${salary.employee?._id === employee._id || salary.employeeId === employee._id ? 'selected' : ''}>${escapeHtml(employee.name)} (${escapeHtml(_roleLabel(employee))})</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Periodo *</label>
        <input class="input" type="month" id="sal-period" value="${escapeHtml(salary.period || '')}">
      </div>
      <div class="form-group">
        <label>Monto base *</label>
        <input class="input" type="number" id="sal-base" min="0" step="0.01" value="${salary.baseAmount ?? ''}" oninput="updateSalaryTotal()">
      </div>
      <div class="form-group">
        <label>Extras</label>
        <input class="input" type="number" id="sal-extra" min="0" step="0.01" value="${salary.extraAmount ?? 0}" oninput="updateSalaryTotal()">
      </div>
      <div class="form-group">
        <label>Descuentos</label>
        <input class="input" type="number" id="sal-deductions" min="0" step="0.01" value="${salary.deductions ?? 0}" oninput="updateSalaryTotal()">
      </div>
      <div class="form-group">
        <label>Total</label>
        <div class="input" id="sal-total" style="background:var(--surface-2);font-weight:600">
          ${_money((salary.baseAmount || 0) + (salary.extraAmount || 0) - (salary.deductions || 0))}
        </div>
      </div>
      ${salary._id ? `<p class="text-sm text-muted">Pagado: ${_money(_salaryPaidAmount(salary))}. No se puede guardar un total menor a ese importe.</p>` : ''}
      <div class="form-group">
        <label>Metodo de pago</label>
        <select class="input" id="sal-method">
          <option value="">Sin especificar</option>
          <option value="cash" ${salary.paymentMethod === 'cash' ? 'selected' : ''}>Efectivo</option>
          <option value="transfer" ${salary.paymentMethod === 'transfer' ? 'selected' : ''}>Transferencia</option>
        </select>
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea class="input" id="sal-notes" rows="2">${escapeHtml(salary.notes || '')}</textarea>
      </div>
    </div>`;
}

window.updateSalaryTotal = function() {
  const base = parseFloat(document.getElementById('sal-base')?.value) || 0;
  const extra = parseFloat(document.getElementById('sal-extra')?.value) || 0;
  const deductions = parseFloat(document.getElementById('sal-deductions')?.value) || 0;
  const total = base + extra - deductions;
  const el = document.getElementById('sal-total');
  if (el) el.textContent = _money(total < 0 ? 0 : total);
};

window.openNewSalaryModal = function() {
  openModal(`
    <h2 style="margin-bottom:1rem">Nueva liquidacion</h2>
    ${_salaryFormBody()}
    <div class="flex gap-2" style="margin-top:.5rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-sal" style="flex:1" onclick="saveNewSalary()">Guardar</button>
    </div>
  `);
};

window.saveNewSalary = async function() {
  const btn = document.getElementById('btn-save-sal');
  if (btn) btn.disabled = true;
  try {
    const data = _collectSalaryForm();
    if (!data) { if (btn) btn.disabled = false; return; }
    await api.salaries.create(data);
    toast('Liquidacion creada correctamente.', 'success');
    closeModal();
    await renderAdminSalaries();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

window.openEditSalaryModal = function(id) {
  const salary = _getSalary(id);
  if (!salary) return;
  openModal(`
    <h2 style="margin-bottom:1rem">Editar liquidacion</h2>
    ${_salaryFormBody(salary)}
    <div class="flex gap-2" style="margin-top:.5rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-sal" style="flex:1" onclick="saveEditSalary('${id}')">Guardar</button>
    </div>
  `);
};

window.saveEditSalary = async function(id) {
  const btn = document.getElementById('btn-save-sal');
  if (btn) btn.disabled = true;
  try {
    const data = _collectSalaryForm(true);
    if (!data) { if (btn) btn.disabled = false; return; }
    await api.salaries.update(id, data);
    toast('Liquidacion actualizada.', 'success');
    closeModal();
    await renderAdminSalaries();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

window.openSalaryPaymentModal = function(id, type = 'salary_payment') {
  const salary = _getSalary(id);
  if (!salary) return;
  if (salary.status === 'paid') return toast('El sueldo ya esta pagado.', 'warning');
  if (salary.status === 'cancelled') return toast('No se puede registrar un pago sobre un sueldo cancelado.', 'warning');

  const remaining = _salaryRemainingAmount(salary);
  openModal(`
    <h2 style="margin-bottom:1rem">Registrar pago de sueldo</h2>
    <div class="salary-summary">
      <div><span>Empleado</span><strong>${escapeHtml(salary.employee?.name || '-')}</strong></div>
      <div><span>Periodo</span><strong>${escapeHtml(salary.period)}</strong></div>
      <div><span>Total</span><strong>${_money(salary.totalAmount)}</strong></div>
      <div><span>Pendiente</span><strong>${_money(remaining)}</strong></div>
    </div>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Tipo *</label>
        <select class="input" id="sal-pay-type">
          <option value="advance" ${type === 'advance' ? 'selected' : ''}>Adelanto</option>
          <option value="salary_payment" ${type === 'salary_payment' ? 'selected' : ''}>Pago de sueldo</option>
        </select>
      </div>
      <div class="form-group">
        <label>Monto *</label>
        <input class="input" type="number" id="sal-pay-amount" min="0.01" step="0.01" max="${remaining}" value="${type === 'salary_payment' ? remaining : ''}">
      </div>
      <div class="form-group">
        <label>Fecha de pago</label>
        <input class="input" type="date" id="sal-pay-date" value="${new Date().toISOString().slice(0, 10)}">
      </div>
      <div class="form-group">
        <label>Metodo *</label>
        <select class="input" id="sal-pay-method">
          <option value="">Selecciona</option>
          <option value="cash">Efectivo</option>
          <option value="transfer">Transferencia</option>
        </select>
      </div>
      <div class="form-group">
        <label>Nota</label>
        <textarea class="input" id="sal-pay-note" rows="2" maxlength="500"></textarea>
      </div>
      <p class="text-sm text-muted">El adelanto se descontara del saldo pendiente del sueldo del periodo.</p>
    </div>
    <div class="flex gap-2" style="margin-top:.75rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-sal-payment" style="flex:1" onclick="saveSalaryPayment('${id}')">Guardar</button>
    </div>
  `);
};

window.saveSalaryPayment = async function(id) {
  const salary = _getSalary(id);
  if (!salary) return;

  const btn = document.getElementById('btn-save-sal-payment');
  if (btn) btn.disabled = true;
  try {
    const amount = parseFloat(document.getElementById('sal-pay-amount')?.value);
    const type = document.getElementById('sal-pay-type')?.value;
    const paymentDate = document.getElementById('sal-pay-date')?.value;
    const paymentMethod = document.getElementById('sal-pay-method')?.value;
    const note = document.getElementById('sal-pay-note')?.value.trim();
    const remaining = _salaryRemainingAmount(salary);

    if (!(amount > 0)) throw new Error('El monto debe ser mayor a cero.');
    if (amount > remaining) throw new Error('El monto ingresado supera el saldo pendiente del sueldo.');
    if (!paymentMethod) throw new Error('Selecciona el metodo de pago.');

    await api.salaryPayments.create({
      salary: id,
      type,
      amount,
      paymentDate,
      paymentMethod,
      note: note || undefined,
    });

    toast('Pago registrado correctamente.', 'success');
    closeModal();
    await renderAdminSalaries();
    if (salState.openMovementsSalaryId === id) await openSalaryMovementsModal(id);
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

window.openSalaryMovementsModal = async function(id) {
  const salary = _getSalary(id);
  if (!salary) return;
  salState.openMovementsSalaryId = id;
  openModal(`<h2 style="margin-bottom:1rem">Movimientos de sueldo</h2>${skeleton(3)}`);
  try {
    const res = await api.salaryPayments.getAll({ salary: id });
    const movements = res.data.salaryPayments || [];
    document.getElementById('modal').innerHTML = _movementsModalBody(salary, movements);
  } catch (err) {
    document.getElementById('modal').innerHTML = `<h2 style="margin-bottom:1rem">Movimientos de sueldo</h2><p style="color:var(--danger)">${escapeHtml(err.message)}</p>`;
  }
};

function _movementsModalBody(salary, movements) {
  return `
    <h2 style="margin-bottom:1rem">Movimientos de sueldo</h2>
    <div class="salary-summary">
      <div><span>Empleado</span><strong>${escapeHtml(salary.employee?.name || '-')}</strong></div>
      <div><span>Periodo</span><strong>${escapeHtml(salary.period)}</strong></div>
      <div><span>Total sueldo</span><strong>${_money(salary.totalAmount)}</strong></div>
      <div><span>Total pagado</span><strong>${_money(_salaryPaidAmount(salary))}</strong></div>
      <div><span>Pendiente</span><strong>${_money(_salaryRemainingAmount(salary))}</strong></div>
    </div>
    ${movements.length === 0
      ? '<p class="text-muted text-sm" style="padding:.75rem 0">Sin movimientos registrados.</p>'
      : `<div class="salary-payment-list">
          ${movements.map(payment => `
            <div class="salary-payment-item">
              <div>
                <strong>${_dateLabel(payment.paymentDate)} - ${escapeHtml(payment.typeLabel || PAYMENT_TYPE_LABELS[payment.type] || payment.type)}</strong>
                <span>${escapeHtml(payment.paymentMethodLabel || PAYMENT_METHOD_LABELS[payment.paymentMethod] || payment.paymentMethod)}${payment.note ? ` - ${escapeHtml(payment.note)}` : ''}</span>
              </div>
              <div class="salary-payment-item-side">
                <strong>${_money(payment.amount)}</strong>
                <button class="btn btn-sm btn-danger" onclick="deleteSalaryPayment('${payment._id}','${salary._id}')">Eliminar</button>
              </div>
            </div>
          `).join('')}
        </div>`}
    <div class="flex gap-2" style="margin-top:.75rem">
      <button class="btn btn-ghost" style="flex:1" onclick="salState.openMovementsSalaryId=null;closeModal()">Cerrar</button>
      ${salary.status !== 'paid' && salary.status !== 'cancelled'
        ? `<button class="btn btn-primary" style="flex:1" onclick="openSalaryPaymentModal('${salary._id}','salary_payment')">Registrar pago</button>`
        : ''}
    </div>`;
}

window.deleteSalaryPayment = async function(paymentId, salaryId) {
  if (!confirm('¿Eliminar este movimiento?')) return;
  try {
    await api.salaryPayments.delete(paymentId);
    toast('Movimiento eliminado correctamente.', 'success');
    await renderAdminSalaries();
    await openSalaryMovementsModal(salaryId);
  } catch (err) {
    toast(err.message, 'error');
  }
};

window.confirmCancelSalary = function(id) {
  const salary = _getSalary(id);
  if (!salary) return;
  openModal(`
    <h2 style="margin-bottom:1rem">Cancelar liquidacion</h2>
    <p>¿Confirmas cancelar el sueldo de <strong>${escapeHtml(salary.employee?.name || '-')}</strong> (${escapeHtml(salary.period)})? Los movimientos registrados se conservaran como historial.</p>
    <div class="flex gap-2" style="margin-top:.75rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">No cancelar</button>
      <button class="btn btn-danger" id="btn-cancel-sal" style="flex:1" onclick="cancelSalary('${id}')">Si, cancelar</button>
    </div>
  `);
};

window.cancelSalary = async function(id) {
  const btn = document.getElementById('btn-cancel-sal');
  if (btn) btn.disabled = true;
  try {
    await api.salaries.delete(id);
    toast('Liquidacion cancelada.', 'success');
    closeModal();
    await renderAdminSalaries();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

function _collectSalaryForm(editMode = false) {
  const employeeId = document.getElementById('sal-employee')?.value;
  const period = document.getElementById('sal-period')?.value;
  const baseAmount = parseFloat(document.getElementById('sal-base')?.value);
  const extraAmount = parseFloat(document.getElementById('sal-extra')?.value) || 0;
  const deductions = parseFloat(document.getElementById('sal-deductions')?.value) || 0;
  const notes = document.getElementById('sal-notes')?.value.trim();
  const paymentMethod = document.getElementById('sal-method')?.value || undefined;

  if (!editMode && !employeeId) { toast('Selecciona un empleado.', 'error'); return null; }
  if (!period) { toast('El periodo es obligatorio.', 'error'); return null; }
  if (isNaN(baseAmount) || baseAmount < 0) { toast('El monto base debe ser un numero positivo.', 'error'); return null; }
  if (baseAmount + extraAmount - deductions < 0) { toast('El total no puede ser negativo.', 'error'); return null; }

  const data = { period, baseAmount, extraAmount, deductions, notes: notes || undefined, paymentMethod };
  if (!editMode) data.employeeId = employeeId;
  return data;
}

window.salState = salState;
window.renderAdminSalaries = renderAdminSalaries;
