import { toast } from '../../ui/toast.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { errorState } from '../../ui/helpers.js';
import { setBtnLoading } from '../../ui/loading.js';
import { cache, state } from '../../core/state.js';

let selectedFile  = null;
let _selectedBalanceFile = null;
let _monthlyFee   = 0;
let _ownerFee     = 0;
let _selectedExtras = new Set();
let _extraAmounts   = {};
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export async function renderUploadPage() {
  const el = document.getElementById('page-owner-pay');
  el.innerHTML = `<div class="oh-wrap">${skeleton(4)}</div>`;
  _selectedExtras = new Set();
  _extraAmounts   = {};

  try {
    const [cfgRes, availRes, payRes, unitsRes] = await Promise.all([
      api.config.get(),
      api.payments.getAvailableItems(),
      api.payments.getAll({ limit: 50 }),
      api.units.getAll(),
    ]);

    const cfg      = cfgRes.data.config;
    const available = availRes.data;
    const payments = payRes.data.payments;
    const owner    = { ...state.user, ...(state.membership || {}) };
    const units    = unitsRes.data.units || [];

    _monthlyFee = cfg.monthlyFee || 0;
    _ownerFee   = units.length > 0
      ? units.reduce((sum, u) => sum + (u.finalFee ?? _monthlyFee), 0)
      : _monthlyFee;

    const feeLabel = _ownerFee > 0 ? ` — $${_ownerFee.toLocaleString('es-AR')}` : '';

    // Usar períodos del endpoint available-items (ya filtrados por el backend)
    const months = (available.periods || []).map(v => ({
      value: v,
      label: `${formatPeriodLabel(v)}${feeLabel}`,
    }));

    // Extraordinarios disponibles
    const extras = (available.extraordinary || []).map(e => ({
      ...e,
      id:     e.id || e._id,
      title:  e.title || e.description || 'Concepto extraordinario',
      amount: Number(e.amount || 0),
    }));
    extras.forEach(e => { _extraAmounts[e.id] = e.amount; });

    // Períodos con pago activo para deuda
    const approvedPeriods = new Set(payments.filter(p => p.status === 'approved').map(p => p.month));
    const pendingPeriods  = new Set(payments.filter(p => p.status === 'pending').map(p => p.month));
    const activePeriods   = new Set([...approvedPeriods, ...pendingPeriods]);
    const startBilling    = owner?.startBillingPeriod;
    const currentPeriod   = cfg.expenseMonthCode || new Date().toISOString().slice(0, 7);
    const unpaidPeriods   = (cfg.paymentPeriods || [])
      .filter(p => !activePeriods.has(p) && (!startBilling || p >= startBilling) && (!currentPeriod || p <= currentPeriod));

    const isDebtor = owner?.isDebtor || (owner?.balance || 0) < 0;
    const hasDebt  = isDebtor && unpaidPeriods.length > 0;
    const hasPendingBalancePayment = payments.some(p => p.type === 'balance' && p.status === 'pending');
    const hasBalanceDebt = (owner?.balance || 0) < 0 && !hasPendingBalancePayment;

    // ── Sección de saldo anterior ────────────────────────────────
    let balanceDebtHtml = '';
    if (hasBalanceDebt) {
      balanceDebtHtml = `
        <div class="card oh-entry op-debt-card" style="--delay:30ms">
          <div class="card-body flex col gap-2">
            <div class="flex between" style="align-items:center">
              <h2 style="font-size:1rem;font-weight:700">Saldo anterior pendiente</h2>
              <span class="badge badge-danger">Deuda</span>
            </div>
            <div class="flex between" style="align-items:center;padding:.55rem .75rem;background:rgba(255,255,255,.06);border-radius:8px">
              <span class="text-sm text-muted">Saldo pendiente</span>
              <strong style="color:#f87171">-$${Math.abs(owner.balance).toLocaleString('es-AR')}</strong>
            </div>
            <div class="form-group">
              <label>Importe a pagar ($)</label>
              <input class="input" type="number" id="balance-amount" value="${Math.abs(owner.balance)}" min="1" placeholder="Ingresá el importe">
            </div>
            <div class="form-group">
              <label>Comprobante (PDF o imagen)</label>
              <div class="upload-zone" id="balance-upload-zone" onclick="document.getElementById('balance-file-input').click()">
                <div class="upload-icon-wrap">${SVG.upload}</div>
                <p class="upload-title">Arrastrá tu archivo aquí</p>
                <p class="upload-desc">o hacé clic para seleccionar</p>
                <span class="upload-badge">PDF o imagen · máx. 10 MB</span>
              </div>
              <input type="file" id="balance-file-input" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic" class="hidden" onchange="handleBalanceFileSelect(event)">
              <div id="balance-file-preview" class="hidden"></div>
            </div>
            <p class="text-sm text-muted" style="text-align:center;font-style:italic">Pago a cuenta de deuda anterior</p>
            <button class="btn btn-primary w-full" id="btn-submit-balance" data-requires-network onclick="submitBalancePayment()">
              ${SVG.upload} Enviar comprobante de deuda
            </button>
          </div>
        </div>`;
    }

    // ── Sección de deuda ─────────────────────────────────────────
    let debtHtml = '';
    if (hasDebt) {
      const periodsHtml = unpaidPeriods.map(p => `
        <label class="op-debt-period-row">
          <input type="checkbox" class="op-debt-check" value="${p}" checked onchange="updateDebtTotal()">
          <span style="flex:1">${formatPeriodLabel(p)}</span>
          <span style="font-size:.88rem;opacity:.7">$${_ownerFee.toLocaleString('es-AR')}</span>
        </label>`).join('');

      debtHtml = `
        <div class="card oh-entry op-debt-card" style="--delay:60ms">
          <div class="card-body flex col gap-2">
            <div class="flex between" style="align-items:center">
              <h2 style="font-size:1rem;font-weight:700">⚠ Saldar deuda</h2>
              <span class="badge badge-danger">${unpaidPeriods.length} período${unpaidPeriods.length > 1 ? 's' : ''}</span>
            </div>
            <p class="text-sm text-muted">Seleccioná los períodos que querés pagar:</p>
            <div class="flex col" style="gap:.35rem" id="debt-periods-list">
              ${periodsHtml}
            </div>
            <div class="flex between" style="align-items:center;padding:.55rem .75rem;background:rgba(255,255,255,.06);border-radius:8px;margin-top:.1rem">
              <span class="text-sm text-muted">Total a pagar</span>
              <strong id="debt-total" style="font-size:1.05rem">$${(_ownerFee * unpaidPeriods.length).toLocaleString('es-AR')}</strong>
            </div>
            ${cfg.hasMercadoPago ? `
            <button class="op-mp-btn" id="btn-pay-debt" onclick="payDebtWithMP()" data-requires-network>
              <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
              Pagar con MercadoPago
            </button>` : ''}
          </div>
        </div>`;
    }

    // ── Sección extraordinarios ──────────────────────────────────
    const extrasHtml = extras.length > 0 ? `
      <div style="margin-top:.5rem">
        <p class="text-sm" style="font-weight:600;margin-bottom:.4rem">Conceptos extraordinarios</p>
        <div class="flex col" style="gap:.35rem">
          ${extras.map(e => `
            <label class="op-debt-period-row">
              <input type="checkbox" class="op-extra-check" value="${e.id}" data-amount="${e.amount}" onchange="toggleExtra(this)">
              <span style="flex:1">${e.title}</span>
              <span class="badge badge-warning" style="font-size:.75rem;margin-right:.35rem">Extraordinario</span>
              <span style="font-size:.88rem;opacity:.7">$${e.amount.toLocaleString('es-AR')}</span>
            </label>`).join('')}
        </div>
      </div>` : '';

    const hasForm = months.length > 0 || extras.length > 0;

    el.innerHTML = `
      <div class="oh-wrap">

        <div class="oh-greeting oh-entry" style="--delay:0ms">
          <div>
            <p class="oh-greeting-sub">Pagos</p>
            <h1 class="oh-greeting-name">Subir Comprobante</h1>
          </div>
          <span class="op-header-icon">${SVG.upload}</span>
        </div>

        ${balanceDebtHtml}

        ${debtHtml}

        <div class="card oh-entry" style="--delay:${hasBalanceDebt || hasDebt ? 120 : 60}ms">
          <div class="card-body flex col gap-2">
            ${!hasForm ? `
            <p class="text-sm text-muted" style="text-align:center;padding:.5rem 0">No hay períodos ni conceptos disponibles para pagar.</p>
            ` : `
            ${months.length > 0 ? `
            <div>
              <p class="text-sm" style="font-weight:600;margin-bottom:.4rem">Períodos</p>
              <div class="op-form-grid">
                <div class="form-group">
                  <label>Período</label>
                  <select class="select" id="pay-month" onchange="updatePayTotal()">
                    <option value="">(ninguno)</option>
                    ${months.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
                  </select>
                </div>
                <div class="form-group">
                  <label>Importe ($)</label>
                  <input class="input" type="number" id="pay-amount" value="${_ownerFee || ''}" placeholder="${_ownerFee || cfg.expenseAmount || ''}" min="1" oninput="updatePayTotal()">
                </div>
              </div>
            </div>` : ''}
            ${extrasHtml}
            <div class="flex between" style="align-items:center;padding:.55rem .75rem;background:rgba(255,255,255,.06);border-radius:8px;margin-top:.25rem">
              <span class="text-sm text-muted">Total</span>
              <strong id="pay-total" style="font-size:1.05rem">$${(_ownerFee || 0).toLocaleString('es-AR')}</strong>
            </div>
            <div class="form-group">
              <label>Comprobante (PDF o imagen)</label>
              <div class="upload-zone" id="upload-zone" onclick="document.getElementById('file-input').click()">
                <div class="upload-icon-wrap">${SVG.pdf}</div>
                <p class="upload-title">Arrastrá tu archivo aquí</p>
                <p class="upload-desc">o hacé clic para seleccionar</p>
                <span class="upload-badge">PDF o imagen · máx. 10 MB</span>
              </div>
              <input type="file" id="file-input" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic" class="hidden" onchange="handleFileSelect(event)">
              <div id="file-preview" class="hidden"></div>
            </div>
            <div class="form-group">
              <label>Nota adicional (opcional)</label>
              <textarea class="input" id="pay-note" placeholder="Ej: Transferencia N° 12345…" rows="2"></textarea>
            </div>
            <button class="btn btn-primary w-full" id="btn-submit-receipt" data-requires-network onclick="submitReceipt()">
              ${SVG.upload} Enviar Comprobante
            </button>
            `}
          </div>
        </div>

        ${!hasDebt && cfg.hasMercadoPago ? `
        <div class="op-divider oh-entry" style="--delay:100ms">
          <span>o pagá online</span>
        </div>

        <div class="op-mp-card oh-entry" style="--delay:140ms">
          <div class="op-mp-card__header">
            <span class="op-mp-card__title">Pagar con MercadoPago</span>
            <svg width="36" height="22" viewBox="0 0 54 32" fill="none" aria-hidden="true">
              <rect width="54" height="32" rx="7" fill="rgba(255,255,255,.18)"/>
              <text x="27" y="22" text-anchor="middle" font-size="13" font-weight="800" fill="white" font-family="Arial,sans-serif">MP</text>
            </svg>
          </div>
          <div class="op-mp-card__amount-row">
            <span class="op-mp-card__amount">$${(_ownerFee || cfg.expenseAmount || 0).toLocaleString('es-AR')}</span>
            <span class="op-mp-card__period">· ${cfg.expenseMonth || ''}</span>
          </div>
          <button class="op-mp-btn" onclick="initMercadoPago()" data-requires-network>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            Ir al checkout seguro
          </button>
          <p class="op-mp-note">Serás redirigido a MercadoPago · Pagá con tarjeta, débito o saldo MP</p>
        </div>` : ''}

      </div>`;

    const zone = document.getElementById('upload-zone');
    if (zone) {
      zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
      zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
      zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); handleFileDrop(e.dataTransfer.files[0]); });
    }
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderUploadPage()');
  }
}

