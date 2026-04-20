import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { showLoading } from '../../ui/loading.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { formatMonth, statusBadge, errorState, downloadReceipt, debounce } from '../../ui/helpers.js';
import { cache } from '../../core/state.js';

// ── Estado de la vista ────────────────────────────────────────
export const ownersListState = { all: [], page: 1, perPage: 10, filterName: '', filterUnit: '' };
export const _debouncedOwnerFilter = debounce(() => { ownersListState.page = 1; _renderOwnersView(); }, 350);

let _newOwnerCfg   = null;
let _ownerDetailCfg = null;

function _calcDebt(months, cfg) {
  if (!cfg || months <= 0) return { total: 0, surcharge: 0 };
  const fee       = cfg.expenseAmount || 0;
  const surcharge = cfg.isOverdue ? (cfg.surcharge || 0) : 0;
  return { total: months * fee + surcharge, surcharge };
}

export async function renderOwnersList() {
  const el = document.getElementById('page-admin-owners');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const res = await api.owners.getAll({ limit: 500 });
    ownersListState.all  = res.data.owners;
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
    const matchUnit = !unit || (o.unit || '').toLowerCase().includes(unit);
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
                  <p class="unit">${_highlightMatch(o.unit || '—', ownersListState.filterUnit)}${o.phone ? ` · ${o.phone}` : ''}</p>
                </div>
                <div class="flex col" style="align-items:flex-end;gap:.25rem">
                  <span class="badge ${o.isDebtor ? 'badge-danger' : 'badge-success'}">${o.isDebtor ? 'Deuda' : 'Al día'}</span>
                  ${o.lastPayment ? `<small>${formatMonth(o.lastPayment.month)}</small>` : '<small class="text-muted">Sin pagos</small>'}
                </div>
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
  if (!query || !text) return text;
  const escaped = query.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return text.replace(new RegExp(`(${escaped})`, 'gi'),
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
    const res      = await api.owners.getOne(ownerId);
    const owner    = res.data.owner;
    const payments = res.data.payments || [];
    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      <div class="flex between" style="margin-bottom:1.25rem">
        <div>
          <h2>${owner.name}</h2>
          <small>${[owner.unit, owner.phone, owner.email].filter(Boolean).join(' · ')}</small>
        </div>
        <span class="badge ${owner.isDebtor ? 'badge-danger' : 'badge-success'}">${owner.isDebtor ? 'Deudor' : 'Al día'}</span>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:.75rem;margin-bottom:1rem" class="flex between">
        <span class="text-sm text-muted">Saldo</span>
        <span class="bold" style="color:${(owner.balance || 0) < 0 ? 'var(--danger)' : 'var(--success)'}">
          ${(owner.balance || 0) < 0 ? '-' : ''}$${Math.abs(owner.balance || 0).toLocaleString('es-AR')}
        </span>
      </div>
      <h3 style="margin-bottom:.75rem">Historial de Pagos</h3>
      ${payments.length === 0
        ? '<p class="text-muted text-sm">Sin pagos registrados.</p>'
        : `<div class="table-wrap"><table>
            <thead><tr><th>Período</th><th>Importe</th><th>Estado</th><th></th></tr></thead>
            <tbody>${payments.map(p => `
              <tr>
                <td>${formatMonth(p.month)}</td>
                <td>$${p.amount.toLocaleString('es-AR')}</td>
                <td>${statusBadge(p.status)}</td>
                <td>${p.receipt?.url ? `<button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" title="Descargar comprobante" style="padding:.3rem .5rem">${SVG.download}</button>` : ''}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`}
      <div class="flex gap-1 mt-3" style="flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
        <button class="btn btn-ghost" onclick="openEditOwnerModal('${owner._id}', '${owner.name.replace(/'/g, "\\'")}', '${owner.unit || ''}', '${owner.phone || ''}')">Editar</button>
        <button class="btn btn-ghost" onclick="openNotifyOwnerModal('${owner._id}', '${owner.name.replace(/'/g, "\\'")}')">Notificar</button>
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
export function openEditOwnerModal(id, name, unit, phone) {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Editar Propietario</h2>
    <div class="flex col gap-2">
      <div class="form-group"><label>Nombre completo</label><input class="input" id="eo-name" value="${name}"></div>
      <div class="form-group"><label>Unidad (lote/casa)</label><input class="input" id="eo-unit" value="${unit}" placeholder="Lote 12"></div>
      <div class="form-group"><label>Teléfono</label><input class="input" type="tel" id="eo-phone" value="${phone}" placeholder="1122334455"></div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="viewOwnerDetail('${id}')">Cancelar</button>
        <button class="btn btn-primary w-full" data-requires-network onclick="saveEditOwner('${id}')">Guardar</button>
      </div>
    </div>`;
  openModal();
}

export async function saveEditOwner(id) {
  const name  = document.getElementById('eo-name')?.value.trim();
  const unit  = document.getElementById('eo-unit')?.value.trim();
  const phone = document.getElementById('eo-phone')?.value.trim();
  if (!name) { toast('El nombre es obligatorio', 'error'); return; }
  try {
    await api.owners.update(id, { name, unit, phone });
    toast('Propietario actualizado', 'success');
    viewOwnerDetail(id);
    renderOwnersList();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Nuevo propietario ─────────────────────────────────────────
export async function openNewOwnerModal() {
  _newOwnerCfg = cache.get('config');
  if (!_newOwnerCfg) {
    try {
      const res = await api.config.get();
      _newOwnerCfg = res.data.config;
      cache.set('config', _newOwnerCfg);
    } catch { _newOwnerCfg = null; }
  }

  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nuevo Propietario</h2>
    <div class="flex col gap-2">
      <div class="form-group"><label>Nombre completo</label><input class="input" id="no-name" placeholder="María García"></div>
      <div class="form-group"><label>Email</label><input class="input" type="email" id="no-email" placeholder="propietario@mail.com"></div>
      <div class="form-group"><label>Contraseña temporal</label><input class="input" id="no-pass" placeholder="Mín. 6 caracteres"></div>
      <div class="form-group"><label>Unidad (lote/casa)</label><input class="input" id="no-unit" placeholder="Lote 12"></div>
      <div class="form-group"><label>Teléfono</label><input class="input" id="no-phone" placeholder="1122334455"></div>
      <div class="form-group">
        <label>Meses sin pagar</label>
        <input class="input" type="number" id="no-months" value="0" min="0" oninput="updateNewOwnerDebtPreview()">
        <p id="no-debt-preview" style="display:none;margin:.4rem 0 0;font-size:.82rem;color:var(--danger);font-weight:600"></p>
      </div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" data-requires-network onclick="saveNewOwner()">Crear</button>
      </div>
    </div>`;
  openModal();
}

export function updateNewOwnerDebtPreview() {
  const months  = Number(document.getElementById('no-months')?.value || 0);
  const preview = document.getElementById('no-debt-preview');
  if (!preview) return;
  if (months <= 0 || !_newOwnerCfg) { preview.style.display = 'none'; return; }

  const { total, surcharge } = _calcDebt(months, _newOwnerCfg);
  preview.style.display = '';
  preview.textContent   = `Deuda inicial: $${total.toLocaleString('es-AR')}${surcharge > 0 ? ` (incluye recargo $${surcharge.toLocaleString('es-AR')})` : ''}`;
}

export async function saveNewOwner() {
  const name   = document.getElementById('no-name')?.value.trim();
  const email  = document.getElementById('no-email')?.value.trim();
  const pass   = document.getElementById('no-pass')?.value.trim();
  const unit   = document.getElementById('no-unit')?.value.trim();
  const phone  = document.getElementById('no-phone')?.value.trim();
  const months = Number(document.getElementById('no-months')?.value || 0);
  if (!name || !email || !pass) { toast('Nombre, email y contraseña son obligatorios', 'error'); return; }

  const { total: debtTotal } = _calcDebt(months, _newOwnerCfg);
  const balance  = -debtTotal;
  const isDebtor = debtTotal > 0;

  try {
    await api.owners.create({ name, email, password: pass, unit, phone, balance, isDebtor });
    closeModal();
    toast('Propietario creado exitosamente', 'success');
    renderOwnersList();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Registrar pago manual (admin) ────────────────────────────
export async function openRegisterPaymentModal(ownerId, ownerName) {
  _ownerDetailCfg = cache.get('config');
  if (!_ownerDetailCfg) {
    try {
      const res = await api.config.get();
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

export async function submitRegisterPayment(ownerId) {
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
    cache.del('owner_home');
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Descargar plantilla Excel (generada en el cliente) ────────
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
window.saveNewOwner                = saveNewOwner;
window.updateNewOwnerDebtPreview   = updateNewOwnerDebtPreview;
window.openRegisterPaymentModal    = openRegisterPaymentModal;
window.submitRegisterPayment       = submitRegisterPayment;
window.downloadBulkTemplate        = downloadBulkTemplate;
window.openBulkOwnerModal          = openBulkOwnerModal;
window.submitBulkOwners            = submitBulkOwners;
