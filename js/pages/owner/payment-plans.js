/* ═══════════════════════════════════════════════════════════════
   GestionAr — Owner: Mis Planes de Pago
   ═══════════════════════════════════════════════════════════════ */

import { apiCall }    from '../../core/apiWrapper.js';
import { toast }      from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton }   from '../../ui/skeleton.js';

const STATUS_LABELS = {
  requested:  'Solicitado',
  approved:   'Aprobado',
  active:     'Activo',
  completed:  'Completado',
  rejected:   'Rechazado',
  cancelled:  'Cancelado',
  defaulted:  'Incumplido',
};

const STATUS_BADGE = {
  requested: 'badge-warning',
  approved:  'badge-warning',
  active:    'badge-success',
  completed: 'badge-neutral',
  rejected:  'badge-danger',
  cancelled: 'badge-neutral',
  defaulted: 'badge-danger',
};

const INSTALLMENT_BADGE = {
  pending:   'badge-warning',
  paid:      'badge-success',
  overdue:   'badge-danger',
  cancelled: 'badge-neutral',
};

const INSTALLMENT_LABELS = {
  pending:   'Pendiente',
  paid:      'Pagada',
  overdue:   'Vencida',
  cancelled: 'Cancelada',
};

function formatCurrency(n) {
  return Number(n || 0).toLocaleString('es-AR', { style: 'currency', currency: 'ARS', minimumFractionDigits: 0 });
}

function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

