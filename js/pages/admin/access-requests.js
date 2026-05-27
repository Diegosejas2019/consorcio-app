/* ═══════════════════════════════════════════════════════════════
   GestionAr — Admin: Solicitudes de Acceso (Etapa 12)
   ═══════════════════════════════════════════════════════════════ */

import { apiCall }           from '../../core/apiWrapper.js';
import { toast }             from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton }          from '../../ui/skeleton.js';

let _activeTab = 'pending';
let _requests  = [];
let _query     = '';
let _settings  = null;

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

      <div id="ar-settings">${skeleton(2)}</div>

      <div class="flex" style="gap:0.5rem;flex-wrap:wrap;margin-top:0.25rem" id="ar-tabs">
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

  await Promise.all([_loadSettings(), _loadRequests()]);
}

// ── Configuración de registro público ────────────────────────
async function _loadSettings() {
  try {
    const res = await api.accessRequests.getSettings();
    _settings = res.data || null;
    _renderSettings();
  } catch {
    const el = document.getElementById('ar-settings');
    if (el) el.innerHTML = '';
  }
}

function _joinUrl(code) {
  return `${window.location.origin}/join.html?code=${encodeURIComponent(code)}`;
}

function _renderSettings() {
  const el = document.getElementById('ar-settings');
  if (!el) return;

  if (!_settings) { el.innerHTML = ''; return; }

  const enabled = _settings.publicJoinEnabled;
  const code    = _settings.publicJoinCode;
  const joinUrl = code ? _joinUrl(code) : null;
  const qrSrc   = joinUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?size=180x180&data=${encodeURIComponent(joinUrl)}&format=svg&ecc=M`
    : null;

  el.innerHTML = `
    <div class="card">
      <div class="card-header" style="display:flex;align-items:center;justify-content:space-between;gap:0.75rem;flex-wrap:wrap">
        <div>
          <strong style="color:var(--text-bright)">Enlace de registro público</strong>
          <p style="margin:0.25rem 0 0;font-size:0.82rem;color:var(--muted)">
            Compartí este enlace para que los propietarios soliciten acceso sin que el admin los cargue manualmente.
          </p>
        </div>
        <span class="badge ${enabled ? 'badge-success' : 'badge-neutral'}">${enabled ? 'Habilitado' : 'Deshabilitado'}</span>
      </div>
      <div class="card-body" style="display:flex;gap:1.5rem;flex-wrap:wrap">
        <div style="flex:1;min-width:220px">
          ${joinUrl ? `
            <div class="form-group" style="margin-bottom:0.75rem">
              <label style="font-size:0.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em">Enlace de solicitud</label>
              <div class="flex" style="gap:0.4rem;margin-top:0.35rem">
                <input id="ar-link-input" class="input" value="${joinUrl}" readonly
                       style="font-size:0.8rem;cursor:text"
                       onfocus="this.select()" />
                <button class="btn-secondary btn-sm" onclick="window._arCopyLink()">Copiar</button>
                <a class="btn-secondary btn-sm" href="${joinUrl}" target="_blank" rel="noreferrer"
                   style="text-decoration:none;display:inline-flex;align-items:center">Abrir</a>
              </div>
            </div>
            <p style="font-size:0.78rem;color:var(--muted);margin:0 0 0.25rem">
              Código: <code style="background:var(--surface-2);padding:1px 6px;border-radius:4px;font-size:0.78rem">${code}</code>
            </p>
          ` : `
            <p style="color:var(--muted);font-size:0.85rem;margin:0 0 0.75rem">
              No hay un código generado. Hacé clic en "Generar código" para crear el enlace de registro.
            </p>
          `}
          <div class="flex" style="gap:0.5rem;flex-wrap:wrap;margin-top:0.75rem">
            <button class="btn-secondary btn-sm" onclick="window._arTogglePublic(${!enabled})">
              ${enabled ? 'Deshabilitar registro' : 'Habilitar registro'}
            </button>
            <button class="btn-secondary btn-sm" onclick="window._arRegenerateCode()" title="Genera un nuevo código. El enlace anterior dejará de funcionar.">
              ${code ? 'Regenerar código' : 'Generar código'}
            </button>
          </div>
          ${code ? `<p style="font-size:0.75rem;color:var(--muted);margin:0.5rem 0 0">⚠️ Regenerar el código invalida el enlace anterior.</p>` : ''}
        </div>
        ${qrSrc ? `
          <div style="flex-shrink:0;text-align:center">
            <p style="font-size:0.75rem;font-weight:700;color:var(--muted);text-transform:uppercase;letter-spacing:0.04em;margin:0 0 0.5rem">Código QR</p>
            <img src="${qrSrc}" alt="QR de registro" width="130" height="130"
                 style="border-radius:8px;background:#fff;padding:6px;display:block"
                 onerror="this.style.display='none'" />
            <p style="font-size:0.72rem;color:var(--muted);margin:0.4rem 0 0">Escaneá para solicitar acceso</p>
          </div>
        ` : ''}
      </div>
    </div>
  `;
}

// ── Handlers globales de configuración ───────────────────────
window._arTogglePublic = async function(enable) {
  try {
    await apiCall(() => api.accessRequests.updateSettings({ publicJoinEnabled: enable }), {
      loadingText: enable ? 'Habilitando…' : 'Deshabilitando…',
    });
    await _loadSettings();
    toast(`Registro público ${enable ? 'habilitado' : 'deshabilitado'}.`, 'success');
  } catch (err) {
    toast(err.message || 'Error al actualizar configuración.', 'error');
  }
};

window._arRegenerateCode = async function() {
  const hasCode = !!_settings?.publicJoinCode;
  if (hasCode && !confirm('¿Regenerar el código? El enlace anterior dejará de funcionar.')) return;
  try {
    await apiCall(() => api.accessRequests.regenerateCode(), { loadingText: 'Generando código…' });
    await _loadSettings();
    toast('Código generado. Compartí el nuevo enlace.', 'success');
  } catch (err) {
    toast(err.message || 'Error al generar código.', 'error');
  }
};

window._arCopyLink = function() {
  const input = document.getElementById('ar-link-input');
  if (!input) return;
  navigator.clipboard.writeText(input.value)
    .then(() => toast('Enlace copiado.', 'success'))
    .catch(() => { input.select(); toast('Seleccioná el texto para copiarlo manualmente.', 'default'); });
};

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
    const allUnits = unitsRes.data?.units || [];
    const availableUnits = allUnits.filter(u => (!u.owner || u.status === 'available') && u.active !== false);

    // Sugerencias por label declarado (match parcial, case-insensitive)
    const query = (r.requestedUnitLabel || '').toLowerCase().trim();
    const suggested = query
      ? availableUnits.filter(u => u.name?.toLowerCase().includes(query) || query.includes(u.name?.toLowerCase() || ''))
      : [];
    const otherUnits = availableUnits.filter(u => !suggested.find(s => s._id === u._id));

    const unitOption = (u, preselect) =>
      `<option value="${u._id}" ${preselect ? 'selected' : ''}>${u.name}</option>`;

    const unitOptions = [
      ...suggested.map(u => unitOption(u, true)),
      ...otherUnits.map(u => unitOption(u, false)),
    ].join('');

    const existingBanner = r.isExistingUser
      ? `<div style="background:rgba(251,191,36,0.1);border:1px solid var(--warning);border-radius:8px;padding:0.75rem;margin-bottom:1rem;font-size:0.85rem;color:var(--warning)">
           ⚠️ Este email ya tiene una cuenta en GestionAr. Se vinculará sin modificar su contraseña.
         </div>`
      : '';

    const suggestionNote = suggested.length
      ? `<p style="font-size:0.78rem;color:var(--accent);margin:0.3rem 0 0">✓ ${suggested.length} unidad${suggested.length > 1 ? 'es' : ''} sugerida${suggested.length > 1 ? 's' : ''} por el nombre declarado.</p>`
      : '';

    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      <h2 style="margin:0 0 1rem">Aprobar solicitud</h2>
      ${existingBanner}
      <div style="background:var(--surface-2);border-radius:8px;padding:0.875rem;margin-bottom:1.25rem">
        <p style="margin:0 0 0.4rem;font-weight:600;color:var(--text-bright)">${r.name}</p>
        <p style="margin:0 0 0.25rem;font-size:0.85rem;color:var(--muted)">${r.email}</p>
        ${r.phone ? `<p style="margin:0 0 0.25rem;font-size:0.82rem;color:var(--muted)">📞 ${r.phone}</p>` : ''}
        ${r.requestedUnitLabel ? `<p style="margin:0;font-size:0.85rem;color:var(--muted)">Solicita: <b>${r.requestedUnitLabel}</b></p>` : ''}
        ${r.message ? `<p style="margin:0.4rem 0 0;font-size:0.82rem;color:var(--muted);font-style:italic">"${r.message}"</p>` : ''}
      </div>
      <div class="form-group">
        <label>Unidad${availableUnits.length !== 1 ? 'es' : ''} a asignar <span style="font-weight:400;color:var(--muted)">(${availableUnits.length} disponibles)</span></label>
        <select id="ar-approve-units" class="select" multiple style="height:auto;min-height:90px">
          ${unitOptions}
        </select>
        <small style="color:var(--muted)">Mantené Ctrl/Cmd para seleccionar varias. Opcional.</small>
        ${suggestionNote}
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
