import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG, svgIcon } from '../../ui/icons.js';
import { formatMonth, paymentConceptLabel, statusBadge, errorState, downloadReceipt, downloadSystemReceipt } from '../../ui/helpers.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';

let _dashYear    = new Date().getFullYear();
let _dashPeriod  = 'año'; // 'mes' | 'trimestre' | 'año' | 'todo'
let _dashMonthly = [];
let _dashStats   = {};
let _dashData    = {};
let _allExpenses = [];
let _allOwners   = [];
let _allPayments = [];

const EXPENSE_COLORS = {
  cleaning:       '#7bb8f2',
  security:       '#f5c24a',
  maintenance:    '#9cf27b',
  utilities:      '#4af0c8',
  administration: '#b87bf2',
  other:          '#f07567',
};
const EXPENSE_LABELS = {
  cleaning:       'Limpieza',
  security:       'Seguridad',
  maintenance:    'Mantenimiento',
  utilities:      'Servicios',
  administration: 'Administración',
  other:          'Otros',
};

export async function renderAdminDashboard(year) {
  if (year !== undefined) _dashYear = year;
  const el = document.getElementById('page-admin-dashboard');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(6)}</div>`;
  try {
    const { dashRes, statsRes, expensesRes, ownersRes, paymentsRes } = await getCachedOrFetch(
      `dashboard:page:${_dashYear}`,
      CACHE_TTL.DASHBOARD,
      async () => {
        const [dashRes, statsRes, expensesRes, ownersRes, paymentsRes] = await Promise.all([
          api.payments.getDashboard(_dashYear),
          api.owners.getStats(),
          api.expenses.getAll({ limit: 500 }),
          api.owners.getAll({ limit: 100 }),
          api.payments.getAll({ limit: 500, status: 'approved' }),
        ]);
        return { dashRes, statsRes, expensesRes, ownersRes, paymentsRes };
      }
    );
    _dashData    = dashRes.data;
    _dashStats   = statsRes.data;
    _dashMonthly = _dashData.monthly || [];
    _allExpenses = (expensesRes.data.expenses || []).filter(e => {
      const y = (e.date || e.createdAt || '').slice(0, 4);
      return y === String(_dashYear);
    });
    _allOwners   = ownersRes.data.owners || [];
    _allPayments = (paymentsRes.data.payments || []).filter(p => {
      if (p.month) return p.month.startsWith(String(_dashYear));
      return (p.createdAt || '').startsWith(String(_dashYear));
    });
    _buildAndRender();
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminDashboard()');
  }
}

function _buildAndRender() {
  const el = document.getElementById('page-admin-dashboard');
  if (!el) return;
  el.innerHTML = _buildDashboard();
}

function _filteredMonthly() {
  const now = new Date();
  const cur = `${_dashYear}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  if (_dashPeriod === 'mes') {
    const m = _dashMonthly.find(m => m._id === cur);
    return m ? [m] : (_dashMonthly.length ? [_dashMonthly[_dashMonthly.length - 1]] : []);
  }
  if (_dashPeriod === 'trimestre') {
    const cutoff = new Date(now.getFullYear(), now.getMonth() - 2, 1);
    const cutStr = `${cutoff.getFullYear()}-${String(cutoff.getMonth() + 1).padStart(2, '0')}`;
    return _dashMonthly.filter(m => m._id >= cutStr);
  }
  return _dashMonthly;
}

