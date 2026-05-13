/* ═══════════════════════════════════════════════════════════════
   GestionAr — Admin: Planes de Pago
   ═══════════════════════════════════════════════════════════════ */

import { apiCall }    from '../../core/apiWrapper.js';
import { toast }      from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton }   from '../../ui/skeleton.js';

let _activeTab = 'requested';

const STATUS_LABELS = {
  requested: 'Solicitado',
  approved:  'Aprobado',
  active:    'Activo',
  completed: 'Completado',
  rejected:  'Rechazado',
  cancelled: 'Cancelado',
  defaulted: 'Incumplido',
};

const INSTALLMENT_LABELS = {
  pending:   'Pendiente',
  paid:      'Pagada',
  overdue:   'Vencida',
  cancelled: 'Cancelada',
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
  const names = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  return `${names[parseInt(month) - 1]} ${year}`;
}

// ── Render principal ──────────────────────────────────────────

export async function renderAdminPaymentPlans() {
  const el = document.getElementById('page-admin-payment-plans');
  if (!el) return;
  el.innerHTML = `
    <div class="page-header between" style="margin-bottom:1.5rem">
      <div>
        <h1 style="margin:0">Planes de Pago</h1>
        <p style="color:var(--muted);margin:.25rem 0 0">Gestión de regularización de deuda</p>
      </div>
      <button class="btn-primary btn-sm" onclick="adminPaymentPlanCreateModal()">+ Nuevo plan</button>
    </div>

    <div class="tabs" style="margin-bottom:1.5rem">
      <button class="tab-btn ${_activeTab === 'requested' ? 'active' : ''}" onclick="adminPaymentPlanTab('requested')">Solicitudes</button>
      <button class="tab-btn ${_activeTab === 'active' ? 'active' : ''}" onclick="adminPaymentPlanTab('active')">Activos</button>
      <button class="tab-btn ${_activeTab === 'completed' ? 'active' : ''}" onclick="adminPaymentPlanTab('completed')">Finalizados</button>
      <button class="tab-btn ${_activeTab === 'rejected,cancelled,defaulted' ? 'active' : ''}" onclick="adminPaymentPlanTab('rejected,cancelled,defaulted')">Incumplidos/Cancelados</button>
    </div>

    <div id="payment-plans-list">${skeleton(4)}</div>
  `;
  await _loadPlans();
}

async function _loadPlans() {
  const el = document.getElementById('payment-plans-list');
  if (!el) return;
  const statuses = _activeTab.split(',');

  const results = await Promise.all(
    statuses.map(s => apiCall(() => api.paymentPlans.listAdmin({ status: s, limit: 50 }), { silent: true }))
  );
  const plans = results.flatMap(r => r?.data?.plans || []);
  plans.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));

  if (!plans.length) {
    el.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;color:var(--muted);padding:2.5rem">Sin planes en esta categoría.</div></div>`;
    return;
  }

  el.innerHTML = plans.map(plan => _planCard(plan)).join('');
}

function _planCard(plan) {
  const ownerName = plan.owner?.name || '—';
  const ownerUnit = plan.owner?.unit || '';
  const badgeCls  = STATUS_BADGE[plan.status] || 'badge-neutral';
  const label     = STATUS_LABELS[plan.status] || plan.status;

  const actionBtns = _planActions(plan);

  const periods = (plan.includedPeriods || []).map(p => formatMonth(p.month)).join(', ');

  return `
    <div class="card" style="margin-bottom:.85rem">
      <div class="card-body">
        <div class="between" style="gap:1rem;flex-wrap:wrap">
          <div style="flex:1;min-width:200px">
            <div class="bold" style="color:var(--text-bright)">${ownerName}${ownerUnit ? ` <span style="color:var(--muted);font-weight:400">· ${ownerUnit}</span>` : ''}</div>
            <div style="color:var(--muted);font-size:.82rem;margin-top:.2rem">${periods || '—'}</div>
          </div>
          <div style="display:flex;align-items:center;gap:.75rem;flex-wrap:wrap">
            <div style="text-align:right">
              <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em">Deuda original</div>
              <div class="bold" style="color:var(--text-bright)">${formatCurrency(plan.originalDebtAmount)}</div>
            </div>
            ${plan.status !== 'requested' ? `
            <div style="text-align:right">
              <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em">Total financiado</div>
              <div class="bold" style="color:var(--text-bright)">${formatCurrency(plan.totalAmount)}</div>
            </div>
            <div style="text-align:right">
              <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em">Cuotas</div>
              <div class="bold" style="color:var(--text-bright)">${plan.paidInstallments || 0}/${plan.totalInstallments || plan.installmentsCount || '—'}</div>
            </div>` : ''}
            <span class="badge ${badgeCls}">${label}</span>
          </div>
        </div>
        ${plan.requestComment ? `<p style="margin:.75rem 0 0;color:var(--muted);font-size:.85rem;font-style:italic">"${plan.requestComment}"</p>` : ''}
        ${actionBtns ? `<div style="margin-top:1rem;display:flex;gap:.5rem;flex-wrap:wrap">${actionBtns}</div>` : ''}
      </div>
    </div>
  `;
}

