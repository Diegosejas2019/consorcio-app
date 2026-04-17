import { state } from '../core/state.js';
import { toast } from '../ui/toast.js';
import { showLoading, setBtnLoading } from '../ui/loading.js';
import { skeleton } from '../ui/skeleton.js';
import { errorState } from '../ui/helpers.js';
import { SVG } from '../ui/icons.js';
import { setupTopBar } from './authService.js';
import { openModal, closeModal } from '../ui/modal.js';

const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function getCurrentPeriod() {
  const now = new Date();
  const code  = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const label = `${MONTHS_ES[now.getMonth()]} ${now.getFullYear()}`;
  return { code, label };
}

// Períodos cacheados para el modal
let _allPeriods = [];

export function periodChip(value) {
  return `<span data-period="${value}" style="display:inline-flex;align-items:center;gap:.35rem;background:var(--primary-lt);color:var(--primary);padding:.25rem .65rem;border-radius:99px;font-size:.82rem;font-weight:500">
    ${formatPeriodLabel(value)}
    <button onclick="removePaymentPeriod('${value}')" style="background:none;border:none;cursor:pointer;color:inherit;line-height:1;padding:0;font-size:.9rem">✕</button>
  </span>`;
}

export async function renderAdminSettings() {
  const el = document.getElementById('page-admin-settings');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res = await api.config.get();
    const cfg = res.data.config;
    _allPeriods = cfg.paymentPeriods || [];

    const current = getCurrentPeriod();
    const periodLabel = cfg.expenseMonth     || current.label;
    const periodCode  = cfg.expenseMonthCode || current.code;

    const lateFeeType    = cfg.lateFeeType    || 'percent';
    const lateFeePercent = cfg.lateFeePercent ?? 5;
    const lateFeeFixed   = cfg.lateFeeFixed   ?? 0;

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
            <div id="periods-list" class="flex gap-2" style="flex-wrap:wrap;min-height:2rem">
              ${_allPeriods.map(p => periodChip(p)).join('') || '<span class="text-sm text-muted">Sin períodos configurados</span>'}
            </div>
            <div class="flex gap-2" style="align-items:center">
              <input class="input" type="month" id="cfg-new-period" style="flex:1">
              <button class="btn btn-secondary" id="btn-add-period" onclick="addPaymentPeriod()">Agregar</button>
            </div>
          </div>
        </div>

        <div class="card">
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

            <button class="btn btn-primary" id="btn-save-settings" data-requires-network onclick="saveSettings()">Guardar cambios</button>
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

            <button class="btn btn-primary" id="btn-save-late-fee" data-requires-network onclick="saveLateFeeSettings()">Guardar cambios</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Datos del Consorcio</h3></div>
          <div class="card-body flex col gap-2">
            <div class="form-group"><label>Nombre del consorcio</label><input class="input" id="cfg-name" value="${cfg.consortiumName || ''}" placeholder="Barrio Privado Los Pinos"></div>
            <div class="form-group"><label>Email de contacto</label><input class="input" id="cfg-email" value="${cfg.adminEmail || ''}"></div>
            <button class="btn btn-primary" id="btn-save-consortium" data-requires-network onclick="saveConsortiumSettings()">Guardar</button>
          </div>
        </div>

        <div class="card">
          <div class="card-header"><h3>Integración MercadoPago</h3></div>
          <div class="card-body flex col gap-2">
            <p class="text-sm text-muted">Credenciales desde developers.mercadopago.com</p>
            <div class="form-group"><label>Public Key</label><input class="input" id="cfg-mp-key" placeholder="APP_USR-..." value="${cfg.mpPublicKey || ''}"></div>
            <div class="form-group"><label>Access Token</label><input class="input" type="password" id="cfg-mp-token" placeholder="APP_USR-..."></div>
            <button class="btn btn-primary" data-requires-network onclick="saveMPSettings()">Guardar credenciales</button>
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
  if (!list.length) return '<p class="text-sm text-muted" style="padding:.5rem 0">No hay períodos para este año.</p>';
  return list.map(p => `
    <div style="display:flex;justify-content:space-between;align-items:center;padding:.55rem 0;border-bottom:1px solid var(--border)">
      <span class="text-sm">${formatPeriodLabel(p)}</span>
      <button class="btn btn-danger btn-sm" onclick="removePaymentPeriodFromModal('${p}')">Eliminar</button>
    </div>`).join('');
}

export function openPeriodsModal() {
  const years = [...new Set(_allPeriods.map(p => p.split('-')[0]))].sort().reverse();
  const defaultYear = years[0] || '';

  openModal(`
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Períodos configurados</h2>
    <div class="flex gap-2" style="margin-bottom:1rem;align-items:center">
      <label style="font-size:.85rem;color:var(--muted);white-space:nowrap">Filtrar por año</label>
      <select class="select" id="modal-year-filter" onchange="filterPeriodsByYear(this.value)" style="flex:1">
        <option value="">Todos</option>
        ${years.map(y => `<option value="${y}" ${y === defaultYear ? 'selected' : ''}>${y}</option>`).join('')}
      </select>
    </div>
    <div id="modal-periods-list">
      ${_renderModalList(defaultYear)}
    </div>
    <button class="btn btn-secondary w-full" style="margin-top:1.25rem" onclick="closeModal()">Cerrar</button>
  `);
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
    const settingsList = document.getElementById('periods-list');
    if (settingsList) {
      settingsList.innerHTML = _allPeriods.length
        ? _allPeriods.map(p => periodChip(p)).join('')
        : '<span class="text-sm text-muted">Sin períodos configurados</span>';
    }
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
      consortiumName: document.getElementById('cfg-name')?.value.trim(),
      adminEmail:     document.getElementById('cfg-email')?.value.trim(),
    });
    toast('Datos del consorcio guardados', 'success');
    setupTopBar();
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
    document.getElementById('periods-list').innerHTML = _allPeriods.map(p => periodChip(p)).join('');
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
    document.getElementById('periods-list').innerHTML = _allPeriods.length
      ? _allPeriods.map(p => periodChip(p)).join('')
      : '<span class="text-sm text-muted">Sin períodos configurados</span>';
    toast('Período eliminado', 'success');
  } catch (err) { toast(err.message, 'error'); }
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

window.renderAdminSettings          = renderAdminSettings;
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
window.saveMPSettings               = saveMPSettings;