export function toggleExtra(checkbox) {
  if (checkbox.checked) {
    _selectedExtras.add(checkbox.value);
  } else {
    _selectedExtras.delete(checkbox.value);
  }
  updatePayTotal();
}

export function updatePayTotal() {
  const periodAmt  = Number(document.getElementById('pay-amount')?.value || 0);
  const hasPeriod  = !!document.getElementById('pay-month')?.value;
  const extrasAmt  = [..._selectedExtras].reduce((s, id) => s + (_extraAmounts[id] || 0), 0);
  const total      = (hasPeriod ? periodAmt : 0) + extrasAmt;
  const el         = document.getElementById('pay-total');
  if (el) el.textContent = `$${total.toLocaleString('es-AR')}`;
}

export function updateDebtTotal() {
  const checks  = document.querySelectorAll('.op-debt-check:checked');
  const total   = checks.length * _ownerFee;
  const totalEl = document.getElementById('debt-total');
  if (totalEl) totalEl.textContent = `$${total.toLocaleString('es-AR')}`;
  const btn = document.getElementById('btn-pay-debt');
  if (btn) btn.disabled = checks.length === 0;
}

export async function payDebtWithMP() {
  const periods = [...document.querySelectorAll('.op-debt-check:checked')].map(c => c.value);
  if (periods.length === 0) {
    toast('Seleccioná al menos un período para pagar', 'error');
    return;
  }
  await initMercadoPago(periods);
}