function _planActions(plan) {
  const id = plan._id;
  const btns = [];
  btns.push(`<button class="btn-ghost btn-sm" onclick="adminPaymentPlanDetail('${id}')">Ver detalle</button>`);
  if (plan.status === 'requested') {
    btns.push(`<button class="btn-primary btn-sm" onclick="adminPaymentPlanApproveModal('${id}', ${JSON.stringify(plan).replace(/"/g,'&quot;')})">Aprobar</button>`);
    btns.push(`<button class="btn-danger btn-sm" onclick="adminPaymentPlanRejectModal('${id}')">Rechazar</button>`);
  }
  if (['active', 'defaulted'].includes(plan.status)) {
    btns.push(`<button class="btn-danger btn-sm" onclick="adminPaymentPlanCancelConfirm('${id}')">Cancelar</button>`);
  }
  return btns.join('');
}

// ── Tabs ──────────────────────────────────────────────────────

window.adminPaymentPlanTab = function(tab) {
  _activeTab = tab;
  renderAdminPaymentPlans();
};

// ── Detalle del plan ──────────────────────────────────────────

window.adminPaymentPlanDetail = async function(id) {
  openModal(`<div style="padding:1rem;text-align:center;color:var(--muted)">Cargando...</div>`);
  const res = await apiCall(() => api.paymentPlans.getAdmin(id), { silent: true });
  if (!res?.data?.plan) { closeModal(); toast('No se pudo cargar el plan.', 'error'); return; }
  const plan = res.data.plan;
  const { installments = [] } = plan;

  const rows = installments.map(i => {
    const bc  = INSTALLMENT_BADGE[i.status] || 'badge-neutral';
    const lbl = INSTALLMENT_LABELS[i.status] || i.status;
    const payBtn = ['pending', 'overdue'].includes(i.status)
      ? `<button class="btn-primary btn-sm" onclick="adminPayInstallment('${i._id}')">Registrar pago</button>`
      : '';
    return `
      <tr>
        <td style="padding:.6rem .75rem">${i.installmentNumber}</td>
        <td style="padding:.6rem .75rem">${formatDate(i.dueDate)}</td>
        <td style="padding:.6rem .75rem;text-align:right">${formatCurrency(i.amount)}</td>
        <td style="padding:.6rem .75rem"><span class="badge ${bc}">${lbl}</span></td>
        <td style="padding:.6rem .75rem">${i.paidAt ? formatDate(i.paidAt) : '—'}</td>
        <td style="padding:.6rem .75rem">${payBtn}</td>
      </tr>`;
  }).join('');

  const periods = (plan.includedPeriods || []).map(p => formatMonth(p.month)).join(', ');
  const ownerName = plan.owner?.name || '—';
  const badgeCls = STATUS_BADGE[plan.status] || 'badge-neutral';

  openModal(`
    <div style="max-width:680px;padding:1.5rem">
      <div class="between" style="margin-bottom:1.25rem">
        <h2 style="margin:0">Plan de pagos</h2>
        <span class="badge ${badgeCls}">${STATUS_LABELS[plan.status] || plan.status}</span>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1.25rem">
        <div class="card" style="padding:.85rem 1rem">
          <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Propietario</div>
          <div class="bold">${ownerName}</div>
        </div>
        <div class="card" style="padding:.85rem 1rem">
          <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Períodos incluidos</div>
          <div class="bold">${periods || '—'}</div>
        </div>
        <div class="card" style="padding:.85rem 1rem">
          <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Deuda original</div>
          <div class="bold">${formatCurrency(plan.originalDebtAmount)}</div>
        </div>
        <div class="card" style="padding:.85rem 1rem">
          <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Total financiado</div>
          <div class="bold">${formatCurrency(plan.totalAmount)}</div>
        </div>
        <div class="card" style="padding:.85rem 1rem">
          <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Total pagado</div>
          <div class="bold" style="color:var(--success)">${formatCurrency(plan.totalPaid)}</div>
        </div>
        <div class="card" style="padding:.85rem 1rem">
          <div style="color:var(--muted);font-size:.75rem;text-transform:uppercase;letter-spacing:.05em;margin-bottom:.3rem">Saldo restante</div>
          <div class="bold" style="color:var(--warning)">${formatCurrency(plan.remainingBalance)}</div>
        </div>
      </div>

      ${installments.length ? `
      <h3 style="margin-bottom:.75rem">Cuotas</h3>
      <div style="overflow-x:auto">
        <table style="width:100%;border-collapse:collapse;font-size:.875rem">
          <thead>
            <tr style="color:var(--muted);text-align:left;border-bottom:1px solid var(--border)">
              <th style="padding:.5rem .75rem">#</th>
              <th style="padding:.5rem .75rem">Vencimiento</th>
              <th style="padding:.5rem .75rem;text-align:right">Monto</th>
              <th style="padding:.5rem .75rem">Estado</th>
              <th style="padding:.5rem .75rem">Pagada</th>
              <th style="padding:.5rem .75rem"></th>
            </tr>
          </thead>
          <tbody>${rows}</tbody>
        </table>
      </div>` : ''}

      ${plan.requestComment ? `<p style="margin-top:1rem;color:var(--muted);font-size:.85rem;font-style:italic">"${plan.requestComment}"</p>` : ''}
      ${plan.adminComment   ? `<p style="margin-top:.5rem;color:var(--muted);font-size:.85rem">Nota admin: ${plan.adminComment}</p>` : ''}
      ${plan.rejectionReason ? `<p style="margin-top:.5rem;color:var(--danger);font-size:.85rem">Motivo de rechazo: ${plan.rejectionReason}</p>` : ''}

      <div style="margin-top:1.25rem;text-align:right">
        <button class="btn-secondary btn-sm" onclick="closeModal()">Cerrar</button>
      </div>
    </div>
  `);
};

