import { state } from '../../core/state.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';
import { showPage, PAGE_RENDERERS } from '../../core/router.js';
import { isFeatureEnabled } from '../../services/featureService.js';
import { skeleton } from '../../ui/skeleton.js';
import { formatDate, errorState } from '../../ui/helpers.js';
import { svgIcon } from '../../ui/icons.js';

export function renderOwnerView() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  const saved = localStorage.getItem('lastPage_owner');
  const page  = saved && document.getElementById(saved) ? saved : 'page-owner-home';
  showPage(page);
  PAGE_RENDERERS[page]?.();
}

// ─── Helpers ──────────────────────────────────────────────────

function deriveStatus(payments, cfg, owner, availablePeriods = []) {
  const code    = cfg.expenseMonthCode;
  const paid    = code ? payments.find(p => p.month === code && p.status === 'approved') : null;
  const pending = code ? payments.find(p => p.month === code && p.status === 'pending')  : null;
  const latestPendingMonthly = payments.find(p => p.status === 'pending' && p.type === 'monthly');
  const currentPeriodHidden = code && !availablePeriods.includes(code);
  const fallbackPending = !paid && !pending && (!code || currentPeriodHidden) ? latestPendingMonthly : null;
  if (pending || fallbackPending) return { kind: 'pending', tone: 'yellow', label: 'Comprobante enviado', payment: pending || fallbackPending };
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

function noticeMeta(tag) {
  const m = {
    urgent:  { color: 'var(--danger)',  bg: 'var(--danger-bg)',  icon: 'alert',     label: 'Urgente' },
    warning: { color: 'var(--warning)', bg: 'var(--warning-bg)', icon: 'alert',     label: 'Importante' },
    info:    { color: 'var(--info)',    bg: 'var(--info-bg)',     icon: 'megaphone', label: 'Aviso' },
  };
  return m[tag] || m.info;
}

function noticePreview(n) {
  const meta  = noticeMeta(n.tag);
  const unread = !n.isRead;
  return `
    <div class="list-item" style="position:relative">
      ${unread ? `<span style="position:absolute;left:-2px;top:50%;transform:translateY(-50%);width:3px;height:28px;border-radius:4px;background:var(--accent);box-shadow:0 0 8px var(--accent)"></span>` : ''}
      <div class="list-icon" style="background:${meta.bg};color:${meta.color}">${svgIcon(meta.icon, 18)}</div>
      <div class="list-body">
        <p class="list-title" style="font-weight:${unread ? 600 : 500}">${n.title}</p>
        <p class="list-sub">${formatDate(n.createdAt)}</p>
      </div>
      <span class="list-trail">${svgIcon('chevron-r', 16)}</span>
    </div>`;
}

function heroStatusBadge(status) {
  const map = {
    paid:    { cls: 'badge-success', dot: 's-success', label: 'Al día' },
    pending: { cls: 'badge-warning', dot: 's-warning', label: 'Comprobante enviado' },
    overdue: { cls: 'badge-danger',  dot: 's-danger',  label: 'Vencido' },
    due:     { cls: 'badge-warning', dot: 's-warning', label: 'Próximo a vencer' },
  };
  return map[status.kind] || map.due;
}

function heroInfoHtml(status, due, progressPct) {
  if (status.kind === 'pending') {
    const sentDate = status.payment?.createdAt ? formatDate(status.payment.createdAt) : null;
    return `
      <div style="display:flex;align-items:center;gap:12px;margin-top:16px;margin-bottom:16px;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:12px">
        <div style="width:44px;height:44px;border-radius:12px;background:var(--warning-bg);color:var(--warning);display:grid;place-items:center;flex-shrink:0">
          ${svgIcon('check', 20)}
        </div>
        <div style="flex:1">
          <div class="bright" style="font:var(--t-body-md)">Comprobante en revisión</div>
          <div class="muted" style="font:var(--t-sm);margin-top:2px">${sentDate ? `Enviado el ${sentDate}. ` : ''}Te avisamos cuando el administrador lo apruebe.</div>
        </div>
      </div>`;
  }

  if (due.days === null) return `<div style="height:20px"></div>`;

  return `
    <div style="display:flex;align-items:center;gap:12px;margin-top:16px;padding:12px 14px;background:var(--surface-2);border:1px solid var(--border);border-radius:12px">
      <div style="width:44px;height:44px;border-radius:12px;background:var(--warning-bg);color:var(--warning);display:grid;place-items:center;flex-shrink:0">
        ${svgIcon('calendar', 20)}
      </div>
      <div style="flex:1">
        <div class="bright" style="font:var(--t-body-md)">Vence el <span style="color:var(--warning)">${due.label}</span></div>
        <div class="muted tnum" style="font:var(--t-sm);margin-top:2px">en ${due.days} días · 23:59hs</div>
      </div>
    </div>
    <div class="progress" style="margin-top:14px;margin-bottom:16px"><span style="width:${progressPct}%"></span></div>`;
}

function heroCtaHtml(status, amount, cfg) {
  const amtStr = `$${amount.toLocaleString('es-AR')}`;
  if (status.kind === 'paid') {
    return `
      <button class="btn btn-primary btn-lg btn-block" style="height:52px;font-size:15px" onclick="showPage('page-owner-history');renderOwnerHistory()">
        ${svgIcon('check', 18)} Ver historial de pagos ${svgIcon('arrow-r', 14)}
      </button>`;
  }
  if (status.kind === 'pending') {
    return `
      <button class="btn btn-primary btn-lg btn-block" style="height:52px;font-size:15px;background:var(--warning);border-color:var(--warning);color:#0a1408" onclick="showPage('page-owner-pay');renderUploadPage()">
        ${svgIcon('check', 18)} Ver estado del comprobante
      </button>`;
  }
  if (status.kind === 'overdue') {
    return `
      <button class="btn btn-primary btn-lg btn-block" style="height:52px;font-size:15px;background:var(--danger);border-color:var(--danger);color:#fff" onclick="showPage('page-owner-pay');renderUploadPage()">
        ${svgIcon('alert', 18)} Regularizar deuda
      </button>`;
  }
  return `
    <button class="btn btn-primary btn-lg btn-block" style="height:52px;font-size:15px" onclick="showPage('page-owner-pay');renderUploadPage()">
      ${svgIcon('upload', 18)} Subir comprobante ${svgIcon('arrow-r', 14)}
    </button>
    ${cfg.hasMercadoPago ? `<button class="btn btn-ghost btn-block" style="height:44px;margin-top:8px" onclick="showPage('page-owner-pay');renderUploadPage()">
      ${svgIcon('wallet', 16)} Pagar online
    </button>` : ''}`;
}

// ─── Render principal ─────────────────────────────────────────��

export async function renderOwnerHome() {
  const el = document.getElementById('page-owner-home');
  el.innerHTML = `<div style="padding:16px">${skeleton(5)}</div>`;

  try {
    const { cfgRes, payRes, unitsRes, notices } = await getCachedOrFetch(
      'owner-home',
      CACHE_TTL.OWNER_HOME,
      async () => {
        const [cfgRes, payRes, unitsRes, notRes] = await Promise.all([
          api.config.get(),
          api.payments.getAll({ limit: 20 }),
          api.units.getAll(),
          api.notices.getAll({ limit: 3 }).catch(() => ({ data: { notices: [] } })),
        ]);
        return { cfgRes, payRes, unitsRes, notices: notRes.data.notices || [] };
      }
    );

    const cfg      = cfgRes.data.config;
    const payments = payRes.data.payments;
    const owner    = { ...state.user, ...(state.membership || {}) };
    const units    = unitsRes.data?.units || [];

    const status       = deriveStatus(payments, cfg, owner, payRes.data.periods || []);
    const due          = nextDueInfo(cfg.dueDayOfMonth);
    const lastApproved = payments.find(p => p.status === 'approved');
    const firstName    = owner.name?.split(' ')[0] || 'Propietario';
    const unreadCount  = notices.filter(n => !n.isRead).length;

    const amount = units.length > 0
      ? units.reduce((s, u) => s + (u.finalFee || 0), 0)
      : (cfg.monthlyFee || 0);

    const unitLabel = units.length > 0
      ? units.map(u => u.name).join(', ')
      : (owner.unit || '');

    const periodLabel = cfg.expenseMonth || '—';

    // Status badge config
    const badge = heroStatusBadge(status);

    // Time progress in period (rough: day/28)
    const dayOfMonth  = new Date().getDate();
    const dueDay      = cfg.dueDayOfMonth || 10;
    const progressPct = Math.min(100, Math.round((dayOfMonth / dueDay) * 100));

    // Glow color for hero based on status
    const glowColor = status.kind === 'overdue'
      ? 'rgba(240,138,138,0.18)'
      : status.kind === 'paid'
        ? 'rgba(110,232,151,0.12)'
        : 'rgba(245,194,101,0.18)';

    el.innerHTML = `
      <div style="padding:0 16px 96px">
        <p class="page-eyebrow">${shortDate()}</p>
        <h1 class="greeting">Hola, <span>${firstName}</span></h1>
        ${unitLabel ? `<p class="page-sub" style="margin-top:4px">${cfg.consortiumName || ''} ${unitLabel}</p>` : ''}

        <!-- Hero estado de cuota -->
        <div class="card-hero hero-due" style="margin-top:18px">
          <div aria-hidden style="position:absolute;top:-60px;right:-60px;width:220px;height:220px;border-radius:50%;background:radial-gradient(circle,${glowColor},transparent 70%);pointer-events:none"></div>

          <div class="row-between" style="margin-bottom:14px">
            <span class="badge ${badge.cls}">
              <span class="dot-status ${badge.dot}" style="margin-right:2px"></span>
              ${badge.label}
            </span>
            <span class="muted" style="font:var(--t-xs);letter-spacing:.12em;text-transform:uppercase">${periodLabel}</span>
          </div>

          <div class="muted" style="font:var(--t-xs);letter-spacing:.12em;text-transform:uppercase;margin-bottom:4px">Tu cuota de este mes</div>
          <div class="h-amount-xl tnum" style="font-size:52px">$${amount.toLocaleString('es-AR')}</div>

          ${heroInfoHtml(status, due, progressPct)}

          ${heroCtaHtml(status, amount, cfg)}
        </div>

        <!-- Acciones rápidas -->
        <div class="section-head"><h3>Acciones rápidas</h3></div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px">
          <button class="qa-card" onclick="showPage('page-owner-notices');renderOwnerNotices()">
            <div class="qa-icon">
              ${svgIcon('megaphone', 20)}
              ${unreadCount > 0 ? '<span class="qa-badge"></span>' : ''}
            </div>
            <div>
              <div class="qa-label">Comunicados</div>
              <div class="qa-hint">${unreadCount > 0 ? `${unreadCount} nuevos` : 'Sin novedades'}</div>
            </div>
          </button>
          <button class="qa-card" onclick="showPage('page-owner-claims');renderOwnerClaims()">
            <div class="qa-icon">${svgIcon('wrench', 20)}</div>
            <div>
              <div class="qa-label">Nuevo reclamo</div>
              <div class="qa-hint">Reportá un problema</div>
            </div>
          </button>
          ${isFeatureEnabled('reservations') ? `<button class="qa-card" onclick="showPage('page-owner-reservations');renderOwnerReservations()">
            <div class="qa-icon">${svgIcon('court', 20)}</div>
            <div>
              <div class="qa-label">Reservar espacio</div>
              <div class="qa-hint">Pileta · SUM · Cancha</div>
            </div>
          </button>` : ''}
          ${isFeatureEnabled('visits') ? `<button class="qa-card" onclick="showPage('page-owner-visits');renderOwnerVisits()">
            <div class="qa-icon">${svgIcon('visit', 20)}</div>
            <div>
              <div class="qa-label">Visitas</div>
              <div class="qa-hint">Autorizar ingreso</div>
            </div>
          </button>` : ''}
        </div>

        <!-- Último pago -->
        ${lastApproved ? `
        <div class="section-head">
          <h3>Último pago</h3>
          <a href="#" onclick="event.preventDefault();showPage('page-owner-history');renderOwnerHistory()">Ver historial →</a>
        </div>
        <div class="list-item">
          <div class="list-icon" style="background:var(--success-bg);color:var(--success)">${svgIcon('check', 18)}</div>
          <div class="list-body">
            <p class="list-title">${lastApproved.monthFormatted || lastApproved.month || 'Pago'}</p>
            <p class="list-sub">${formatDate(lastApproved.createdAt)} · ${lastApproved.channel === 'mercadopago' ? 'MercadoPago' : 'Comprobante'}</p>
          </div>
          <div style="text-align:right">
            <div class="bright tnum" style="font:var(--t-body-md)">$${lastApproved.amount.toLocaleString('es-AR')}</div>
            <span class="badge badge-success" style="margin-top:4px">Aprobado</span>
          </div>
        </div>` : ''}

        <!-- Novedades -->
        <div class="section-head">
          <h3>Novedades</h3>
          <a href="#" onclick="event.preventDefault();showPage('page-owner-notices');renderOwnerNotices()">Ver todo →</a>
        </div>
        ${notices.length > 0
          ? `<div class="stack-2">${notices.slice(0,2).map(n => noticePreview(n)).join('')}</div>`
          : `<div class="empty" style="padding:20px 0"><div class="empty-sub">Sin avisos por el momento</div></div>`
        }

        <div style="height:24px"></div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerHome()');
  }
}

function shortDate() {
  const d = new Date();
  const days   = ['Dom','Lun','Mar','Mié','Jue','Vie','Sáb'];
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${days[d.getDay()]} ${d.getDate()} ${months[d.getMonth()]}`;
}

window.renderOwnerView = renderOwnerView;
window.renderOwnerHome = renderOwnerHome;
