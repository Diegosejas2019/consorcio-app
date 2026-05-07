import { toast } from '../../ui/toast.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG, svgIcon } from '../../ui/icons.js';
import { errorState } from '../../ui/helpers.js';
import { setBtnLoading } from '../../ui/loading.js';
import { state } from '../../core/state.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';

let selectedFile  = null;
let _selectedBalanceFile = null;
let _monthlyFee   = 0;
let _ownerFee     = 0;
let _selectedExtras = new Set();
let _extraAmounts   = {};
let _balanceDebtAmount = 0;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);

function currentPeriodCode() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

function isPeriodOverdue(period, dueDayOfMonth = 10) {
  if (!period || !/^\d{4}-\d{2}$/.test(period)) return false;
  const [year, month] = period.split('-').map(Number);
  const dueDay = Math.min(Math.max(Number(dueDayOfMonth) || 10, 1), 28);
  const dueDate = new Date(year, month - 1, dueDay, 23, 59, 59, 999);
  return new Date() > dueDate;
}

export async function renderUploadPage() {
  const el = document.getElementById('page-owner-pay');
  el.innerHTML = `<div class="oh-wrap">${skeleton(4)}</div>`;
  _selectedExtras = new Set();
  _extraAmounts   = {};
  _balanceDebtAmount = 0;

  try {
    const { cfgRes, availRes, payRes, unitsRes } = await getCachedOrFetch(
      'owner-pay',
      CACHE_TTL.PAYMENTS_SHORT,
      async () => {
        const [cfgRes, availRes, payRes, unitsRes] = await Promise.all([
          api.config.get(),
          api.payments.getAvailableItems(),
          api.payments.getAll({ limit: 50 }),
          api.units.getAll(),
        ]);
        return { cfgRes, availRes, payRes, unitsRes };
      }
    );

    const cfg      = cfgRes.data.config;
    const hasMercadoPago = !!cfg.hasMercadoPago;
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
    const currentPeriod = currentPeriodCode();
    const months = (available.periods || []).filter(v => v <= currentPeriod).map(v => ({
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
    const unpaidPeriods   = (cfg.paymentPeriods || [])
      .filter(p => !activePeriods.has(p) && (!startBilling || p >= startBilling) && (!currentPeriod || p <= currentPeriod));

    const isDebtor = owner?.isDebtor || (owner?.balance || 0) < 0;
    const hasDebt  = isDebtor && unpaidPeriods.length > 0;
    const hasPendingBalancePayment = payments.some(p => p.type === 'balance' && p.status === 'pending');
    const hasBalanceDebt = (owner?.balance || 0) < 0 && !hasPendingBalancePayment;
    _balanceDebtAmount = hasBalanceDebt ? Math.abs(Number(owner.balance || 0)) : 0;

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
            ${hasMercadoPago ? `
            <button class="op-mp-btn" id="btn-pay-balance-mp" onclick="payBalanceWithMP()" data-requires-network>
              ${svgIcon('wallet', 16)} Pagar deuda con MercadoPago
            </button>` : ''}
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

    const hasForm = months.length > 0 || extras.length > 0 || hasBalanceDebt;

    // Build all period cards: regular months + extras
    const periodCardsHtml = [
      hasBalanceDebt ? `
        <label class="period-card" data-type="balance" data-value="initial-balance" data-amount="${_balanceDebtAmount}" onclick="togglePeriodCard(this)">
          <span class="pc-check"></span>
          <div style="flex:1;min-width:0">
            <div class="row" style="gap:6px">
              <span class="bright" style="font:var(--t-body-md)">Deuda inicial</span>
              <span class="badge badge-danger">Deuda</span>
            </div>
            <div class="muted" style="font:var(--t-sm);margin-top:2px">Saldo anterior pendiente</div>
          </div>
          <span class="bright tnum" style="font:var(--t-body-md)">$${_balanceDebtAmount.toLocaleString('es-AR')}</span>
        </label>` : '',
      ...months.map((m, i) => {
        const isDebt = isPeriodOverdue(m.value, cfg.dueDayOfMonth);
        const statusBadge = isDebt
          ? `<span class="badge badge-danger">Vencida</span>`
          : `<span class="badge badge-accent">Disponible</span>`;
        return `
          <label class="period-card${i === 0 ? ' is-selected' : ''}" data-type="period" data-value="${m.value}" data-amount="${_ownerFee}" onclick="togglePeriodCard(this)">
            <span class="pc-check${i === 0 ? ' is-on' : ''}">${i === 0 ? svgIcon('check', 12) : ''}</span>
            <div style="flex:1;min-width:0">
              <div class="row" style="gap:6px">
                <span class="bright" style="font:var(--t-body-md)">${m.value ? formatPeriodLabel(m.value) : m.label}</span>
                ${statusBadge}
              </div>
              <div class="muted" style="font:var(--t-sm);margin-top:2px">Expensa ${isDebt ? 'vencida' : 'ordinaria'}</div>
            </div>
            <span class="bright tnum" style="font:var(--t-body-md)">$${_ownerFee.toLocaleString('es-AR')}</span>
          </label>`;
      }),
      ...extras.map(e => `
        <label class="period-card" data-type="extra" data-value="${e.id}" data-amount="${e.amount}" onclick="togglePeriodCard(this)">
          <span class="pc-check"></span>
          <div style="flex:1;min-width:0">
            <div class="row" style="gap:6px">
              <span class="bright" style="font:var(--t-body-md)">${e.title}</span>
              <span class="badge badge-warning">Extra</span>
            </div>
            <div class="muted" style="font:var(--t-sm);margin-top:2px">Concepto extraordinario</div>
          </div>
          <span class="bright tnum" style="font:var(--t-body-md)">$${e.amount.toLocaleString('es-AR')}</span>
        </label>`),
    ].join('');

    const initTotal = months.length > 0 ? _ownerFee : 0;

    el.innerHTML = `
      <div style="padding:0 16px 120px">
        <p class="page-eyebrow">Pagos</p>
        <div class="pay-page-head">
          <div>
            <h1 class="page-title">Pagar</h1>
            <p class="page-sub">Selecciona los conceptos que queres pagar.</p>
          </div>
          <button class="btn btn-ghost pay-history-btn" onclick="showPage('page-owner-history');renderOwnerHistory()">
            ${svgIcon('doc', 16)} Historial
          </button>
        </div>

        <div class="seg" style="margin-top:18px" id="pay-tab-seg">
          <button class="seg-btn is-active" id="tab-upload" onclick="switchPayTab('upload')">${svgIcon('upload', 16)} Subir comprobante</button>
          ${hasMercadoPago ? `
          <button class="seg-btn" id="tab-online" onclick="switchPayTab('online')">${svgIcon('wallet', 16)} Pago online</button>
          ` : ''}
        </div>

        ${hasForm ? `
        <!-- Conceptos a pagar -->
        <div class="section-head" style="margin-top:18px">
          <h3>Conceptos a pagar</h3>
          <span class="muted" style="font:var(--t-xs)" id="period-count">${months.length > 0 ? '1 concepto' : '0 conceptos'}</span>
        </div>
        <div class="stack-2" id="period-cards-list">
          ${periodCardsHtml}
        </div>

        <!-- Total -->
        <div class="card" style="margin-top:14px;padding:14px">
          <div class="row-between">
            <div>
              <div class="muted" style="font:var(--t-xs);letter-spacing:.12em;text-transform:uppercase">Total a pagar</div>
              <div class="muted" style="font:var(--t-xs);margin-top:4px" id="period-count-label">${months.length > 0 ? '1 concepto seleccionado' : '0 conceptos'}</div>
            </div>
            <span class="h-amount tnum accent" style="font-size:30px" id="pay-total">$${initTotal.toLocaleString('es-AR')}</span>
          </div>
        </div>

        <!-- Tab content: Subir comprobante -->
        <div id="panel-upload">
          <div class="section-head"><h3>Comprobante</h3></div>
          <div class="upload-area" id="upload-zone" onclick="document.getElementById('file-input').click()">
            <div style="width:52px;height:52px;border-radius:50%;background:var(--accent-lt);color:var(--accent);display:grid;place-items:center">
              ${svgIcon('upload', 24)}
            </div>
            <div class="bright" style="font:var(--t-h3);margin-top:10px">Arrastrá tu archivo</div>
            <div class="muted" style="font:var(--t-sm);margin-top:4px">o tocá para seleccionar</div>
            <span class="badge" style="margin-top:12px;background:var(--surface-3)">PDF o imagen · máx. 10 MB</span>
          </div>
          <input type="file" id="file-input" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,image/heic,.jpg,.jpeg,.png,.webp,.heic" class="hidden" onchange="handleFileSelect(event)">
          <div id="file-preview" class="hidden"></div>
          <div class="field" style="margin-top:16px">
            <label class="field-label">Nota (opcional)</label>
            <textarea class="input textarea" id="pay-note" placeholder="Ej: Transferencia Nº 12345…"></textarea>
          </div>
          <button class="btn btn-primary btn-lg pay-submit-inline pay-submit-btn" id="btn-submit-receipt-inline" data-requires-network onclick="submitReceipt()">
            ${svgIcon('check', 18)} Enviar comprobante · $${initTotal.toLocaleString('es-AR')}
          </button>
        </div>

        ${hasMercadoPago ? `
        <!-- Tab content: Pago online -->
        <div id="panel-online" class="hidden">
          <div class="card" style="margin-top:16px;background:radial-gradient(120% 100% at 100% 0%,rgba(156,242,123,0.10),transparent 55%),var(--surface);border:1px solid var(--border-md)">
            <div style="padding:16px">
              <div class="row-between">
                <span class="muted" style="font:var(--t-xs);letter-spacing:.12em;text-transform:uppercase">Pago online</span>
                <span class="badge badge-success">Seguro</span>
              </div>
              <div class="h-amount-xl tnum" style="margin-top:12px" id="online-total">$${initTotal.toLocaleString('es-AR')}</div>
              <div class="muted" style="font:var(--t-sm);margin-top:4px" id="online-period-label">Seleccioná períodos arriba</div>
              <div class="stack-3" style="margin-top:16px">
                <button class="btn btn-primary btn-lg btn-block" onclick="initMercadoPagoNew()" data-requires-network>
                  ${svgIcon('wallet', 18)} Ir a MercadoPago
                </button>
                <div class="row" style="justify-content:center;gap:6px;color:var(--muted);font:var(--t-xs)">
                  ${svgIcon('shield', 14)} Pago procesado por MercadoPago
                </div>
              </div>
            </div>
          </div>
        </div>
        ` : ''}
        ` : `
        <div class="empty" style="padding:32px 0">
          <div class="empty-icon">${svgIcon('check', 24)}</div>
          <p class="empty-title">¡Todo al día!</p>
          <p class="empty-sub">No hay períodos pendientes de pago en este momento.</p>
        </div>
        `}

        <!-- Hidden inputs for submit compat -->
        <select id="pay-month" class="hidden">
          <option value=""></option>
          ${months.map((m, i) => `<option value="${m.value}"${i === 0 ? ' selected' : ''}>${m.label}</option>`).join('')}
        </select>
        <input type="number" id="pay-amount" class="hidden" value="${_ownerFee || ''}">
        <input type="number" id="pay-balance-amount" class="hidden" value="">

        <div style="height:24px"></div>
      </div>

      ${hasForm ? `
      <div class="sticky-cta" id="sticky-cta-upload">
        <button class="btn btn-primary btn-lg btn-block pay-submit-btn" id="btn-submit-receipt-sticky" style="box-shadow:var(--glow-accent)" data-requires-network onclick="submitReceipt()">
          ${svgIcon('check', 18)} Enviar comprobante · $${initTotal.toLocaleString('es-AR')}
        </button>
      </div>` : ''}`;

    updatePayTotal();

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

export function togglePeriodCard(el) {
  const card = el.closest('.period-card') || el;
  const isOn = card.classList.toggle('is-selected');
  const check = card.querySelector('.pc-check');
  if (check) {
    check.classList.toggle('is-on', isOn);
    check.innerHTML = isOn ? svgIcon('check', 12) : '';
  }
  if (card.dataset.type === 'extra') {
    const id = card.dataset.value;
    isOn ? _selectedExtras.add(id) : _selectedExtras.delete(id);
  }
  updatePayTotal();
}

export function switchPayTab(tab) {
  const isUpload = tab === 'upload';
  document.getElementById('tab-upload')?.classList.toggle('is-active', isUpload);
  document.getElementById('tab-online')?.classList.toggle('is-active', !isUpload);
  document.getElementById('panel-upload')?.classList.toggle('hidden', !isUpload);
  document.getElementById('panel-online')?.classList.toggle('hidden', isUpload);
  document.getElementById('sticky-cta-upload')?.classList.toggle('hidden', !isUpload);
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
  const selected = [...document.querySelectorAll('.period-card.is-selected')];
  const total    = selected.reduce((s, c) => s + Number(c.dataset.amount || 0), 0);
  const periods  = selected.filter(c => c.dataset.type === 'period').map(c => c.dataset.value);
  const hasBalance = selected.some(c => c.dataset.type === 'balance');
  const count    = selected.length;

  const totalEl   = document.getElementById('pay-total');
  const onlineEl  = document.getElementById('online-total');
  const countEl   = document.getElementById('period-count');
  const labelEl   = document.getElementById('period-count-label');
  const onlineLbl = document.getElementById('online-period-label');
  const ctaBtns   = document.querySelectorAll('.pay-submit-btn');

  const fmt = v => `$${v.toLocaleString('es-AR')}`;
  if (totalEl)   totalEl.textContent  = fmt(total);
  if (onlineEl)  onlineEl.textContent = fmt(total);
  if (countEl)   countEl.textContent  = `${count} concepto${count !== 1 ? 's' : ''}`;
  if (labelEl)   labelEl.textContent  = count > 0 ? `${count} concepto${count !== 1 ? 's' : ''} seleccionado${count !== 1 ? 's' : ''}` : '0 conceptos';
  if (onlineLbl) onlineLbl.textContent = count > 0 ? `${count} concepto${count !== 1 ? 's' : ''}` : 'Selecciona conceptos arriba';
  ctaBtns.forEach(btn => { btn.innerHTML = `${svgIcon('check', 18)} Enviar comprobante · ${fmt(total)}`; });

  // Sync hidden inputs for submitReceipt backward compat
  const monthSel = document.getElementById('pay-month');
  const amtInput = document.getElementById('pay-amount');
  const balanceInput = document.getElementById('pay-balance-amount');
  if (monthSel) monthSel.value = periods.length > 0 ? periods[0] : '';
  if (amtInput) amtInput.value = periods.length > 0 ? _ownerFee : '';
  if (balanceInput) balanceInput.value = hasBalance ? _balanceDebtAmount : '';
}

function getSelectedPaymentConcepts() {
  const selected = [...document.querySelectorAll('.period-card.is-selected')];
  return {
    periods: selected.filter(c => c.dataset.type === 'period').map(c => c.dataset.value),
    extras: selected.filter(c => c.dataset.type === 'extra').map(c => c.dataset.value),
    balanceAmount: selected.some(c => c.dataset.type === 'balance') ? _balanceDebtAmount : 0,
  };
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

export async function payBalanceWithMP() {
  const amount = Number(document.getElementById('balance-amount')?.value || 0);
  if (!amount || amount < 1) {
    toast('Ingresá un importe válido', 'error');
    return;
  }
  await initMercadoPago({ balanceAmount: amount });
}

export async function initMercadoPagoNew() {
  const selected = [...document.querySelectorAll('.period-card.is-selected')];
  if (selected.length === 0) {
    toast('Seleccioná al menos un período para pagar', 'error');
    return;
  }
  const periods = selected.filter(c => c.dataset.type === 'period').map(c => c.dataset.value);
  const extraordinaryIds = selected.filter(c => c.dataset.type === 'extra').map(c => c.dataset.value);
  const balanceAmount = selected.some(c => c.dataset.type === 'balance') ? _balanceDebtAmount : 0;
  await initMercadoPago({ periods, extraordinaryIds, balanceAmount });
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
  const { periods, extras, balanceAmount } = getSelectedPaymentConcepts();
  const month  = periods[0] || document.getElementById('pay-month')?.value;
  const amount = periods.length > 0 ? document.getElementById('pay-amount')?.value : '';
  const note   = document.getElementById('pay-note')?.value?.trim();
  const isBalanceOnly = balanceAmount > 0 && !month && extras.length === 0;

  if (balanceAmount > 0 && (periods.length > 0 || extras.length > 0)) {
    toast('Para subir comprobante, paga la deuda inicial en un comprobante separado.', 'error');
    return;
  }

  if (isBalanceOnly) {
    if (!selectedFile) { toast('Adjunta el comprobante (PDF o imagen)', 'error'); return; }
    const formData = new FormData();
    formData.append('balanceAmount', String(balanceAmount));
    if (note) formData.append('ownerNote', note);
    formData.append('receipt', selectedFile);

    const buttons = [...document.querySelectorAll('.pay-submit-btn')];
    buttons.forEach(btn => setBtnLoading(btn, true));
    try {
      await api.payments.create(formData);
      toast('Comprobante enviado. Pendiente de revision.', 'success');
      selectedFile = null;
      window.gestionarInvalidateCaches?.('payments');
      await renderUploadPage();
    } catch (err) {
      toast(err.message, 'error');
    } finally {
      buttons.forEach(btn => setBtnLoading(btn, false));
    }
    return;
  }

  if (!month && extras.length === 0) { toast('Seleccioná un período o al menos un concepto extraordinario', 'error'); return; }
  if (month && (!amount || amount < 1)) { toast('Ingresá un importe válido', 'error'); return; }
  if (!selectedFile)                    { toast('Adjuntá el comprobante (PDF o imagen)', 'error'); return; }

  const formData = new FormData();
  periods.forEach(period => formData.append('periods', period));
  if (month) formData.append('month', month);
  if (month) formData.append('amount', amount);
  if (note)  formData.append('ownerNote', note);
  extras.forEach(id => formData.append('extraordinaryIds', id));
  formData.append('receipt', selectedFile);

  const buttons = [...document.querySelectorAll('.pay-submit-btn')];
  buttons.forEach(btn => setBtnLoading(btn, true));

  try {
    await api.payments.create(formData);
    toast('Comprobante enviado. Pendiente de revisión.', 'success');
    selectedFile = null;
    window.gestionarInvalidateCaches?.('payments');
    await renderUploadPage();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    buttons.forEach(btn => setBtnLoading(btn, false));
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
    window.gestionarInvalidateCaches?.('payments');
    await renderUploadPage();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

window.renderUploadPage        = renderUploadPage;
window.handleFileSelect        = handleFileSelect;
window.handleFileDrop          = handleFileDrop;
window.clearFile               = clearFile;
window.submitReceipt           = submitReceipt;
window.updateDebtTotal         = updateDebtTotal;
window.payDebtWithMP           = payDebtWithMP;
window.payBalanceWithMP        = payBalanceWithMP;
window.toggleExtra             = toggleExtra;
window.updatePayTotal          = updatePayTotal;
window.handleBalanceFileSelect = handleBalanceFileSelect;
window.clearBalanceFile        = clearBalanceFile;
window.submitBalancePayment    = submitBalancePayment;
window.togglePeriodCard        = togglePeriodCard;
window.switchPayTab            = switchPayTab;
window.initMercadoPagoNew      = initMercadoPagoNew;
