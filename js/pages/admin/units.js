import { toast } from '../../ui/toast.js';
import { skeleton } from '../../ui/skeleton.js';
import { errorState, escapeHtml } from '../../ui/helpers.js';

let unitsState = { all: [], filter: '' };

function statusLabel(unit) {
  if (!unit.active) return '<span class="badge badge-danger">Inactiva</span>';
  if (unit.owner || unit.status === 'occupied') return '<span class="badge badge-success">Ocupada</span>';
  return '<span class="badge badge-warning">Disponible</span>';
}

function unitOwnerName(unit) {
  return unit.owner?.name || '';
}

function filteredUnits() {
  const q = unitsState.filter.trim().toLowerCase();
  if (!q) return unitsState.all;
  return unitsState.all.filter(u =>
    String(u.name || '').toLowerCase().includes(q) ||
    unitOwnerName(u).toLowerCase().includes(q)
  );
}

export async function renderAdminUnits() {
  const el = document.getElementById('page-admin-units');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;

  try {
    const res = await api.units.getAll();
    unitsState.all = (res.data.units || []).sort((a, b) =>
      String(a.name || '').localeCompare(String(b.name || ''), undefined, { numeric: true, sensitivity: 'base' })
    );
    renderUnitsView();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminUnits()');
  }
}

export function renderUnitsView() {
  const el = document.getElementById('page-admin-units');
  const units = filteredUnits();
  const occupied = unitsState.all.filter(u => u.owner || u.status === 'occupied').length;
  const available = unitsState.all.filter(u => !u.owner && u.status !== 'occupied').length;

  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between">
        <h1>Unidades</h1>
        <button class="btn btn-primary btn-sm" onclick="createUnitRange()">Crear rango</button>
      </div>

      <div class="card">
        <div class="card-body flex col gap-2">
          <div class="grid-2">
            <div class="form-group">
              <label>Cantidad</label>
              <input class="input" type="number" id="unit-range-count" min="1" max="1000" value="100">
            </div>
            <div class="form-group">
              <label>Desde</label>
              <input class="input" type="number" id="unit-range-start" min="0" value="1">
            </div>
          </div>
          <div class="form-group">
            <label>Prefijo</label>
            <input class="input" id="unit-range-prefix" value="Lote" placeholder="Dejá vacío para 1, 2, 3...">
          </div>
          <button class="btn btn-primary" id="unit-range-btn" onclick="createUnitRange()">Crear unidades</button>
        </div>
      </div>

      <div class="owners-filter-bar">
        <input id="units-filter" class="input" type="search" placeholder="Buscar unidad o propietario..."
          value="${escapeHtml(unitsState.filter)}"
          oninput="unitsState.filter=this.value;renderUnitsView()">
      </div>

      <div class="owners-meta">
        <span>${unitsState.all.length} unidad${unitsState.all.length !== 1 ? 'es' : ''}</span>
        <span>${occupied} ocupada${occupied !== 1 ? 's' : ''} · ${available} disponible${available !== 1 ? 's' : ''}</span>
      </div>

      <div class="card">
        <div class="card-body flex col" style="gap:0">
          ${units.length === 0
            ? '<p class="text-muted text-sm" style="padding:1rem;text-align:center">No se encontraron unidades.</p>'
            : units.map(u => `
              <div class="owner-row">
                <div class="owner-info">
                  <p class="name">${escapeHtml(u.name)}</p>
                  <p class="unit">${unitOwnerName(u) ? escapeHtml(unitOwnerName(u)) : 'Sin propietario'}</p>
                </div>
                <div class="flex col" style="align-items:flex-end;gap:.25rem">
                  ${statusLabel(u)}
                  <small>$${(u.finalFee || 0).toLocaleString('es-AR')}</small>
                  ${Number(u.balance || 0) < 0 ? `<small style="color:var(--danger)">Debe $${Math.abs(Number(u.balance || 0)).toLocaleString('es-AR')}</small>` : ''}
                </div>
              </div>`).join('')}
        </div>
      </div>
    </div>`;

  const input = document.getElementById('units-filter');
  if (input && document.activeElement?.id === 'units-filter') {
    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }
}

export async function createUnitRange() {
  const count = Number(document.getElementById('unit-range-count')?.value || 0);
  const start = Number(document.getElementById('unit-range-start')?.value || 1);
  const prefix = document.getElementById('unit-range-prefix')?.value ?? '';
  const btn = document.getElementById('unit-range-btn');

  if (!Number.isInteger(count) || count < 1 || count > 1000) {
    toast('La cantidad debe estar entre 1 y 1000.', 'warning');
    return;
  }
  if (!Number.isInteger(start) || start < 0) {
    toast('El número inicial no es válido.', 'warning');
    return;
  }

  try {
    if (btn) {
      btn.disabled = true;
      btn.textContent = 'Creando...';
    }
    const res = await api.units.bulkCreate({ count, start, prefix });
    const { created, skipped } = res.data;
    toast(`Unidades creadas: ${created}${skipped ? ` · omitidas: ${skipped}` : ''}`, skipped ? 'warning' : 'success');
    renderAdminUnits();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.textContent = 'Crear unidades';
    }
  }
}

window.renderAdminUnits = renderAdminUnits;
window.renderUnitsView = renderUnitsView;
window.unitsState = unitsState;
window.createUnitRange = createUnitRange;
