import { skeleton } from '../../ui/skeleton.js';
import { svgIcon } from '../../ui/icons.js';
import { errorState } from '../../ui/helpers.js';
import { getOwnerPayments } from '../../services/ownerSummaryService.js';

let _payments = [];
let _histFilter = 'all';

const MONTHS = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function _periodLabel(month) {
  if (!month) return 'Saldo anterior';
  const [y, m] = month.split('-').map(Number);
  return `${MONTHS[m - 1]} ${y}`;
}

function _shortDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  return d.toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: '2-digit' });
}

function _dotClass(status) {
  if (status === 'approved') return 's-success';
  if (status === 'pending')  return 's-warning';
  return 's-danger';
}

function _statusBadge(status) {
  if (status === 'approved') return `<span class="badge badge-success">Aprobado</span>`;
  if (status === 'pending')  return `<span class="badge badge-warning">Pendiente</span>`;
  return `<span class="badge badge-danger">Rechazado</span>`;
}

function _paymentRow(p) {
  const period = p.monthFormatted || _periodLabel(p.month);
  const method = p.paymentMethod === 'mercadopago' ? 'MercadoPago' : 'Transferencia';
  const receiptActions = [
    p.status === 'approved'
      ? `<button class="btn-icon" onclick="downloadSystemReceipt('${p._id}')" title="Descargar recibo" aria-label="Descargar recibo" style="color:var(--success);flex-shrink:0">${svgIcon('doc', 18)}</button>`
      : '',
    p.receipt?.url
      ? `<button class="btn-icon" onclick="downloadReceipt('${p._id}')" title="Descargar comprobante" aria-label="Descargar comprobante" style="color:var(--muted);flex-shrink:0">${svgIcon('download', 18)}</button>`
      : '',
  ].join('');
  return `
    <div class="list-item" style="padding:14px 16px">
      <div class="dot-status ${_dotClass(p.status)}"></div>
      <div class="list-body">
        <div class="row-between">
          <span class="list-title">${period}</span>
          <span class="bright tnum">$${p.amount != null ? p.amount.toLocaleString('es-AR') : '—'}</span>
        </div>
        <div class="row-between" style="margin-top:4px">
          <span class="list-sub">${_shortDate(p.createdAt)} · ${method}</span>
          ${_statusBadge(p.status)}
        </div>
      </div>
      ${receiptActions ? `<div style="display:flex;gap:6px;align-items:center">${receiptActions}</div>` : ''}
    </div>`;
}

function _computeStats(payments) {
  const year = new Date().getFullYear().toString();
  const approved = payments.filter(p => p.status === 'approved');
  const paidYTD  = approved.filter(p => p.month?.startsWith(year)).reduce((s, p) => s + (p.amount || 0), 0);
  const payCount = approved.length;

  const approvedSet = new Set(approved.filter(p => p.month).map(p => p.month));
  let streak = 0;
  let d = new Date();
  for (let i = 0; i < 24; i++) {
    const ym = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    if (approvedSet.has(ym)) { streak++; d = new Date(d.getFullYear(), d.getMonth() - 1, 1); }
    else break;
  }
  return { paidYTD, payCount, streak };
}

function _groupByMonth(payments) {
  const groups = {};
  for (const p of payments) {
    const key = p.month || '__other__';
    if (!groups[key]) groups[key] = [];
    groups[key].push(p);
  }
  return Object.entries(groups).sort(([a], [b]) => b.localeCompare(a));
}

function _renderList() {
  const filtered = _histFilter === 'all' ? _payments : _payments.filter(p => p.status === _histFilter);
  if (filtered.length === 0) {
    return `<div class="empty" style="padding:32px 0">
      <div class="empty-icon">${svgIcon('doc', 24)}</div>
      <p class="empty-title">Sin resultados</p>
      <p class="empty-sub">No hay pagos que coincidan con el filtro.</p>
    </div>`;
  }
  return _groupByMonth(filtered).map(([key, items]) => {
    const label = key === '__other__' ? 'Otros' : _periodLabel(key);
    return `
      <div class="section-head"><h3>${label}</h3></div>
      <div class="card" style="padding:0;overflow:hidden">
        ${items.map((p, i) => `${i > 0 ? '<div style="height:1px;background:var(--border)"></div>' : ''}${_paymentRow(p)}`).join('')}
      </div>`;
  }).join('');
}

export function switchHistFilter(f) {
  _histFilter = f;
  document.querySelectorAll('#hist-seg .seg-btn').forEach(b => b.classList.toggle('is-active', b.dataset.f === f));
  document.getElementById('hist-list').innerHTML = _renderList();
}

export async function renderOwnerHistory() {
  const el = document.getElementById('page-owner-history');
  el.innerHTML = `<div style="padding:16px">${skeleton(4)}</div>`;
  try {
    const res = await getOwnerPayments(100);
    _payments   = res.data.payments;
    _histFilter = 'all';
    const { paidYTD, payCount, streak } = _computeStats(_payments);

    el.innerHTML = `
      <div style="padding:0 16px 32px">
        <p class="page-eyebrow">Cuenta</p>
        <h1 class="page-title">Mis Pagos</h1>

        <div class="seg" style="margin-top:18px">
          <button class="seg-btn" onclick="showPage('page-owner-pay');renderUploadPage()">${svgIcon('wallet', 16)} Pagar</button>
          <button class="seg-btn is-active">${svgIcon('doc', 16)} Historial</button>
        </div>

        <div class="card" style="display:grid;grid-template-columns:repeat(3,1fr);text-align:center;padding:16px 8px;margin-top:16px">
          <div>
            <div class="h-amount" style="font-size:22px">$${paidYTD >= 1000 ? Math.round(paidYTD / 1000) + 'k' : paidYTD.toLocaleString('es-AR')}</div>
            <div class="muted" style="font:var(--t-xs);margin-top:4px">Pagado este año</div>
          </div>
          <div style="border-left:1px solid var(--border);border-right:1px solid var(--border)">
            <div class="h-amount" style="font-size:22px">${payCount}</div>
            <div class="muted" style="font:var(--t-xs);margin-top:4px">Pagos totales</div>
          </div>
          <div>
            <div class="h-amount" style="font-size:22px">${streak}</div>
            <div class="muted" style="font:var(--t-xs);margin-top:4px">Racha mensual</div>
          </div>
        </div>

        <div class="seg" style="margin-top:18px" id="hist-seg">
          <button class="seg-btn is-active" data-f="all" onclick="switchHistFilter('all')">Todos</button>
          <button class="seg-btn" data-f="approved" onclick="switchHistFilter('approved')">Aprobados</button>
          <button class="seg-btn" data-f="pending" onclick="switchHistFilter('pending')">Pendientes</button>
        </div>

        <div style="margin-top:16px" id="hist-list">${_renderList()}</div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerHistory()');
  }
}

window.renderOwnerHistory = renderOwnerHistory;
window.switchHistFilter   = switchHistFilter;
