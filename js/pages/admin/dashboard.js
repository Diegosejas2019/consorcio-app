import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { formatMonth, statusBadge, errorState, downloadReceipt } from '../../ui/helpers.js';

let _dashYear    = new Date().getFullYear();
let _dashMonthly = [];
let _dashStats   = {};

export async function renderAdminDashboard(year) {
  if (year !== undefined) _dashYear = year;
  const el = document.getElementById('page-admin-dashboard');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(5)}</div>`;
  try {
    const [dashRes, statsRes] = await Promise.all([
      api.payments.getDashboard(_dashYear),
      api.owners.getStats(),
    ]);
    const dash  = dashRes.data;
    const stats = statsRes.data;
    _dashMonthly = dash.monthly || [];
    _dashStats   = stats;

    const maxTotal = Math.max(..._dashMonthly.map(m => m.total), 1);
    const barW = 36, barGap = 16, chartH = 120;
    const chartW = _dashMonthly.length * (barW + barGap);
    const bars = _dashMonthly.map((m) => {
      const h = Math.max(Math.round((m.total / maxTotal) * chartH), m.total > 0 ? 4 : 0);
      const x = _dashMonthly.indexOf(m) * (barW + barGap);
      const label = formatMonth(m._id).slice(0, 3);
      return `<g style="cursor:pointer" onclick="openStatDetail('monthDetail','${m._id}')">
        <rect x="${x}" y="${chartH - h}" width="${barW}" height="${h}" rx="5" fill="var(--accent)" opacity=".85"/>
        <rect x="${x}" y="0" width="${barW}" height="${chartH}" rx="5" fill="transparent"/>
        <text x="${x + barW / 2}" y="${chartH + 16}" text-anchor="middle" font-size="9" fill="var(--muted)">${label}</text>
        ${m.total > 0 ? `<text x="${x + barW / 2}" y="${chartH - h - 5}" text-anchor="middle" font-size="8" fill="var(--accent)" font-weight="600">$${(m.total / 1000).toFixed(0)}k</text>` : ''}
        ${m.pending > 0 ? `<circle cx="${x + barW - 4}" cy="${chartH - h - 2}" r="5" fill="var(--warning)"/><text x="${x + barW - 4}" y="${chartH - h + 2}" text-anchor="middle" font-size="6" fill="#fff" font-weight="700">${m.pending}</text>` : ''}
      </g>`;
    }).join('');

    const totalYear = _dashMonthly.reduce((s, m) => s + (m.total || 0), 0);

    el.innerHTML = `
      <div class="flex col gap-3">
        <div class="flex between" style="align-items:center">
          <h1>Dashboard de Pagos</h1>
          <button class="btn btn-secondary btn-sm" onclick="exportDashboardExcel()" style="gap:.4rem;display:flex;align-items:center">
            ${SVG.download} Excel
          </button>
        </div>
        <div class="stats-grid">
          <div class="stat-card" style="cursor:pointer" onclick="openStatDetail('compliance')">
            <span class="stat-label">Cumplimiento</span>
            <span class="stat-value" style="color:${stats.complianceRate >= 70 ? 'var(--success)' : 'var(--danger)'}">${stats.complianceRate}%</span>
            <span class="stat-sub">${stats.upToDate} de ${stats.totalOwners} ›</span>
          </div>
          <div class="stat-card" style="cursor:pointer" onclick="openStatDetail('collected')">
            <span class="stat-label">Recaudado ${_dashYear}</span>
            <span class="stat-value" style="color:var(--accent);font-size:1.3rem">$${(totalYear / 1000).toFixed(0)}k</span>
            <span class="stat-sub">Ver detalle ›</span>
          </div>
          <div class="stat-card" style="cursor:pointer" onclick="openStatDetail('debtors')">
            <span class="stat-label">Morosos</span>
            <span class="stat-value" style="color:var(--danger)">${stats.debtors}</span>
            <span class="stat-sub">propietarios ›</span>
          </div>
          <div class="stat-card" style="cursor:pointer" onclick="openStatDetail('pending')">
            <span class="stat-label">Por revisar</span>
            <span class="stat-value" style="color:var(--warning)">${stats.pendingPayments}</span>
            <span class="stat-sub">comprobantes ›</span>
          </div>
        </div>
        <div class="card">
          <div class="card-header" style="display:flex;align-items:center;justify-content:space-between">
            <h3>Recaudación mensual</h3>
            <div class="flex gap-1" style="align-items:center">
              <button class="btn btn-ghost btn-sm" style="padding:.2rem .5rem;font-size:1rem" onclick="renderAdminDashboard(${_dashYear - 1})">‹</button>
              <span style="font-size:.9rem;font-weight:600;min-width:2.5rem;text-align:center">${_dashYear}</span>
              <button class="btn btn-ghost btn-sm" style="padding:.2rem .5rem;font-size:1rem" onclick="renderAdminDashboard(${_dashYear + 1})" ${_dashYear >= new Date().getFullYear() ? 'disabled' : ''}>›</button>
            </div>
          </div>
          <div class="card-body" style="overflow-x:auto">
            ${_dashMonthly.length > 0
              ? `<svg width="${Math.max(chartW, 300)}" height="${chartH + 30}" style="display:block;margin:0 auto">${bars}</svg>
                 <p style="text-align:center;font-size:.73rem;color:var(--muted);margin-top:.25rem">Tocá una barra para ver el detalle del mes</p>`
              : '<p class="text-muted text-sm">Sin datos para este año.</p>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Detalle por período — ${_dashYear}</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Período</th><th>Aprobados</th><th>Pendientes</th><th>Rechazados</th><th>Recaudado</th></tr></thead>
              <tbody>${_dashMonthly.length > 0
                ? _dashMonthly.map(m => `<tr style="cursor:pointer" onclick="openStatDetail('monthDetail','${m._id}')">
                    <td class="bold">${formatMonth(m._id)}</td>
                    <td><span class="badge badge-success">${m.count}</span></td>
                    <td><span class="badge badge-warning">${m.pending || 0}</span></td>
                    <td><span class="badge badge-danger">${m.rejected || 0}</span></td>
                    <td class="bold">$${(m.total || 0).toLocaleString('es-AR')}</td>
                  </tr>`).join('')
                : '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Sin datos</td></tr>'
              }</tbody>
            </table>
          </div>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminDashboard()');
  }
}

