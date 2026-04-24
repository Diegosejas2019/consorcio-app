import { skeleton } from '../../ui/skeleton.js';
import { SVG } from '../../ui/icons.js';
import { formatMonth, statusBadge, downloadReceipt, errorState } from '../../ui/helpers.js';

export async function renderOwnerHistory() {
  const el = document.getElementById('page-owner-history');
  el.innerHTML = `<div class="oh-wrap">${skeleton(4)}</div>`;
  try {
    const res      = await api.payments.getAll({ limit: 50 });
    const payments = res.data.payments;

    const itemsHtml = payments.length === 0
      ? `<div class="ohi-empty oh-entry" style="--delay:60ms">
           <p class="ohi-empty__icon">📋</p>
           <p class="ohi-empty__msg">No hay pagos registrados aún.</p>
         </div>`
      : `<div class="ohi-list">
           ${payments.map((p, i) => `
             <div class="ohi-item oh-entry" style="--delay:${Math.min(i * 35 + 40, 220)}ms">
               <div class="ohi-status-dot ohi-dot-${p.status}"></div>
               <div class="ohi-item__info">
                 <p class="ohi-item__period">${formatMonth(p.month)}</p>
                 <p class="ohi-item__channel">${p.paymentMethod === 'mercadopago' ? '💳 MercadoPago' : '📄 Manual'}</p>
                 ${p.breakdown?.length > 1 ? `
                   <div class="ohi-breakdown">
                     ${p.breakdown.map(b => `<span>${b.name}: $${b.amount.toLocaleString('es-AR')}</span>`).join('')}
                   </div>` : ''}
                 ${p.rejectionNote ? `<p class="ohi-item__rejection">↳ ${p.rejectionNote}</p>` : ''}
               </div>
               <div class="ohi-item__right">
                 <p class="ohi-item__amount">$${p.amount.toLocaleString('es-AR')}</p>
                 ${statusBadge(p.status)}
                 ${p.receipt?.url ? `<button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" title="Descargar" style="padding:.3rem .5rem">${SVG.download}</button>` : ''}
               </div>
             </div>
           `).join('')}
         </div>`;

    el.innerHTML = `
      <div class="oh-wrap">
        <div class="oh-greeting oh-entry" style="--delay:0ms">
          <div>
            <p class="oh-greeting-sub">Cuenta</p>
            <h1 class="oh-greeting-name">Mis Pagos</h1>
          </div>
          ${payments.length > 0 ? `<span class="oh-unit-chip">${payments.length} registro${payments.length !== 1 ? 's' : ''}</span>` : ''}
        </div>
        ${itemsHtml}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerHistory()');
  }
}

window.renderOwnerHistory = renderOwnerHistory;