function _buildDashboard() {
  const monthly      = _dashMonthly;
  const totalIncome  = monthly.reduce((s, m) => s + (m.total || 0), 0);
  const totalExpenses = _dashData.totalExpenses || 0;
  const balance      = totalIncome - totalExpenses;
  const now          = new Date();

  // Expense breakdown by category
  const byCategory = {};
  let catTotal = 0;
  _allExpenses.forEach(e => {
    byCategory[e.category] = (byCategory[e.category] || 0) + (e.amount || 0);
    catTotal += (e.amount || 0);
  });
  const catEntries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]).slice(0, 6);

  // Top payers by YTD approved payment sum
  const payerMap = {};
  _allPayments.forEach(p => {
    if (!p.owner) return;
    const id = p.owner._id || p.owner;
    if (!payerMap[id]) payerMap[id] = { owner: p.owner, total: 0, count: 0 };
    payerMap[id].total += p.amount || 0;
    payerMap[id].count++;
  });
  const topPayers  = Object.values(payerMap).sort((a, b) => b.total - a.total).slice(0, 3);
  const topDebtors = _allOwners.filter(o => (o.totalOwed || 0) > 0)
    .sort((a, b) => (b.totalOwed || 0) - (a.totalOwed || 0)).slice(0, 3);

  const complianceSpark = _buildSparkline(monthly.map(m => m.count || 0));
  const debtorSpark     = _buildSparkline(monthly.map(m => (m.pending || 0) + (m.rejected || 0)));

  const periodTabs = ['mes', 'trimestre', 'año', 'todo'].map(p =>
    `<button class="dash-period-tab${_dashPeriod === p ? ' active' : ''}" onclick="setDashPeriod('${p}')">${p.charAt(0).toUpperCase() + p.slice(1)}</button>`
  ).join('');

  return `
    <div class="flex col gap-3">

      <!-- Header -->
      <div class="flex between" style="align-items:flex-end">
        <div>
          <div class="dash-eyebrow">FINANZAS</div>
          <h1>Dashboard<br>de pagos</h1>
        </div>
        <button class="btn btn-secondary btn-sm" onclick="exportDashboardExcel()" style="flex-shrink:0">
          ${SVG.download} Excel
        </button>
      </div>

      <!-- Period selector -->
      <div class="dash-period-tabs">${periodTabs}</div>

      <!-- Year switcher -->
      <div class="dash-year-switch">
        <div>
          <div class="dash-year-lbl">PERÍODO</div>
          <div class="dash-year-val">Año ${_dashYear}</div>
        </div>
        <div class="flex gap-1">
          <button class="btn btn-ghost btn-sm" style="padding:.25rem .55rem;font-size:1rem" onclick="renderAdminDashboard(${_dashYear - 1})">‹</button>
          <button class="btn btn-ghost btn-sm" style="padding:.25rem .55rem;font-size:1rem" onclick="renderAdminDashboard(${_dashYear + 1})" ${_dashYear >= now.getFullYear() ? 'disabled' : ''}>›</button>
        </div>
      </div>

      <!-- Balance hero -->
      <div class="dash-balance-card">
        <div class="flex between" style="margin-bottom:14px">
          <div class="dash-balance-lbl"><span class="dash-pulse"></span>BALANCE ${_dashYear}</div>
          <div style="font-size:.65rem;color:var(--muted);font-family:monospace;letter-spacing:.06em">YTD</div>
        </div>
        <div class="dash-balance-amt">
          <span class="dash-cur">$</span><span class="dash-num">${_fmtK(balance)}</span>
        </div>
        <div class="dash-balance-sub" style="color:${balance >= 0 ? 'var(--accent)' : 'var(--danger)'}">
          ${balance >= 0 ? '↑ ingresos superan los gastos' : '↓ gastos superan los ingresos'}
        </div>
        <div class="dash-flow">
          <div class="dash-flow-item in">
            <div class="dash-flow-ico in">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="19" x2="12" y2="5"/><polyline points="5 12 12 5 19 12"/></svg>
            </div>
            <div class="dash-flow-lbl">Ingresos</div>
            <div class="dash-flow-val in">$${_fmtK(totalIncome)}</div>
            <div class="dash-flow-pct">${monthly.length} período${monthly.length !== 1 ? 's' : ''}</div>
          </div>
          <div class="dash-flow-item out">
            <div class="dash-flow-ico out">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/></svg>
            </div>
            <div class="dash-flow-lbl">Gastos</div>
            <div class="dash-flow-val out">$${_fmtK(totalExpenses)}</div>
            <div class="dash-flow-pct">${_allExpenses.length} registro${_allExpenses.length !== 1 ? 's' : ''}</div>
          </div>
        </div>
      </div>

      <!-- Mini KPIs -->
      <div class="dash-kpi-row">
        <div class="dash-kpi">
          <div class="flex between" style="margin-bottom:8px">
            <span class="dash-kpi-lbl">CUMPLIMIENTO</span>
            <span class="dash-kpi-ico ok">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>
            </span>
          </div>
          <div class="dash-kpi-val ok">${_dashStats.complianceRate}%</div>
          <div class="dash-kpi-sub">${_dashStats.upToDate} de ${_dashStats.totalOwners}</div>
          <svg class="dash-spark" viewBox="0 0 50 20" preserveAspectRatio="none">
            <polyline points="${complianceSpark}" fill="none" stroke="var(--accent)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
        <div class="dash-kpi alert">
          <div class="flex between" style="margin-bottom:8px">
            <span class="dash-kpi-lbl">MOROSOS</span>
            <span class="dash-kpi-ico alert">
              <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
            </span>
          </div>
          <div class="dash-kpi-val alert">${_dashStats.debtors}</div>
          <div class="dash-kpi-sub">${_dashStats.pendingPayments} pendiente${_dashStats.pendingPayments !== 1 ? 's' : ''}</div>
          <svg class="dash-spark" viewBox="0 0 50 20" preserveAspectRatio="none">
            <polyline points="${debtorSpark}" fill="none" stroke="var(--danger)" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
        </div>
      </div>

      <!-- Bar chart -->
      <div class="dash-section-hd">
        <h2>Recaudación mensual</h2>
        <span style="font-size:.7rem;color:var(--muted)">${_dashYear}</span>
      </div>
      ${_buildBarChart()}

      <!-- Expense breakdown -->
      ${catEntries.length > 0 ? `
      <div class="dash-section-hd">
        <h2>Gastos por categoría</h2>
        <span style="font-size:.7rem;color:var(--muted)">$${_fmtK(catTotal)}</span>
      </div>
      <div class="card">
        <div class="card-body">
          ${catEntries.map(([cat, amt]) => {
            const pct   = catTotal > 0 ? Math.round((amt / catTotal) * 100) : 0;
            const color = EXPENSE_COLORS[cat] || '#888';
            return `
              <div class="dash-bd-item">
                <div class="flex between" style="margin-bottom:5px">
                  <div class="flex gap-1" style="align-items:center">
                    <span class="dash-bd-dot" style="background:${color}"></span>
                    <span style="font-size:.85rem;font-weight:500;color:var(--text-bright)">${EXPENSE_LABELS[cat] || cat}</span>
                  </div>
                  <span style="font-size:.78rem;font-family:monospace;color:var(--text)">$${_fmtK(amt)} <span style="color:var(--muted)">${pct}%</span></span>
                </div>
                <div class="dash-bd-bar">
                  <div class="dash-bd-fill" style="width:${Math.max(pct, 2)}%;background:${color}"></div>
                </div>
              </div>`;
          }).join('')}
        </div>
      </div>` : ''}

      <!-- Top movers -->
      ${(topPayers.length > 0 || topDebtors.length > 0) ? `
      <div class="dash-section-hd">
        <h2>Top propietarios</h2>
        <span style="font-size:.7rem;color:var(--muted)">${_dashYear}</span>
      </div>
      <div class="card" style="overflow:hidden">
        <div style="padding:0">
          ${topPayers.map(({ owner, total, count }) => `
            <div class="dash-mover">
              <div class="dash-mover-ava">${_initials(owner.name)}</div>
              <div class="dash-mover-info">
                <div class="dash-mover-name">${owner.name}</div>
                <div class="dash-mover-meta">${owner.unit ? owner.unit + ' · ' : ''}${count} PAGO${count !== 1 ? 'S' : ''} APROBADOS</div>
              </div>
              <div class="dash-mover-amt pos">+$${_fmtK(total)}<span class="dash-mover-tag">YTD</span></div>
            </div>`).join('')}
          ${topDebtors.map(o => `
            <div class="dash-mover">
              <div class="dash-mover-ava" style="background:var(--danger-lt);color:var(--danger)">${_initials(o.name)}</div>
              <div class="dash-mover-info">
                <div class="dash-mover-name">${o.name}</div>
                <div class="dash-mover-meta">${o.unit ? o.unit + ' · ' : ''}MOROSO</div>
              </div>
              <div class="dash-mover-amt neg">−$${_fmtK(o.totalOwed || 0)}<span class="dash-mover-tag">DEUDA</span></div>
            </div>`).join('')}
        </div>
      </div>` : ''}

      <!-- Period detail table -->
      <div class="dash-section-hd">
        <h2>Detalle por período</h2>
        <span style="font-size:.7rem;color:var(--muted)">${_dashYear}</span>
      </div>
      <div class="card" style="overflow:hidden">
        ${_buildPeriodTable()}
      </div>

      <div class="last-updated">
        <span class="tick"></span>
        Datos en vivo · ${new Date().toLocaleTimeString('es-AR', { hour: '2-digit', minute: '2-digit' })}
      </div>
    </div>`;
}

