import { toast }                       from '../../ui/toast.js';
import { errorState, currentMonth, escapeHtml } from '../../ui/helpers.js';
import { SVG }                         from '../../ui/icons.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';

// ── Constantes ────────────────────────────────────────────────
const CAT_LABELS = {
  cleaning:       'Limpieza',
  security:       'Seguridad',
  maintenance:    'Mantenimiento',
  utilities:      'Servicios',
  administration: 'Administración',
  salaries:       'Sueldos',
  other:          'Otros',
};

// ── Estado del módulo ─────────────────────────────────────────
const _rpt = {
  tab:              'mensual',
  month:            currentMonth(),
  mensualData:      null,
  stmtData:         null,
  delinqData:       null,
  paymentsData:     null,
  expensesData:     null,
  ownersData:       null,
  ownersList:       null,  // cache para el select de propietarios
  renditionPeriod:  currentMonth(),
  renditionData:    null,
  renditionHistory: null,
  annualData:       null,
};

// ── Helpers de formato ────────────────────────────────────────
const _fmt$  = (n) => (n == null ? '—' : '$ ' + Number(n).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
const _fmtDt = (iso) => iso ? new Date(iso).toLocaleDateString('es-AR') : '—';
const _stLbl = (s) => ({ approved: 'Aprobado', pending: 'Pendiente', rejected: 'Rechazado' }[s] || s || '—');
const _tpLbl = (t) => ({ monthly: 'Mensual', extraordinary: 'Extraordinario', balance: 'Saldo ant.', installment: 'Cuota' }[t] || t || '—');
const _mLbl  = (m) => ({ manual: 'Manual', mercadopago: 'MercadoPago' }[m] || m || '—');

function _fmt(n) {
  return (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function formatMonthFull(m) {
  if (!m) return '';
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y, mo] = m.split('-');
  return `${months[parseInt(mo, 10) - 1]} ${y}`;
}

// ── SVG íconos inline ─────────────────────────────────────────
const _ICON_DL = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M12 10v6m0 0l-3-3m3 3l3-3M3 17V19a2 2 0 002 2h14a2 2 0 002-2v-2M7 9a5 5 0 0110 0"/></svg>`;
const _ICON_PDF = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><path stroke-linecap="round" stroke-linejoin="round" d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/></svg>`;

// ── Render principal ──────────────────────────────────────────
export async function renderAdminReport() {
  const el = document.getElementById('page-admin-report');
  if (!el) return;

  const tabs = [
    { id: 'mensual',     label: 'Informe mensual' },
    { id: 'statement',   label: 'Estado de cuenta' },
    { id: 'delinquency', label: 'Morosidad' },
    { id: 'payments',    label: 'Pagos' },
    { id: 'expenses',    label: 'Gastos' },
    { id: 'owners',      label: 'Propietarios' },
    { id: 'rendicion',   label: 'Rendición' },
  ];

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 style="margin:0 0 .15rem">Centro de reportes</h2>
        <p class="text-muted text-sm" style="margin:0">Generá y descargá reportes financieros de la organización</p>
      </div>
    </div>

    <div class="card" style="margin-bottom:1rem;padding:.25rem .5rem;overflow-x:auto;">
      <div style="display:flex;gap:.25rem;min-width:max-content;">
        ${tabs.map(t => `
          <button id="rtab-${t.id}" onclick="_rptSetTab('${t.id}')"
            style="padding:.55rem 1rem;border-radius:8px;border:none;cursor:pointer;font-size:.82rem;font-weight:600;white-space:nowrap;
                   background:${_rpt.tab === t.id ? 'var(--accent)' : 'var(--surface-2)'};
                   color:${_rpt.tab === t.id ? '#0a1209' : 'var(--muted)'};
                   transition:all .15s;">
            ${escapeHtml(t.label)}
          </button>`).join('')}
      </div>
    </div>

    <div id="rpt-content"></div>`;

  _renderActiveTab();
}

// ── Tab switching ─────────────────────────────────────────────
window._rptSetTab = function(tab) {
  _rpt.tab = tab;
  document.querySelectorAll('[id^="rtab-"]').forEach(btn => {
    const isActive = btn.id === `rtab-${tab}`;
    btn.style.background = isActive ? 'var(--accent)' : 'var(--surface-2)';
    btn.style.color       = isActive ? '#0a1209' : 'var(--muted)';
  });
  _renderActiveTab();
};

function _renderActiveTab() {
  const content = document.getElementById('rpt-content');
  if (!content) return;
  const map = {
    mensual:     _renderTabMensual,
    statement:   _renderTabStatement,
    delinquency: _renderTabDelinquency,
    payments:    _renderTabPayments,
    expenses:    _renderTabExpenses,
    owners:      _renderTabOwners,
    rendicion:   _renderTabRendicion,
  };
  (map[_rpt.tab] || _renderTabMensual)();
}

// ── Tabla genérica helpers ────────────────────────────────────
function _tableWrap(headers, rows, emptyMsg = 'Sin datos') {
  if (!rows.length) {
    return `<p class="text-muted text-sm" style="padding:1.5rem;text-align:center;">${emptyMsg}</p>`;
  }
  return `<div style="overflow-x:auto;">
    <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
      <thead><tr style="border-bottom:2px solid var(--border-md);">
        ${headers.map(h => `<th style="padding:.6rem .75rem;text-align:left;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase;letter-spacing:.04em;">${h}</th>`).join('')}
      </tr></thead>
      <tbody>${rows}</tbody>
    </table>
  </div>`;
}

function _summaryBadge(items) {
  return `<div style="display:flex;gap:.75rem;flex-wrap:wrap;margin-bottom:.75rem;">
    ${items.map(({ label, value, color }) =>
      `<div class="card" style="padding:.5rem 1rem;flex:1;min-width:120px;border-left:3px solid ${color || 'var(--accent)'};">
        <div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;">${label}</div>
        <div style="font-size:1rem;font-weight:700;color:var(--text-bright);margin-top:.15rem;">${value}</div>
      </div>`).join('')}
  </div>`;
}

function _dlButtons(content) {
  return `<div style="margin-top:.75rem;display:flex;gap:.5rem;flex-wrap:wrap;">${content}</div>`;
}

// ─────────────────────────────────────────────────────────────
// TAB 1 — Informe mensual (funcionalidad existente)
// ─────────────────────────────────────────────────────────────
function _renderTabMensual() {
  document.getElementById('rpt-content').innerHTML = `
    <div class="card" style="margin-bottom:1rem;padding:1rem 1.25rem;">
      <div class="flex gap-2 items-center flex-wrap">
        <div class="form-group" style="flex:1;min-width:160px;margin:0">
          <label style="font-size:.75rem;margin-bottom:.3rem;display:block">Período</label>
          <input type="month" id="report-month-picker" class="input" value="${_rpt.month}" style="font-size:.9rem">
        </div>
        <button class="btn btn-primary" id="btn-gen-report" onclick="loadReport()" style="align-self:flex-end;gap:.4rem;display:flex;align-items:center">
          ${SVG.list} Generar
        </button>
        <button class="btn btn-secondary" id="btn-download-expensas" onclick="downloadExpensasPdf()" style="align-self:flex-end;gap:.4rem;display:flex;align-items:center">
          ${_ICON_DL} Liquidación PDF
        </button>
      </div>
    </div>
    <div id="report-area"></div>`;

  document.getElementById('report-month-picker').addEventListener('change', e => {
    _rpt.month = e.target.value;
    loadReport();
  });

  loadReport();
}

export async function loadReport() {
  const area = document.getElementById('report-area');
  if (!area) return;
  const btn = document.getElementById('btn-gen-report');
  if (btn) { btn.disabled = true; btn.textContent = 'Cargando…'; }

  const month = document.getElementById('report-month-picker')?.value || _rpt.month;
  _rpt.month = month;

  area.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--muted)">
    <svg class="loading-spinner" width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" style="margin:0 auto 1rem">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    <p>Generando informe…</p>
  </div>`;

  try {
    const res = await getCachedOrFetch(
      `reports:monthly:${month}`,
      CACHE_TTL.REPORTS,
      () => api.reports.getMonthlySummary(month)
    );
    _rpt.mensualData = res.data;
    area.innerHTML = _renderReportTable(res.data);
  } catch (err) {
    area.innerHTML = errorState(err.message, 'loadReport()');
    toast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `${SVG.list} Generar`; }
  }
}

function _renderReportTable(d) {
  const { month, saldoAnterior, income, expenses, expenseCategories, balance } = d;
  const balanceClass = balance >= 0 ? 'text-success' : 'text-danger';
  const categories = Array.isArray(expenseCategories) && expenseCategories.length
    ? expenseCategories
    : Object.entries(CAT_LABELS).map(([key, label]) => ({ key, label, amount: expenses[key] || 0 }));

  const expRows = categories.map(({ key, label, amount }) => `
    <tr class="report-row">
      <td>${escapeHtml(label || key)}</td>
      <td class="report-amount">${amount > 0 ? `$${_fmt(amount)}` : '<span class="text-muted">—</span>'}</td>
    </tr>`).join('');

  return `
  <div class="report-table card">
    <div class="report-header">
      <div>
        <div class="report-title">INFORME MENSUAL</div>
        <div class="report-subtitle">${formatMonthFull(month)}</div>
      </div>
      <button class="btn btn-secondary btn-sm report-print-btn" onclick="window.print()" style="gap:.4rem;display:flex;align-items:center">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="15" height="15">
          <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm1-4h.01"/>
        </svg>
        Imprimir / PDF
      </button>
    </div>
    <table class="report-body">
      <tbody>
        <tr class="report-section-header"><td colspan="2">SALDO ANTERIOR</td></tr>
        <tr class="report-row">
          <td>Saldo al inicio del período</td>
          <td class="report-amount ${saldoAnterior < 0 ? 'text-danger' : ''}">$${_fmt(saldoAnterior)}</td>
        </tr>
      </tbody>
      <tbody>
        <tr class="report-section-header"><td colspan="2">INGRESOS</td></tr>
        <tr class="report-row"><td>Expensas cobradas</td><td class="report-amount">$${_fmt(income.expensas)}</td></tr>
        <tr class="report-subtotal"><td>Total ingresos</td><td class="report-amount">$${_fmt(income.total)}</td></tr>
      </tbody>
      <tbody>
        <tr class="report-section-header"><td colspan="2">EGRESOS</td></tr>
        ${expRows}
        <tr class="report-subtotal"><td>Total egresos</td><td class="report-amount">$${_fmt(expenses.total)}</td></tr>
      </tbody>
      <tbody>
        <tr class="report-total">
          <td>BALANCE FINAL</td>
          <td class="report-amount ${balanceClass}">$${_fmt(balance)}</td>
        </tr>
      </tbody>
    </table>
    <p class="report-footer">Generado el ${new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' })}</p>
  </div>`;
}

export async function downloadExpensasPdf() {
  const month = document.getElementById('report-month-picker')?.value || _rpt.month;
  const btn   = document.getElementById('btn-download-expensas');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  try {
    const blob = await api.reports.downloadExpensasPdf(month);
    _triggerBlobDownload(blob, `liquidacion_expensas_${month}.pdf`);
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `${_ICON_DL} Liquidación PDF`; }
  }
}

// ─────────────────────────────────────────────────────────────
// TAB 2 — Estado de cuenta por propietario
// ─────────────────────────────────────────────────────────────
function _renderTabStatement() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';

  document.getElementById('rpt-content').innerHTML = `
    <div class="card" style="padding:1rem 1.25rem;margin-bottom:1rem;">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(180px,1fr));gap:.75rem;align-items:end;">
        <div class="form-group" style="margin:0;">
          <label>Propietario</label>
          <select id="stmt-owner" class="select">
            <option value="">Cargando…</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label>Desde</label>
          <input type="date" id="stmt-from" class="input" value="${firstOfMonth}">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Hasta</label>
          <input type="date" id="stmt-to" class="input" value="${today}">
        </div>
        <div class="form-group" style="margin:0;">
          <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;">
            <input type="checkbox" id="stmt-pending" checked style="accent-color:var(--accent);width:15px;height:15px;">
            Incluir pendientes
          </label>
        </div>
        <button class="btn btn-primary" onclick="_generateStatement()" style="gap:.4rem;display:flex;align-items:center;height:38px;">
          ${SVG.list} Generar
        </button>
      </div>
    </div>
    <div id="stmt-result"></div>`;

  _loadOwnersSelect('stmt-owner');
}

async function _loadOwnersSelect(selectId, defaultLabel = 'Seleccioná un propietario…') {
  const sel = document.getElementById(selectId);
  if (!sel) return;

  if (!_rpt.ownersList) {
    try {
      const res = await api.owners.getAll({ limit: 500 });
      _rpt.ownersList = (res.data?.owners || res.data || []).sort((a, b) => (a.name || '').localeCompare(b.name || ''));
    } catch {
      sel.innerHTML = `<option value="">Error al cargar propietarios</option>`;
      return;
    }
  }

  sel.innerHTML = `<option value="">${defaultLabel}</option>` +
    _rpt.ownersList.map(o => `<option value="${o._id}">${escapeHtml(o.name)} — ${escapeHtml(o.unit || o.email || '')}</option>`).join('');
}

window._generateStatement = async function() {
  const ownerId = document.getElementById('stmt-owner')?.value;
  const from    = document.getElementById('stmt-from')?.value;
  const to      = document.getElementById('stmt-to')?.value;
  const pending = document.getElementById('stmt-pending')?.checked ?? true;
  const area    = document.getElementById('stmt-result');
  if (!area) return;
  if (!ownerId) { toast('Seleccioná un propietario', 'warning'); return; }

  area.innerHTML = `<div class="card" style="padding:1.5rem;text-align:center;color:var(--muted);">Generando…</div>`;
  try {
    const res = await api.reports.ownerStatement({ ownerId, from, to, includePending: pending });
    _rpt.stmtData = res.data;
    area.innerHTML = _renderStatementResult(res.data);
  } catch (err) {
    area.innerHTML = errorState(err.message, '_generateStatement()');
    toast(err.message, 'error');
  }
};

function _renderStatementResult(d) {
  const { owner, org, payments, summary } = d;
  const balColor = summary.currentBalance < 0 ? 'var(--danger)' : 'var(--success)';

  const rowFn = (p, i) => {
    const bg = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:.5rem .75rem;background:${bg};">${_fmtDt(p.date)}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${p.month || '—'}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${_tpLbl(p.type)}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${_mLbl(p.paymentMethod)}</td>
      <td style="padding:.5rem .75rem;background:${bg};text-align:right;font-weight:600;color:var(--success);">${_fmt$(p.amount)}</td>
    </tr>`;
  };

  const approvedRows = payments.approved.length
    ? payments.approved.map(rowFn).join('')
    : `<tr><td colspan="5" style="padding:.75rem;text-align:center;color:var(--muted);">Sin pagos aprobados en el período</td></tr>`;

  const pendingBlock = (payments.pending && payments.pending.length > 0) ? `
    <h3 style="font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;color:var(--warning);margin:1.25rem 0 .5rem;">Pagos pendientes de aprobación</h3>
    ${_tableWrap(['Fecha','Período','Tipo','Canal','Importe'],
      payments.pending.map((p, i) => {
        const bg = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)';
        return `<tr style="border-bottom:1px solid var(--border);">
          <td style="padding:.5rem .75rem;background:${bg};">${_fmtDt(p.date)}</td>
          <td style="padding:.5rem .75rem;background:${bg};">${p.month || '—'}</td>
          <td style="padding:.5rem .75rem;background:${bg};">${_tpLbl(p.type)}</td>
          <td style="padding:.5rem .75rem;background:${bg};">${_mLbl(p.paymentMethod)}</td>
          <td style="padding:.5rem .75rem;background:${bg};text-align:right;font-weight:600;color:var(--warning);">${_fmt$(p.amount)}</td>
        </tr>`;
      }).join('')
    )}
    <p style="font-size:.75rem;color:var(--muted);margin-top:.4rem;">* Los pagos pendientes no descuentan del saldo hasta ser aprobados.</p>` : '';

  return `
  <div class="card" style="padding:1.25rem;margin-bottom:.75rem;">
    <div style="display:flex;flex-wrap:wrap;gap:1.25rem;margin-bottom:1rem;">
      <div><div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;">Propietario</div>
           <div style="font-weight:700;color:var(--text-bright);">${escapeHtml(owner.name)}</div>
           <div style="font-size:.78rem;color:var(--muted);">${escapeHtml(owner.email)}</div></div>
      <div><div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;">Unidad / Lote</div>
           <div style="font-weight:700;color:var(--text-bright);">${escapeHtml(owner.unitLabel)}</div></div>
      <div><div style="font-size:.7rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;">Saldo actual</div>
           <div style="font-size:1.15rem;font-weight:800;color:${balColor};">${_fmt$(summary.currentBalance)}</div></div>
    </div>

    ${_summaryBadge([
      { label: 'Total aprobado',  value: _fmt$(summary.totalApproved), color: 'var(--success)' },
      { label: 'Total pendiente', value: _fmt$(summary.totalPending),  color: 'var(--warning)' },
      { label: 'Saldo actual',    value: _fmt$(summary.currentBalance), color: balColor },
    ])}

    <h3 style="font-size:.8rem;text-transform:uppercase;letter-spacing:.05em;color:var(--text-bright);margin-bottom:.5rem;">Pagos aprobados</h3>
    ${_tableWrap(['Fecha','Período','Tipo','Canal','Importe'],approvedRows)}
    ${pendingBlock}

    ${_dlButtons(`
      <button class="btn btn-secondary btn-sm" onclick="_downloadStatementPdf()" style="gap:.35rem;display:flex;align-items:center">
        ${_ICON_PDF} Descargar PDF
      </button>
      <button class="btn btn-secondary btn-sm" onclick="_downloadStatementExcel()" style="gap:.35rem;display:flex;align-items:center">
        ${_ICON_DL} Descargar Excel
      </button>`)}
  </div>`;
}

