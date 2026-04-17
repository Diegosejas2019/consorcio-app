import { toast } from '../../ui/toast.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { errorState } from '../../ui/helpers.js';
import { setBtnLoading } from '../../ui/loading.js';
import { cache } from '../../core/state.js';

let selectedFile = null;
const ALLOWED_TYPES = new Set(['application/pdf', 'image/jpeg', 'image/png', 'image/webp', 'image/heic']);

export async function renderUploadPage() {
  const el = document.getElementById('page-owner-pay');
  el.innerHTML = `<div class="oh-wrap">${skeleton(4)}</div>`;

  try {
    const cfgRes = await api.config.get();
    const cfg    = cfgRes.data.config;
    const months = cfg.paymentPeriods?.length
      ? cfg.paymentPeriods.map(v => ({ value: v, label: formatPeriodLabel(v) }))
      : getRecentMonths(6);

    el.innerHTML = `
      <div class="oh-wrap">

        <div class="oh-greeting oh-entry" style="--delay:0ms">
          <div>
            <p class="oh-greeting-sub">Pagos</p>
            <h1 class="oh-greeting-name">Subir Comprobante</h1>
          </div>
          <span class="op-header-icon">${SVG.upload}</span>
        </div>

        <div class="card oh-entry" style="--delay:60ms">
          <div class="card-body flex col gap-2">
            <div class="op-form-grid">
              <div class="form-group">
                <label>Período</label>
                <select class="select" id="pay-month">
                  ${months.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
                </select>
              </div>
              <div class="form-group">
                <label>Importe ($)</label>
                <input class="input" type="number" id="pay-amount" placeholder="${cfg.expenseAmount}" min="1">
              </div>
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
          </div>
        </div>

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
            <span class="op-mp-card__amount">$${(cfg.expenseAmount || 0).toLocaleString('es-AR')}</span>
            <span class="op-mp-card__period">· ${cfg.expenseMonth || ''}</span>
          </div>
          <button class="op-mp-btn" onclick="initMercadoPago()" data-requires-network>
            <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.5" width="16" height="16"><path d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14"/></svg>
            Ir al checkout seguro
          </button>
          <p class="op-mp-note">Serás redirigido a MercadoPago · Pagá con tarjeta, débito o saldo MP</p>
        </div>

      </div>`;

    const zone = document.getElementById('upload-zone');
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); handleFileDrop(e.dataTransfer.files[0]); });
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderUploadPage()');
  }
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

  if (!month)               { toast('Seleccioná el período', 'error'); return; }
  if (!amount || amount < 1) { toast('Ingresá un importe válido', 'error'); return; }
  if (!selectedFile)         { toast('Adjuntá el comprobante (PDF o imagen)', 'error'); return; }

  const formData = new FormData();
  formData.append('month', month);
  formData.append('amount', amount);
  if (note) formData.append('ownerNote', note);
  formData.append('receipt', selectedFile);

  const btn = document.getElementById('btn-submit-receipt');
  setBtnLoading(btn, true);

  try {
    await api.payments.create(formData);
    toast('Comprobante enviado. Pendiente de revisión.', 'success');
    clearFile();
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-note').value   = '';
    cache.del('owner_home');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

window.renderUploadPage  = renderUploadPage;
window.handleFileSelect  = handleFileSelect;
window.handleFileDrop    = handleFileDrop;
window.clearFile         = clearFile;
window.submitReceipt     = submitReceipt;
