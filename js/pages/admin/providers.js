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

const DOC_CATEGORY_LABELS = {
  insurance:   'Seguro',
  contract:    'Contrato',
  license:     'Habilitación',
  permit:      'Permiso',
  certificate: 'Certificado',
  other:       'Otro',
};

const STATUS_LABELS = {
  active:     'Activo',
  suspended:  'Suspendido',
  incomplete: 'Incompleto',
};

const DOC_STATUS_LABELS = {
  expired:       'Doc. vencida',
  expiring_soon: 'Por vencer',
  valid:         'Doc. OK',
  no_docs:       'Sin docs',
};

// estado de filtros (en memoria)
const filterState = { status: '', serviceType: '', documentStatus: '' };

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

function _applyFilters(providers) {
  return providers.filter(p => {
    if (filterState.status && p.status !== filterState.status) return false;
    if (filterState.serviceType && p.serviceType !== filterState.serviceType) return false;
    if (filterState.documentStatus && p.documentStatus !== filterState.documentStatus) return false;
    return true;
  });
}

function _docStatusBadge(ds) {
  const cls = {
    expired:       'badge-danger',
    expiring_soon: 'badge-warning',
    valid:         'badge-success',
    no_docs:       'badge-neutral',
  }[ds] || 'badge-neutral';
  return `<span class="badge ${cls}">${DOC_STATUS_LABELS[ds] || ds}</span>`;
}

function _statusBadge(s) {
  if (s === 'active' || !s) return '';
  const cls = s === 'suspended' ? 'badge-danger' : 'badge-warning';
  return `<span class="badge ${cls}">${STATUS_LABELS[s]}</span>`;
}