export async function openStatDetail(type, arg) {
  openModal();
  document.getElementById('modal').innerHTML = `<div class="modal-handle"></div>${skeleton(4)}`;
  try {
    let html = '<div class="modal-handle"></div>';

    if (type === 'pending') {
      const res = await api.payments.getAll({ status: 'pending', limit: 50 });
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
                      <p style="font-size:.78rem;color:var(--muted)">${p.owner?.unit || ''} · ${formatMonth(p.month)} · $${p.amount.toLocaleString('es-AR')}</p>
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
      const res = await api.owners.getAll({ limit: 100 });
      const owners = res.data.owners;
      const upToDate = owners.filter(o => !o.isDebtor);
      const debtors  = owners.filter(o => o.isDebtor);
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
      const res = await api.owners.getAll({ limit: 100 });
      const debtors = res.data.owners.filter(o => o.isDebtor);
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
                    ${o.balance ? `<p style="font-size:.78rem;color:var(--danger);margin-top:.25rem">$${Math.abs(o.balance).toLocaleString('es-AR')}</p>` : ''}
                  </div>
                </div>`).join('')}
            </div>`}
        <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
    }

    else if (type === 'collected') {
      const monthly = _dashMonthly.length > 0 ? _dashMonthly : (await api.payments.getDashboard(_dashYear)).data.monthly || [];
      const total = monthly.reduce((sum, m) => sum + (m.total || 0), 0);
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
      const month = arg;
      const res = await api.payments.getAll({ month, limit: 100 });
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
                <p style="font-size:.75rem;color:var(--muted)">${p.owner?.unit || ''} · $${(p.amount || 0).toLocaleString('es-AR')}</p>
              </div>
              <div class="flex gap-1" style="align-items:center">
                ${statusBadge(p.status)}
                ${p.receipt?.url ? `<button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" style="padding:.25rem .4rem">${SVG.download}</button>` : ''}
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

export async function exportDashboardExcel() {
  try {
    const res = await api.payments.getAll({ limit: 500 });
    const allPayments = (res.data.payments || []).filter(p => {
      const year = p.month ? p.month.slice(0, 4) : '';
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
        p.month || '—',
        p.amount || 0,
        p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado',
        p.paymentMethod === 'mercadopago' ? 'MercadoPago' : 'Manual',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR') : '—',
      ]),
    ];

    const wb = XLSX.utils.book_new();

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
window.openStatDetail       = openStatDetail;
window.exportDashboardExcel = exportDashboardExcel;