export function handleFileSelect(e) { selectedFile = e.target.files[0]; showFilePreview(selectedFile); }
export function handleFileDrop(file)  { selectedFile = file; showFilePreview(file); }

function showFilePreview(file) {
  if (!file) return;
  if (!ALLOWED_TYPES.has(file.type)) {
    toast('Solo se aceptan PDF o imágenes (JPG, PNG, WebP, HEIC).', 'error');
    clearFile();
    return;
  }
  document.getElementById('upload-zone').classList.add('hidden');
  const preview    = document.getElementById('file-preview');
  const isImage    = file.type.startsWith('image/');
  const iconOrThumb = isImage
    ? `<img src="${URL.createObjectURL(file)}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0">`
    : `<div class="upload-preview-icon">${SVG.pdf}</div>`;
  preview.classList.remove('hidden');
  preview.innerHTML = `
    <div class="upload-preview">
      ${iconOrThumb}
      <div style="flex:1;min-width:0">
        <p class="bold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${file.name}</p>
        <small class="text-muted">${(file.size / 1024).toFixed(1)} KB · PDF</small>
      </div>
      <button class="btn-icon" onclick="clearFile()" title="Quitar">✕</button>
    </div>`;
}

export function clearFile() {
  selectedFile = null;
  document.getElementById('file-preview').classList.add('hidden');
  document.getElementById('upload-zone').classList.remove('hidden');
  document.getElementById('file-input').value = '';
}

