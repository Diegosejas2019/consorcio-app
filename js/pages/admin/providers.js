import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { errorState, downloadAttachment } from '../../ui/helpers.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';

const SERVICE_LABELS = {
  cleaning:       'Limpieza',
  security:       'Seguridad',
  maintenance:    'Mantenimiento',
  utilities:      'Servicios',
  administration: 'Administración',
  other:          'Otro',
};

// ── Render principal ──────────────────────────────────────────
export async function renderAdminProviders() {
  const el = document.getElementById('page-admin-providers');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const res = await getCachedOrFetch(
      'providers:admin:includeInactive=true',
      CACHE_TTL.PROVIDERS,
      () => api.providers.getAll({ includeInactive: 'true' })
    );
    _renderProvidersList(el, res.data.providers);
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminProviders()');
  }
}

function _renderProvidersList(el, providers) {
  const active   = providers.filter(p => p.active);
  const inactive = providers.filter(p => !p.active);

  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between" style="align-items:center">
        <h1>Proveedores</h1>
        <button class="btn btn-primary btn-sm" onclick="openNewProviderModal()">+ Agregar</button>
      </div>

      <p class="owners-meta">${active.length} activo${active.length !== 1 ? 's' : ''}${inactive.length ? ` · ${inactive.length} inactivo${inactive.length !== 1 ? 's' : ''}` : ''}</p>

      ${providers.length === 0 ? '<p class="text-muted text-sm" style="padding:1rem 0">Sin proveedores registrados.</p>' : `
      <div class="flex col gap-2">
        ${providers.map(p => `
          <div class="card" style="padding:.85rem 1rem;opacity:${p.active ? 1 : 0.55}">
            <div class="flex between" style="align-items:flex-start">
              <div style="flex:1;min-width:0">
                <div class="flex gap-2" style="align-items:center;margin-bottom:.25rem">
                  <strong>${p.name}</strong>
                  <span class="badge badge-info">${SERVICE_LABELS[p.serviceType] || p.serviceType}</span>
                  ${!p.active ? '<span class="badge badge-danger">Inactivo</span>' : ''}
                </div>
                <div class="text-muted text-sm" style="display:flex;gap:1rem;flex-wrap:wrap">
                  ${p.cuit  ? `<span>CUIT: ${p.cuit}</span>` : ''}
                  ${p.phone ? `<span>📞 ${p.phone}</span>`  : ''}
                  ${p.email ? `<span>✉ ${p.email}</span>`   : ''}
                </div>
                ${p.documents?.length ? `
                <div class="flex gap-1" style="flex-wrap:wrap;margin-top:.4rem">
                  ${p.documents.map((d, i) => `
                    <button class="btn btn-ghost btn-sm" style="font-size:.72rem;padding:.2rem .5rem"
                      onclick="downloadProviderDoc('${p._id}',${i},'${(d.filename || 'documento').replace(/'/g, "\\'")}')">
                      📎 ${d.filename ? _truncate(d.filename, 20) : `Documento ${i + 1}`}
                    </button>`).join('')}
                </div>` : ''}
              </div>
              <div class="flex gap-1">
                <button class="btn btn-sm btn-ghost" onclick="openEditProviderModal('${p._id}')">Editar</button>
                <button class="btn btn-sm ${p.active ? 'btn-danger-ghost' : 'btn-ghost'}"
                  onclick="toggleProvider('${p._id}',${p.active})">${p.active ? 'Desactivar' : 'Activar'}</button>
              </div>
            </div>
          </div>`).join('')}
      </div>`}
    </div>`;
}

function _truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ── Descarga de documento via API (signed URL proxy) ─────────
export async function downloadProviderDoc(providerId, index, filename) {
  await downloadAttachment(api.providers.getDocumentUrl(providerId, index), filename);
}

// ── Eliminar documento individual ────────────────────────────
export async function deleteProviderDoc(providerId, index) {
  if (!confirm('¿Eliminar este documento?')) return;
  try {
    await api.providers.deleteDocument(providerId, index);
    toast('Documento eliminado.', 'success');
    await renderAdminProviders();
  } catch (err) {
    toast(err.message || 'Error al eliminar.', 'error');
  }
}

// ── Modal nuevo proveedor ─────────────────────────────────────
export function openNewProviderModal() {
  openModal('modal-new-provider', `
    <h2 style="margin-bottom:1rem">Nuevo proveedor</h2>
    ${_providerForm()}
    <div class="flex gap-2" style="margin-top:.5rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-new-provider')">Cancelar</button>
      <button id="btn-save-provider" class="btn btn-primary" style="flex:1" onclick="saveNewProvider()">Guardar</button>
    </div>
  `);
}

export async function openEditProviderModal(id) {
  let provider;
  try {
    const res = await getCachedOrFetch(
      'providers:admin:includeInactive=true',
      CACHE_TTL.PROVIDERS,
      () => api.providers.getAll({ includeInactive: 'true' })
    );
    provider  = res.data.providers.find(p => p._id === id);
  } catch { return toast('Error al cargar proveedor.', 'error'); }
  if (!provider) return;

  openModal('modal-edit-provider', `
    <h2 style="margin-bottom:1rem">Editar proveedor</h2>
    ${_providerForm(provider)}
    <div class="flex gap-2" style="margin-top:.5rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-edit-provider')">Cancelar</button>
      <button id="btn-upd-provider" class="btn btn-primary" style="flex:1" onclick="updateProvider('${id}')">Guardar</button>
    </div>
  `);
}

function _providerForm(p = {}) {
  const existingDocs = p.documents?.length
    ? `<div style="margin-bottom:.5rem">
        <p class="text-sm text-muted" style="margin-bottom:.3rem">Documentos actuales:</p>
        <div class="flex col gap-1">
          ${p.documents.map((d, i) => `
            <div class="flex between" style="align-items:center;gap:.5rem">
              <button class="btn btn-ghost btn-sm" style="font-size:.72rem;padding:.2rem .5rem;text-align:left"
                onclick="downloadProviderDoc('${p._id}',${i},'${(d.filename || 'documento').replace(/'/g, "\\'")}')">
                📎 ${d.filename ? _truncate(d.filename, 30) : `Documento ${i + 1}`}
              </button>
              <button class="btn btn-danger-ghost btn-sm" style="font-size:.7rem;padding:.15rem .4rem"
                onclick="deleteProviderDoc('${p._id}',${i})">✕</button>
            </div>`).join('')}
        </div>
      </div>`
    : '';

  return `
    <div class="flex col gap-2">
      <div class="flex gap-2">
        <div style="flex:2">
          <label class="label">Nombre *</label>
          <input id="prov-name" class="input" type="text" value="${p.name || ''}" placeholder="Ej: Empresa de Limpieza SA">
        </div>
        <div style="flex:1">
          <label class="label">Tipo *</label>
          <select id="prov-type" class="input">
            ${Object.entries(SERVICE_LABELS).map(([v, l]) =>
              `<option value="${v}" ${p.serviceType === v ? 'selected' : ''}>${l}</option>`
            ).join('')}
          </select>
        </div>
      </div>
      <div class="flex gap-2">
        <div style="flex:1">
          <label class="label">CUIT</label>
          <input id="prov-cuit" class="input" type="text" value="${p.cuit || ''}" placeholder="20-12345678-0">
        </div>
        <div style="flex:1">
          <label class="label">Teléfono</label>
          <input id="prov-phone" class="input" type="text" value="${p.phone || ''}" placeholder="+54 9 11 xxxx-xxxx">
        </div>
      </div>
      <div>
        <label class="label">Email</label>
        <input id="prov-email" class="input" type="email" value="${p.email || ''}" placeholder="contacto@empresa.com">
      </div>
      <div>
        <label class="label">Adjuntar documentos (DNI, foto, contrato…)</label>
        ${existingDocs}
        <input id="prov-doc" class="input" type="file" accept=".pdf,image/*" multiple>
        <p class="text-muted text-sm" style="margin-top:.2rem">Podés seleccionar varios archivos. Máx. 5 por vez, 10 MB c/u.</p>
      </div>
    </div>`;
}

function _buildProviderBody(fields) {
  const { files, ...rest } = fields;
  if (!files?.length) {
    return rest;
  }
  const fd = new FormData();
  Object.entries(rest).forEach(([k, v]) => { if (v !== undefined) fd.append(k, v); });
  Array.from(files).forEach(f => fd.append('documents', f));
  return fd;
}

function _providerFields() {
  return {
    name:        document.getElementById('prov-name')?.value.trim(),
    serviceType: document.getElementById('prov-type')?.value,
    cuit:        document.getElementById('prov-cuit')?.value.trim() || undefined,
    phone:       document.getElementById('prov-phone')?.value.trim() || undefined,
    email:       document.getElementById('prov-email')?.value.trim() || undefined,
    files:       document.getElementById('prov-doc')?.files,
  };
}

export async function saveNewProvider() {
  const fields = _providerFields();
  if (!fields.name || !fields.serviceType) return toast('Nombre y tipo son obligatorios.', 'warning');

  const btn = document.getElementById('btn-save-provider');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await api.providers.create(_buildProviderBody(fields));
    closeModal('modal-new-provider');
    toast('Proveedor creado.', 'success');
    await renderAdminProviders();
  } catch (err) {
    toast(err.message || 'Error al guardar.', 'error');
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

export async function updateProvider(id) {
  const fields = _providerFields();
  if (!fields.name || !fields.serviceType) return toast('Nombre y tipo son obligatorios.', 'warning');

  const btn = document.getElementById('btn-upd-provider');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await api.providers.update(id, _buildProviderBody(fields));
    closeModal('modal-edit-provider');
    toast('Proveedor actualizado.', 'success');
    await renderAdminProviders();
  } catch (err) {
    toast(err.message || 'Error al actualizar.', 'error');
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

export async function toggleProvider(id, isActive) {
  try {
    await api.providers.update(id, { active: !isActive });
    toast(isActive ? 'Proveedor desactivado.' : 'Proveedor activado.', 'success');
    await renderAdminProviders();
  } catch (err) {
    toast(err.message || 'Error.', 'error');
  }
}

// ── Exponer globalmente ───────────────────────────────────────
window.renderAdminProviders    = renderAdminProviders;
window.openNewProviderModal    = openNewProviderModal;
window.openEditProviderModal   = openEditProviderModal;
window.saveNewProvider         = saveNewProvider;
window.updateProvider          = updateProvider;
window.toggleProvider          = toggleProvider;
window.downloadProviderDoc     = downloadProviderDoc;
window.deleteProviderDoc       = deleteProviderDoc;
