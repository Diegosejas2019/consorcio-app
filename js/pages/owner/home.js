import { state } from '../../core/state.js';
import { showPage, PAGE_RENDERERS } from '../../core/router.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { formatMonth, formatDate, noticeCard, errorState } from '../../ui/helpers.js';

export function renderOwnerView() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const saved = localStorage.getItem('lastPage_owner');
  const page  = saved && document.getElementById(saved) ? saved : 'page-owner-home';
  showPage(page);
  PAGE_RENDERERS[page]?.();
}

export async function renderOwnerHome() {
  const el = document.getElementById('page-owner-home');
  el.innerHTML = `<div class="oh-wrap">${skeleton(5)}</div>`;

  try {
    const [cfgRes, payRes] = await Promise.all([
      api.config.get(),
      api.payments.getAll({ limit: 10 }),
    ]);

    const cfg      = cfgRes.data.config;
    const payments = payRes.data.payments;
    const owner    = state.user;

    const pending  = payments.filter(p => p.status === 'pending').length;
    const lastPay  = payments.find(p => p.status === 'approved');
    const balance  = owner.balance || 0;
    const isDebtor = owner.isDebtor;

    let noticesHtml = '';
    try {
      const notRes = await api.notices.getAll({ limit: 2 });
      noticesHtml = notRes.data.notices.map(n => noticeCard(n)).join('');
    } catch { noticesHtml = ''; }

    el.innerHTML = `
      <div class="oh-wrap">

        <div class="oh-greeting oh-entry" style="--delay:0ms">
          <div>
            <p class="oh-greeting-sub">Bienvenido/a</p>
            <h1 class="oh-greeting-name">${owner.name}</h1>
          </div>
          ${owner.unit ? `<span class="oh-unit-chip">${owner.unit}</span>` : ''}
        </div>

        <div class="oh-balance-card oh-entry" style="--delay:60ms">
          <div class="oh-balance-card__header">
            <span class="oh-balance-card__label">Saldo actual</span>
            <span class="oh-balance-card__status ${isDebtor ? 'oh-status-debt' : 'oh-status-ok'}">
              ${isDebtor ? '⚠ Deuda' : '✓ Al día'}
            </span>
          </div>
          <div class="oh-balance-card__amount ${balance < 0 ? 'oh-amount-debt' : 'oh-amount-ok'}">
            ${balance < 0 ? '-' : ''}$${Math.abs(balance).toLocaleString('es-AR')}
          </div>
          <div class="oh-balance-card__footer">
            <div class="oh-balance-card__meta">
              <span>Expensa</span>
              <strong>$${(cfg.expenseAmount || 0).toLocaleString('es-AR')}</strong>
            </div>
            <div class="oh-balance-card__sep"></div>
            <div class="oh-balance-card__meta">
              <span>Período</span>
              <strong>${cfg.expenseMonth || '—'}</strong>
            </div>
          </div>
        </div>

        ${pending > 0 ? `
        <div class="oh-alert oh-entry" style="--delay:100ms">
          <span class="oh-alert-icon">⏳</span>
          <span>Tenés <strong>${pending}</strong> comprobante${pending > 1 ? 's' : ''} pendiente${pending > 1 ? 's' : ''} de revisión.</span>
        </div>` : ''}

        <button class="oh-cta oh-entry" style="--delay:${pending > 0 ? 140 : 100}ms" onclick="showPage('page-owner-pay');renderUploadPage()">
          <span class="oh-cta-icon">${SVG.upload}</span>
          <span class="oh-cta-text">
            <span class="oh-cta-label">Subir Comprobante</span>
            <span class="oh-cta-sub">PDF o imagen · pago del mes</span>
          </span>
          <span class="oh-cta-arrow">›</span>
        </button>

        ${lastPay ? `
        <div class="oh-last-pay oh-entry" style="--delay:160ms">
          <div>
            <p class="oh-last-pay__label">Último pago aprobado</p>
            <p class="oh-last-pay__amount">$${lastPay.amount.toLocaleString('es-AR')}</p>
          </div>
          <div class="oh-last-pay__right">
            <span class="badge badge-success">${SVG.check} Aprobado</span>
            <small>${formatMonth(lastPay.month)} · ${formatDate(lastPay.createdAt)}</small>
          </div>
        </div>` : ''}

        <div class="oh-entry" style="--delay:${lastPay ? 200 : 160}ms">
          <div class="flex between" style="margin-bottom:.75rem;align-items:center">
            <h2 class="oh-section-title">Avisos recientes</h2>
            <button class="btn btn-ghost btn-sm" onclick="showPage('page-owner-notices');renderOwnerNotices()">Ver todos</button>
          </div>
          <div class="flex col gap-1 oh-notices">
            ${noticesHtml || '<p class="text-muted text-sm">Sin avisos por el momento.</p>'}
          </div>
        </div>

      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerHome()');
  }
}

window.renderOwnerView = renderOwnerView;
window.renderOwnerHome = renderOwnerHome;
