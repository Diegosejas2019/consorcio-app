import { state } from '../../core/state.js';
import { showPage, PAGE_RENDERERS } from '../../core/router.js';
import { skeleton } from '../../ui/skeleton.js';
import { formatDate, errorState } from '../../ui/helpers.js';

export function renderOwnerView() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const saved = localStorage.getItem('lastPage_owner');
  const page  = saved && document.getElementById(saved) ? saved : 'page-owner-home';
  showPage(page);
  PAGE_RENDERERS[page]?.();
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(payments, cfg, owner) {
  const code    = cfg.expenseMonthCode;
  const paid    = code ? payments.find(p => p.month === code && p.status === 'approved') : null;
  const pending = code ? payments.find(p => p.month === code && p.status === 'pending')  : null;
  if (pending) return { kind: 'pending', tone: 'yellow', label: 'Pago en revisión', pendingId: pending._id };
  if (paid)    return { kind: 'paid',    tone: 'green',  label: 'Al día',           payment: paid };
  if (owner.isDebtor) return { kind: 'overdue', tone: 'red', label: 'Tenés deuda' };
  return { kind: 'due', tone: 'green', label: 'Próximo a vencer' };
}

function computeStreak(payments) {
  const approved = payments
    .filter(p => p.status === 'approved' && p.month)
    .sort((a, b) => b.month.localeCompare(a.month));
  let streak = 0, prev = null;
  for (const p of approved) {
    if (!prev) { streak = 1; prev = p.month; continue; }
    const [py, pm] = prev.split('-').map(Number);
    const [cy, cm] = p.month.split('-').map(Number);
    if ((py * 12 + pm) - (cy * 12 + cm) === 1) { streak++; prev = p.month; } else break;
  }
  return streak;
}

function nextDueInfo(dueDayOfMonth) {
  if (!dueDayOfMonth) return { label: '—', days: null };
  const now = new Date();
  const candidate = new Date(now.getFullYear(), now.getMonth(), dueDayOfMonth, 23, 59, 59);
  if (candidate <= now) candidate.setMonth(candidate.getMonth() + 1);
  const days = Math.ceil((candidate - now) / 86400000);
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return { label: `${dueDayOfMonth} ${months[candidate.getMonth()]}`, days };
}

function heroContent(status, cfg, lastApproved) {
  const amount = lastApproved ? `$${lastApproved.amount.toLocaleString('es-AR')}` : '';
  const date   = lastApproved ? formatDate(lastApproved.createdAt) : '';
  switch (status.kind) {
    case 'paid':
      return {
        title: `Estás <em>al día</em><br>con tu expensa`,
        desc:  `Ya pagaste <strong>${amount}</strong> el <strong>${date}</strong>.`,
      };
    case 'pending':
      return {
        title: `Tu pago está<br><em>en revisión</em>`,
        desc:  `Subiste el comprobante el <strong>${date}</strong>. Te avisamos cuando se apruebe.`,
      };
    case 'overdue':
      return {
        title: `Tenés pagos<br><em>pendientes</em>`,
        desc:  `Regularizá tu deuda para evitar recargos adicionales.`,
      };
    default:
      return {
        title: `Vence el <em>día ${cfg.dueDayOfMonth || '—'}</em>`,
        desc:  `Subí el comprobante cuando estés listo. Período: <strong>${cfg.expenseMonth || '—'}</strong>.`,
      };
  }
}

function ctaConfig(status, cfg) {
  switch (status.kind) {
    case 'overdue': return { label: 'Regularizar deuda',     sub: `Período: ${cfg.expenseMonth || '—'}` };
    case 'pending': return { label: 'Ver mi comprobante',    sub: 'En revisión por el administrador'    };
    case 'paid':    return { label: 'Adelantar próximo pago', sub: 'Subir comprobante anticipado'        };
    default:        return { label: 'Subir comprobante',     sub: `PDF o imagen · ${cfg.expenseMonth || 'pago del mes'}` };
  }
}

