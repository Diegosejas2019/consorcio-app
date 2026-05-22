/* ═══════════════════════════════════════════════════════════════
   GestionAr — Admin: Solicitudes de Acceso (Etapa 5)
   ═══════════════════════════════════════════════════════════════ */

import { apiCall }           from '../../core/apiWrapper.js';
import { toast }             from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton }          from '../../ui/skeleton.js';

let _activeTab = 'pending';
let _requests  = [];
let _query     = '';

const TABS = [
  { key: 'pending',  label: 'Pendientes' },
  { key: 'approved', label: 'Aprobadas'  },
  { key: 'rejected', label: 'Rechazadas' },
];

const STATUS_BADGE = {
  pending:  'badge-warning',
  approved: 'badge-success',
  rejected: 'badge-danger',
};
const STATUS_LABEL = {
  pending:  'Pendiente',
  approved: 'Aprobada',
  rejected: 'Rechazada',
};

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

// ── Render principal ─────────────────────────────────────────
export async function renderAdminAccessRequests() {
  const el = document.getElementById('page-admin-access-requests');
  if (!el) return;
  _query = '';

  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between" style="flex-wrap:wrap;gap:0.75rem">
        <h1 style="margin:0">Solicitudes de acceso</h1>
      </div>
      <div class="flex" style="gap:0.5rem;flex-wrap:wrap" id="ar-tabs">
        ${TABS.map(t => `
          <button class="btn-secondary btn-sm ar-tab ${t.key === _activeTab ? 'active' : ''}"
                  data-tab="${t.key}" onclick="window._arSetTab('${t.key}')">
            ${t.label}
          </button>`).join('')}
      </div>
      <div style="max-width:320px">
        <input id="ar-search" type="search" class="input" placeholder="Buscar por nombre o email…"
               oninput="window._arSearch(this.value)" value="">
      </div>
      <div id="ar-list">${skeleton(4)}</div>
    </div>
  `;

  await _loadRequests();
}

async function _loadRequests() {
  const el = document.getElementById('ar-list');
  if (!el) return;
  el.innerHTML = skeleton(4);
  try {
    const res = await api.accessRequests.getAll({ status: _activeTab, limit: 100 });
    _requests = res.data?.requests || [];
    _renderList();
  } catch (err) {
    el.innerHTML = `<p style="color:var(--danger)">${err.message || 'Error cargando solicitudes'}</p>`;
  }
}

function _renderList() {
  const el = document.getElementById('ar-list');
  if (!el) return;

  const filtered = _query
    ? _requests.filter(r =>
        r.name?.toLowerCase().includes(_query.toLowerCase()) ||
        r.email?.toLowerCase().includes(_query.toLowerCase())
      )
    : _requests;

  if (!filtered.length) {
    el.innerHTML = `<div class="card"><div class="card-body" style="text-align:center;color:var(--muted)">
      ${_activeTab === 'pending' ? 'No hay solicitudes pendientes.' : 'No hay solicitudes en esta categoría.'}
    </div></div>`;
    return;
  }

  el.innerHTML = `
    <div class="flex col gap-2">
      ${filtered.map(r => _requestCard(r)).join('')}
    </div>
  `;
}

function _requestCard(r) {
  const isExisting = r.isExistingUser
    ? `<span class="badge badge-warning" style="font-size:0.7rem">Usuario existente</span>`
    : '';
  const unitText = r.requestedUnitLabel
    ? `<span style="color:var(--muted);font-size:0.82rem">🏠 ${r.requestedUnitLabel}</span>`
    : '';
  const actions = r.status === 'pending'
    ? `<div class="flex" style="gap:0.5rem;margin-top:0.75rem">
         <button class="btn-primary btn-sm" onclick="window._arOpenApprove('${r._id}')">Aprobar</button>
         <button class="btn-danger btn-sm"  onclick="window._arOpenReject('${r._id}')">Rechazar</button>
       </div>`
    : '';
  const reviewedInfo = (r.status !== 'pending' && r.reviewedAt)
    ? `<p style="font-size:0.78rem;color:var(--muted);margin:0.5rem 0 0">
         Revisado el ${fmtDate(r.reviewedAt)} por ${r.reviewedBy?.name || '—'}
       </p>`
    : '';
  const rejectReason = (r.status === 'rejected' && r.rejectionReason)
    ? `<p style="font-size:0.82rem;color:var(--danger);margin:0.25rem 0 0">Motivo: ${r.rejectionReason}</p>`
    : '';

  return `
    <div class="card">
      <div class="card-body">
        <div class="flex between" style="flex-wrap:wrap;gap:0.5rem">
          <div class="flex col" style="gap:0.25rem">
            <div class="flex" style="gap:0.5rem;align-items:center;flex-wrap:wrap">
              <span style="font-weight:600;color:var(--text-bright)">${r.name}</span>
              <span class="badge ${STATUS_BADGE[r.status]}">${STATUS_LABEL[r.status]}</span>
              ${isExisting}
            </div>
            <span style="color:var(--muted);font-size:0.85rem">${r.email}</span>
            ${r.phone ? `<span style="color:var(--muted);font-size:0.82rem">📞 ${r.phone}</span>` : ''}
            ${unitText}
            ${r.message ? `<span style="color:var(--muted);font-size:0.82rem;font-style:italic">"${r.message}"</span>` : ''}
          </div>
          <span style="color:var(--muted);font-size:0.78rem;white-space:nowrap">${fmtDate(r.createdAt)}</span>
        </div>
        ${rejectReason}
        ${reviewedInfo}
        ${actions}
      </div>
    </div>
  `;
}

// ── Modal: Aprobar ────────────────────────────────────────────
window._arOpenApprove = async function(id) {
  openModal(`<div class="modal-handle"></div>${skeleton(3)}`);
  try {
    const [reqRes, unitsRes] = await Promise.all([
      api.accessRequests.getOne(id),
      api.units.getAll({ limit: 200 }),
    ]);
    const r = reqRes.data?.request;
    const units = (unitsRes.data?.units || []).filter(u => !u.owner || u.status === 'available');
    const unitOptions = units.map(u => `<option value="${u._id}">${u.name}</option>`).join('');
    const existingBanner = r.isExistingUser
      ? `<div style="background:rgba(251,191,36,0.1);border:1px solid var(--warning);border-radius:8px;padding:0.75rem;margin-bottom:1rem;font-size:0.85rem;color:var(--warning)">
           ⚠️ Este email ya tiene una cuenta en GestionAr. Se vinculará sin modificar su contraseña.
         </div>`
      : '';

    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      <h2 style="margin:0 0 1rem">Aprobar solicitud</h2>
      ${existingBanner}
      <div style="background:var(--surface-2);border-radius:8px;padding:0.875rem;margin-bottom:1.25rem">
        <p style="margin:0 0 0.4rem;font-weight:600;color:var(--text-bright)">${r.name}</p>
        <p style="margin:0 0 0.25rem;font-size:0.85rem;color:var(--muted)">${r.email}</p>
        ${r.requestedUnitLabel ? `<p style="margin:0;font-size:0.85rem;color:var(--muted)">Solicita: <b>${r.requestedUnitLabel}</b></p>` : ''}
      </div>
      <div class="form-group">
        <label>Unidades a asignar</label>
        <select id="ar-approve-units" class="select" multiple style="height:auto;min-height:80px">
          ${unitOptions}
        </select>
        <small style="color:var(--muted)">Mantené Ctrl/Cmd para seleccionar varias. Opcional.</small>
      </div>
      <div class="flex" style="align-items:center;gap:0.5rem;margin-top:0.75rem">
        <input type="checkbox" id="ar-charge-now" checked style="accent-color:var(--accent)">
        <label for="ar-charge-now" style="font-size:0.875rem;cursor:pointer">Cobrar mes en curso</label>
      </div>
      <div class="flex" style="gap:0.75rem;margin-top:1.25rem">
        <button class="btn-primary" onclick="window._arApprove('${id}')">Aprobar</button>
        <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
      </div>
    `;
  } catch (err) {
    document.getElementById('modal').innerHTML = `<div class="modal-handle"></div><p style="color:var(--danger)">${err.message}</p>`;
  }
};