function _renderProvidersList(el, allProviders) {
  const providers = _applyFilters(allProviders);
  const active    = allProviders.filter(p => p.active);
  const inactive  = allProviders.filter(p => !p.active);

  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between" style="align-items:center">
        <h1>Proveedores</h1>
        <button class="btn btn-primary btn-sm" onclick="openNewProviderModal()">+ Agregar</button>
      </div>

      <p class="owners-meta">${active.length} activo${active.length !== 1 ? 's' : ''}${inactive.length ? ` · ${inactive.length} inactivo${inactive.length !== 1 ? 's' : ''}` : ''}</p>

      <!-- Filtros -->
      <div class="flex gap-2" style="flex-wrap:wrap;align-items:center">
        <select class="input" style="flex:1;min-width:120px;max-width:160px" onchange="providerFilterChange('status',this.value)">
          <option value="" ${!filterState.status ? 'selected' : ''}>Todos los estados</option>
          <option value="active" ${filterState.status === 'active' ? 'selected' : ''}>Activo</option>
          <option value="suspended" ${filterState.status === 'suspended' ? 'selected' : ''}>Suspendido</option>
          <option value="incomplete" ${filterState.status === 'incomplete' ? 'selected' : ''}>Incompleto</option>
        </select>
        <select class="input" style="flex:1;min-width:120px;max-width:170px" onchange="providerFilterChange('serviceType',this.value)">
          <option value="" ${!filterState.serviceType ? 'selected' : ''}>Todos los tipos</option>
          ${Object.entries(SERVICE_LABELS).map(([v, l]) =>
            `<option value="${v}" ${filterState.serviceType === v ? 'selected' : ''}>${l}</option>`
          ).join('')}
        </select>
        <select class="input" style="flex:1;min-width:130px;max-width:180px" onchange="providerFilterChange('documentStatus',this.value)">
          <option value="" ${!filterState.documentStatus ? 'selected' : ''}>Estado documental</option>
          <option value="expired" ${filterState.documentStatus === 'expired' ? 'selected' : ''}>Doc. vencida</option>
          <option value="expiring_soon" ${filterState.documentStatus === 'expiring_soon' ? 'selected' : ''}>Por vencer</option>
          <option value="valid" ${filterState.documentStatus === 'valid' ? 'selected' : ''}>Doc. OK</option>
          <option value="no_docs" ${filterState.documentStatus === 'no_docs' ? 'selected' : ''}>Sin docs</option>
        </select>
        ${(filterState.status || filterState.serviceType || filterState.documentStatus)
          ? `<button class="btn btn-ghost btn-sm" onclick="providerClearFilters()">Limpiar filtros</button>`
          : ''}
      </div>

      ${providers.length === 0
        ? `<p class="text-muted text-sm" style="padding:1rem 0">Sin proveedores para los filtros seleccionados.</p>`
        : `<div class="flex col gap-2">
          ${providers.map(p => `
            <div class="card" style="padding:.85rem 1rem;opacity:${p.active ? 1 : 0.55}">
              <div class="flex between" style="align-items:flex-start;gap:.5rem">
                <div style="flex:1;min-width:0">
                  <div class="flex gap-2" style="align-items:center;margin-bottom:.25rem;flex-wrap:wrap">
                    <strong>${p.name}</strong>
                    <span class="badge badge-info">${SERVICE_LABELS[p.serviceType] || p.serviceType}</span>
                    ${!p.active ? '<span class="badge badge-danger">Inactivo</span>' : ''}
                    ${_statusBadge(p.status)}
                    ${_docStatusBadge(p.documentStatus || 'no_docs')}
                    ${p.nextExpiration ? `<span class="text-muted text-sm">Vence: ${new Date(p.nextExpiration).toLocaleDateString('es-AR')}</span>` : ''}
                  </div>
                  <div class="text-muted text-sm" style="display:flex;gap:1rem;flex-wrap:wrap">
                    ${p.contactName ? `<span>👤 ${p.contactName}</span>` : ''}
                    ${p.cuit  ? `<span>CUIT: ${p.cuit}</span>` : ''}
                    ${p.phone ? `<span>📞 ${p.phone}</span>`  : ''}
                    ${p.email ? `<span>✉ ${p.email}</span>`   : ''}
                  </div>
                  ${p.documentWarnings?.length ? `
                  <div style="margin-top:.35rem">
                    ${p.documentWarnings.map(w => `<p class="text-sm" style="color:var(--warning)">⚠ ${w}</p>`).join('')}
                  </div>` : ''}
                </div>
                <div class="flex gap-1" style="flex-shrink:0">
                  <button class="btn btn-sm btn-ghost" onclick="openProviderDetail('${p._id}')">Ver ficha</button>
                  <button class="btn btn-sm btn-ghost" onclick="openEditProviderModal('${p._id}')">Editar</button>
                  <button class="btn btn-sm ${p.active ? 'btn-danger-ghost' : 'btn-ghost'}"
                    onclick="toggleProvider('${p._id}',${p.active})">${p.active ? 'Desactivar' : 'Activar'}</button>
                </div>
              </div>
            </div>`).join('')}
        </div>`}
    </div>`;

  // guardar providers en el nodo para filtros sin re-fetch
  el._allProviders = allProviders;
}

function _truncate(str, max) {
  return str.length > max ? str.slice(0, max - 1) + '…' : str;
}

// ── Filtros ────────────────────────────────────────────────────
export function providerFilterChange(key, value) {
  filterState[key] = value;
  const el = document.getElementById('page-admin-providers');
  if (el._allProviders) _renderProvidersList(el, el._allProviders);
}

export function providerClearFilters() {
  filterState.status = '';
  filterState.serviceType = '';
  filterState.documentStatus = '';
  const el = document.getElementById('page-admin-providers');
  if (el._allProviders) _renderProvidersList(el, el._allProviders);
}

// ── Descarga de documento via API (signed URL proxy) ─────────
export async function downloadProviderDoc(providerId, index, filename) {
  await downloadAttachment(api.providers.getDocumentUrl(providerId, index), filename);
}

// ── Eliminar documento individual ────────────────────────────
export async function deleteProviderDoc(providerId, index, fromDetail = false) {
  if (!confirm('¿Eliminar este documento?')) return;
  try {
    await api.providers.deleteDocument(providerId, index);
    toast('Documento eliminado.', 'success');
    if (fromDetail) {
      await openProviderDetail(providerId);
    } else {
      await renderAdminProviders();
    }
  } catch (err) {
    toast(err.message || 'Error al eliminar.', 'error');
  }
}

// ── Modal ficha de proveedor ──────────────────────────────────
export async function openProviderDetail(id) {
  openModal('modal-provider-detail', `<div style="padding:1rem">${skeleton(6)}</div>`);
  try {
    const res = await api.providers.getDetails(id);
    const { provider, documents, documentStatus, warnings, expenseSummary, recentExpenses } = res.data;
    _renderProviderDetail(id, provider, documents, documentStatus, warnings, expenseSummary, recentExpenses);
  } catch (err) {
    toast(err.message || 'Error al cargar ficha.', 'error');
    closeModal('modal-provider-detail');
  }
}

function _docStatusIcon(ds) {
  return { expired: '🔴', expiring_soon: '🟡', valid: '🟢', no_expiration: '⚪' }[ds] || '⚪';
}

function _renderProviderDetail(id, provider, documents, documentStatus, warnings, expenseSummary, recentExpenses) {
  const ars = n => n?.toLocaleString('es-AR', { style: 'currency', currency: 'ARS', maximumFractionDigits: 0 }) ?? '—';

  const docsHtml = documents?.length
    ? `<div class="flex col gap-1" style="margin-top:.5rem">
        ${documents.map((d, i) => {
          const expLabel = d.expirationDate
            ? new Date(d.expirationDate).toLocaleDateString('es-AR')
            : 'Sin vencimiento';
          const catLabel = DOC_CATEGORY_LABELS[d.category] || d.category || '—';
          return `
          <div class="card" style="padding:.6rem .85rem">
            <div class="flex between" style="align-items:center;gap:.5rem">
              <div style="flex:1;min-width:0">
                <div class="flex gap-2" style="align-items:center;flex-wrap:wrap">
                  <span>${_docStatusIcon(d.docStatus)}</span>
                  <strong class="text-sm">${d.title || d.filename || `Documento ${i + 1}`}</strong>
                  <span class="badge badge-info" style="font-size:.68rem">${catLabel}</span>
                  ${d.expirationDate ? `<span class="text-muted text-sm">Vence: ${expLabel}</span>` : `<span class="text-muted text-sm">Sin vencimiento</span>`}
                </div>
              </div>
              <div class="flex gap-1" style="flex-shrink:0">
                <button class="btn btn-ghost btn-sm" style="font-size:.7rem"
                  onclick="downloadProviderDoc('${id}',${d.index},'${(d.filename || 'doc').replace(/'/g, "\\'")}')">↓</button>
                <button class="btn btn-ghost btn-sm" style="font-size:.7rem"
                  onclick="openDocMetaModal('${id}',${d.index},'${(d.title||'').replace(/'/g,"\\'")}','${d.category||'other'}','${d.expirationDate ? d.expirationDate.slice(0,10) : ''}')">✏</button>
                <button class="btn btn-danger-ghost btn-sm" style="font-size:.7rem"
                  onclick="deleteProviderDoc('${id}',${d.index},true)">✕</button>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>`
    : '<p class="text-muted text-sm">Sin documentos cargados.</p>';

  const expensesHtml = recentExpenses?.length
    ? `<div style="overflow-x:auto;margin-top:.5rem">
        <table class="table" style="width:100%;font-size:.82rem">
          <thead><tr><th>Fecha</th><th>Descripción</th><th>Monto</th><th>Estado</th></tr></thead>
          <tbody>
            ${recentExpenses.map(e => `
              <tr>
                <td>${e.date ? new Date(e.date).toLocaleDateString('es-AR') : '—'}</td>
                <td>${e.description || '—'}</td>
                <td>${ars(e.amount)}</td>
                <td><span class="badge ${e.status === 'paid' ? 'badge-success' : 'badge-warning'}">${e.status === 'paid' ? 'Pagado' : 'Pendiente'}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>`
    : '<p class="text-muted text-sm">Sin gastos registrados.</p>';

  const html = `
    <div style="max-width:640px;width:100%">
      <div class="flex between" style="align-items:flex-start;margin-bottom:1rem;gap:.5rem">
        <div>
          <h2 style="margin:0">${provider.name}</h2>
          <div class="flex gap-2" style="margin-top:.3rem;flex-wrap:wrap;align-items:center">
            <span class="badge badge-info">${SERVICE_LABELS[provider.serviceType] || provider.serviceType}</span>
            ${_statusBadge(provider.status)}
            ${_docStatusBadge(documentStatus)}
          </div>
        </div>
        <button class="btn btn-ghost btn-sm" onclick="closeModal('modal-provider-detail')">✕</button>
      </div>

      ${warnings?.length ? `
      <div style="background:rgba(var(--warning-rgb,251,191,36),.1);border:1px solid rgba(251,191,36,.3);border-radius:8px;padding:.6rem .85rem;margin-bottom:1rem">
        ${warnings.map(w => `<p class="text-sm" style="color:var(--warning);margin:.1rem 0">⚠ ${w}</p>`).join('')}
      </div>` : ''}

      <!-- Datos generales -->
      <div class="card" style="margin-bottom:.75rem">
        <div class="card-body" style="padding:.85rem 1rem">
          <h3 style="margin-bottom:.6rem">Datos generales</h3>
          <div class="flex col gap-1" style="font-size:.85rem">
            ${provider.cuit          ? `<div class="flex gap-2"><span class="text-muted" style="min-width:120px">CUIT</span><span>${provider.cuit}</span></div>` : ''}
            ${provider.phone         ? `<div class="flex gap-2"><span class="text-muted" style="min-width:120px">Teléfono</span><span>${provider.phone}</span></div>` : ''}
            ${provider.emergencyPhone ? `<div class="flex gap-2"><span class="text-muted" style="min-width:120px">Tel. emergencia</span><span>${provider.emergencyPhone}</span></div>` : ''}
            ${provider.email         ? `<div class="flex gap-2"><span class="text-muted" style="min-width:120px">Email</span><span>${provider.email}</span></div>` : ''}
            ${provider.contactName   ? `<div class="flex gap-2"><span class="text-muted" style="min-width:120px">Contacto</span><span>${provider.contactName}</span></div>` : ''}
            ${provider.notes         ? `<div class="flex gap-2"><span class="text-muted" style="min-width:120px">Notas</span><span style="white-space:pre-wrap">${provider.notes}</span></div>` : ''}
          </div>
        </div>
      </div>

      <!-- Resumen de gastos -->
      <div class="card" style="margin-bottom:.75rem">
        <div class="card-body" style="padding:.85rem 1rem">
          <h3 style="margin-bottom:.6rem">Gastos</h3>
          <div class="flex gap-3" style="flex-wrap:wrap;font-size:.85rem;margin-bottom:.5rem">
            <div><span class="text-muted">Total histórico</span><br><strong>${ars(expenseSummary?.totalHistorico)}</strong></div>
            <div><span class="text-muted">Año actual</span><br><strong>${ars(expenseSummary?.totalAnioActual)}</strong></div>
            <div><span class="text-muted">Cantidad</span><br><strong>${expenseSummary?.cantidadGastos ?? 0}</strong></div>
            <div><span class="text-muted">Pendientes</span><br><strong>${expenseSummary?.pendientes ?? 0}</strong></div>
          </div>
          ${expensesHtml}
        </div>
      </div>

      <!-- Documentos -->
      <div class="card">
        <div class="card-body" style="padding:.85rem 1rem">
          <div class="flex between" style="align-items:center;margin-bottom:.5rem">
            <h3 style="margin:0">Documentación</h3>
            <button class="btn btn-ghost btn-sm" onclick="openAddDocModal('${id}')">+ Agregar doc.</button>
          </div>
          ${docsHtml}
        </div>
      </div>
    </div>`;

  const container = document.getElementById('modal-provider-detail')?.querySelector('.modal-content') ||
                    document.getElementById('modal-provider-detail');
  if (container) container.innerHTML = html;
}

// ── Modal agregar documento desde ficha ──────────────────────
export function openAddDocModal(providerId) {
  openModal('modal-add-provider-doc', `
    <h2 style="margin-bottom:1rem">Agregar documento</h2>
    <div class="flex col gap-2">
      <div>
        <label class="label">Título del documento</label>
        <input id="adoc-title" class="input" type="text" placeholder="Ej: Seguro de vida vigente">
      </div>
      <div class="flex gap-2">
        <div style="flex:1">
          <label class="label">Categoría</label>
          <select id="adoc-category" class="input">
            ${Object.entries(DOC_CATEGORY_LABELS).map(([v, l]) =>
              `<option value="${v}">${l}</option>`
            ).join('')}
          </select>
        </div>
        <div style="flex:1">
          <label class="label">Fecha de vencimiento (opcional)</label>
          <input id="adoc-expiration" class="input" type="date">
        </div>
      </div>
      <div>
        <label class="label">Archivo</label>
        <input id="adoc-file" class="input" type="file" accept=".pdf,image/*">
      </div>
    </div>
    <div class="flex gap-2" style="margin-top:.75rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-add-provider-doc')">Cancelar</button>
      <button id="btn-add-doc" class="btn btn-primary" style="flex:1" onclick="saveProviderDoc('${providerId}')">Guardar</button>
    </div>
  `);
}

export async function saveProviderDoc(providerId) {
  const file     = document.getElementById('adoc-file')?.files?.[0];
  const title    = document.getElementById('adoc-title')?.value.trim();
  const category = document.getElementById('adoc-category')?.value || 'other';
  const exp      = document.getElementById('adoc-expiration')?.value;

  if (!file) return toast('Seleccioná un archivo.', 'warning');

  const btn = document.getElementById('btn-add-doc');
  btn.disabled = true; btn.textContent = 'Subiendo…';

  const fd = new FormData();
  fd.append('documents', file);
  fd.append('docTitle', title);
  fd.append('docCategory', category);
  if (exp) fd.append('docExpiration', exp);

  try {
    await api.providers.update(providerId, fd);
    closeModal('modal-add-provider-doc');
    toast('Documento agregado.', 'success');
    await openProviderDetail(providerId);
    // invalidar cache de la lista
    if (window._invalidateProvidersCache) window._invalidateProvidersCache();
  } catch (err) {
    toast(err.message || 'Error al subir.', 'error');
    btn.disabled = false; btn.textContent = 'Guardar';
  }
}

// ── Modal editar metadata de documento ───────────────────────
export function openDocMetaModal(providerId, docIndex, currentTitle, currentCategory, currentExp) {
  openModal('modal-doc-meta', `
    <h2 style="margin-bottom:1rem">Editar documento</h2>
    <div class="flex col gap-2">
      <div>
        <label class="label">Título</label>
        <input id="dmeta-title" class="input" type="text" value="${currentTitle || ''}">
      </div>
      <div class="flex gap-2">
        <div style="flex:1">
          <label class="label">Categoría</label>
          <select id="dmeta-category" class="input">
            ${Object.entries(DOC_CATEGORY_LABELS).map(([v, l]) =>
              `<option value="${v}" ${currentCategory === v ? 'selected' : ''}>${l}</option>`
            ).join('')}
          </select>
        </div>
        <div style="flex:1">
          <label class="label">Fecha de vencimiento</label>
          <input id="dmeta-exp" class="input" type="date" value="${currentExp || ''}">
        </div>
      </div>
    </div>
    <div class="flex gap-2" style="margin-top:.75rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-doc-meta')">Cancelar</button>
      <button id="btn-save-meta" class="btn btn-primary" style="flex:1" onclick="saveDocMeta('${providerId}',${docIndex})">Guardar</button>
    </div>
  `);
}

export async function saveDocMeta(providerId, docIndex) {
  const btn = document.getElementById('btn-save-meta');
  btn.disabled = true; btn.textContent = 'Guardando…';
  try {
    await api.providers.updateDocumentMeta(providerId, docIndex, {
      title:          document.getElementById('dmeta-title')?.value.trim(),
      category:       document.getElementById('dmeta-category')?.value,
      expirationDate: document.getElementById('dmeta-exp')?.value || null,
    });
    closeModal('modal-doc-meta');
    toast('Documento actualizado.', 'success');
    await openProviderDetail(providerId);
  } catch (err) {
    toast(err.message || 'Error al actualizar.', 'error');
    btn.disabled = false; btn.textContent = 'Guardar';
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
  _bindFilePreview('prov-doc', 'prov-doc-meta');
}

export async function openEditProviderModal(id) {
  let provider;
  try {
    const res = await getCachedOrFetch(
      'providers:admin:includeInactive=true',
      CACHE_TTL.PROVIDERS,
      () => api.providers.getAll({ includeInactive: 'true' })
    );
    provider = res.data.providers.find(p => p._id === id);
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
  _bindFilePreview('prov-doc', 'prov-doc-meta');
}

function _providerForm(p = {}) {
  const existingDocs = p.documents?.length
    ? `<div style="margin-bottom:.5rem">
        <p class="text-sm text-muted" style="margin-bottom:.3rem">Documentos actuales:</p>
        <div class="flex col gap-1">
          ${p.documents.map((d, i) => `
            <div class="flex between" style="align-items:center;gap:.5rem">
              <span class="text-sm">${_docStatusIcon(d.docStatus || 'no_expiration')} ${d.title || d.filename || `Documento ${i + 1}`}
                ${d.expirationDate ? `<span class="text-muted text-sm">— vence ${new Date(d.expirationDate).toLocaleDateString('es-AR')}</span>` : ''}
              </span>
              <button class="btn btn-danger-ghost btn-sm" style="font-size:.7rem;padding:.15rem .4rem"
                onclick="deleteProviderDoc('${p._id}',${i})">✕</button>
            </div>`).join('')}
        </div>
      </div>`
    : '';

  return `
    <div class="flex col gap-2">
      <!-- Fila 1: nombre + tipo -->
      <div class="flex gap-2">
        <div style="flex:2">
          <label class="label">Nombre *</label>
          <input id="prov-name" class="input" type="text" value="${p.name || ''}" placeholder="Empresa de Limpieza SA">
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
      <!-- Fila 2: estado -->
      <div>
        <label class="label">Estado del proveedor</label>
        <select id="prov-status" class="input">
          <option value="active" ${(p.status || 'active') === 'active' ? 'selected' : ''}>Activo</option>
          <option value="incomplete" ${p.status === 'incomplete' ? 'selected' : ''}>Incompleto</option>
          <option value="suspended" ${p.status === 'suspended' ? 'selected' : ''}>Suspendido</option>
        </select>
      </div>
      <!-- Fila 3: CUIT + tel -->
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
      <!-- Fila 4: email + tel emergencia -->
      <div class="flex gap-2">
        <div style="flex:1">
          <label class="label">Email</label>
          <input id="prov-email" class="input" type="email" value="${p.email || ''}" placeholder="contacto@empresa.com">
        </div>
        <div style="flex:1">
          <label class="label">Tel. emergencia</label>
          <input id="prov-emergency" class="input" type="text" value="${p.emergencyPhone || ''}" placeholder="+54 9 11 xxxx-xxxx">
        </div>
      </div>
      <!-- Contacto -->
      <div>
        <label class="label">Nombre de contacto</label>
        <input id="prov-contact" class="input" type="text" value="${p.contactName || ''}" placeholder="Juan Pérez">
      </div>
      <!-- Notas -->
      <div>
        <label class="label">Notas internas</label>
        <textarea id="prov-notes" class="input" rows="2" placeholder="Observaciones, condiciones especiales…">${p.notes || ''}</textarea>
      </div>
      <!-- Documentos -->
      <div>
        <label class="label">Adjuntar documentos</label>
        ${existingDocs}
        <input id="prov-doc" class="input" type="file" accept=".pdf,image/*" multiple>
        <p class="text-muted text-sm" style="margin-top:.2rem">Máx. 5 por vez, 10 MB c/u. Podés añadir título, categoría y vencimiento por archivo.</p>
        <div id="prov-doc-meta" class="flex col gap-1" style="margin-top:.4rem"></div>
      </div>
    </div>`;
}

// Renderiza metadatos por archivo al seleccionar archivos ─────
function _bindFilePreview(inputId, metaContainerId) {
  setTimeout(() => {
    const input = document.getElementById(inputId);
    if (!input) return;
    input.addEventListener('change', () => {
      const container = document.getElementById(metaContainerId);
      if (!container) return;
      container.innerHTML = Array.from(input.files).map((f, i) => `
        <div class="card" style="padding:.5rem .75rem;font-size:.82rem">
          <p class="text-sm" style="margin-bottom:.3rem;font-weight:600">📎 ${f.name}</p>
          <div class="flex gap-2" style="flex-wrap:wrap">
            <div style="flex:2;min-width:120px">
              <label class="label" style="font-size:.72rem">Título</label>
              <input id="prov-doc-title-${i}" class="input" type="text" placeholder="Ej: Seguro de vida">
            </div>
            <div style="flex:1;min-width:100px">
              <label class="label" style="font-size:.72rem">Categoría</label>
              <select id="prov-doc-cat-${i}" class="input">
                ${Object.entries(DOC_CATEGORY_LABELS).map(([v, l]) =>
                  `<option value="${v}">${l}</option>`
                ).join('')}
              </select>
            </div>
            <div style="flex:1;min-width:100px">
              <label class="label" style="font-size:.72rem">Vencimiento</label>
              <input id="prov-doc-exp-${i}" class="input" type="date">
            </div>
          </div>
        </div>`).join('');
    });
  }, 100);
}

function _buildProviderBody(fields) {
  const { files, filesMeta, ...rest } = fields;
  if (!files?.length) {
    return rest;
  }
  const fd = new FormData();
  Object.entries(rest).forEach(([k, v]) => { if (v !== undefined && v !== '') fd.append(k, v); });
  Array.from(files).forEach((f, i) => {
    fd.append('documents', f);
    const title = document.getElementById(`prov-doc-title-${i}`)?.value?.trim();
    const cat   = document.getElementById(`prov-doc-cat-${i}`)?.value || 'other';
    const exp   = document.getElementById(`prov-doc-exp-${i}`)?.value;
    if (title) fd.append(`docTitle_${i}`, title);
    fd.append(`docCategory_${i}`, cat);
    if (exp) fd.append(`docExpiration_${i}`, exp);
  });
  return fd;
}

function _providerFields() {
  return {
    name:          document.getElementById('prov-name')?.value.trim(),
    serviceType:   document.getElementById('prov-type')?.value,
    status:        document.getElementById('prov-status')?.value || 'active',
    cuit:          document.getElementById('prov-cuit')?.value.trim() || undefined,
    phone:         document.getElementById('prov-phone')?.value.trim() || undefined,
    email:         document.getElementById('prov-email')?.value.trim() || undefined,
    emergencyPhone: document.getElementById('prov-emergency')?.value.trim() || undefined,
    contactName:   document.getElementById('prov-contact')?.value.trim() || undefined,
    notes:         document.getElementById('prov-notes')?.value.trim() || undefined,
    files:         document.getElementById('prov-doc')?.files,
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
window.openProviderDetail      = openProviderDetail;
window.saveNewProvider         = saveNewProvider;
window.updateProvider          = updateProvider;
window.toggleProvider          = toggleProvider;
window.downloadProviderDoc     = downloadProviderDoc;
window.deleteProviderDoc       = deleteProviderDoc;
window.providerFilterChange    = providerFilterChange;
window.providerClearFilters    = providerClearFilters;
window.openAddDocModal         = openAddDocModal;
window.saveProviderDoc         = saveProviderDoc;
window.openDocMetaModal        = openDocMetaModal;
window.saveDocMeta             = saveDocMeta;