function formatMonth(m) {
  if (!m) return '—';
  const [year, month] = m.split('-');
  const names = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${names[parseInt(month) - 1]} ${year}`;
}

// ── Render principal ──────────────────────────────────────────

export async function renderOwnerPaymentPlans() {
  const el = document.getElementById('page-owner-payment-plans');
  if (!el) return;
  el.innerHTML = `
    <div class="page-header" style="margin-bottom:1.5rem">
      <h1 style="margin:0">Mis planes de pago</h1>
      <p style="color:var(--muted);margin:.25rem 0 0">Seguí el estado de tus regularizaciones de deuda</p>
    </div>
    <div id="owner-plans-list">${skeleton(3)}</div>
  `;
  await _loadOwnerPlans();
}

async function _loadOwnerPlans() {
  const el = document.getElementById('owner-plans-list');
  if (!el) return;

  const res = await apiCall(() => api.paymentPlans.getMy(), { silent: true });
  const plans = res?.data?.plans || [];

  if (!plans.length) {
    el.innerHTML = `
      <div class="card">
        <div class="card-body" style="text-align:center;padding:2.5rem">
          <p style="color:var(--muted);margin:0 0 1rem">No tenés planes de pago activos.</p>
          <p style="color:var(--muted);font-size:.875rem;margin:0">Si tenés deuda pendiente, podés solicitar un plan desde la sección <strong>Pagar</strong>.</p>
        </div>
      </div>`;
    return;
  }

  el.innerHTML = plans.map(plan => _planView(plan)).join('');
}

function _planView(plan) {
  const badgeCls    = STATUS_BADGE[plan.status] || 'badge-neutral';
  const statusLabel = STATUS_LABELS[plan.status] || plan.status;
  const periods     = (plan.includedPeriods || []).map(p => formatMonth(p.month)).join(', ');

  const installments = plan.installments || [];
  const rows = installments.map(i => {
    const bc  = INSTALLMENT_BADGE[i.status] || 'badge-neutral';
    const lbl = INSTALLMENT_LABELS[i.status] || i.status;
    return `
      <tr style="border-bottom:1px solid var(--border)">
        <td style="padding:.6rem .75rem;color:var(--muted)">Cuota ${i.installmentNumber}</td>
        <td style="padding:.6rem .75rem">${formatDate(i.dueDate)}</td>
        <td style="padding:.6rem .75rem;text-align:right;font-weight:600">${formatCurrency(i.amount)}</td>
        <td style="padding:.6rem .75rem"><span class="badge ${bc}">${lbl}</span></td>
        <td style="padding:.6rem .75rem;color:var(--muted)">${i.paidAt ? formatDate(i.paidAt) : '—'}</td>
      </tr>`;
  }).join('');

  const isActive = ['requested', 'approved', 'active'].includes(plan.status);

  return `
    <div class="card" style="margin-bottom:1.25rem">
      <div class="card-header between">
        <div>
          <strong style="color:var(--text-bright)">Plan de regularización</strong>
          <div style="color:var(--muted);font-size:.82rem;margin-top:.15rem">${periods || '—'}</div>
        </div>
        <span class="badge ${badgeCls}">${statusLabel}</span>
      </div>
      <div class="card-body">
        <div style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:.75rem;margin-bottom:1.25rem">
          <div>
            <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">Deuda original</div>
            <div style="font-weight:700;color:var(--text-bright)">${formatCurrency(plan.originalDebtAmount)}</div>
          </div>
          ${plan.totalAmount ? `
          <div>
            <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">Total financiado</div>
            <div style="font-weight:700;color:var(--text-bright)">${formatCurrency(plan.totalAmount)}</div>
          </div>
          <div>
            <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">Total pagado</div>
            <div style="font-weight:700;color:var(--success)">${formatCurrency(plan.totalPaid)}</div>
          </div>
          <div>
            <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">Saldo restante</div>
            <div style="font-weight:700;color:${plan.remainingBalance > 0 ? 'var(--warning)' : 'var(--success)'}">${formatCurrency(plan.remainingBalance)}</div>
          </div>` : ''}
          ${plan.nextDueDate ? `
          <div>
            <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">Próximo vencimiento</div>
            <div style="font-weight:700;color:var(--text-bright)">${formatDate(plan.nextDueDate)}</div>
            <div style="color:var(--muted);font-size:.8rem">${formatCurrency(plan.nextDueAmount)}</div>
          </div>` : ''}
          ${plan.installmentsCount ? `
          <div>
            <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.2rem">Cuotas</div>
            <div style="font-weight:700;color:var(--text-bright)">${plan.paidInstallments || 0} / ${plan.totalInstallments || plan.installmentsCount}</div>
          </div>` : ''}
        </div>

        ${plan.status === 'requested' ? `
          <div class="card" style="background:rgba(251,191,36,.07);border-color:rgba(251,191,36,.3);padding:.85rem 1rem">
            <p style="margin:0;color:var(--warning);font-size:.875rem">
              Tu solicitud está siendo revisada por el administrador. Te notificaremos cuando sea procesada.
            </p>
          </div>` : ''}

        ${plan.rejectionReason ? `
          <div class="card" style="background:rgba(248,113,113,.07);border-color:rgba(248,113,113,.3);padding:.85rem 1rem;margin-bottom:1rem">
            <p style="margin:0;color:var(--danger);font-size:.875rem">
              <strong>Solicitud rechazada:</strong> ${plan.rejectionReason}
            </p>
          </div>` : ''}

        ${installments.length ? `
          <h3 style="margin:.5rem 0 .75rem;font-size:.95rem">Detalle de cuotas</h3>
          <div style="overflow-x:auto;border-radius:8px;border:1px solid var(--border)">
            <table style="width:100%;border-collapse:collapse;font-size:.875rem">
              <thead>
                <tr style="background:var(--surface-2)">
                  <th style="padding:.5rem .75rem;text-align:left;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Cuota</th>
                  <th style="padding:.5rem .75rem;text-align:left;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Vencimiento</th>
                  <th style="padding:.5rem .75rem;text-align:right;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Monto</th>
                  <th style="padding:.5rem .75rem;text-align:left;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Estado</th>
                  <th style="padding:.5rem .75rem;text-align:left;color:var(--muted);font-weight:600;font-size:.75rem;text-transform:uppercase">Pagada</th>
                </tr>
              </thead>
              <tbody>${rows}</tbody>
            </table>
          </div>` : ''}

        ${plan.adminComment ? `<p style="margin-top:.85rem;color:var(--muted);font-size:.85rem">Nota del administrador: ${plan.adminComment}</p>` : ''}
      </div>
    </div>
  `;
}

// ── Modal para solicitar plan (llamado desde pay.js) ──────────

export async function openRequestPlanModal(availablePeriods, totalDebt) {
  const items = (availablePeriods || []).map(p =>
    typeof p === 'string' ? { type: 'period', month: p, id: p, amount: 0 } : p
  );
  const labelFor = item => {
    if (item.type === 'period') return formatMonth(item.month || item.id);
    if (item.type === 'extra') return `Extraordinario - ${formatCurrency(item.amount)}`;
    if (item.type === 'balance') return `Saldo anterior - ${formatCurrency(item.amount)}`;
    return `Concepto - ${formatCurrency(item.amount)}`;
  };
  const periodOptions = items.map((item, index) => `
    <label style="display:flex;align-items:center;gap:.5rem;cursor:pointer;margin-bottom:.4rem">
      <input type="checkbox" name="plan-period" value="${index}" checked style="accent-color:var(--accent)">
      <span>${labelFor(item)}</span>
    </label>
  `).join('');

  const periodsWithAmounts = items;

  openModal(`
    <div style="max-width:480px;padding:1.5rem">
      <h2 style="margin:0 0 .5rem">Solicitar plan de pagos</h2>
      <p style="color:var(--muted);font-size:.875rem;margin:0 0 1.25rem">
        Seleccioná los períodos que querés incluir en el plan. El administrador definirá las condiciones de financiamiento.
      </p>

      ${periodOptions ? `
      <div class="form-group" style="margin-bottom:1rem">
        <label>Períodos a regularizar</label>
        <div style="margin-top:.4rem">${periodOptions}</div>
      </div>` : `<p style="color:var(--muted)">No hay períodos disponibles para incluir en un plan.</p>`}

      <div class="form-group" style="margin-bottom:1.25rem">
        <label>Comentario (opcional)</label>
        <textarea id="rp-comment" class="input" rows="2" style="width:100%;resize:vertical" placeholder="Por ejemplo: dificultades económicas temporales..."></textarea>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end">
        <button class="btn-secondary btn-sm" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary btn-sm" id="rp-submit-btn">Enviar solicitud</button>
      </div>
    </div>
  `);

  document.getElementById('rp-submit-btn')?.addEventListener('click', () => {
    ownerSubmitPlanRequest(periodsWithAmounts);
  });
}

window.ownerSubmitPlanRequest = async function(periodsWithAmounts) {
  const checked = [...document.querySelectorAll('input[name="plan-period"]:checked')]
    .map(el => periodsWithAmounts[Number(el.value)])
    .filter(Boolean);
  if (!checked.length) { toast('Seleccioná al menos un período.', 'error'); return; }

  const comment = document.getElementById('rp-comment')?.value?.trim();

  const includedPeriods = checked
    .filter(item => item.type === 'period')
    .map(item => ({ month: item.month || item.id, originalAmount: item.amount || 0 }));
  const extraordinaryItems = checked
    .filter(item => item.type === 'extra')
    .map(item => ({ id: item.id, amount: item.amount || 0 }));
  const balanceDebt = checked
    .filter(item => item.type === 'balance')
    .reduce((sum, item) => sum + (item.amount || 0), 0);
  const originalDebtAmount = checked.reduce((sum, item) => sum + (item.amount || 0), 0) || 1;

  const res = await apiCall(() => api.paymentPlans.request({
    includedPeriods,
    extraordinaryItems,
    balanceDebt,
    originalDebtAmount,
    requestComment: comment || undefined,
  }));

  if (!res?.success) return;
  toast('Solicitud enviada. El administrador la revisará a la brevedad.', 'success');
  closeModal();
};