// ── Registrar pago de cuota ───────────────────────────────────

window.adminPayInstallment = async function(installmentId) {
  if (!confirm('¿Confirmás el pago de esta cuota?')) return;
  const res = await apiCall(() => api.paymentPlans.registerInstallmentPayment(installmentId));
  if (!res?.success) return;
  toast(res.data?.planCompleted ? 'Cuota pagada. ¡El plan quedó completado!' : 'Pago registrado correctamente.', 'success');
  closeModal();
  await _loadPlans();
};

// ── Modal aprobar plan ────────────────────────────────────────

window.adminPaymentPlanApproveModal = async function(planId, plan) {
  const periodsText = (plan.includedPeriods || []).map(p => formatMonth(p.month)).join(', ') || '—';
  openModal(`
    <div style="max-width:520px;padding:1.5rem">
      <h2 style="margin:0 0 1rem">Aprobar plan de pagos</h2>

      <div class="card" style="padding:.85rem 1rem;margin-bottom:1.25rem">
        <div style="color:var(--muted);font-size:.8rem;margin-bottom:.3rem">Períodos incluidos</div>
        <div class="bold">${periodsText}</div>
        <div style="margin-top:.4rem;color:var(--muted);font-size:.85rem">Deuda original: <strong style="color:var(--text-bright)">${formatCurrency(plan.originalDebtAmount)}</strong></div>
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem">
        <div class="form-group">
          <label>Cantidad de cuotas</label>
          <input id="ap-count" type="number" min="1" class="input" value="3" style="width:100%">
        </div>
        <div class="form-group">
          <label>Primer vencimiento</label>
          <input id="ap-start" type="date" class="input" value="${_nextMonthDate()}" style="width:100%">
        </div>
        <div class="form-group">
          <label>Tipo de interés</label>
          <select id="ap-interest-type" class="select" style="width:100%" onchange="adminApproveUpdateSummary('${planId}', ${plan.originalDebtAmount})">
            <option value="none">Sin interés</option>
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed">Monto fijo ($)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Valor del interés</label>
          <input id="ap-interest-val" type="number" min="0" step="0.01" class="input" value="0" style="width:100%" oninput="adminApproveUpdateSummary('${planId}', ${plan.originalDebtAmount})">
        </div>
      </div>

      <div id="ap-summary" class="card" style="padding:.85rem 1rem;margin-bottom:1rem;background:var(--accent-lt);border-color:var(--accent)">
        Completá los campos para ver el resumen.
      </div>

      <div class="form-group" style="margin-bottom:1rem">
        <label>Observación (opcional)</label>
        <textarea id="ap-comment" class="input" rows="2" style="width:100%;resize:vertical"></textarea>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end">
        <button class="btn-secondary btn-sm" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary btn-sm" onclick="adminPaymentPlanApproveConfirm('${planId}')">Confirmar aprobación</button>
      </div>
    </div>
  `);
  adminApproveUpdateSummary(planId, plan.originalDebtAmount);
};