export async function submitReceipt() {
  const month  = document.getElementById('pay-month')?.value;
  const amount = document.getElementById('pay-amount')?.value;
  const note   = document.getElementById('pay-note')?.value?.trim();
  const extras = [..._selectedExtras];

  if (!month && extras.length === 0) { toast('Seleccioná un período o al menos un concepto extraordinario', 'error'); return; }
  if (month && (!amount || amount < 1)) { toast('Ingresá un importe válido', 'error'); return; }
  if (!selectedFile)                    { toast('Adjuntá el comprobante (PDF o imagen)', 'error'); return; }

  const formData = new FormData();
  if (month) formData.append('month', month);
  if (month) formData.append('amount', amount);
  if (note)  formData.append('ownerNote', note);
  extras.forEach(id => formData.append('extraordinaryIds', id));
  formData.append('receipt', selectedFile);

  const btn = document.getElementById('btn-submit-receipt');
  setBtnLoading(btn, true);

  try {
    await api.payments.create(formData);
    toast('Comprobante enviado. Pendiente de revisión.', 'success');
    selectedFile = null;
    cache.del('owner_home');
    await renderUploadPage();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

export function handleBalanceFileSelect(e) {
  _selectedBalanceFile = e.target.files[0];
  showBalanceFilePreview(_selectedBalanceFile);
}

function showBalanceFilePreview(file) {
  if (!file) return;
  if (!ALLOWED_TYPES.has(file.type)) {
    toast('Solo se aceptan PDF o imágenes (JPG, PNG, WebP, HEIC).', 'error');
    clearBalanceFile();
    return;
  }
  document.getElementById('balance-upload-zone').classList.add('hidden');
  const preview  = document.getElementById('balance-file-preview');
  const isImage  = file.type.startsWith('image/');
  const iconOrThumb = isImage
    ? `<img src="${URL.createObjectURL(file)}" style="width:56px;height:56px;object-fit:cover;border-radius:8px;flex-shrink:0">`
    : `<div class="upload-preview-icon">${SVG.pdf}</div>`;
  preview.classList.remove('hidden');
  preview.innerHTML = `
    <div class="upload-preview">
      ${iconOrThumb}
      <div style="flex:1;min-width:0">
        <p class="bold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${file.name}</p>
        <small class="text-muted">${(file.size / 1024).toFixed(1)} KB</small>
      </div>
      <button class="btn-icon" onclick="clearBalanceFile()" title="Quitar">✕</button>
    </div>`;
}

export function clearBalanceFile() {
  _selectedBalanceFile = null;
  const preview = document.getElementById('balance-file-preview');
  if (preview) preview.classList.add('hidden');
  const zone = document.getElementById('balance-upload-zone');
  if (zone) zone.classList.remove('hidden');
  const input = document.getElementById('balance-file-input');
  if (input) input.value = '';
}

export async function submitBalancePayment() {
  const amount = document.getElementById('balance-amount')?.value;
  if (!amount || Number(amount) < 1) { toast('Ingresá un importe válido', 'error'); return; }
  if (!_selectedBalanceFile)         { toast('Adjuntá el comprobante (PDF o imagen)', 'error'); return; }

  const formData = new FormData();
  formData.append('amount', amount);
  formData.append('receipt', _selectedBalanceFile);

  const btn = document.getElementById('btn-submit-balance');
  setBtnLoading(btn, true);
  try {
    await api.payments.create(formData);
    toast('Comprobante enviado. Pendiente de revisión.', 'success');
    _selectedBalanceFile = null;
    cache.del('owner_home');
    await renderUploadPage();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

window.renderUploadPage       = renderUploadPage;
window.handleFileSelect       = handleFileSelect;
window.handleFileDrop         = handleFileDrop;
window.clearFile              = clearFile;
window.submitReceipt          = submitReceipt;
window.updateDebtTotal        = updateDebtTotal;
window.payDebtWithMP          = payDebtWithMP;
window.toggleExtra            = toggleExtra;
window.updatePayTotal         = updatePayTotal;
window.handleBalanceFileSelect = handleBalanceFileSelect;
window.clearBalanceFile        = clearBalanceFile;
window.submitBalancePayment    = submitBalancePayment;
