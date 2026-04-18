import { toast }                      from '../../ui/toast.js';
import { errorState, currentMonth }   from '../../ui/helpers.js';
import { SVG }                        from '../../ui/icons.js';

// ── Estado ────────────────────────────────────────────────────
const reportState = { month: currentMonth(), data: null };

// ── Labels de categorías de gasto ─────────────────────────────
const CAT_LABELS = {
  cleaning:       'Limpieza',
  security:       'Seguridad',
  maintenance:    'Mantenimiento',
  utilities:      'Servicios',
  administration: 'Administración',
  other:          'Otros',
};

// ── Helpers ───────────────────────────────────────────────────
function fmt(n) {
  return (n || 0).toLocaleString('es-AR', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function formatMonthFull(m) {
  if (!m) return '';
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio',
                  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  const [y, mo] = m.split('-');
  return `${months[parseInt(mo, 10) - 1]} ${y}`;
}

// ── Render principal ──────────────────────────────────────────
export async function renderAdminReport() {
  const el = document.getElementById('page-admin-report');
  if (!el) return;

  el.innerHTML = `
    <div class="page-header">
      <div>
        <h2 style="margin:0 0 .15rem">Informe Mensual</h2>
        <p class="text-muted text-sm" style="margin:0">Resumen financiero del consorcio</p>
      </div>
    </div>

    <div class="report-controls card" style="margin-bottom:1rem">
      <div class="flex gap-2 items-center flex-wrap">
        <div class="form-group" style="flex:1;min-width:160px;margin:0">
          <label style="font-size:.75rem;margin-bottom:.3rem;display:block">Período</label>
          <input type="month" id="report-month-picker" class="input"
                 value="${reportState.month}"
                 style="font-size:.9rem">
        </div>
        <button class="btn btn-primary" id="btn-gen-report"
                onclick="loadReport()" style="align-self:flex-end;gap:.4rem;display:flex;align-items:center">
          ${SVG.list} Generar
        </button>
      </div>
    </div>

    <div id="report-area"></div>`;

  document.getElementById('report-month-picker').addEventListener('change', e => {
    reportState.month = e.target.value;
    loadReport();
  });

  await loadReport();
}

// ── Carga de datos ────────────────────────────────────────────
export async function loadReport() {
  const area = document.getElementById('report-area');
  if (!area) return;

  const btn = document.getElementById('btn-gen-report');
  if (btn) { btn.disabled = true; btn.textContent = 'Cargando…'; }

  const month = document.getElementById('report-month-picker')?.value || reportState.month;
  reportState.month = month;

  area.innerHTML = `<div class="card" style="padding:2rem;text-align:center;color:var(--muted)">
    <svg class="loading-spinner" width="22" height="22" viewBox="0 0 24 24" fill="none"
         stroke="currentColor" stroke-width="2.5" style="margin:0 auto 1rem">
      <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83"/>
    </svg>
    <p>Generando informe…</p>
  </div>`;

  try {
    const res = await api.reports.getMonthlySummary(month);
    reportState.data = res.data;
    area.innerHTML = _renderReportTable(res.data);
  } catch (err) {
    area.innerHTML = errorState(err.message, 'loadReport()');
    toast(err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerHTML = `${SVG.list} Generar`;
    }
  }
}

// ── Tabla del informe ─────────────────────────────────────────
function _renderReportTable(d) {
  const { month, saldoAnterior, income, expenses, balance } = d;
  const balanceClass = balance >= 0 ? 'text-success' : 'text-danger';

  const expRows = Object.entries(CAT_LABELS).map(([key, label]) => `
    <tr class="report-row">
      <td>${label}</td>
      <td class="report-amount">${expenses[key] > 0 ? `$${fmt(expenses[key])}` : '<span class="text-muted">—</span>'}</td>
    </tr>`).join('');

  return `
  <div class="report-table card">

    <!-- Header -->
    <div class="report-header">
      <div>
        <div class="report-title">INFORME MENSUAL</div>
        <div class="report-subtitle">${formatMonthFull(month)}</div>
      </div>
      <button class="btn btn-secondary btn-sm report-print-btn"
              onclick="window.print()" style="gap:.4rem;display:flex;align-items:center">
        <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="15" height="15">
          <path d="M17 17h2a2 2 0 002-2v-4a2 2 0 00-2-2H5a2 2 0 00-2 2v4a2 2 0 002 2h2m2 4h6a2 2 0 002-2v-4a2 2 0 00-2-2H9a2 2 0 00-2 2v4a2 2 0 002 2zm1-4h.01"/>
        </svg>
        Imprimir / PDF
      </button>
    </div>

    <table class="report-body">

      <!-- Saldo anterior -->
      <tbody>
        <tr class="report-section-header">
          <td colspan="2">SALDO ANTERIOR</td>
        </tr>
        <tr class="report-row">
          <td>Saldo al inicio del período</td>
          <td class="report-amount ${saldoAnterior < 0 ? 'text-danger' : ''}">$${fmt(saldoAnterior)}</td>
        </tr>
      </tbody>

      <!-- Ingresos -->
      <tbody>
        <tr class="report-section-header">
          <td colspan="2">INGRESOS</td>
        </tr>
        <tr class="report-row">
          <td>Expensas cobradas</td>
          <td class="report-amount">$${fmt(income.expensas)}</td>
        </tr>
        <tr class="report-subtotal">
          <td>Total ingresos</td>
          <td class="report-amount">$${fmt(income.total)}</td>
        </tr>
      </tbody>

      <!-- Egresos -->
      <tbody>
        <tr class="report-section-header">
          <td colspan="2">EGRESOS</td>
        </tr>
        ${expRows}
        <tr class="report-subtotal">
          <td>Total egresos</td>
          <td class="report-amount">$${fmt(expenses.total)}</td>
        </tr>
      </tbody>

      <!-- Balance final -->
      <tbody>
        <tr class="report-total">
          <td>BALANCE FINAL</td>
          <td class="report-amount ${balanceClass}">$${fmt(balance)}</td>
        </tr>
      </tbody>

    </table>

    <p class="report-footer">
      Generado el ${new Date().toLocaleDateString('es-AR', { day:'2-digit', month:'long', year:'numeric' })}
    </p>
  </div>`;
}

// ── Exponer globalmente ───────────────────────────────────────
window.renderAdminReport = renderAdminReport;
window.loadReport        = loadReport;
