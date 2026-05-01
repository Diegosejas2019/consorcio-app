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

const empState = { all: [], filterRole: '', filterActive: 'true' };

export async function renderAdminEmployees() {
  const el = document.getElementById('page-admin-employees');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const params = {};
    if (empState.filterRole)   params.role     = empState.filterRole;
    if (empState.filterActive) params.isActive = empState.filterActive;

    const res = await api.employees.getAll(params);
    empState.all = res.data.employees;
    _renderEmployeesView();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminEmployees()');
  }
}

function _renderEmployeesView() {
  const el    = document.getElementById('page-admin-employees');
  const items = empState.all;

  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between" style="align-items:center">
        <h1>Empleados</h1>
        <button class="btn btn-primary btn-sm" onclick="openNewEmployeeModal()">+ Nuevo empleado</button>
      </div>

      <div class="owners-filter-bar">
        <select class="input" onchange="empState.filterRole=this.value;renderAdminEmployees()">
          <option value="">Todos los roles</option>
          ${Object.entries(ROLE_LABELS).map(([v, l]) =>
            `<option value="${v}" ${empState.filterRole === v ? 'selected' : ''}>${l}</option>`
          ).join('')}
        </select>
        <select class="input" onchange="empState.filterActive=this.value;renderAdminEmployees()">
          <option value="true"  ${empState.filterActive === 'true'  ? 'selected' : ''}>Activos</option>
          <option value="false" ${empState.filterActive === 'false' ? 'selected' : ''}>Dados de baja</option>
          <option value=""      ${empState.filterActive === ''      ? 'selected' : ''}>Todos</option>
        </select>
      </div>

      <div class="owners-meta"><span>${items.length} empleado${items.length !== 1 ? 's' : ''}</span></div>

      ${items.length === 0
        ? '<p class="text-muted text-sm" style="padding:1rem 0">Sin empleados registrados.</p>'
        : `<div class="table-wrap">
            <table class="table">
              <thead><tr>
                <th>Nombre</th><th>Rol</th><th>DNI</th><th>Teléfono</th><th>Inicio</th><th>Estado</th><th></th>
              </tr></thead>
              <tbody>
                ${items.map(e => `
                  <tr>
                    <td><strong>${e.name}</strong></td>
                    <td>${e.role === 'other' && e.customRole ? e.customRole : (ROLE_LABELS[e.role] || e.role)}</td>
                    <td>${e.documentNumber || '—'}</td>
                    <td>${e.phone || '—'}</td>
                    <td>${e.startDate ? new Date(e.startDate).toLocaleDateString('es-AR') : '—'}</td>
                    <td><span class="badge ${e.isActive ? 'badge-green' : 'badge-gray'}">${e.isActive ? 'Activo' : 'Baja'}</span></td>
                    <td class="actions">
                      <button class="btn btn-sm btn-ghost" onclick="openEditEmployeeModal('${e._id}')">Editar</button>
                      ${e.isActive ? `<button class="btn btn-sm btn-danger-ghost" onclick="confirmDeactivateEmployee('${e._id}','${e.name.replace(/'/g,"\\'")}')">Dar de baja</button>` : ''}
                    </td>
                  </tr>
                `).join('')}
              </tbody>
            </table>
          </div>`
      }
    </div>`;
}

function _employeeForm(e = {}) {
  return `
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Nombre *</label>
        <input class="input" id="emp-name" value="${e.name || ''}" placeholder="Nombre completo">
      </div>
      <div class="form-group">
        <label>Rol *</label>
        <select class="input" id="emp-role" onchange="toggleCustomRole()">
          ${Object.entries(ROLE_LABELS).map(([v, l]) =>
            `<option value="${v}" ${(e.role || '') === v ? 'selected' : ''}>${l}</option>`
          ).join('')}
        </select>
      </div>
      <div class="form-group" id="custom-role-group" style="display:${(e.role === 'other') ? 'block' : 'none'}">
        <label>Rol personalizado</label>
        <input class="input" id="emp-custom-role" value="${e.customRole || ''}" placeholder="Ej: Jardinero">
      </div>
      <div class="form-group">
        <label>DNI</label>
        <input class="input" id="emp-doc" value="${e.documentNumber || ''}" placeholder="Número de documento">
      </div>
      <div class="form-group">
        <label>Teléfono</label>
        <input class="input" id="emp-phone" value="${e.phone || ''}" placeholder="Teléfono de contacto">
      </div>
      <div class="form-group">
        <label>Email</label>
        <input class="input" type="email" id="emp-email" value="${e.email || ''}" placeholder="email@ejemplo.com">
      </div>
      <div class="form-group">
        <label>Fecha de inicio</label>
        <input class="input" type="date" id="emp-start" value="${e.startDate ? e.startDate.slice(0,10) : ''}">
      </div>
      <div class="form-group">
        <label>Notas</label>
        <textarea class="input" id="emp-notes" rows="2" placeholder="Observaciones opcionales">${e.notes || ''}</textarea>
      </div>
    </div>`;
}

window.toggleCustomRole = function() {
  const role = document.getElementById('emp-role')?.value;
  const grp  = document.getElementById('custom-role-group');
  if (grp) grp.style.display = role === 'other' ? 'block' : 'none';
};

window.openNewEmployeeModal = function() {
  openModal(`
    <h2 style="margin-bottom:1rem">Nuevo empleado</h2>
    ${_employeeForm()}
    <div class="flex gap-2" style="margin-top:.5rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-emp" style="flex:1" onclick="saveNewEmployee()">Guardar</button>
    </div>
  `);
};

window.saveNewEmployee = async function() {
  const btn = document.getElementById('btn-save-emp');
  if (btn) btn.disabled = true;
  try {
    const data = _collectForm();
    if (!data) { if (btn) btn.disabled = false; return; }
    await api.employees.create(data);
    toast('Empleado creado correctamente.', 'success');
    closeModal();
    await renderAdminEmployees();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

window.openEditEmployeeModal = function(id) {
  const e = empState.all.find(x => x._id === id);
  if (!e) return;
  openModal(`
    <h2 style="margin-bottom:1rem">Editar empleado</h2>
    ${_employeeForm(e)}
    <div class="flex gap-2" style="margin-top:.5rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-emp" style="flex:1" onclick="saveEditEmployee('${id}')">Guardar</button>
    </div>
  `);
};

window.saveEditEmployee = async function(id) {
  const btn = document.getElementById('btn-save-emp');
  if (btn) btn.disabled = true;
  try {
    const data = _collectForm();
    if (!data) { if (btn) btn.disabled = false; return; }
    await api.employees.update(id, data);
    toast('Empleado actualizado.', 'success');
    closeModal();
    await renderAdminEmployees();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

window.confirmDeactivateEmployee = function(id, name) {
  openModal(`
    <h2 style="margin-bottom:1rem">Dar de baja empleado</h2>
    <p>¿Confirmás dar de baja a <strong>${name}</strong>? Esta acción se puede revertir editando el empleado.</p>
    <div class="flex gap-2" style="margin-top:.5rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger" id="btn-deact-emp" style="flex:1" onclick="deactivateEmployee('${id}')">Dar de baja</button>
    </div>
  `);
};

window.deactivateEmployee = async function(id) {
  const btn = document.getElementById('btn-deact-emp');
  if (btn) btn.disabled = true;
  try {
    await api.employees.delete(id);
    toast('Empleado dado de baja.', 'success');
    closeModal();
    await renderAdminEmployees();
  } catch (err) {
    toast(err.message, 'error');
    if (btn) btn.disabled = false;
  }
};

function _collectForm() {
  const name = document.getElementById('emp-name')?.value.trim();
  const role = document.getElementById('emp-role')?.value;
  if (!name) { toast('El nombre es obligatorio.', 'error'); return null; }
  if (!role) { toast('El rol es obligatorio.', 'error');    return null; }
  return {
    name,
    role,
    customRole:     document.getElementById('emp-custom-role')?.value.trim() || undefined,
    documentNumber: document.getElementById('emp-doc')?.value.trim()          || undefined,
    phone:          document.getElementById('emp-phone')?.value.trim()         || undefined,
    email:          document.getElementById('emp-email')?.value.trim()         || undefined,
    startDate:      document.getElementById('emp-start')?.value                || undefined,
    notes:          document.getElementById('emp-notes')?.value.trim()         || undefined,
  };
}

window.empState         = empState;
window.renderAdminEmployees = renderAdminEmployees;