function avisoIcon(tag) {
  const icons = {
    urgent:  { cls: 'oh2-aviso-icon--red',    svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
    warning: { cls: 'oh2-aviso-icon--yellow', svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>' },
    info:    { cls: 'oh2-aviso-icon--blue',   svg: '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>' },
  };
  return icons[tag] || icons.info;
}

function avisoCard(n) {
  const icon   = avisoIcon(n.tag);
  const unread = !n.isRead;
  const body   = n.body?.slice(0, 90) + (n.body?.length > 90 ? '…' : '');
  return `
    <div class="oh2-aviso-row">
      <div class="oh2-aviso-icon ${icon.cls}">${icon.svg}</div>
      <div class="oh2-aviso-body">
        <div class="oh2-aviso-t">${n.title}</div>
        <div class="oh2-aviso-s">${body}</div>
        <div class="oh2-aviso-time">${formatDate(n.createdAt)}</div>
      </div>
      ${unread ? '<span class="oh2-aviso-dot"></span>' : ''}
    </div>`;
}

// ─── Render principal ──────────────────────────────────────────

export async function renderOwnerHome() {
  const el = document.getElementById('page-owner-home');
  el.innerHTML = `<div class="oh2-wrap">${skeleton(5)}</div>`;

  try {
    const [cfgRes, payRes, unitsRes] = await Promise.all([
      api.config.get(),
      api.payments.getAll({ limit: 12 }),
      api.units.getAll(),
    ]);

    const cfg      = cfgRes.data.config;
    const payments = payRes.data.payments;
    const owner    = state.user;
    const units    = unitsRes.data?.units || [];

    let notices = [];
    try {
      const notRes = await api.notices.getAll({ limit: 3 });
      notices = notRes.data.notices || [];
    } catch { /* aviso no crítico */ }

    const status       = deriveStatus(payments, cfg, owner);
    const streak       = computeStreak(payments);
    const due          = nextDueInfo(cfg.dueDayOfMonth);
    const cta          = ctaConfig(status, cfg);
    const hero         = heroContent(status, cfg, payments.find(p => p.status === 'approved'));
    const lastApproved = payments.find(p => p.status === 'approved');
    const firstName    = owner.name?.split(' ')[0] || owner.name || 'Propietario';
    const amount       = units.length > 0
      ? units.reduce((s, u) => s + (u.finalFee || 0), 0)
      : (cfg.monthlyFee || 0);

    const unitLabel = units.length > 0
      ? units.map(u => u.name).join(', ')
      : (owner.unit || '');

    const periodTag = cfg.expenseMonth
      ? cfg.expenseMonth.toUpperCase()
      : '—';

    el.innerHTML = `
      <div class="oh2-wrap">

        <!-- Saludo -->
        <div class="oh2-greet oh-entry" style="--delay:0ms">
          <div class="oh2-hello">${greetingWord()} · ${shortDate()}</div>
          <h1>Hola, <em>${firstName}</em> 👋</h1>
          ${unitLabel ? `<div class="oh2-meta">${cfg.consortiumName || 'Consorcio'} · ${unitLabel}</div>` : ''}
        </div>

        <!-- Hero estado -->
        <div class="oh2-hero oh2-hero--${status.tone} oh-entry" style="--delay:50ms">
          <div class="oh2-hero-top">
            <span class="oh2-hero-tag">${periodTag}</span>
            <span class="oh2-hero-pill oh2-pill--${status.tone}">${status.label}</span>
          </div>
          <div class="oh2-hero-status">${hero.title}</div>
          <div class="oh2-hero-desc">${hero.desc}</div>
          <div class="oh2-hero-stats">
            <div class="oh2-hero-stat">
              <div class="oh2-stat-lbl">PRÓXIMO</div>
              <div class="oh2-stat-v">${due.label}</div>
              ${due.days !== null ? `<div class="oh2-stat-sub">en ${due.days} días</div>` : ''}
            </div>
            <div class="oh2-hero-stat">
              <div class="oh2-stat-lbl">MONTO</div>
              <div class="oh2-stat-v">$${amount.toLocaleString('es-AR')}</div>
              <div class="oh2-stat-sub">expensa fija</div>
            </div>
            <div class="oh2-hero-stat">
              <div class="oh2-stat-lbl">RACHA</div>
              <div class="oh2-stat-v oh2-streak">${streak > 0 ? `${streak} ${streak === 1 ? 'mes' : 'meses'}` : '—'}</div>
              ${streak > 0 ? `<div class="oh2-stat-sub">al día ✓</div>` : '<div class="oh2-stat-sub">sin datos</div>'}
            </div>
          </div>
        </div>

        <!-- CTA principal -->
        <button class="oh2-cta oh2-cta--${status.tone} oh-entry" style="--delay:100ms"
          onclick="showPage('page-owner-pay');renderUploadPage()">
          <div class="oh2-cta-ico">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          </div>
          <div class="oh2-cta-body">
            <div class="oh2-cta-label">${cta.label}</div>
            <div class="oh2-cta-sub">${cta.sub}</div>
          </div>
          <svg class="oh2-cta-chev" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="9 18 15 12 9 6"/></svg>
        </button>

        <!-- Acciones secundarias -->
        <div class="oh2-actions oh-entry" style="--delay:140ms">
          <button class="oh2-action" onclick="showPage('page-owner-history');renderOwnerHistory()">
            <div class="oh2-action-ico">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/></svg>
            </div>
            <div>
              <div class="oh2-action-t">Mi historial</div>
              <div class="oh2-action-s">${payments.filter(p => p.status === 'approved').length} pagos aprobados</div>
            </div>
          </button>
          <button class="oh2-action" onclick="showPage('page-owner-claims');renderOwnerClaims()">
            <div class="oh2-action-ico">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </div>
            <div>
              <div class="oh2-action-t">Nuevo reclamo</div>
              <div class="oh2-action-s">Mantenimiento</div>
            </div>
          </button>
        </div>

        <!-- Último pago aprobado -->
        ${lastApproved ? `
        <div class="oh-entry" style="--delay:170ms">
          <div class="oh2-section-head">
            <h2>Último pago aprobado</h2>
            <button class="btn btn-ghost btn-sm" onclick="showPage('page-owner-history');renderOwnerHistory()">Ver todos →</button>
          </div>
          <div class="oh2-last-pay">
            <div class="oh2-last-pay-ico">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </div>
            <div class="oh2-last-pay-body">
              <div class="oh2-last-pay-amt">$${lastApproved.amount.toLocaleString('es-AR')}</div>
              <div class="oh2-last-pay-meta">
                <span>${periodTag}</span>
                <span>·</span>
                <span>${formatDate(lastApproved.createdAt)}</span>
                <span>·</span>
                <span class="oh2-ok-chip">APROBADO</span>
              </div>
            </div>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" style="color:var(--muted)"><polyline points="9 18 15 12 9 6"/></svg>
          </div>
        </div>` : ''}

        <!-- Avisos -->
        <div class="oh-entry" style="--delay:200ms">
          <div class="oh2-section-head">
            <h2>Novedades del barrio</h2>
            <button class="btn btn-ghost btn-sm" onclick="showPage('page-owner-notices');renderOwnerNotices()">Ver todas →</button>
          </div>
          ${notices.length > 0 ? `
          <div class="oh2-avisos">
            ${notices.map(n => avisoCard(n)).join('')}
          </div>` : `
          <div class="oh2-avisos-empty">Sin avisos por el momento.</div>`}
        </div>

      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerHome()');
  }
}

function greetingWord() {
  const h = new Date().getHours();
  if (h < 12) return 'BUENOS DÍAS';
  if (h < 20) return 'BUENAS TARDES';
  return 'BUENAS NOCHES';
}

function shortDate() {
  const d = new Date();
  const days  = ['DOM','LUN','MAR','MIÉ','JUE','VIE','SÁB'];
  const months = ['ENE','FEB','MAR','ABR','MAY','JUN','JUL','AGO','SEP','OCT','NOV','DIC'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

window.renderOwnerView = renderOwnerView;
window.renderOwnerHome = renderOwnerHome;