function _buildBarChart() {
  const monthly  = _filteredMonthly();
  if (!monthly.length) return '<div class="card"><div class="card-body"><p class="text-muted text-sm">Sin datos para este período.</p></div></div>';

  const chartH   = 130;
  const barW     = 36;
  const barGap   = 14;
  const maxTotal = Math.max(...monthly.map(m => m.total || 0), 1);
  const nowMonth = new Date().toISOString().slice(0, 7);
  const chartW   = Math.max(monthly.length * (barW + barGap) - barGap, 300);

  const bars = monthly.map((m, i) => {
    const h        = Math.max(Math.round(((m.total || 0) / maxTotal) * chartH), (m.total || 0) > 0 ? 4 : 0);
    const x        = i * (barW + barGap);
    const label    = formatMonth(m._id).slice(0, 3);
    const isFuture = m._id > nowMonth;
    const isActive = m._id === nowMonth;
    const fill     = isFuture ? 'url(#dhatch)' : (isActive ? 'var(--accent)' : 'rgba(156,242,123,0.5)');

    return `<g style="cursor:pointer" onclick="openStatDetail('monthDetail','${m._id}')">
      <rect x="${x}" y="${chartH - h}" width="${barW}" height="${h}" rx="5" fill="${fill}"
        style="${isActive ? 'filter:drop-shadow(0 0 7px rgba(156,242,123,0.55))' : ''}" opacity="${isFuture ? '.45' : '1'}"/>
      <rect x="${x}" y="0" width="${barW}" height="${chartH}" rx="5" fill="transparent"/>
      <text x="${x + barW / 2}" y="${chartH + 17}" text-anchor="middle" font-size="9"
        fill="${isActive ? 'var(--accent)' : 'var(--muted)'}" font-weight="${isActive ? '700' : '400'}">${label}</text>
      ${(m.total || 0) > 0 && !isFuture
        ? `<text x="${x + barW / 2}" y="${chartH - h - 5}" text-anchor="middle" font-size="8"
            fill="${isActive ? 'var(--accent)' : 'var(--text)'}" font-weight="600">$${((m.total || 0) / 1000).toFixed(0)}k</text>`
        : ''}
    </g>`;
  }).join('');

  return `
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between">
        <span style="font-size:.85rem;font-weight:600;color:var(--text-bright)">Ingresos por mes</span>
        <div class="flex gap-1" style="align-items:center;font-size:.68rem;color:var(--muted)">
          <span style="width:8px;height:8px;border-radius:2px;background:var(--accent);display:inline-block"></span>Aprobado
          <span style="width:8px;height:8px;border-radius:2px;background:rgba(156,242,123,0.25);border:1px dashed rgba(156,242,123,0.45);display:inline-block"></span>Proyección
        </div>
      </div>
      <div class="card-body" style="overflow-x:auto">
        <svg width="${chartW}" height="${chartH + 28}" style="display:block;margin:0 auto">
          <defs>
            <pattern id="dhatch" width="5" height="5" patternUnits="userSpaceOnUse" patternTransform="rotate(45)">
              <line x1="0" y1="0" x2="0" y2="5" stroke="rgba(156,242,123,0.35)" stroke-width="2"/>
            </pattern>
          </defs>
          ${bars}
        </svg>
        <p style="text-align:center;font-size:.7rem;color:var(--muted);margin-top:.15rem">Tocá una barra para ver el detalle del mes</p>
      </div>
    </div>`;
}