window._arApprove = async function(id) {
  const sel = document.getElementById('ar-approve-units');
  const unitIds = sel ? [...sel.selectedOptions].map(o => o.value) : [];
  const chargeCurrentMonth = document.getElementById('ar-charge-now')?.checked !== false;
  try {
    await apiCall(() => api.accessRequests.approve(id, { unitIds, chargeCurrentMonth }), { loadingText: 'Aprobando…' });
    closeModal();
    toast('Solicitud aprobada. El propietario recibirá un email con sus datos de acceso.', 'success');
    await _loadRequests();
  } catch (err) {
    toast(err.message || 'Error al aprobar', 'error');
  }
};

// ── Modal: Rechazar ───────────────────────────────────────────
window._arOpenReject = function(id) {
  openModal(`
    <div class="modal-handle"></div>
    <h2 style="margin:0 0 1rem">Rechazar solicitud</h2>
    <div class="form-group">
      <label>Motivo del rechazo (recomendado)</label>
      <textarea id="ar-reject-reason" class="input" rows="3" placeholder="Ej: La unidad indicada no existe en el sistema."></textarea>
    </div>
    <div class="flex" style="gap:0.75rem;margin-top:1.25rem">
      <button class="btn-danger" onclick="window._arReject('${id}')">Rechazar</button>
      <button class="btn-secondary" onclick="closeModal()">Cancelar</button>
    </div>
  `);
};

window._arReject = async function(id) {
  const reason = document.getElementById('ar-reject-reason')?.value.trim();
  try {
    await apiCall(() => api.accessRequests.reject(id, { rejectionReason: reason }), { loadingText: 'Rechazando…' });
    closeModal();
    toast('Solicitud rechazada.', 'success');
    await _loadRequests();
  } catch (err) {
    toast(err.message || 'Error al rechazar', 'error');
  }
};

// ── Helpers de navegación ─────────────────────────────────────
window._arSetTab = function(tab) {
  _activeTab = tab;
  document.querySelectorAll('.ar-tab').forEach(b => {
    b.classList.toggle('active', b.dataset.tab === tab);
  });
  _loadRequests();
};

window._arSearch = function(q) {
  _query = q;
  _renderList();
};

// ── Count de pendientes (para badge en nav) ───────────────────
export async function getPendingAccessRequestCount() {
  try {
    const res = await api.accessRequests.getAll({ status: 'pending', limit: 1 });
    return res.data?.total || 0;
  } catch {
    return 0;
  }
}