window.adminApproveUpdateSummary = function(planId, originalDebt) {
  const count    = parseInt(document.getElementById('ap-count')?.value || '1', 10) || 1;
  const iType    = document.getElementById('ap-interest-type')?.value || 'none';
  const iVal     = parseFloat(document.getElementById('ap-interest-val')?.value || '0') || 0;
  const sumEl    = document.getElementById('ap-summary');
  if (!sumEl) return;

  let interest = 0;
  if (iType === 'percentage') interest = Math.round(originalDebt * (iVal / 100) * 100) / 100;
  if (iType === 'fixed')      interest = iVal;

  const total = originalDebt + interest;
  const perInstallment = Math.round((total / count) * 100) / 100;

  sumEl.innerHTML = `
    <div style="display:grid;grid-template-columns:1fr 1fr;gap:.5rem;font-size:.875rem">
      <div>Deuda original: <strong>${formatCurrency(originalDebt)}</strong></div>
      <div>Interés: <strong>${formatCurrency(interest)}</strong></div>
      <div>Total financiado: <strong style="color:var(--text-bright)">${formatCurrency(total)}</strong></div>
      <div>${count} cuota(s) de: <strong style="color:var(--accent)">${formatCurrency(perInstallment)}</strong></div>
    </div>
  `;
};

window.adminPaymentPlanApproveConfirm = async function(planId) {
  const count   = parseInt(document.getElementById('ap-count')?.value, 10);
  const start   = document.getElementById('ap-start')?.value;
  const iType   = document.getElementById('ap-interest-type')?.value;
  const iVal    = parseFloat(document.getElementById('ap-interest-val')?.value || '0');
  const comment = document.getElementById('ap-comment')?.value?.trim();

  if (!count || count < 1) { toast('Ingresá una cantidad de cuotas válida.', 'error'); return; }
  if (!start) { toast('Ingresá la fecha del primer vencimiento.', 'error'); return; }

  const res = await apiCall(() => api.paymentPlans.approve(planId, {
    installmentsCount: count,
    startDate:         start,
    interestType:      iType,
    interestValue:     iVal,
    adminComment:      comment,
  }));
  if (!res?.success) return;
  toast('Plan aprobado correctamente.', 'success');
  closeModal();
  await _loadPlans();
};

// ── Modal rechazar plan ───────────────────────────────────────

window.adminPaymentPlanRejectModal = function(planId) {
  openModal(`
    <div style="max-width:400px;padding:1.5rem">
      <h2 style="margin:0 0 1rem">Rechazar solicitud</h2>
      <div class="form-group" style="margin-bottom:1rem">
        <label>Motivo de rechazo</label>
        <textarea id="rj-reason" class="input" rows="3" style="width:100%;resize:vertical" placeholder="Explicá brevemente el motivo..."></textarea>
      </div>
      <div style="display:flex;gap:.75rem;justify-content:flex-end">
        <button class="btn-secondary btn-sm" onclick="closeModal()">Cancelar</button>
        <button class="btn-danger btn-sm" onclick="adminPaymentPlanRejectConfirm('${planId}')">Rechazar</button>
      </div>
    </div>
  `);
};

window.adminPaymentPlanRejectConfirm = async function(planId) {
  const reason = document.getElementById('rj-reason')?.value?.trim();
  if (!reason) { toast('El motivo es obligatorio.', 'error'); return; }
  const res = await apiCall(() => api.paymentPlans.reject(planId, { rejectionReason: reason }));
  if (!res?.success) return;
  toast('Solicitud rechazada.', 'success');
  closeModal();
  await _loadPlans();
};

// ── Cancelar plan ─────────────────────────────────────────────

window.adminPaymentPlanCancelConfirm = async function(planId) {
  if (!confirm('¿Cancelar este plan? Las cuotas pendientes quedarán canceladas. Los pagos ya registrados no se modifican.')) return;
  const res = await apiCall(() => api.paymentPlans.cancel(planId));
  if (!res?.success) return;
  toast('Plan cancelado.', 'success');
  await _loadPlans();
};

// ── Modal nuevo plan manual ───────────────────────────────────