function _buildPeriodTable() {
  const monthly = _filteredMonthly();
  if (!monthly.length) return '<div style="padding:1rem"><p class="text-muted text-sm">Sin datos para este período.</p></div>';

  const chip = (n, type) => {
    if (n === 0) return `<span class="dash-chip zero">0</span>`;
    return `<span class="dash-chip ${type}">${n}</span>`;
  };

  const rows = monthly.map(m => {
    const [yr, mo] = m._id.split('-');
    const mName    = new Date(`${yr}-${mo}-15`).toLocaleDateString('es-AR', { month: 'short' }).replace('.', '');
    return `
      <div class="dash-trow" onclick="openStatDetail('monthDetail','${m._id}')" style="cursor:pointer">
        <div class="dash-period-cell">
          <div class="dash-pm">${mName}</div>
          <div class="dash-py">${yr}</div>
        </div>
        ${chip(m.count || 0, 'ok')}
        ${chip(m.pending || 0, 'pend')}
        ${chip(m.rejected || 0, 'rej')}
        <div style="font-size:.78rem;font-weight:600;text-align:right;font-family:monospace;color:var(--text-bright)">$${_fmtK(m.total || 0)}</div>
      </div>`;
  }).join('');

  return `
    <div style="padding:14px 16px 10px;display:flex;align-items:center;justify-content:space-between">
      <span style="font-size:.85rem;font-weight:600;color:var(--text-bright)">Comprobantes por mes</span>
    </div>
    <div class="dash-tcols">
      <span>Período</span><span>Aprobados</span><span>Pendientes</span><span>Rechazados</span><span style="text-align:right">Recaudado</span>
    </div>
    ${rows}`;
}

