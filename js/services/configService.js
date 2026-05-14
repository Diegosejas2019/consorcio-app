import { state, setState } from '../core/state.js';
import { CACHE_TTL, getCachedOrFetch } from '../core/cacheHelpers.js';
import { toast } from '../ui/toast.js';
import { showLoading, setBtnLoading } from '../ui/loading.js';
import { skeleton } from '../ui/skeleton.js';
import { errorState, escapeHtml } from '../ui/helpers.js';
import { SVG, svgIcon } from '../ui/icons.js';
import { setupTopBar, getOrgId } from './authService.js';
import { openModal, closeModal } from '../ui/modal.js';
import { hasPermission, ROLE_LABELS, ROLE_DESCRIPTIONS, groupPermissionLabels } from './permissionService.js';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getCurrentPeriod() {
  const now = new Date();
  const code  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const label = `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`;
  return { code, label };
}

// Períodos cacheados para el modal
let _allPeriods = [];

function getCachedConfig() {
  return getCachedOrFetch('config:api', CACHE_TTL.CONFIG, () => api.config.get());
}

export function periodChip(value) {
  return `<span data-period="${value}" style="display:inline-flex;align-items:center;gap:.35rem;background:var(--primary-lt);color:var(--primary);padding:.25rem .65rem;border-radius:99px;font-size:.82rem;font-weight:500">
    ${formatPeriodLabel(value)}
    <button onclick="removePaymentPeriod('${value}')" style="background:none;border:none;cursor:pointer;color:inherit;line-height:1;padding:0;font-size:.9rem">✕</button>
  </span>`;
}

const FEATURE_LABELS = {
  visits:       'Visitas',
  reservations: 'Reservas',
  votes:        'Votaciones',
  expenses:     'Gastos',
  providers:    'Proveedores',
  documents:    'Documentacion',
};

let _adminRoles = [];
let _adminInviteOwnerResults = [];
let _adminInviteOwnerSearchTimer = null;

function _disabledAttr(permission) {
  return hasPermission(permission) ? '' : 'disabled';
}

function _actionButton(permission, html) {
  return hasPermission(permission) ? html : '';
}