window.adminPaymentPlanCreateModal = async function() {
  // Cargar propietarios
  const res = await apiCall(() => api.owners.getAll({ limit: 200 }), { silent: true });
  const owners = res?.data?.owners || [];
  const options = owners.map(o => `<option value="${o._id}">${o.name}${o.unit ? ` · ${o.unit}` : ''}</option>`).join('');

  openModal(`
    <div style="max-width:560px;padding:1.5rem">
      <h2 style="margin:0 0 1.25rem">Nuevo plan de pagos</h2>

      <div class="form-group" style="margin-bottom:1rem">
        <label>Propietario</label>
        <select id="np-owner" class="select" style="width:100%">
          <option value="">— Seleccionar —</option>
          ${options}
        </select>
      </div>

      <div class="form-group" style="margin-bottom:1rem">
        <label>Períodos incluidos (formato YYYY-MM, separados por coma)</label>
        <input id="np-periods" type="text" class="input" style="width:100%" placeholder="2025-01, 2025-02, 2025-03">
      </div>

      <div class="form-group" style="margin-bottom:1rem">
        <label>Deuda original total ($)</label>
        <input id="np-debt" type="number" min="1" class="input" style="width:100%">
      </div>

      <div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-bottom:1rem">
        <div class="form-group">
          <label>Cantidad de cuotas</label>
          <input id="np-count" type="number" min="1" class="input" value="3" style="width:100%">
        </div>
        <div class="form-group">
          <label>Primer vencimiento</label>
          <input id="np-start" type="date" class="input" value="${_nextMonthDate()}" style="width:100%">
        </div>
        <div class="form-group">
          <label>Tipo de interés</label>
          <select id="np-interest-type" class="select" style="width:100%">
            <option value="none">Sin interés</option>
            <option value="percentage">Porcentaje (%)</option>
            <option value="fixed">Monto fijo ($)</option>
          </select>
        </div>
        <div class="form-group">
          <label>Valor del interés</label>
          <input id="np-interest-val" type="number" min="0" step="0.01" class="input" value="0" style="width:100%">
        </div>
      </div>

      <div class="form-group" style="margin-bottom:1.25rem">
        <label>Observación (opcional)</label>
        <textarea id="np-comment" class="input" rows="2" style="width:100%;resize:vertical"></textarea>
      </div>

      <div style="display:flex;gap:.75rem;justify-content:flex-end">
        <button class="btn-secondary btn-sm" onclick="closeModal()">Cancelar</button>
        <button class="btn-primary btn-sm" onclick="adminPaymentPlanCreateConfirm()">Crear plan</button>
      </div>
    </div>
  `);
};

window.adminPaymentPlanCreateConfirm = async function() {
  const ownerId  = document.getElementById('np-owner')?.value;
  const periodsRaw = document.getElementById('np-periods')?.value?.trim();
  const debt     = parseFloat(document.getElementById('np-debt')?.value || '0');
  const count    = parseInt(document.getElementById('np-count')?.value || '1', 10);
  const start    = document.getElementById('np-start')?.value;
  const iType    = document.getElementById('np-interest-type')?.value;
  const iVal     = parseFloat(document.getElementById('np-interest-val')?.value || '0');
  const comment  = document.getElementById('np-comment')?.value?.trim();

  if (!ownerId)     { toast('Seleccioná un propietario.', 'error'); return; }
  if (!periodsRaw)  { toast('Ingresá al menos un período.', 'error'); return; }
  if (!debt || debt <= 0) { toast('El monto de deuda debe ser mayor a cero.', 'error'); return; }
  if (!count || count < 1) { toast('La cantidad de cuotas debe ser al menos 1.', 'error'); return; }
  if (!start) { toast('Ingresá la fecha del primer vencimiento.', 'error'); return; }

  const periods = periodsRaw.split(',')
    .map(s => s.trim())
    .filter(Boolean)
    .map(m => ({ month: m, originalAmount: 0 }));

  if (!periods.length) { toast('Ingresá al menos un período válido.', 'error'); return; }

  const res = await apiCall(() => api.paymentPlans.create({
    ownerId,
    includedPeriods:    periods,
    originalDebtAmount: debt,
    installmentsCount:  count,
    startDate:          start,
    interestType:       iType,
    interestValue:      iVal,
    adminComment:       comment || undefined,
  }));
  if (!res?.success) return;
  toast('Plan creado correctamente.', 'success');
  closeModal();
  _activeTab = 'active';
  await renderAdminPaymentPlans();
};

// ── Helpers ───────────────────────────────────────────────────

function _nextMonthDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  d.setDate(1);
  return d.toISOString().split('T')[0];
}