function _buildSparkline(values) {
  if (!values.length) return '0,16 50,16';
  const max  = Math.max(...values, 1);
  const step = values.length > 1 ? 50 / (values.length - 1) : 0;
  return values.map((v, i) => `${Math.round(i * step)},${Math.round(16 - (v / max) * 14)}`).join(' ');
}

function _fmtK(n) {
  const abs = Math.abs(n || 0);
  if (abs >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (abs >= 1_000)     return `${(n / 1_000).toFixed(0)}k`;
  return (n || 0).toLocaleString('es-AR');
}

function _initials(name = '') {
  return name.trim().split(/\s+/).slice(0, 2).map(w => w[0] || '').join('').toUpperCase();
}

// ── Period tab handler ────────────────────────────────────────────────────────

export function setDashPeriod(period) {
  _dashPeriod = period;
  _buildAndRender();
}

// ── Stat detail modals (unchanged) ───────────────────────────────────────────

export async function openStatDetail(type, arg) {
  openModal();
  document.getElementById('modal').innerHTML = `<div class="modal-handle"></div>${skeleton(4)}`;
  try {
    let html = '<div class="modal-handle"></div>';

    if (type === 'pending') {
      const res      = await getCachedOrFetch(
        'payments:admin-pending:limit=50',
        CACHE_TTL.PAYMENTS_SHORT,
        () => api.payments.getAll({ status: 'pending', limit: 50 })
      );
      const payments = res.data.payments;
      html += `<h2 style="margin-bottom:1.25rem">Comprobantes Pendientes</h2>
        ${payments.length === 0
          ? '<p class="text-muted text-sm">No hay comprobantes pendientes.</p>'
          : `<div class="flex col" style="gap:.6rem">
              ${payments.map(p => `
                <div style="padding:.85rem;background:var(--bg);border-radius:10px">
                  <div class="flex between" style="align-items:center">
                    <div>
                      <p style="font-weight:600;font-size:.9rem">${p.owner?.name || '—'}</p>
                      <p style="font-size:.78rem;color:var(--muted)">${p.owner?.unit || ''} · ${paymentConceptLabel(p)} · $${p.amount.toLocaleString('es-AR')}</p>
                    </div>
                    <div class="flex gap-1">
                      ${p.receipt?.url ? `<button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" title="Descargar" style="padding:.3rem .5rem">${SVG.download}</button>` : ''}
                      <button class="btn btn-success btn-sm" data-requires-network onclick="approvePayment('${p._id}');closeModal()">${SVG.check}</button>
                      <button class="btn btn-danger btn-sm" data-requires-network onclick="closeModal();openRejectModal('${p._id}')">${SVG.x}</button>
                    </div>
                  </div>
                </div>`).join('')}
            </div>`}
        <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
    }

    else if (type === 'compliance') {
      const res    = await getCachedOrFetch(
        'owners:dashboard:limit=100',
        CACHE_TTL.OWNERS,
        () => api.owners.getAll({ limit: 100 })
      );
      const owners = res.data.owners;
      const upToDate = owners.filter(o => !((o.totalOwed || 0) > 0));
      const debtors  = owners.filter(o => (o.totalOwed || 0) > 0);
      html += `<h2 style="margin-bottom:1rem">Cumplimiento de Pagos</h2>
        <div class="flex gap-2" style="margin-bottom:1.25rem">
          <div style="flex:1;background:var(--success-lt);color:var(--success);border-radius:10px;padding:.85rem;text-align:center">
            <div style="font-size:1.6rem;font-weight:700">${upToDate.length}</div>
            <div style="font-size:.78rem;margin-top:.2rem">Al día</div>
          </div>
          <div style="flex:1;background:var(--danger-lt);color:var(--danger);border-radius:10px;padding:.85rem;text-align:center">
            <div style="font-size:1.6rem;font-weight:700">${debtors.length}</div>
            <div style="font-size:.78rem;margin-top:.2rem">Con deuda</div>
          </div>
        </div>
        ${upToDate.length > 0 ? `
          <p style="font-size:.72rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.5rem">Al día</p>
          <div class="flex col" style="gap:.3rem;margin-bottom:1rem">
            ${upToDate.map(o => `
              <div class="flex between" style="padding:.5rem .75rem;background:var(--bg);border-radius:8px;font-size:.85rem">
                <span>${o.name}</span><span style="color:var(--muted);font-size:.78rem">${o.unit || ''}</span>
              </div>`).join('')}
          </div>` : ''}
        ${debtors.length > 0 ? `
          <p style="font-size:.72rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.5rem">Con deuda</p>
          <div class="flex col" style="gap:.3rem;margin-bottom:1rem">
            ${debtors.map(o => `
              <div class="flex between" style="padding:.5rem .75rem;background:var(--danger-lt);border-radius:8px;font-size:.85rem">
                <span>${o.name}</span><span style="color:var(--muted);font-size:.78rem">${o.unit || ''}</span>
              </div>`).join('')}
          </div>` : ''}
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cerrar</button>`;
    }

    else if (type === 'debtors') {
      const res     = await getCachedOrFetch(
        'owners:dashboard:limit=100',
        CACHE_TTL.OWNERS,
        () => api.owners.getAll({ limit: 100 })
      );
      const debtors = res.data.owners.filter(o => (o.totalOwed || 0) > 0);
      html += `<h2 style="margin-bottom:1.25rem">Propietarios Morosos</h2>
        ${debtors.length === 0
          ? '<p class="text-muted text-sm">No hay morosos actualmente.</p>'
          : `<div class="flex col" style="gap:.5rem">
              ${debtors.map(o => `
                <div class="flex between" style="padding:.85rem;background:var(--bg);border-radius:10px;align-items:center">
                  <div>
                    <p style="font-weight:600;font-size:.9rem">${o.name}</p>
                    <p style="font-size:.78rem;color:var(--muted)">${o.unit || ''} · ${o.email}</p>
                  </div>
                  <div style="text-align:right">
                    <span class="badge badge-danger">Deuda</span>
                    ${(o.totalOwed || 0) > 0 ? `<p style="font-size:.78rem;color:var(--danger);margin-top:.25rem">$${(o.totalOwed).toLocaleString('es-AR')}</p>` : ''}
                  </div>
                </div>`).join('')}
            </div>`}
        <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
    }

    else if (type === 'collected') {
      const monthly = _dashMonthly.length > 0
        ? _dashMonthly
        : (await getCachedOrFetch(`dashboard:raw:${_dashYear}`, CACHE_TTL.DASHBOARD, () => api.payments.getDashboard(_dashYear))).data.monthly || [];
      const total   = monthly.reduce((sum, m) => sum + (m.total || 0), 0);
      html += `<h2 style="margin-bottom:1rem">Recaudación ${_dashYear}</h2>
        <div style="background:var(--bg);border-radius:10px;padding:.85rem 1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.85rem;color:var(--muted)">Total del año</span>
          <span style="font-size:1.4rem;font-weight:700;color:var(--accent)">$${total.toLocaleString('es-AR')}</span>
        </div>
        ${monthly.length > 0
          ? `<div class="flex col" style="gap:.35rem">
              ${[...monthly].reverse().map(m => `
                <div class="flex between" style="padding:.6rem .75rem;background:var(--bg);border-radius:8px;font-size:.85rem;align-items:center;cursor:pointer" onclick="openStatDetail('monthDetail','${m._id}')">
                  <span style="font-weight:500">${formatMonth(m._id)}</span>
                  <div class="flex gap-2" style="align-items:center">
                    <span style="font-size:.78rem;color:var(--muted)">${m.count} pago${m.count !== 1 ? 's' : ''}</span>
                    <span style="font-weight:600;color:var(--accent)">$${(m.total || 0).toLocaleString('es-AR')} ›</span>
                  </div>
                </div>`).join('')}
            </div>`
          : '<p class="text-muted text-sm">Sin datos disponibles.</p>'}
        <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
    }

    else if (type === 'monthDetail') {
      const month    = arg;
      const res      = await getCachedOrFetch(
        `payments:month-detail:${month}`,
        CACHE_TTL.PAYMENTS_SHORT,
        () => api.payments.getAll({ effectiveMonth: month, limit: 100 })
      );
      const payments = res.data.payments || [];
      const approved = payments.filter(p => p.status === 'approved');
      const pending  = payments.filter(p => p.status === 'pending');
      const rejected = payments.filter(p => p.status === 'rejected');
      const totalRec = approved.reduce((s, p) => s + (p.amount || 0), 0);
      html += `<h2 style="margin-bottom:.75rem">${formatMonth(month)}</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:1.25rem">
          <div style="background:var(--success-lt);color:var(--success);border-radius:8px;padding:.6rem;text-align:center">
            <div style="font-size:1.4rem;font-weight:700">${approved.length}</div><div style="font-size:.72rem">Aprobados</div>
          </div>
          <div style="background:var(--warning-lt);color:var(--warning);border-radius:8px;padding:.6rem;text-align:center">
            <div style="font-size:1.4rem;font-weight:700">${pending.length}</div><div style="font-size:.72rem">Pendientes</div>
          </div>
          <div style="background:var(--danger-lt);color:var(--danger);border-radius:8px;padding:.6rem;text-align:center">
            <div style="font-size:1.4rem;font-weight:700">${rejected.length}</div><div style="font-size:.72rem">Rechazados</div>
          </div>
        </div>
        <div style="background:var(--bg);border-radius:8px;padding:.7rem 1rem;display:flex;justify-content:space-between;margin-bottom:1rem">
          <span style="font-size:.85rem;color:var(--muted)">Recaudado</span>
          <span style="font-weight:700;color:var(--accent)">$${totalRec.toLocaleString('es-AR')}</span>
        </div>
        ${payments.length > 0 ? `
        <div class="flex col" style="gap:.35rem">
          ${payments.map(p => `
            <div class="flex between" style="padding:.6rem .75rem;background:var(--bg);border-radius:8px;font-size:.84rem;align-items:center">
              <div>
                <p style="font-weight:600">${p.owner?.name || '—'}</p>
                <p style="font-size:.75rem;color:var(--muted)">${p.owner?.unit || ''} · ${paymentConceptLabel(p)} · $${(p.amount || 0).toLocaleString('es-AR')}</p>
              </div>
              <div class="flex gap-1" style="align-items:center">
                ${statusBadge(p.status)}
                ${p.status === 'approved' ? `<button class="btn btn-ghost btn-sm" onclick="downloadSystemReceipt('${p._id}')" title="Descargar recibo" style="padding:.25rem .4rem">${svgIcon('doc', 14)}</button>` : ''}
                ${p.receipt?.url ? `<button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" title="Descargar comprobante" style="padding:.25rem .4rem">${SVG.download}</button>` : ''}
              </div>
            </div>`).join('')}
        </div>` : '<p class="text-muted text-sm">Sin pagos registrados en este período.</p>'}
        <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
    }

    document.getElementById('modal').innerHTML = html;
  } catch (err) {
    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      <p style="color:var(--danger)">${err.message}</p>
      <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
  }
}

// ── Excel export (unchanged) ──────────────────────────────────────────────────

export async function exportDashboardExcel() {
  try {
    const res         = await getCachedOrFetch(
      'payments:dashboard-export:limit=500',
      CACHE_TTL.PAYMENTS,
      () => api.payments.getAll({ limit: 500 })
    );
    const allPayments = (res.data.payments || []).filter(p => {
      const year = p.month ? p.month.slice(0, 4) : (p.createdAt || '').slice(0, 4);
      return year === String(_dashYear);
    });

    const summaryData = [
      ['Período', 'Recaudado ($)', 'Pagos aprobados', 'Pendientes', 'Rechazados'],
      ..._dashMonthly.map(m => [
        formatMonth(m._id),
        m.total || 0,
        m.count || 0,
        m.pending || 0,
        m.rejected || 0,
      ]),
      [],
      ['TOTAL', _dashMonthly.reduce((s, m) => s + (m.total || 0), 0),
               _dashMonthly.reduce((s, m) => s + (m.count || 0), 0), '', ''],
    ];

    const paymentsData = [
      ['Propietario', 'Unidad', 'Período', 'Monto ($)', 'Estado', 'Canal', 'Fecha'],
      ...allPayments.map(p => [
        p.owner?.name || '—',
        p.owner?.unit || '—',
        paymentConceptLabel(p),
        p.amount || 0,
        p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado',
        p.paymentMethod === 'mercadopago' ? 'MercadoPago' : 'Manual',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR') : '—',
      ]),
    ];

    const wb  = XLSX.utils.book_new();
    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen mensual');

    const ws2 = XLSX.utils.aoa_to_sheet(paymentsData);
    ws2['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Pagos');

    XLSX.writeFile(wb, `consorcio_informe_${_dashYear}.xlsx`);
    toast('Informe descargado correctamente.', 'success');
  } catch (err) {
    toast('Error al generar el informe: ' + err.message, 'error');
  }
}

window.renderAdminDashboard = renderAdminDashboard;
window.setDashPeriod        = setDashPeriod;
window.openStatDetail       = openStatDetail;
window.exportDashboardExcel = exportDashboardExcel;