function _jsString(value) {
  return String(value ?? '').replace(/\\/g, '\\\\').replace(/'/g, "\\'").replace(/\r?\n/g, ' ');
}

function _roleOptions(selected = '') {
  const roles = _adminRoles.length
    ? _adminRoles
    : Object.entries(ROLE_LABELS).map(([role, label]) => ({ role, label, permissions: [] }));
  return roles.map(r => `<option value="${escapeHtml(r.role)}" ${selected === r.role ? 'selected' : ''}>${escapeHtml(r.label || ROLE_LABELS[r.role] || 'Administrador')}</option>`).join('');
}

function _permissionsPreview(role) {
  const roles = _adminRoles.length
    ? _adminRoles
    : Object.entries(ROLE_LABELS).map(([key, label]) => ({ role: key, label, permissions: [] }));
  const def = roles.find(r => r.role === role) || roles[0];
  if (!def) return '<p class="text-sm text-muted">Seleccioná un rol para ver sus permisos.</p>';
  const groups = groupPermissionLabels(def.permissions || []);
  return `
    <p class="text-sm text-muted" style="margin:.5rem 0 0">${ROLE_DESCRIPTIONS[def.role] || 'Permisos administrativos configurados para la organizacion.'}</p>
    <div class="permission-groups">
      ${groups.length ? groups.map(group => `
        <div class="permission-group">
          <strong>${escapeHtml(group.module)}</strong>
          <span>${group.labels.map(escapeHtml).join(', ')}</span>
        </div>
      `).join('') : '<p class="text-sm text-muted">Sin permisos configurados.</p>'}
    </div>`;
}

async function _renderAdminUsersCard() {
  if (!hasPermission('admins.read')) return '';
  try {
    const res = await api.adminUsers.getAll();
    const admins = res.data.admins || [];
    _adminRoles = res.data.roles || [];
    return `
      <div class="card">
        <div class="card-header flex between" style="align-items:center">
          <h3>Usuarios administradores</h3>
          ${_actionButton('admins.create', '<button class="btn btn-primary btn-sm" onclick="openAdminInviteModal()">Invitar</button>')}
        </div>
          <div class="card-body flex col gap-2">
          ${admins.length ? admins.map(admin => {
            const isOwnerAdmin = admin.role === 'owner_admin';
            return `
            <div class="owner-row">
              <div class="owner-avatar">${(admin.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('')}</div>
              <div class="owner-info">
                <p class="name">${admin.name || '-'}</p>
                <p class="unit">${admin.email || ''}</p>
              </div>
              <span class="badge ${admin.isActive ? 'badge-success' : 'badge-neutral'}">${admin.isActive ? escapeHtml(admin.roleLabel || ROLE_LABELS[admin.role] || 'Administrador') : 'Desactivado'}</span>
              ${admin.isActive ? `
                ${_actionButton('admins.update', `<button class="btn btn-ghost btn-sm" onclick="openAdminRoleModal('${admin.userId}','${admin.role}')">Rol</button>`)}
                ${!isOwnerAdmin ? _actionButton('admins.disable', `<button class="btn btn-danger btn-sm" onclick="disableAdminUser('${admin.userId}')">Desactivar</button>`) : ''}
              ` : ''}
            </div>`;
          }).join('') : '<p class="text-sm text-muted">No hay administradores cargados.</p>'}
        </div>
      </div>`;
  } catch (err) {
    return `
      <div class="card">
        <div class="card-header"><h3>Usuarios administradores</h3></div>
        <div class="card-body"><p class="text-sm text-muted">${err.message || 'No se pudieron cargar los administradores.'}</p></div>
      </div>`;
  }
}

export async function renderAdminAdministrators() {
  const el = document.getElementById('page-admin-admins');
  if (!el) return;
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    el.innerHTML = `
      <div class="flex col gap-3">
        <div>
          <h1>Administradores</h1>
          <p class="text-sm text-muted">Gestiona invitaciones, roles y permisos administrativos de esta organizacion.</p>
        </div>
        ${await _renderAdminUsersCard()}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message || 'No se pudieron cargar los administradores.', 'renderAdminAdministrators()');
  }
}

async function _renderFeaturesCard() {
  const orgId = getOrgId();
  if (!orgId) return '';

  let features = {};
  try {
    const res = await getCachedOrFetch(
      `features:${orgId}`,
      CACHE_TTL.FEATURES,
      () => api.organizations.getFeatures(orgId)
    );
    features = res.data.features;
  } catch (_) {
    // Error cargando features → mostrar todos habilitados
    Object.keys(FEATURE_LABELS).forEach(k => { features[k] = true; });
  }

  const toggles = Object.entries(FEATURE_LABELS).map(([key, label]) => {
    const checked = features[key] !== false;
    return `
      <label style="display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid var(--border);cursor:pointer">
        <span class="text-sm">${label}</span>
        <input type="checkbox" id="feat-${key}" ${checked ? 'checked' : ''} style="accent-color:var(--primary);width:18px;height:18px;cursor:pointer">
      </label>`;
  }).join('');

  return `
    <div class="card" style="display:none">
      <div class="card-header"><h3>Módulos habilitados</h3></div>
      <div class="card-body flex col gap-1">
        <p class="text-sm text-muted">Activá o desactivá módulos para todos los miembros del consorcio.</p>
        ${toggles}
        <button class="btn btn-primary" id="btn-save-features" style="margin-top:.5rem" data-requires-network onclick="saveFeatureSettings()">Guardar módulos</button>
      </div>
    </div>`;
}

export async function saveFeatureSettings() {
  const btn = document.getElementById('btn-save-features');
  setBtnLoading(btn, true);
  try {
    const orgId = getOrgId();
    if (!orgId) { toast('No tenés una organización asignada', 'error'); return; }

    const features = {};
    Object.keys(FEATURE_LABELS).forEach(key => {
      features[key] = !!document.getElementById(`feat-${key}`)?.checked;
    });

    const res = await api.organizations.updateFeatures(orgId, features);
    setState({ features: res.data.features });
    window.gestionarCache?.set(`features:${orgId}`, res, CACHE_TTL.FEATURES);
    window.setupNav?.();
    toast('Módulos guardados correctamente', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

export async function renderAdminSettings() {
  const el = document.getElementById('page-admin-settings');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res = await getCachedConfig();
    const cfg = res.data.config;
    _allPeriods = cfg.paymentPeriods || [];

    const current = getCurrentPeriod();
    const periodLabel = cfg.expenseMonth     || current.label;
    const periodCode  = cfg.expenseMonthCode || current.code;

    const lateFeeType    = cfg.lateFeeType    || 'percent';
    const lateFeePercent = cfg.lateFeePercent ?? 5;
    const lateFeeFixed   = cfg.lateFeeFixed   ?? 0;
    const canUpdateSettings = hasPermission('settings.update');

    el.innerHTML = `
      <div class="flex col gap-3">
        <h1>Configuración</h1>

        <div class="card">
          <div class="card-header flex between" style="align-items:center">
            <h3>Períodos de pago disponibles</h3>
            <button class="btn btn-ghost btn-sm" onclick="openPeriodsModal()">Ver todos</button>
          </div>
          <div class="card-body flex col gap-2">
            <p class="text-sm text-muted">Definí qué meses pueden seleccionar los propietarios al subir un comprobante. Si no hay ninguno, se muestran los últimos 6 meses automáticamente.</p>
            <div class="flex gap-2" style="align-items:center">
              <input class="input" type="month" id="cfg-new-period" style="flex:1">
              ${canUpdateSettings ? '<button class="btn btn-secondary" id="btn-add-period" onclick="addPaymentPeriod()">Agregar</button>' : ''}
            </div>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Monto mensual</h3></div>
          <div class="card-body flex col gap-2">
            <p class="text-sm text-muted">Importe que se usa por defecto al registrar un pago. El propietario puede modificarlo al subir el comprobante.</p>
            <div class="form-group">
              <label>Monto mensual ($)</label>
              <input class="input" type="number" id="cfg-monthly-fee" value="${cfg.monthlyFee || ''}" min="0" placeholder="Ej: 10000">
            </div>
            ${canUpdateSettings ? '<button class="btn btn-primary" id="btn-save-monthly-fee" data-requires-network onclick="saveMonthlyFeeSettings()">Guardar</button>' : ''}
          </div>
        </div>

        <div class="card" style="display:none">
          <div class="card-header"><h3>Concepto Extraordinario</h3></div>
          <div class="card-body flex col gap-2">
            <div class="form-group">
              <label>Período (nombre)</label>
              <div class="flex gap-2" style="align-items:center">
                <input class="input" id="cfg-month" value="${periodLabel}" placeholder="Ej: Abril 2025" style="flex:1">
                <button class="btn btn-secondary btn-sm" style="white-space:nowrap" onclick="fillCurrentPeriod()">Mes actual</button>
              </div>
            </div>
            <div class="form-group"><label>Código de mes</label><input class="input" id="cfg-month-code" value="${periodCode}" placeholder="YYYY-MM"></div>
            <div class="form-group"><label>Importe ($)</label><input class="input" type="number" id="cfg-amount" value="${cfg.expenseAmount || ''}" min="1"></div>

            ${canUpdateSettings ? '<button class="btn btn-primary" id="btn-save-settings" data-requires-network onclick="saveSettings()">Guardar cambios</button>' : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Recargo por mora</h3></div>
          <div class="card-body flex col gap-2">
            <div class="form-group"><label>Día de vencimiento</label><input class="input" type="number" id="cfg-due" value="${cfg.dueDayOfMonth || 10}" min="1" max="28"></div>

            <div class="form-group">
              <label>Tipo de recargo por mora</label>
              <div class="flex gap-2" style="align-items:center">
                <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;flex:1;padding:.6rem .75rem;border:1px solid var(--border);border-radius:8px;background:${lateFeeType==='percent'?'var(--primary-lt)':'var(--bg-card)'}">
                  <input type="radio" name="lateFeeType" value="percent" ${lateFeeType==='percent'?'checked':''} onchange="toggleLateFeeType('percent')" style="accent-color:var(--primary)">
                  <span class="text-sm">Porcentaje (%)</span>
                </label>
                <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;flex:1;padding:.6rem .75rem;border:1px solid var(--border);border-radius:8px;background:${lateFeeType==='fixed'?'var(--primary-lt)':'var(--bg-card)'}">
                  <input type="radio" name="lateFeeType" value="fixed" ${lateFeeType==='fixed'?'checked':''} onchange="toggleLateFeeType('fixed')" style="accent-color:var(--primary)">
                  <span class="text-sm">Importe fijo ($)</span>
                </label>
              </div>
            </div>

            <div id="late-fee-percent-row" class="form-group" style="${lateFeeType==='fixed'?'display:none':''}">
              <label>Recargo (%)</label>
              <input class="input" type="number" id="cfg-late-percent" value="${lateFeePercent}" min="0" max="100" placeholder="Ej: 5">
            </div>
            <div id="late-fee-fixed-row" class="form-group" style="${lateFeeType==='percent'?'display:none':''}">
              <label>Recargo ($)</label>
              <input class="input" type="number" id="cfg-late-fixed" value="${lateFeeFixed}" min="0" placeholder="Ej: 500">
            </div>

            ${canUpdateSettings ? '<button class="btn btn-primary" id="btn-save-late-fee" data-requires-network onclick="saveLateFeeSettings()">Guardar cambios</button>' : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Datos del Consorcio</h3></div>
          <div class="card-body flex col gap-2">
            <div class="form-group"><label>Nombre del consorcio</label><input class="input" id="cfg-name" value="${cfg.consortiumName || ''}" placeholder="Barrio Privado Los Pinos"></div>
            <div class="form-group"><label>Dirección</label><input class="input" id="cfg-address" value="${cfg.consortiumAddress || ''}" placeholder="Av. Siempre Viva 742"></div>
            <div class="form-group"><label>CUIT</label><input class="input" id="cfg-cuit" value="${cfg.consortiumCuit || ''}" placeholder="20-12345678-9"></div>
            <div class="form-group"><label>Email de contacto</label><input class="input" id="cfg-email" value="${cfg.adminEmail || ''}"></div>
            ${canUpdateSettings ? '<button class="btn btn-primary" id="btn-save-consortium" data-requires-network onclick="saveConsortiumSettings()">Guardar</button>' : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Datos bancarios para transferencia</h3></div>
          <div class="card-body flex col gap-2">
            <p class="text-sm text-muted">Estos datos aparecen al final de la liquidación de expensas en PDF.</p>
            <div class="form-group"><label>Banco</label><input class="input" id="cfg-bank-name" value="${cfg.bankName || ''}" placeholder="Banco Nación"></div>
            <div class="form-group"><label>N° de cuenta</label><input class="input" id="cfg-bank-account" value="${cfg.bankAccount || ''}" placeholder="0000000000"></div>
            <div class="form-group"><label>CBU</label><input class="input" id="cfg-bank-cbu" value="${cfg.bankCbu || ''}" placeholder="0000000000000000000000"></div>
            <div class="form-group"><label>Titular</label><input class="input" id="cfg-bank-holder" value="${cfg.bankHolder || ''}" placeholder="Nombre del titular"></div>
            ${canUpdateSettings ? '<button class="btn btn-primary" id="btn-save-bank" data-requires-network onclick="saveBankSettings()">Guardar</button>' : ''}
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Integración MercadoPago</h3></div>
          <div class="card-body flex col gap-2">
            <p class="text-sm text-muted">Credenciales desde developers.mercadopago.com</p>
            <div class="form-group"><label>Public Key</label><input class="input" id="cfg-mp-key" placeholder="APP_USR-..." value="${cfg.mpPublicKey || ''}"></div>
            <div class="form-group"><label>Access Token</label><input class="input" type="password" id="cfg-mp-token" placeholder="APP_USR-..."></div>
            ${canUpdateSettings ? '<button class="btn btn-primary" data-requires-network onclick="saveMPSettings()">Guardar credenciales</button>' : ''}
          </div>
        </div>

        ${await _renderFeaturesCard()}

        <div class="card">
          <div class="card-header"><h3>Legal</h3></div>
          <div class="card-body">
            <button class="legal-link" onclick="openTermsPage()">
              <span>${svgIcon('doc', 18)}</span>
              <span>Términos y Condiciones</span>
              <span class="legal-link-arrow">${svgIcon('chevron-r', 16)}</span>
            </button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Cuenta</h3></div>
          <div class="card-body">
            <button class="btn btn-danger w-full" onclick="logout()">${SVG.logout} Cerrar sesión</button>
          </div>
        </div>
      </div>`;
  } catch (err) {
    if (err.status === 404 || (err.message && err.message.toLowerCase().includes('configurada'))) {
      let templateOptions = '<option value="consorcio">Consorcio / Barrio Privado</option>';
      try {
        const tRes = await api.organizations.getTemplates();
        templateOptions = tRes.data.templates.map(t =>
          `<option value="${t.businessType}">${t.displayName}</option>`
        ).join('');
      } catch (_) { /* usar default */ }

      el.innerHTML = `
        <div class="flex col gap-3">
          <h1>Configuración</h1>
          <div class="card">
            <div class="card-header"><h3>Configurar organización</h3></div>
            <div class="card-body flex col gap-2">
              <p class="text-sm text-muted">Todavía no configuraste tu organización. Completá los datos para comenzar.</p>
              <div class="form-group">
                <label>Tipo de organización *</label>
                <select class="input" id="setup-org-template">${templateOptions}</select>
              </div>
              <div class="form-group"><label>Nombre *</label><input class="input" id="setup-org-name" placeholder="Barrio Privado Los Pinos"></div>
              <div class="form-group"><label>Dirección</label><input class="input" id="setup-org-address" placeholder="Av. Siempre Viva 742"></div>
              <div class="form-group"><label>Email de contacto</label><input class="input" type="email" id="setup-org-email" placeholder="admin@consorcio.com"></div>
              <button class="btn btn-primary" onclick="createOrganization()">Crear organización</button>
            </div>
          </div>
          <div class="card">
            <div class="card-header"><h3>Legal</h3></div>
            <div class="card-body">
              <button class="legal-link" onclick="openTermsPage()">
                <span>${svgIcon('doc', 18)}</span>
                <span>Términos y Condiciones</span>
                <span class="legal-link-arrow">${svgIcon('chevron-r', 16)}</span>
              </button>
            </div>
          </div>
        </div>`;
    } else {
      el.innerHTML = errorState(err.message, 'renderAdminSettings()');
    }
  }
}

export function toggleLateFeeType(type) {
  const percentRow = document.getElementById('late-fee-percent-row');
  const fixedRow   = document.getElementById('late-fee-fixed-row');
  if (percentRow) percentRow.style.display = type === 'fixed'   ? 'none' : '';
  if (fixedRow)   fixedRow.style.display   = type === 'percent' ? 'none' : '';
  // Actualizar estilos de las etiquetas radio
  document.querySelectorAll('[name="lateFeeType"]').forEach(r => {
    r.closest('label').style.background = r.value === type ? 'var(--primary-lt)' : 'var(--bg-card)';
  });
}

export function fillCurrentPeriod() {
  const { code, label } = getCurrentPeriod();
  const monthEl = document.getElementById('cfg-month');
  const codeEl  = document.getElementById('cfg-month-code');
  if (monthEl) monthEl.value = label;
  if (codeEl)  codeEl.value  = code;
}

// ── Modal: ver todos los períodos con filtro por año ──────────────

function _periodsForYear(year) {
  return year ? _allPeriods.filter(p => p.startsWith(year)) : _allPeriods;
}

function _renderModalList(year) {
  const list = _periodsForYear(year);
  if (!list.length) {
    const msg = year ? `No hay períodos configurados para ${year}.` : 'No hay períodos configurados.';
    return `<p class="text-sm text-muted" style="padding:.5rem 0">${msg}</p>`;
  }
  return list.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid var(--border)">
      <span class="text-sm">${formatPeriodLabel(p)}</span>
      <button class="btn btn-danger btn-sm" onclick="removePaymentPeriodFromModal('${p}')">Eliminar</button>
    </div>`).join('');
}

export async function openPeriodsModal() {
  const currentYear = new Date().getFullYear();

  // Esqueleto inicial mientras carga
  openModal(`
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Períodos configurados</h2>
    <div id="modal-periods-loading" style="padding:1.5rem 0;text-align:center">
      <span class="text-sm text-muted">Cargando períodos…</span>
    </div>
    <button class="btn btn-secondary w-full" style="margin-top:1.25rem" onclick="closeModal()">Cerrar</button>
  `);

  try {
    const res = await getCachedConfig();
    _allPeriods = res.data.config.paymentPeriods || [];
  } catch (err) {
    const loading = document.getElementById('modal-periods-loading');
    if (loading) loading.innerHTML = `<p class="text-sm text-muted" style="padding:.5rem 0">Error al cargar los períodos.</p>`;
    return;
  }

  const defaultYears = [String(currentYear), String(currentYear - 1)];
  const years = [...new Set([
    ..._allPeriods.map(p => p.split('-')[0]),
    ...defaultYears,
  ])].sort().reverse();
  const defaultYear = String(currentYear);

  const loading = document.getElementById('modal-periods-loading');
  if (!loading) return; // modal cerrado antes de que resuelva

  loading.outerHTML = `
    <div class="flex gap-2" style="margin-bottom:1rem;align-items:center">
      <label style="font-size:.85rem;color:var(--muted);white-space:nowrap">Filtrar por año</label>
      <select class="select" id="modal-year-filter" onchange="filterPeriodsByYear(this.value)" style="flex:1">
        <option value="">Todos</option>
        ${years.map(y => `<option value="${y}" ${y === defaultYear ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
    </div>
    <div id="modal-periods-list">
      ${_renderModalList(defaultYear)}
    </div>`;

}

export function filterPeriodsByYear(year) {
  const el = document.getElementById('modal-periods-list');
  if (el) el.innerHTML = _renderModalList(year);
}

export async function removePaymentPeriodFromModal(value) {
  const updated = _allPeriods.filter(p => p !== value);
  try {
    await api.config.update({ paymentPeriods: updated });
    _allPeriods = updated;
    const year = document.getElementById('modal-year-filter')?.value || '';
    const years = [...new Set(_allPeriods.map(p => p.split('-')[0]))].sort().reverse();
    const yearSelect = document.getElementById('modal-year-filter');
    if (yearSelect) {
      yearSelect.innerHTML = `<option value="">Todos</option>${years.map(y => `<option value="${y}" ${y === year ? 'selected' : ''}>${y}</option>`).join('')}`;
    }
    filterPeriodsByYear(year);
    toast('Período eliminado', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

// ─────────────────────────────────────────────────────────────────

export async function createOrganization() {
  const template = document.getElementById('setup-org-template')?.value || 'consorcio';
  const name     = document.getElementById('setup-org-name')?.value.trim();
  const address  = document.getElementById('setup-org-address')?.value.trim();
  const email    = document.getElementById('setup-org-email')?.value.trim();
  if (!name) { toast('El nombre es requerido', 'error'); return; }
  try {
    showLoading(true);
    await api.organizations.create({ template, name, address, adminEmail: email });
    const me = await api.auth.getMe();
    state.user = me.data.user;
    toast('Organización creada correctamente', 'success');
    renderAdminSettings();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

export async function saveSettings() {
  const btn = document.getElementById('btn-save-settings');
  setBtnLoading(btn, true);
  try {
    await api.config.update({
      expenseMonth:     document.getElementById('cfg-month')?.value.trim(),
      expenseMonthCode: document.getElementById('cfg-month-code')?.value.trim(),
      expenseAmount:    Number(document.getElementById('cfg-amount')?.value),
    });
    toast('Configuración guardada', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

export async function saveLateFeeSettings() {
  const btn = document.getElementById('btn-save-late-fee');
  setBtnLoading(btn, true);
  try {
    const lateFeeType = document.querySelector('[name="lateFeeType"]:checked')?.value || 'percent';
    await api.config.update({
      dueDayOfMonth:  Number(document.getElementById('cfg-due')?.value),
      lateFeeType,
      lateFeePercent: Number(document.getElementById('cfg-late-percent')?.value || 0),
      lateFeeFixed:   Number(document.getElementById('cfg-late-fixed')?.value  || 0),
    });
    toast('Recargo por mora guardado', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

export async function saveConsortiumSettings() {
  const btn = document.getElementById('btn-save-consortium');
  setBtnLoading(btn, true);
  try {
    await api.config.update({
      consortiumName:    document.getElementById('cfg-name')?.value.trim(),
      consortiumAddress: document.getElementById('cfg-address')?.value.trim(),
      consortiumCuit:    document.getElementById('cfg-cuit')?.value.trim(),
      adminEmail:        document.getElementById('cfg-email')?.value.trim(),
    });
    toast('Datos del consorcio guardados', 'success');
    setupTopBar();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

export async function saveBankSettings() {
  const btn = document.getElementById('btn-save-bank');
  setBtnLoading(btn, true);
  try {
    await api.config.update({
      bankName:    document.getElementById('cfg-bank-name')?.value.trim(),
      bankAccount: document.getElementById('cfg-bank-account')?.value.trim(),
      bankCbu:     document.getElementById('cfg-bank-cbu')?.value.trim(),
      bankHolder:  document.getElementById('cfg-bank-holder')?.value.trim(),
    });
    toast('Datos bancarios guardados', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

export async function addPaymentPeriod() {
  const input = document.getElementById('cfg-new-period');
  const value = input?.value;
  if (!value) { toast('Seleccioná un mes', 'error'); return; }
  if (_allPeriods.includes(value)) { toast('Ese período ya está en la lista', 'error'); return; }
  const updated = [..._allPeriods, value].sort();
  const btn = document.getElementById('btn-add-period');
  setBtnLoading(btn, true);
  try {
    await api.config.update({ paymentPeriods: updated });
    _allPeriods = updated;
    input.value = '';
    toast('Período agregado', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

export async function removePaymentPeriod(value) {
  const updated = _allPeriods.filter(p => p !== value);
  try {
    await api.config.update({ paymentPeriods: updated });
    _allPeriods = updated;
    toast('Período eliminado', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

export async function saveMonthlyFeeSettings() {
  const btn = document.getElementById('btn-save-monthly-fee');
  setBtnLoading(btn, true);
  try {
    const value = document.getElementById('cfg-monthly-fee')?.value;
    if (value === '' || value === undefined) { toast('Ingresá un monto válido', 'error'); return; }
    await api.config.update({ monthlyFee: Number(value) });
    toast('Monto mensual guardado', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

export async function saveMPSettings() {
  const update = {};
  const key   = document.getElementById('cfg-mp-key')?.value.trim();
  const token = document.getElementById('cfg-mp-token')?.value.trim();
  if (key)   update.mpPublicKey   = key;
  if (token) update.mpAccessToken = token;
  if (!Object.keys(update).length) { toast('Ingresá al menos una credencial', 'error'); return; }
  try {
    await api.config.update(update);
    toast('Credenciales MP guardadas', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

export function openAdminInviteModal() {
  _adminInviteOwnerResults = [];
  if (_adminInviteOwnerSearchTimer) clearTimeout(_adminInviteOwnerSearchTimer);
  openModal(`
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Invitar administrador</h2>
    <div class="flex col gap-2">
      <div class="admin-invite-mode">
        <button type="button" class="is-active" data-admin-invite-mode="new_user" onclick="setAdminInviteMode('new_user')">Nuevo usuario</button>
        <button type="button" data-admin-invite-mode="existing_owner" onclick="setAdminInviteMode('existing_owner')">Propietario existente</button>
      </div>
      <div id="admin-invite-new-user" class="flex col gap-2">
        <div class="form-group"><label>Nombre</label><input class="input" id="admin-invite-name" maxlength="100"></div>
        <div class="form-group"><label>Email</label><input class="input" id="admin-invite-email" type="email"></div>
      </div>
      <div id="admin-invite-existing-owner" class="flex col gap-2" hidden>
        <div class="form-group">
          <label>Buscar propietario</label>
          <input class="input" id="admin-owner-search" type="search" placeholder="Nombre, email, unidad, lote o departamento" oninput="searchAdminInviteOwners(this.value)">
        </div>
        <input type="hidden" id="admin-invite-owner-id">
        <div id="admin-owner-results" class="owner-admin-results">
          <p class="text-sm text-muted">Busca por nombre, email, unidad, lote o departamento.</p>
        </div>
        <div id="admin-owner-selected" class="owner-admin-selected" hidden></div>
      </div>
      <div class="form-group">
        <label>Rol</label>
        <select class="select" id="admin-invite-role" onchange="renderAdminRolePreview(this.value)">
          ${_roleOptions('read_only')}
        </select>
        <div id="admin-role-preview">${_permissionsPreview('read_only')}</div>
      </div>
      <div class="flex gap-1 mt-2">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" data-requires-network onclick="inviteAdminUser()">Invitar</button>
      </div>
    </div>
  `);
}

export function setAdminInviteMode(mode = 'new_user') {
  const safeMode = mode === 'existing_owner' ? 'existing_owner' : 'new_user';
  document.querySelectorAll('[data-admin-invite-mode]').forEach(btn => {
    btn.classList.toggle('is-active', btn.dataset.adminInviteMode === safeMode);
  });
  const newUser = document.getElementById('admin-invite-new-user');
  const existingOwner = document.getElementById('admin-invite-existing-owner');
  if (newUser) newUser.hidden = safeMode !== 'new_user';
  if (existingOwner) existingOwner.hidden = safeMode !== 'existing_owner';
  if (safeMode === 'existing_owner') searchAdminInviteOwners(document.getElementById('admin-owner-search')?.value || '');
}

function _renderAdminInviteOwnerResults(owners = []) {
  const el = document.getElementById('admin-owner-results');
  if (!el) return;
  if (!owners.length) {
    el.innerHTML = '<p class="text-sm text-muted">No encontramos propietarios para esa busqueda.</p>';
    return;
  }
  el.innerHTML = owners.map(owner => `
    <button
      type="button"
      class="owner-admin-option ${owner.isAdminActive ? 'is-disabled' : ''}"
      ${owner.isAdminActive ? 'disabled' : ''}
      onclick="selectAdminInviteOwner('${_jsString(owner.ownerId)}')">
      <strong>${escapeHtml(owner.name || 'Sin nombre')}</strong>
      <span>${escapeHtml(owner.email || '-')}</span>
      <small>${escapeHtml((owner.unitNames || []).join(', ') || 'Sin unidad asignada')}${owner.isAdminActive ? ' - Ya es administrador' : ''}</small>
    </button>
  `).join('');
}

export function searchAdminInviteOwners(query = '') {
  const el = document.getElementById('admin-owner-results');
  if (el) el.innerHTML = '<p class="text-sm text-muted">Buscando propietarios...</p>';
  if (_adminInviteOwnerSearchTimer) clearTimeout(_adminInviteOwnerSearchTimer);
  _adminInviteOwnerSearchTimer = setTimeout(async () => {
    try {
      const res = await api.adminUsers.searchOwners(query || '');
      _adminInviteOwnerResults = res.data?.owners || [];
      _renderAdminInviteOwnerResults(_adminInviteOwnerResults);
    } catch (err) {
      if (el) el.innerHTML = `<p class="text-sm text-muted">${escapeHtml(err.message || 'No se pudieron buscar propietarios.')}</p>`;
    }
  }, 250);
}

export function selectAdminInviteOwner(ownerId) {
  const owner = _adminInviteOwnerResults.find(item => String(item.ownerId) === String(ownerId));
  if (!owner) return;
  if (owner.isAdminActive) {
    toast('Este usuario ya es administrador de la organizacion.', 'error');
    return;
  }
  const ownerIdInput = document.getElementById('admin-invite-owner-id');
  const selected = document.getElementById('admin-owner-selected');
  if (ownerIdInput) ownerIdInput.value = owner.ownerId;
  if (selected) {
    selected.hidden = false;
    selected.innerHTML = `
      <div>
        <span class="text-sm text-muted">Propietario seleccionado</span>
        <p class="text-sm text-muted">${escapeHtml((owner.unitNames || []).join(', ') || 'Sin unidad asignada')}</p>
        <div class="form-group" style="margin-top:.6rem">
          <label>Nombre</label>
          <input class="input" value="${escapeHtml(owner.name || '')}" disabled>
        </div>
        <div class="form-group" style="margin-top:.6rem">
          <label>Email</label>
          <input class="input" value="${escapeHtml(owner.email || '')}" disabled>
        </div>
      </div>`;
  }
  document.querySelectorAll('.owner-admin-option').forEach(btn => btn.classList.remove('is-selected'));
  document.querySelectorAll('.owner-admin-option').forEach(btn => {
    if (btn.getAttribute('onclick')?.includes(String(owner.ownerId))) btn.classList.add('is-selected');
  });
}

export function openAdminRoleModal(userId, currentRole) {
  openModal(`
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Cambiar rol</h2>
    <div class="form-group">
      <label>Rol</label>
      <select class="select" id="admin-role-select" onchange="renderAdminRolePreview(this.value)">
        ${_roleOptions(currentRole)}
      </select>
      <div id="admin-role-preview">${_permissionsPreview(currentRole)}</div>
    </div>
    <div class="flex gap-1 mt-2">
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-primary w-full" data-requires-network onclick="updateAdminUserRole('${userId}')">Guardar</button>
    </div>
  `);
}

export function renderAdminRolePreview(role) {
  const el = document.getElementById('admin-role-preview');
  if (el) el.innerHTML = _permissionsPreview(role);
}

export async function inviteAdminUser() {
  const mode = document.getElementById('admin-invite-existing-owner')?.hidden === false ? 'existing_owner' : 'new_user';
  const name = document.getElementById('admin-invite-name')?.value.trim();
  const email = document.getElementById('admin-invite-email')?.value.trim();
  const ownerId = document.getElementById('admin-invite-owner-id')?.value;
  const role = document.getElementById('admin-invite-role')?.value;
  if (mode === 'existing_owner') {
    if (!ownerId) { toast('Selecciona un propietario.', 'error'); return; }
    try {
      await api.adminUsers.invite({ mode, ownerId, role });
      closeModal();
      toast('Propietario asociado como administrador.', 'success');
      renderAdminAdministrators();
    } catch (err) {
      toast(err.message, 'error');
    }
    return;
  }
  if (!name || !email) { toast('Completá nombre y email.', 'error'); return; }
  try {
    await api.adminUsers.invite({ mode: 'new_user', name, email, role });
    closeModal();
    toast('Administrador invitado correctamente.', 'success');
    renderAdminAdministrators();
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function updateAdminUserRole(userId) {
  const role = document.getElementById('admin-role-select')?.value;
  try {
    await api.adminUsers.updateRole(userId, role);
    closeModal();
    toast('Rol actualizado correctamente.', 'success');
    renderAdminAdministrators();
  } catch (err) {
    toast(err.message, 'error');
  }
}

export async function disableAdminUser(userId) {
  if (!confirm('¿Desactivar el acceso administrativo de este usuario?')) return;
  try {
    await api.adminUsers.disable(userId);
    toast('Acceso administrativo desactivado.', 'success');
    renderAdminAdministrators();
  } catch (err) {
    toast(err.message, 'error');
  }
}

window.renderAdminSettings          = renderAdminSettings;
window.renderAdminAdministrators    = renderAdminAdministrators;
window.saveFeatureSettings          = saveFeatureSettings;
window.createOrganization           = createOrganization;
window.toggleLateFeeType            = toggleLateFeeType;
window.fillCurrentPeriod            = fillCurrentPeriod;
window.saveSettings                 = saveSettings;
window.saveLateFeeSettings          = saveLateFeeSettings;
window.saveConsortiumSettings       = saveConsortiumSettings;
window.addPaymentPeriod             = addPaymentPeriod;
window.removePaymentPeriod          = removePaymentPeriod;
window.openPeriodsModal             = openPeriodsModal;
window.filterPeriodsByYear          = filterPeriodsByYear;
window.removePaymentPeriodFromModal = removePaymentPeriodFromModal;
window.saveMonthlyFeeSettings       = saveMonthlyFeeSettings;
window.saveBankSettings             = saveBankSettings;
window.saveMPSettings               = saveMPSettings;
window.openAdminInviteModal         = openAdminInviteModal;
window.setAdminInviteMode           = setAdminInviteMode;
window.searchAdminInviteOwners      = searchAdminInviteOwners;
window.selectAdminInviteOwner       = selectAdminInviteOwner;
window.openAdminRoleModal           = openAdminRoleModal;
window.renderAdminRolePreview       = renderAdminRolePreview;
window.inviteAdminUser              = inviteAdminUser;
window.updateAdminUserRole          = updateAdminUserRole;
window.disableAdminUser             = disableAdminUser;
