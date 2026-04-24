import { setState, cache } from '../../core/state.js';
import { toast } from '../../ui/toast.js';

const CONFIGS = {
  success: {
    icon: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="36" cy="36" r="36" fill="rgba(34,197,94,0.12)"/>
      <circle cx="36" cy="36" r="26" fill="rgba(34,197,94,0.18)"/>
      <path d="M23 36l9 9 17-17" stroke="#22C55E" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>`,
    color:    'var(--success)',
    title:    '¡Pago realizado!',
    subtitle: 'Tu pago fue procesado exitosamente. En breve recibirás una confirmación por email.',
    btnLabel: 'Ir al inicio',
    btnPage:  'page-owner-home',
    btnFn:    'renderOwnerHome',
  },
  pending: {
    icon: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="36" cy="36" r="36" fill="rgba(251,191,36,0.12)"/>
      <circle cx="36" cy="36" r="26" fill="rgba(251,191,36,0.18)"/>
      <path d="M36 24v12l7 7" stroke="#FBBF24" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/>
      <circle cx="36" cy="36" r="14" stroke="#FBBF24" stroke-width="2.5" fill="none"/>
    </svg>`,
    color:    'var(--warning)',
    title:    'Pago en proceso',
    subtitle: 'Tu pago está siendo verificado por MercadoPago. Te notificaremos cuando se confirme.',
    btnLabel: 'Ir al inicio',
    btnPage:  'page-owner-home',
    btnFn:    'renderOwnerHome',
  },
  failure: {
    icon: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="36" cy="36" r="36" fill="rgba(248,113,113,0.12)"/>
      <circle cx="36" cy="36" r="26" fill="rgba(248,113,113,0.18)"/>
      <path d="M27 27l18 18M45 27L27 45" stroke="#F87171" stroke-width="3.5" stroke-linecap="round"/>
    </svg>`,
    color:    'var(--danger)',
    title:    'Pago no completado',
    subtitle: 'No se pudo procesar el pago. Podés intentarlo nuevamente o subir un comprobante manualmente.',
    btnLabel: 'Volver a Pagos',
    btnPage:  'page-owner-pay',
    btnFn:    'renderUploadPage',
  },
};

function resolvePaymentStatus() {
  const path = window.location.pathname;
  if (path.includes('/pago/exitoso'))   return 'success';
  if (path.includes('/pago/fallido'))   return 'failure';
  if (path.includes('/pago/pendiente')) return 'pending';
  const s = new URLSearchParams(window.location.search).get('status') || '';
  if (s === 'approved') return 'success';
  if (s === 'rejected') return 'failure';
  return 'pending';
}

export async function renderPaymentResult() {
  const el = document.getElementById('page-owner-pago-resultado');
  if (!el) return;

  const status = resolvePaymentStatus();

  // Limpiar la URL para que el back button no vuelva al resultado
  window.history.replaceState({}, '', '/');

  const cfg = CONFIGS[status] || CONFIGS.pending;

  el.innerHTML = `
    <div class="oh-wrap" style="min-height:80vh;display:flex;flex-direction:column;align-items:center;justify-content:center;text-align:center;padding:2rem 1.25rem">
      <div class="oh-entry" style="--delay:0ms;display:flex;flex-direction:column;align-items:center;gap:1.5rem;max-width:340px;width:100%">

        <div style="animation:pr-pop .45s cubic-bezier(.34,1.56,.64,1) both;animation-delay:.05s">
          ${cfg.icon}
        </div>

        <div style="display:flex;flex-direction:column;gap:.5rem">
          <h1 style="font-size:1.5rem;color:${cfg.color};letter-spacing:-.03em">${cfg.title}</h1>
          <p class="text-muted text-sm" style="line-height:1.65">${cfg.subtitle}</p>
        </div>

        ${status !== 'success' ? `
        <button
          class="btn btn-primary w-full"
          style="margin-top:.5rem;padding:.85rem"
          onclick="window.showPage('${cfg.btnPage}'); window['${cfg.btnFn}']?.()">
          ${cfg.btnLabel}
        </button>` : ''}

        ${status === 'failure' ? `
        <button
          class="btn w-full"
          style="padding:.75rem;background:var(--surface);color:var(--text);border:1px solid var(--border-md)"
          onclick="window.showPage('page-owner-home'); window.renderOwnerHome?.()">
          Ir al inicio
        </button>` : ''}

      </div>
    </div>

    <style>
      @keyframes pr-pop {
        from { opacity:0; transform:scale(.6); }
        to   { opacity:1; transform:scale(1); }
      }
    </style>`;

  if (status === 'success') {
    try {
      const res = await api.auth.getMe();
      setState({ user: res.data.user });
      cache.clear();
    } catch (_) {}
    setTimeout(() => {
      window.showPage?.('page-owner-pay');
      window.renderUploadPage?.();
    }, 1500);
  }
}

window.renderPaymentResult = renderPaymentResult;