window._downloadStatementPdf = async function() {
  const ownerId = document.getElementById('stmt-owner')?.value;
  const from    = document.getElementById('stmt-from')?.value;
  const to      = document.getElementById('stmt-to')?.value;
  const pending = document.getElementById('stmt-pending')?.checked ?? true;
  if (!ownerId) { toast('Seleccioná un propietario', 'warning'); return; }
  try {
    toast('Generando PDF…', 'default');
    const blob = await api.reports.ownerStatementPdf({ ownerId, from, to, includePending: pending });
    _triggerBlobDownload(blob, `estado_cuenta_${Date.now()}.pdf`);
  } catch (err) {
    toast(err.message, 'error');
  }
};

window._downloadStatementExcel = function() {
  const d = _rpt.stmtData;
  if (!d) { toast('Generá el reporte primero', 'warning'); return; }
  const wb = XLSX.utils.book_new();

  const summaryRows = [
    ['Propietario', d.owner.name],
    ['Email', d.owner.email],
    ['Unidad / Lote', d.owner.unitLabel],
    ['Saldo actual', d.summary.currentBalance],
    ['Total aprobado en período', d.summary.totalApproved],
    ['Total pendiente en período', d.summary.totalPending],
  ];
  const ws1 = XLSX.utils.aoa_to_sheet(summaryRows);
  ws1['!cols'] = [{ wch: 30 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws1, 'Resumen');

  const headers = ['Fecha', 'Período', 'Tipo', 'Canal', 'Estado', 'Importe'];
  const rows = [
    ...d.payments.approved.map(p => [_fmtDt(p.date), p.month || '—', _tpLbl(p.type), _mLbl(p.paymentMethod), 'Aprobado', p.amount]),
    ...d.payments.pending.map(p  => [_fmtDt(p.date), p.month || '—', _tpLbl(p.type), _mLbl(p.paymentMethod), 'Pendiente', p.amount]),
  ];
  const ws2 = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws2['!cols'] = [{ wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Movimientos');

  XLSX.writeFile(wb, `estado_cuenta_${_rpt.stmtData.owner.name?.replace(/\s+/g, '_') || 'propietario'}_${new Date().toISOString().slice(0,10)}.xlsx`);
};

// ─────────────────────────────────────────────────────────────
// TAB 3 — Morosidad general
// ─────────────────────────────────────────────────────────────
function _renderTabDelinquency() {
  document.getElementById('rpt-content').innerHTML = `
    <div class="card" style="padding:1rem 1.25rem;margin-bottom:1rem;">
      <div style="display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap;">
        <div class="form-group" style="margin:0;min-width:160px;">
          <label>Deuda mínima $</label>
          <input type="number" id="delinq-min" class="input" placeholder="0 (todos los morosos)" min="0" step="1">
        </div>
        <button class="btn btn-primary" onclick="_generateDelinquency()" style="gap:.4rem;display:flex;align-items:center;height:38px;">
          ${SVG.list} Generar
        </button>
      </div>
    </div>
    <div id="delinq-result"></div>`;
}

window._generateDelinquency = async function() {
  const minDebt = parseFloat(document.getElementById('delinq-min')?.value) || 0;
  const area    = document.getElementById('delinq-result');
  if (!area) return;
  area.innerHTML = `<div class="card" style="padding:1.5rem;text-align:center;color:var(--muted);">Generando…</div>`;
  try {
    const res = await api.reports.delinquency({ minDebt });
    _rpt.delinqData = res.data;
    area.innerHTML = _renderDelinquencyResult(res.data);
  } catch (err) {
    area.innerHTML = errorState(err.message, '_generateDelinquency()');
    toast(err.message, 'error');
  }
};

function _renderDelinquencyResult(d) {
  const { owners, summary } = d;

  const tableRows = owners.map((o, i) => {
    const bg = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)';
    const balColor = o.balance < 0 ? 'var(--danger)' : 'var(--text)';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:.5rem .75rem;background:${bg};font-weight:600;">${escapeHtml(o.name)}</td>
      <td style="padding:.5rem .75rem;background:${bg};color:var(--muted);">${escapeHtml(o.email)}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${escapeHtml(o.unitLabel)}</td>
      <td style="padding:.5rem .75rem;background:${bg};text-align:right;font-weight:700;color:${balColor};">${_fmt$(o.balance)}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${o.startBillingPeriod || '—'}</td>
    </tr>`;
  }).join('');

  return `<div class="card" style="padding:1.25rem;">
    ${_summaryBadge([
      { label: 'Propietarios morosos', value: summary.totalDebtors, color: 'var(--danger)' },
      { label: 'Deuda total',  value: _fmt$(summary.totalDebt), color: 'var(--danger)' },
      { label: 'Deuda promedio', value: _fmt$(summary.avgDebt), color: 'var(--warning)' },
    ])}
    ${_tableWrap(['Propietario','Email','Unidad / Lote','Saldo','Inicio facturación'], tableRows, 'Sin propietarios morosos')}
    ${owners.length > 0 ? _dlButtons(`
      <button class="btn btn-secondary btn-sm" onclick="_downloadDelinquencyExcel()" style="gap:.35rem;display:flex;align-items:center">
        ${_ICON_DL} Descargar Excel
      </button>`) : ''}
  </div>`;
}

window._downloadDelinquencyExcel = function() {
  const d = _rpt.delinqData;
  if (!d) { toast('Generá el reporte primero', 'warning'); return; }
  const headers = ['Propietario', 'Email', 'Teléfono', 'Unidad / Lote', 'Saldo', 'Inicio facturación'];
  const rows = d.owners.map(o => [o.name, o.email, o.phone, o.unitLabel, o.balance, o.startBillingPeriod || '—']);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 25 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Morosidad');
  XLSX.writeFile(wb, `morosidad_${new Date().toISOString().slice(0,10)}.xlsx`);
};

// ─────────────────────────────────────────────────────────────
// TAB 4 — Pagos por período
// ─────────────────────────────────────────────────────────────
function _renderTabPayments() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';

  document.getElementById('rpt-content').innerHTML = `
    <div class="card" style="padding:1rem 1.25rem;margin-bottom:1rem;">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.75rem;align-items:end;">
        <div class="form-group" style="margin:0;">
          <label>Desde</label>
          <input type="date" id="pay-from" class="input" value="${firstOfMonth}">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Hasta</label>
          <input type="date" id="pay-to" class="input" value="${today}">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Estado</label>
          <select id="pay-status" class="select">
            <option value="">Todos</option>
            <option value="approved">Aprobados</option>
            <option value="pending">Pendientes</option>
            <option value="rejected">Rechazados</option>
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label>Propietario</label>
          <select id="pay-owner" class="select">
            <option value="">Cargando…</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="_generatePayments()" style="gap:.4rem;display:flex;align-items:center;height:38px;">
          ${SVG.list} Generar
        </button>
      </div>
    </div>
    <div id="pay-result"></div>`;

  _loadOwnersSelect('pay-owner', 'Todos los propietarios');
}

window._generatePayments = async function() {
  const from    = document.getElementById('pay-from')?.value;
  const to      = document.getElementById('pay-to')?.value;
  const status  = document.getElementById('pay-status')?.value || undefined;
  const ownerId = document.getElementById('pay-owner')?.value   || undefined;
  const area    = document.getElementById('pay-result');
  if (!area) return;
  area.innerHTML = `<div class="card" style="padding:1.5rem;text-align:center;color:var(--muted);">Generando…</div>`;
  try {
    const res = await api.reports.payments({ from, to, status, ownerId });
    _rpt.paymentsData = res.data;
    area.innerHTML = _renderPaymentsResult(res.data);
  } catch (err) {
    area.innerHTML = errorState(err.message, '_generatePayments()');
    toast(err.message, 'error');
  }
};

function _renderPaymentsResult(d) {
  const { payments, summary, truncated } = d;

  const tableRows = payments.map((p, i) => {
    const bg       = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)';
    const stColor  = { approved: 'var(--success)', pending: 'var(--warning)', rejected: 'var(--danger)' }[p.status] || 'var(--text)';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:.5rem .75rem;background:${bg};">${_fmtDt(p.date)}</td>
      <td style="padding:.5rem .75rem;background:${bg};font-weight:600;">${escapeHtml(p.ownerName)}</td>
      <td style="padding:.5rem .75rem;background:${bg};color:var(--muted);">${escapeHtml(p.unitLabel)}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${p.month || '—'}</td>
      <td style="padding:.5rem .75rem;background:${bg};text-align:right;font-weight:600;">${_fmt$(p.amount)}</td>
      <td style="padding:.5rem .75rem;background:${bg};color:${stColor};font-weight:600;">${_stLbl(p.status)}</td>
      <td style="padding:.5rem .75rem;background:${bg};color:var(--muted);">${_mLbl(p.paymentMethod)}</td>
    </tr>`;
  }).join('');

  const truncWarning = truncated ? `<p class="text-muted text-sm" style="margin:.5rem 0;">⚠️ Mostrando los primeros 1.000 resultados. Aplicá filtros más específicos para ver todos.</p>` : '';

  return `<div class="card" style="padding:1.25rem;">
    ${_summaryBadge([
      { label: 'Total registros',  value: summary.count, color: 'var(--accent)' },
      { label: 'Total aprobados',  value: _fmt$(summary.totalApproved), color: 'var(--success)' },
      { label: 'Total pendientes', value: _fmt$(summary.totalPending), color: 'var(--warning)' },
    ])}
    ${truncWarning}
    ${_tableWrap(['Fecha','Propietario','Unidad','Período','Importe','Estado','Canal'], tableRows, 'Sin pagos en el período seleccionado')}
    ${payments.length > 0 ? _dlButtons(`
      <button class="btn btn-secondary btn-sm" onclick="_downloadPaymentsExcel()" style="gap:.35rem;display:flex;align-items:center">
        ${_ICON_DL} Descargar Excel
      </button>`) : ''}
  </div>`;
}

window._downloadPaymentsExcel = function() {
  const d = _rpt.paymentsData;
  if (!d) { toast('Generá el reporte primero', 'warning'); return; }
  const headers = ['Fecha','Propietario','Email','Unidad / Lote','Período','Tipo','Importe','Estado','Canal','Aprobado por'];
  const rows = d.payments.map(p => [
    _fmtDt(p.date), p.ownerName, p.ownerEmail, p.unitLabel, p.month || '—',
    _tpLbl(p.type), p.amount, _stLbl(p.status), _mLbl(p.paymentMethod), p.reviewedByName,
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 12 }, { wch: 24 }, { wch: 26 }, { wch: 14 }, { wch: 10 }, { wch: 14 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 20 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Pagos');
  XLSX.writeFile(wb, `pagos_${new Date().toISOString().slice(0,10)}.xlsx`);
};

// ─────────────────────────────────────────────────────────────
// TAB 5 — Gastos por período
// ─────────────────────────────────────────────────────────────
function _renderTabExpenses() {
  const today = new Date().toISOString().slice(0, 10);
  const firstOfMonth = today.slice(0, 7) + '-01';

  document.getElementById('rpt-content').innerHTML = `
    <div class="card" style="padding:1rem 1.25rem;margin-bottom:1rem;">
      <div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(160px,1fr));gap:.75rem;align-items:end;">
        <div class="form-group" style="margin:0;">
          <label>Desde</label>
          <input type="date" id="exp-from" class="input" value="${firstOfMonth}">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Hasta</label>
          <input type="date" id="exp-to" class="input" value="${today}">
        </div>
        <div class="form-group" style="margin:0;">
          <label>Categoría</label>
          <select id="exp-cat" class="select">
            <option value="">Todas</option>
            ${Object.entries(CAT_LABELS).map(([k, v]) => `<option value="${k}">${v}</option>`).join('')}
          </select>
        </div>
        <div class="form-group" style="margin:0;">
          <label>Tipo</label>
          <select id="exp-type" class="select">
            <option value="">Todos</option>
            <option value="ordinary">Ordinario</option>
            <option value="extraordinary">Extraordinario</option>
          </select>
        </div>
        <button class="btn btn-primary" onclick="_generateExpenses()" style="gap:.4rem;display:flex;align-items:center;height:38px;">
          ${SVG.list} Generar
        </button>
      </div>
    </div>
    <div id="exp-result"></div>`;
}

window._generateExpenses = async function() {
  const from        = document.getElementById('exp-from')?.value;
  const to          = document.getElementById('exp-to')?.value;
  const category    = document.getElementById('exp-cat')?.value  || undefined;
  const expenseType = document.getElementById('exp-type')?.value || undefined;
  const area        = document.getElementById('exp-result');
  if (!area) return;
  area.innerHTML = `<div class="card" style="padding:1.5rem;text-align:center;color:var(--muted);">Generando…</div>`;
  try {
    const res = await api.reports.expenses({ from, to, category, expenseType });
    _rpt.expensesData = res.data;
    area.innerHTML = _renderExpensesResult(res.data);
  } catch (err) {
    area.innerHTML = errorState(err.message, '_generateExpenses()');
    toast(err.message, 'error');
  }
};

function _renderExpensesResult(d) {
  const { expenses, summary, truncated } = d;

  const tableRows = expenses.map((e, i) => {
    const bg    = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)';
    const tBadge = e.expenseType === 'extraordinary'
      ? `<span class="badge badge-warning" style="font-size:.65rem;">Extraord.</span>`
      : `<span class="badge badge-neutral" style="font-size:.65rem;">Ord.</span>`;
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:.5rem .75rem;background:${bg};">${_fmtDt(e.date)}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${escapeHtml(e.description)}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${escapeHtml(e.categoryLabel)}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${tBadge}</td>
      <td style="padding:.5rem .75rem;background:${bg};color:var(--muted);">${escapeHtml(e.providerName)}</td>
      <td style="padding:.5rem .75rem;background:${bg};text-align:right;font-weight:600;">${_fmt$(e.amount)}</td>
      <td style="padding:.5rem .75rem;background:${bg};color:var(--muted);">${e.invoiceNumber}</td>
    </tr>`;
  }).join('');

  const truncWarning = truncated ? `<p class="text-muted text-sm" style="margin:.5rem 0;">⚠️ Mostrando los primeros 1.000 resultados.</p>` : '';

  return `<div class="card" style="padding:1.25rem;">
    ${_summaryBadge([
      { label: 'Total gastos',      value: summary.count, color: 'var(--accent)' },
      { label: 'Total importe',     value: _fmt$(summary.total), color: 'var(--danger)' },
      { label: 'Ordinarios',        value: _fmt$(summary.totalOrdinary), color: 'var(--muted)' },
      { label: 'Extraordinarios',   value: _fmt$(summary.totalExtraordinary), color: 'var(--warning)' },
    ])}
    ${truncWarning}
    ${_tableWrap(['Fecha','Descripción','Categoría','Tipo','Proveedor','Importe','N° Factura'], tableRows, 'Sin gastos en el período seleccionado')}
    ${expenses.length > 0 ? _dlButtons(`
      <button class="btn btn-secondary btn-sm" onclick="_downloadExpensesExcel()" style="gap:.35rem;display:flex;align-items:center">
        ${_ICON_DL} Descargar Excel
      </button>`) : ''}
  </div>`;
}

window._downloadExpensesExcel = function() {
  const d = _rpt.expensesData;
  if (!d) { toast('Generá el reporte primero', 'warning'); return; }
  const headers = ['Fecha','Descripción','Categoría','Tipo','Proveedor','Importe','Estado','N° Factura','Cobrable'];
  const rows = d.expenses.map(e => [
    _fmtDt(e.date), e.description, e.categoryLabel,
    e.expenseType === 'extraordinary' ? 'Extraordinario' : 'Ordinario',
    e.providerName, e.amount, e.status === 'paid' ? 'Pagado' : 'Pendiente',
    e.invoiceNumber, e.isChargeable ? 'Sí' : 'No',
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 12 }, { wch: 30 }, { wch: 16 }, { wch: 14 }, { wch: 22 }, { wch: 14 }, { wch: 12 }, { wch: 14 }, { wch: 10 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Gastos');
  XLSX.writeFile(wb, `gastos_${new Date().toISOString().slice(0,10)}.xlsx`);
};

// ─────────────────────────────────────────────────────────────
// TAB 6 — Propietarios / Unidades
// ─────────────────────────────────────────────────────────────
function _renderTabOwners() {
  document.getElementById('rpt-content').innerHTML = `
    <div class="card" style="padding:1rem 1.25rem;margin-bottom:1rem;">
      <div style="display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap;">
        <div class="form-group" style="margin:0;">
          <label style="display:flex;align-items:center;gap:.4rem;cursor:pointer;">
            <input type="checkbox" id="own-inactive" style="accent-color:var(--accent);width:15px;height:15px;">
            Incluir inactivos
          </label>
        </div>
        <button class="btn btn-primary" onclick="_generateOwners()" style="gap:.4rem;display:flex;align-items:center;height:38px;">
          ${SVG.list} Generar
        </button>
      </div>
    </div>
    <div id="own-result"></div>`;
}

window._generateOwners = async function() {
  const includeInactive = document.getElementById('own-inactive')?.checked ?? false;
  const area = document.getElementById('own-result');
  if (!area) return;
  area.innerHTML = `<div class="card" style="padding:1.5rem;text-align:center;color:var(--muted);">Generando…</div>`;
  try {
    const res = await api.reports.owners({ includeInactive });
    _rpt.ownersData = res.data;
    area.innerHTML = _renderOwnersResult(res.data);
  } catch (err) {
    area.innerHTML = errorState(err.message, '_generateOwners()');
    toast(err.message, 'error');
  }
};

function _renderOwnersResult(d) {
  const { owners, summary } = d;

  const tableRows = owners.map((o, i) => {
    const bg    = i % 2 === 0 ? 'var(--surface)' : 'var(--surface-2)';
    const stBadge = o.isActive
      ? `<span class="badge badge-success" style="font-size:.65rem;">Activo</span>`
      : `<span class="badge badge-neutral" style="font-size:.65rem;">Inactivo</span>`;
    const debtBadge = o.isDebtor
      ? `<span class="badge badge-danger" style="font-size:.65rem;">Moroso</span>`
      : '';
    const balColor = o.balance < 0 ? 'var(--danger)' : o.balance > 0 ? 'var(--success)' : 'var(--muted)';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:.5rem .75rem;background:${bg};font-weight:600;">${escapeHtml(o.name)}</td>
      <td style="padding:.5rem .75rem;background:${bg};color:var(--muted);">${escapeHtml(o.email)}</td>
      <td style="padding:.5rem .75rem;background:${bg};color:var(--muted);">${escapeHtml(o.phone)}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${escapeHtml(o.unitLabel)}</td>
      <td style="padding:.5rem .75rem;background:${bg};">${stBadge} ${debtBadge}</td>
      <td style="padding:.5rem .75rem;background:${bg};text-align:right;font-weight:600;color:${balColor};">${_fmt$(o.balance)}</td>
      <td style="padding:.5rem .75rem;background:${bg};color:var(--muted);">${o.startBillingPeriod || '—'}</td>
      <td style="padding:.5rem .75rem;background:${bg};color:var(--muted);">${_fmtDt(o.createdAt)}</td>
    </tr>`;
  }).join('');

  return `<div class="card" style="padding:1.25rem;">
    ${_summaryBadge([
      { label: 'Total propietarios', value: summary.total,   color: 'var(--accent)' },
      { label: 'Activos',            value: summary.active,  color: 'var(--success)' },
      { label: 'Morosos',            value: summary.debtors, color: 'var(--danger)' },
    ])}
    ${_tableWrap(['Nombre','Email','Teléfono','Unidad / Lote','Estado','Saldo','Inicio facturación','Alta'], tableRows, 'Sin propietarios')}
    ${owners.length > 0 ? _dlButtons(`
      <button class="btn btn-secondary btn-sm" onclick="_downloadOwnersExcel()" style="gap:.35rem;display:flex;align-items:center">
        ${_ICON_DL} Descargar Excel
      </button>`) : ''}
  </div>`;
}

window._downloadOwnersExcel = function() {
  const d = _rpt.ownersData;
  if (!d) { toast('Generá el reporte primero', 'warning'); return; }
  const headers = ['Nombre','Email','Teléfono','Unidad / Lote','Estado','Moroso','Saldo','Inicio facturación','Fecha de alta'];
  const rows = d.owners.map(o => [
    o.name, o.email, o.phone, o.unitLabel,
    o.isActive ? 'Activo' : 'Inactivo',
    o.isDebtor ? 'Sí' : 'No',
    o.balance, o.startBillingPeriod || '—', _fmtDt(o.createdAt),
  ]);
  const wb = XLSX.utils.book_new();
  const ws = XLSX.utils.aoa_to_sheet([headers, ...rows]);
  ws['!cols'] = [{ wch: 25 }, { wch: 28 }, { wch: 16 }, { wch: 16 }, { wch: 10 }, { wch: 8 }, { wch: 14 }, { wch: 18 }, { wch: 14 }];
  XLSX.utils.book_append_sheet(wb, ws, 'Propietarios');
  XLSX.writeFile(wb, `propietarios_${new Date().toISOString().slice(0,10)}.xlsx`);
};

// ─────────────────────────────────────────────────────────────
// TAB 7 — Rendición mensual/anual profesional
// ─────────────────────────────────────────────────────────────

function _renderTabRendicion() {
  const el = document.getElementById('rpt-content');
  if (!el) return;

  el.innerHTML = `
  <div class="card" style="margin-bottom:1rem;padding:1rem 1.25rem;">
    <div style="display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap;">
      <div class="form-group" style="flex:1;min-width:160px;margin:0">
        <label style="font-size:.75rem;margin-bottom:.3rem;display:block">Período</label>
        <input type="month" id="rend-month" class="input" value="${_rpt.renditionPeriod}" style="font-size:.9rem">
      </div>
      <button class="btn btn-primary" id="btn-rend-preview" onclick="window._rendPreview()" style="gap:.4rem;display:flex;align-items:center">
        ${SVG.list} Previsualizar
      </button>
      <button class="btn btn-secondary" id="btn-rend-pdf" onclick="window._rendGeneratePdf()" style="gap:.4rem;display:flex;align-items:center">
        ${_ICON_PDF} Generar PDF
      </button>
    </div>
  </div>

  <div id="rend-content">
    <p class="text-muted text-sm" style="padding:2rem;text-align:center;">Seleccioná un período y presioná <strong>Previsualizar</strong>.</p>
  </div>

  <div class="card" style="margin-top:1.5rem;padding:1rem 1.25rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="window._rendToggleAnnual()">
      <strong style="font-size:.9rem;color:var(--text-bright)">Rendición anual</strong>
      <span id="rend-annual-chevron" style="color:var(--muted);font-size:1.1rem;">▶</span>
    </div>
    <div id="rend-annual-section" style="display:none;margin-top:1rem;">
      <div style="display:flex;gap:.75rem;align-items:flex-end;flex-wrap:wrap;">
        <div class="form-group" style="flex:1;min-width:120px;margin:0">
          <label style="font-size:.75rem;margin-bottom:.3rem;display:block">Año</label>
          <input type="number" id="rend-year" class="input" value="${new Date().getFullYear()}" min="2020" max="2099" style="font-size:.9rem">
        </div>
        <button class="btn btn-secondary" onclick="window._rendLoadAnnual()" style="gap:.4rem;display:flex;align-items:center">
          ${SVG.list} Ver rendición anual
        </button>
      </div>
      <div id="rend-annual-content" style="margin-top:1rem;"></div>
    </div>
  </div>

  <div class="card" style="margin-top:1.5rem;padding:1rem 1.25rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="window._rendToggleHistory()">
      <strong style="font-size:.9rem;color:var(--text-bright)">Historial de rendiciones</strong>
      <span id="rend-hist-chevron" style="color:var(--muted);font-size:1.1rem;">▶</span>
    </div>
    <div id="rend-hist-section" style="display:none;margin-top:1rem;">
      <button class="btn btn-secondary btn-sm" onclick="window._rendLoadHistory()" style="margin-bottom:.75rem;">Cargar historial</button>
      <div id="rend-hist-content"></div>
    </div>
  </div>`;

  document.getElementById('rend-month').addEventListener('change', e => { _rpt.renditionPeriod = e.target.value; });
}

window._rendToggleAnnual = function() {
  const s = document.getElementById('rend-annual-section');
  const c = document.getElementById('rend-annual-chevron');
  if (!s) return;
  const isOpen = s.style.display !== 'none';
  s.style.display = isOpen ? 'none' : 'block';
  if (c) c.textContent = isOpen ? '▶' : '▼';
};

window._rendToggleHistory = function() {
  const s = document.getElementById('rend-hist-section');
  const c = document.getElementById('rend-hist-chevron');
  if (!s) return;
  const isOpen = s.style.display !== 'none';
  s.style.display = isOpen ? 'none' : 'block';
  if (c) c.textContent = isOpen ? '▶' : '▼';
};

window._rendPreview = async function() {
  const period = document.getElementById('rend-month')?.value || _rpt.renditionPeriod;
  _rpt.renditionPeriod = period;
  const area = document.getElementById('rend-content');
  if (!area) return;

  area.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--muted)">
    <p>Cargando preview…</p></div>`;

  try {
    const res = await api.renditions.getPreview(period);
    _rpt.renditionData = res.data;
    area.innerHTML = _buildRenditionPreviewHTML(res.data);
  } catch (err) {
    area.innerHTML = errorState(err.message, '_rendPreview()');
    toast(err.message, 'error');
  }
};

function _buildRenditionPreviewHTML(d) {
  const { org, periodLabel, summary, expenses, payments, delinquency, observations, warnings, unidentifiedPendingCount, existingRendition } = d;

  // Tarjetas resumen ejecutivo
  const cards = _summaryBadge([
    { label: 'Saldo anterior',  value: _fmt$(summary.saldoAnterior),  color: summary.saldoAnterior < 0 ? 'var(--danger)' : 'var(--accent)' },
    { label: 'Ingresos cobrados', value: _fmt$(summary.income),       color: 'var(--success)' },
    { label: 'Total gastos',    value: _fmt$(summary.expTotal),        color: 'var(--danger)' },
    { label: 'Balance',         value: _fmt$(summary.balance),         color: summary.balance < 0 ? 'var(--danger)' : 'var(--success)' },
    { label: 'Gastos ordinarios', value: _fmt$(summary.ordinaryTotal), color: 'var(--muted)' },
    { label: 'Gastos extraord.',  value: _fmt$(summary.extraordinaryTotal), color: 'var(--muted)' },
    { label: 'Pagos pendientes', value: `${summary.pendingCount} (${_fmt$(summary.pendingTotal)})`, color: summary.pendingCount > 0 ? 'var(--warning)' : 'var(--muted)' },
    { label: 'Morosidad',       value: `${delinquency.delinquencyRate}%`, color: delinquency.delinquencyRate > 0 ? 'var(--danger)' : 'var(--success)' },
    { label: 'Deuda total',     value: _fmt$(delinquency.totalDebt),   color: delinquency.totalDebt > 0 ? 'var(--danger)' : 'var(--muted)' },
  ]);

  // Advertencias
  const warnHtml = warnings.length > 0
    ? `<div class="card" style="margin-bottom:1rem;padding:1rem;border-left:3px solid var(--warning);">
        <strong style="font-size:.8rem;color:var(--warning);display:block;margin-bottom:.5rem;">Advertencias (${warnings.length})</strong>
        ${warnings.map(w => `<div style="font-size:.82rem;color:var(--text);margin-bottom:.25rem;">
          ${w.severity === 'critical' ? '🔴' : w.severity === 'warning' ? '🟡' : 'ℹ️'} ${escapeHtml(w.message)}
        </div>`).join('')}
      </div>` : '';

  // Sección gastos por categoría
  const catEntries = Object.entries(expenses.categoryLabels || {});
  const gastoRows = catEntries.map(([key, label]) => {
    const cat = (expenses.byCategory || {})[key];
    if (!cat) return '';
    const tot = (cat.ordinary || 0) + (cat.extraordinary || 0);
    if (tot === 0) return '';
    return `<tr style="border-bottom:1px solid var(--border);">
      <td style="padding:.5rem .75rem;font-size:.82rem;">${escapeHtml(label)}</td>
      <td style="padding:.5rem .75rem;font-size:.82rem;text-align:right;">${_fmt$(cat.ordinary || 0)}</td>
      <td style="padding:.5rem .75rem;font-size:.82rem;text-align:right;">${_fmt$(cat.extraordinary || 0)}</td>
      <td style="padding:.5rem .75rem;font-size:.82rem;font-weight:700;text-align:right;">${_fmt$(tot)}</td>
    </tr>`;
  }).join('');

  // Pagos aprobados
  const pagRows = payments.approved.slice(0, 20).map((p, i) =>
    `<tr style="border-bottom:1px solid var(--border);background:${i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)'};">
      <td style="padding:.5rem .75rem;font-size:.82rem;">${_fmtDt(p.date)}</td>
      <td style="padding:.5rem .75rem;font-size:.82rem;">${escapeHtml(p.owner)}</td>
      <td style="padding:.5rem .75rem;font-size:.82rem;text-align:right;">${_fmt$(p.amount)}</td>
      <td style="padding:.5rem .75rem;font-size:.82rem;">${p.method === 'mercadopago' ? 'MercadoPago' : 'Manual'}</td>
    </tr>`).join('') || `<tr><td colspan="4" style="padding:1rem;font-size:.82rem;color:var(--muted);text-align:center;">Sin pagos aprobados.</td></tr>`;

  const pendRows = payments.pending.length > 0
    ? payments.pending.map((p, i) =>
        `<tr style="border-bottom:1px solid var(--border);background:rgba(251,191,36,.05);">
          <td style="padding:.5rem .75rem;font-size:.82rem;">${_fmtDt(p.date)}</td>
          <td style="padding:.5rem .75rem;font-size:.82rem;">${escapeHtml(p.owner)}</td>
          <td style="padding:.5rem .75rem;font-size:.82rem;text-align:right;">${_fmt$(p.amount)}</td>
        </tr>`).join('')
    : '';

  // Morosidad
  const morCards = _summaryBadge([
    { label: 'Morosos',         value: `${delinquency.delinquentOwners} / ${delinquency.totalOwners}`, color: delinquency.delinquentOwners > 0 ? 'var(--danger)' : 'var(--success)' },
    { label: 'Deuda total',     value: _fmt$(delinquency.totalDebt), color: delinquency.totalDebt > 0 ? 'var(--danger)' : 'var(--muted)' },
    { label: 'Mora crítica',    value: delinquency.criticalOwners,   color: delinquency.criticalOwners > 0 ? 'var(--danger)' : 'var(--muted)' },
    { label: 'Período más ant.', value: delinquency.oldestDebtPeriod ? _fmtPeriodLabel(delinquency.oldestDebtPeriod) : '—', color: 'var(--muted)' },
  ]);

  const existingBanner = existingRendition
    ? `<div style="margin-bottom:.75rem;padding:.6rem 1rem;background:var(--accent-lt);border-radius:8px;font-size:.82rem;color:var(--text);">
        ✅ Ya existe PDF de rendición generado (v${existingRendition.version}, ${_fmtDt(existingRendition.generatedAt)}).
        <a href="${existingRendition.pdfUrl}" target="_blank" rel="noopener" style="color:var(--accent);margin-left:.5rem;">Ver PDF ↗</a>
      </div>` : '';

  return `
  ${existingBanner}
  <div class="card" style="margin-bottom:1rem;padding:1rem 1.25rem;">
    <div style="font-size:.75rem;color:var(--muted);text-transform:uppercase;letter-spacing:.04em;margin-bottom:.6rem;">Resumen ejecutivo — ${escapeHtml(periodLabel)}</div>
    ${cards}
    ${_dlButtons(`
      <button class="btn btn-secondary btn-sm" onclick="window._rendExportCsv('resumen')" style="gap:.3rem;display:flex;align-items:center">${_ICON_DL} Resumen CSV</button>
    `)}
  </div>

  ${warnHtml}

  <!-- GASTOS -->
  <div class="card" style="margin-bottom:1rem;padding:1rem 1.25rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="window._rendToggleSection('gastos')">
      <strong style="font-size:.9rem;color:var(--text-bright)">Gastos del período</strong>
      <span style="color:var(--accent);font-size:.82rem;">${_fmt$(expenses.total || 0)} ▼</span>
    </div>
    <div id="rend-sec-gastos" style="margin-top:.75rem;">
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
          <thead><tr style="border-bottom:2px solid var(--border-md);">
            <th style="padding:.5rem .75rem;text-align:left;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Categoría</th>
            <th style="padding:.5rem .75rem;text-align:right;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Ordinario</th>
            <th style="padding:.5rem .75rem;text-align:right;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Extraordinario</th>
            <th style="padding:.5rem .75rem;text-align:right;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Total</th>
          </tr></thead>
          <tbody>${gastoRows || '<tr><td colspan="4" style="padding:1rem;font-size:.82rem;color:var(--muted);text-align:center;">Sin gastos.</td></tr>'}</tbody>
        </table>
      </div>
      ${_dlButtons(`<button class="btn btn-secondary btn-sm" onclick="window._rendExportCsv('gastos')" style="gap:.3rem;display:flex;align-items:center">${_ICON_DL} Gastos CSV</button>`)}
    </div>
  </div>

  <!-- PAGOS APROBADOS -->
  <div class="card" style="margin-bottom:1rem;padding:1rem 1.25rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="window._rendToggleSection('pagos')">
      <strong style="font-size:.9rem;color:var(--text-bright)">Ingresos / Pagos aprobados</strong>
      <span style="color:var(--success);font-size:.82rem;">${_fmt$(summary.income)} ▼</span>
    </div>
    <div id="rend-sec-pagos" style="margin-top:.75rem;">
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
          <thead><tr style="border-bottom:2px solid var(--border-md);">
            <th style="padding:.5rem .75rem;text-align:left;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Fecha</th>
            <th style="padding:.5rem .75rem;text-align:left;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Propietario</th>
            <th style="padding:.5rem .75rem;text-align:right;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Importe</th>
            <th style="padding:.5rem .75rem;text-align:left;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Medio</th>
          </tr></thead>
          <tbody>${pagRows}</tbody>
        </table>
      </div>
      ${payments.approved.length > 20 ? `<p class="text-muted text-sm" style="margin-top:.5rem;">Mostrando 20 de ${payments.approved.length}. Descargá el CSV para ver todos.</p>` : ''}
      ${payments.pending.length > 0 ? `
        <div style="margin-top:.75rem;padding:.75rem;background:rgba(251,191,36,.07);border-radius:8px;border:1px solid rgba(251,191,36,.2);">
          <strong style="font-size:.8rem;color:var(--warning);display:block;margin-bottom:.4rem;">Pagos pendientes de aprobación (${payments.pending.length})</strong>
          <table style="width:100%;border-collapse:collapse;">
            <thead><tr><th style="padding:.4rem .75rem;text-align:left;color:var(--muted);font-size:.72rem;">Fecha</th>
              <th style="padding:.4rem .75rem;text-align:left;color:var(--muted);font-size:.72rem;">Propietario</th>
              <th style="padding:.4rem .75rem;text-align:right;color:var(--muted);font-size:.72rem;">Importe</th></tr></thead>
            <tbody>${pendRows}</tbody>
          </table>
        </div>` : ''}
      ${_dlButtons(`<button class="btn btn-secondary btn-sm" onclick="window._rendExportCsv('pagos')" style="gap:.3rem;display:flex;align-items:center">${_ICON_DL} Pagos CSV</button>`)}
    </div>
  </div>

  <!-- MOROSIDAD -->
  <div class="card" style="margin-bottom:1rem;padding:1rem 1.25rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="window._rendToggleSection('mora')">
      <strong style="font-size:.9rem;color:var(--text-bright)">Deuda y morosidad</strong>
      <span style="color:${delinquency.delinquencyRate > 0 ? 'var(--danger)' : 'var(--muted)'};font-size:.82rem;">${delinquency.delinquencyRate}% ▼</span>
    </div>
    <div id="rend-sec-mora" style="margin-top:.75rem;">
      ${morCards}
      ${_dlButtons(`<button class="btn btn-secondary btn-sm" onclick="window._rendExportCsv('morosidad')" style="gap:.3rem;display:flex;align-items:center">${_ICON_DL} Morosidad CSV</button>`)}
    </div>
  </div>

  <!-- OBSERVACIONES -->
  <div class="card" style="margin-bottom:1rem;padding:1rem 1.25rem;">
    <div style="display:flex;justify-content:space-between;align-items:center;cursor:pointer;" onclick="window._rendToggleSection('obs')">
      <strong style="font-size:.9rem;color:var(--text-bright)">Observaciones del administrador</strong>
      <span style="color:var(--muted);font-size:.82rem;">▼</span>
    </div>
    <div id="rend-sec-obs" style="margin-top:.75rem;">
      <textarea id="rend-obs-text" class="input" rows="5" maxlength="4000"
        placeholder="Agregá observaciones que se incluirán en el PDF de rendición…"
        style="width:100%;resize:vertical;font-size:.85rem;">${escapeHtml(observations || '')}</textarea>
      <div style="margin-top:.5rem;display:flex;gap:.5rem;align-items:center;">
        <button class="btn btn-primary btn-sm" onclick="window._rendSaveObs()" style="gap:.3rem;display:flex;align-items:center">
          Guardar observaciones
        </button>
        <span id="rend-obs-status" style="font-size:.78rem;color:var(--muted);"></span>
      </div>
    </div>
  </div>`;
}

window._rendToggleSection = function(id) {
  const sec = document.getElementById(`rend-sec-${id}`);
  if (!sec) return;
  sec.style.display = sec.style.display === 'none' ? 'block' : 'none';
};

window._rendGeneratePdf = async function() {
  const period = _rpt.renditionPeriod;
  if (!period) { toast('Seleccioná un período primero.', 'warning'); return; }
  const btn = document.getElementById('btn-rend-pdf');
  if (btn) { btn.disabled = true; btn.textContent = 'Generando…'; }
  try {
    const res = await api.renditions.generatePdf(period);
    toast('PDF generado exitosamente.', 'success');
    if (res.data?.pdfUrl) {
      window.open(res.data.pdfUrl, '_blank');
    }
    _rpt.renditionData = null; // forzar reload del preview para mostrar banner
    window._rendPreview();
  } catch (err) {
    toast(err.message || 'Error al generar el PDF.', 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `${_ICON_PDF} Generar PDF`; }
  }
};

window._rendExportCsv = async function(section) {
  const period = _rpt.renditionPeriod;
  if (!period) { toast('Seleccioná un período primero.', 'warning'); return; }
  try {
    const blob = await api.renditions.exportCsv(period, section);
    _triggerBlobDownload(blob, `rendicion_${period}_${section}.csv`);
  } catch (err) {
    toast(err.message || 'Error al exportar CSV.', 'error');
  }
};

window._rendSaveObs = async function() {
  const period = _rpt.renditionPeriod;
  const text   = document.getElementById('rend-obs-text')?.value || '';
  const status = document.getElementById('rend-obs-status');
  if (!period) { toast('Seleccioná un período primero.', 'warning'); return; }
  if (status) status.textContent = 'Guardando…';
  try {
    await api.renditions.saveObservations(period, text);
    if (status) status.textContent = 'Guardado ✓';
    setTimeout(() => { if (status) status.textContent = ''; }, 3000);
  } catch (err) {
    if (status) status.textContent = 'Error al guardar.';
    toast(err.message || 'Error al guardar observaciones.', 'error');
  }
};

window._rendLoadHistory = async function() {
  const area = document.getElementById('rend-hist-content');
  if (!area) return;
  area.innerHTML = `<p class="text-muted text-sm">Cargando…</p>`;
  try {
    const res = await api.renditions.getHistory();
    const history = res.data || [];
    if (!history.length) {
      area.innerHTML = `<p class="text-muted text-sm" style="text-align:center;padding:1rem;">Sin rendiciones generadas aún.</p>`;
      return;
    }
    const rows = history.map(h => `
      <tr style="border-bottom:1px solid var(--border);">
        <td style="padding:.5rem .75rem;font-size:.82rem;">${_fmtPeriodLabel(h.period)}</td>
        <td style="padding:.5rem .75rem;font-size:.82rem;">${_fmtDt(h.generatedAt)}</td>
        <td style="padding:.5rem .75rem;font-size:.82rem;">${h.generatedBy?.name || '—'}</td>
        <td style="padding:.5rem .75rem;font-size:.82rem;">
          <span class="badge ${h.status === 'generated' ? 'badge-success' : 'badge-neutral'}">${h.status}</span>
        </td>
        <td style="padding:.5rem .75rem;font-size:.82rem;text-align:center;">v${h.version}</td>
        <td style="padding:.5rem .75rem;font-size:.82rem;">
          ${h.pdfUrl ? `<a href="${h.pdfUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="gap:.3rem;display:inline-flex;align-items:center;">${_ICON_PDF} Ver PDF</a>` : '—'}
        </td>
      </tr>`).join('');
    area.innerHTML = `
      <div style="overflow-x:auto;">
        <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
          <thead><tr style="border-bottom:2px solid var(--border-md);">
            <th style="padding:.5rem .75rem;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Período</th>
            <th style="padding:.5rem .75rem;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Generado</th>
            <th style="padding:.5rem .75rem;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Por</th>
            <th style="padding:.5rem .75rem;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Estado</th>
            <th style="padding:.5rem .75rem;color:var(--muted);font-size:.75rem;text-transform:uppercase;text-align:center;">Versión</th>
            <th style="padding:.5rem .75rem;color:var(--muted);font-size:.75rem;text-transform:uppercase;">PDF</th>
          </tr></thead>
          <tbody>${rows}</tbody>
        </table>
      </div>`;
  } catch (err) {
    area.innerHTML = errorState(err.message, '_rendLoadHistory()');
  }
};

window._rendLoadAnnual = async function() {
  const year  = document.getElementById('rend-year')?.value || new Date().getFullYear();
  const area  = document.getElementById('rend-annual-content');
  if (!area) return;
  area.innerHTML = `<p class="text-muted text-sm">Cargando rendición anual ${year}…</p>`;
  try {
    const res = await api.renditions.getAnnual(year);
    const { rows, totals, warnings } = res.data;

    const warnHtml = warnings.length > 0
      ? `<div style="margin-bottom:.75rem;padding:.6rem 1rem;background:var(--accent-lt);border-radius:8px;font-size:.82rem;color:var(--text);">
          ${warnings.map(w => `ℹ️ ${escapeHtml(w.message)}`).join('<br>')}
        </div>` : '';

    const monthRows = rows.map((r, i) => {
      if (r.error) return `<tr style="border-bottom:1px solid var(--border);">
        <td style="padding:.5rem .75rem;font-size:.82rem;">${escapeHtml(r.periodLabel)}</td>
        <td colspan="6" style="padding:.5rem .75rem;font-size:.82rem;color:var(--muted);">Error al calcular.</td>
      </tr>`;
      const res = (r.resultado || 0) >= 0;
      return `<tr style="border-bottom:1px solid var(--border);background:${i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,.02)'};">
        <td style="padding:.5rem .75rem;font-size:.82rem;font-weight:600;">${escapeHtml(r.periodLabel)}</td>
        <td style="padding:.5rem .75rem;font-size:.82rem;text-align:right;color:var(--success);">${_fmt$(r.income)}</td>
        <td style="padding:.5rem .75rem;font-size:.82rem;text-align:right;color:var(--danger);">${_fmt$(r.expTotal)}</td>
        <td style="padding:.5rem .75rem;font-size:.82rem;text-align:right;">${_fmt$(r.ordinaryTotal)}</td>
        <td style="padding:.5rem .75rem;font-size:.82rem;text-align:right;">${_fmt$(r.extraordinaryTotal)}</td>
        <td style="padding:.5rem .75rem;font-size:.82rem;text-align:right;font-weight:700;color:${res ? 'var(--success)' : 'var(--danger)'};">${_fmt$(r.resultado)}</td>
        <td style="padding:.5rem .75rem;font-size:.82rem;text-align:center;">
          ${r.hasSavedRendition ? `<a href="${r.savedPdfUrl}" target="_blank" rel="noopener" class="btn btn-secondary btn-sm" style="padding:.2rem .5rem;font-size:.72rem;">${_ICON_PDF}</a>` : '<span class="text-muted text-sm">—</span>'}
        </td>
      </tr>`;
    }).join('');

    area.innerHTML = `${warnHtml}
    <div style="overflow-x:auto;">
      <table style="width:100%;border-collapse:collapse;font-size:.82rem;">
        <thead><tr style="border-bottom:2px solid var(--border-md);">
          <th style="padding:.5rem .75rem;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Mes</th>
          <th style="padding:.5rem .75rem;text-align:right;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Ingresos</th>
          <th style="padding:.5rem .75rem;text-align:right;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Total gastos</th>
          <th style="padding:.5rem .75rem;text-align:right;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Ordinarios</th>
          <th style="padding:.5rem .75rem;text-align:right;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Extraord.</th>
          <th style="padding:.5rem .75rem;text-align:right;color:var(--muted);font-size:.75rem;text-transform:uppercase;">Resultado</th>
          <th style="padding:.5rem .75rem;text-align:center;color:var(--muted);font-size:.75rem;text-transform:uppercase;">PDF</th>
        </tr></thead>
        <tbody>${monthRows}</tbody>
        <tfoot>
          <tr style="border-top:2px solid var(--border-md);font-weight:700;">
            <td style="padding:.6rem .75rem;font-size:.82rem;">TOTAL ${year}</td>
            <td style="padding:.6rem .75rem;font-size:.82rem;text-align:right;color:var(--success);">${_fmt$(totals.income)}</td>
            <td style="padding:.6rem .75rem;font-size:.82rem;text-align:right;color:var(--danger);">${_fmt$(totals.expTotal)}</td>
            <td style="padding:.6rem .75rem;font-size:.82rem;text-align:right;">${_fmt$(totals.ordinaryTotal)}</td>
            <td style="padding:.6rem .75rem;font-size:.82rem;text-align:right;">${_fmt$(totals.extraordinaryTotal)}</td>
            <td style="padding:.6rem .75rem;font-size:.82rem;text-align:right;color:${totals.resultado >= 0 ? 'var(--success)' : 'var(--danger)'};">${_fmt$(totals.resultado)}</td>
            <td></td>
          </tr>
        </tfoot>
      </table>
    </div>`;
  } catch (err) {
    area.innerHTML = errorState(err.message, '_rendLoadAnnual()');
    toast(err.message, 'error');
  }
};

function _fmtPeriodLabel(yyyymm) {
  if (!yyyymm) return '—';
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y, m] = yyyymm.split('-');
  return `${months[parseInt(m, 10) - 1]} ${y}`;
}

// ── Utilidades ────────────────────────────────────────────────
function _triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a   = document.createElement('a');
  a.href     = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── Exponer globalmente ───────────────────────────────────────
window.renderAdminReport   = renderAdminReport;
window.loadReport          = loadReport;
window.downloadExpensasPdf = downloadExpensasPdf;
