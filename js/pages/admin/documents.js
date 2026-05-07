import { toast } from '../../ui/toast.js';
import { openModal, closeModal } from '../../ui/modal.js';
import { skeleton } from '../../ui/skeleton.js';
import { setBtnLoading } from '../../ui/loading.js';
import { errorState, downloadAttachment } from '../../ui/helpers.js';
import { svgIcon } from '../../ui/icons.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';
import { apiCall } from '../../core/apiWrapper.js';

const CATEGORY_LABELS = {
  regulation: 'Reglamento',
  map:        'Mapa',
  rules:      'Normas',
  assembly:   'Asamblea',
  insurance:  'Seguro',
  payment:    'Pagos',
  contract:   'Contrato',
  other:      'Otro',
};

const VISIBILITY_LABELS = {
  owners: 'Propietarios',
  admin:  'Solo admin',
};

let _documents = [];
let _filters = { search: '', category: '', visibility: '' };

function esc(value = '') {
  return String(value).replace(/[&<>"']/g, ch => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[ch]));
}

function jsString(value = '') {
  return String(value).replace(/\\/g, '\\\\').replace(/'/g, "\\'");
}

function filteredDocuments() {
  const search = _filters.search.trim().toLowerCase();
  return _documents.filter(doc => {
    const text = `${doc.title || ''} ${doc.description || ''}`.toLowerCase();
    return (!search || text.includes(search))
      && (!_filters.category || doc.category === _filters.category)
      && (!_filters.visibility || doc.visibility === _filters.visibility);
  });
}

function documentCard(doc) {
  const filename = doc.file?.filename || 'documento';
  const meta = [doc.fileTypeLabel, doc.formattedSize].filter(Boolean).join(' · ');
  return `
    <div class="card doc-card">
      <div class="doc-card-main">
        <div class="doc-icon">${svgIcon('doc', 20)}</div>
        <div class="doc-content">
          <div class="doc-title-row">
            <strong>${esc(doc.title)}</strong>
            <span class="badge badge-info">${CATEGORY_LABELS[doc.category] || doc.category}</span>
            <span class="badge ${doc.visibility === 'owners' ? 'badge-success' : 'badge-warning'}">${VISIBILITY_LABELS[doc.visibility] || doc.visibility}</span>
          </div>
          ${doc.description ? `<p class="text-muted text-sm">${esc(doc.description)}</p>` : ''}
          <p class="text-muted text-sm">${esc(filename)}${meta ? ` · ${esc(meta)}` : ''}</p>
        </div>
      </div>
      <div class="doc-actions">
        <button class="btn btn-sm btn-ghost" onclick="downloadOrganizationDocument('${doc._id}','${jsString(filename)}')">${svgIcon('download', 14)} Descargar</button>
        <button class="btn btn-sm btn-ghost" onclick="openEditOrganizationDocumentModal('${doc._id}')">Editar</button>
        <button class="btn btn-sm btn-danger-ghost" onclick="deleteOrganizationDocument('${doc._id}')">Eliminar</button>
      </div>
    </div>`;
}

function renderList(el) {
  const docs = filteredDocuments();
  el.innerHTML = `
    <div class="flex col gap-3">
      <div class="flex between admin-docs-head">
        <div>
          <p class="page-eyebrow">Organizacion</p>
          <h1>Documentacion</h1>
          <p class="owners-meta">${docs.length} documento${docs.length !== 1 ? 's' : ''}</p>
        </div>
        <button class="btn btn-primary btn-sm" data-requires-network onclick="openNewOrganizationDocumentModal()">
          ${svgIcon('plus', 14)} Agregar
        </button>
      </div>

      <div class="doc-filters">
        <input class="input" type="search" placeholder="Buscar documento" value="${esc(_filters.search)}"
          oninput="adminDocumentsSetFilter('search', this.value)">
        <select class="input" onchange="adminDocumentsSetFilter('category', this.value)">
          <option value="">Todas las categorias</option>
          ${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}" ${_filters.category === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
        <select class="input" onchange="adminDocumentsSetFilter('visibility', this.value)">
          <option value="">Todas las visibilidades</option>
          ${Object.entries(VISIBILITY_LABELS).map(([value, label]) => `<option value="${value}" ${_filters.visibility === value ? 'selected' : ''}>${label}</option>`).join('')}
        </select>
      </div>

      ${docs.length ? `<div class="doc-grid">${docs.map(documentCard).join('')}</div>` : `
        <div class="empty" style="padding:32px 0">
          <div class="empty-icon">${svgIcon('doc', 24)}</div>
          <p class="empty-title">Sin documentos</p>
          <p class="empty-sub">Subi reglamentos, mapas, actas o instructivos para compartirlos.</p>
        </div>`}
    </div>`;
}

export async function renderAdminDocuments(force = false) {
  const el = document.getElementById('page-admin-documents');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const res = await getCachedOrFetch(
      'documents:admin',
      CACHE_TTL.DOCUMENTS,
      () => api.organizationDocuments.getAll(),
      { skipCache: force }
    );
    _documents = res.data.documents || [];
    renderList(el);
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminDocuments()');
  }
}

export function adminDocumentsSetFilter(key, value) {
  _filters[key] = value;
  const el = document.getElementById('page-admin-documents');
  if (el) renderList(el);
}

function documentForm(doc = {}) {
  return `
    <div class="flex col gap-2">
      <div>
        <label class="label">Titulo *</label>
        <input id="org-doc-title" class="input" maxlength="120" value="${esc(doc.title || '')}" placeholder="Ej: Reglamento de convivencia">
      </div>
      <div class="flex gap-2">
        <div style="flex:1">
          <label class="label">Categoria</label>
          <select id="org-doc-category" class="input">
            ${Object.entries(CATEGORY_LABELS).map(([value, label]) => `<option value="${value}" ${doc.category === value ? 'selected' : ''}>${label}</option>`).join('')}
          </select>
        </div>
        <div style="flex:1">
          <label class="label">Visibilidad</label>
          <select id="org-doc-visibility" class="input">
            <option value="owners" ${doc.visibility !== 'admin' ? 'selected' : ''}>Visible para propietarios</option>
            <option value="admin" ${doc.visibility === 'admin' ? 'selected' : ''}>Solo administradores</option>
          </select>
        </div>
      </div>
      <div>
        <label class="label">Descripcion</label>
        <textarea id="org-doc-description" class="input textarea" maxlength="500" placeholder="Detalle opcional">${esc(doc.description || '')}</textarea>
      </div>
      <div>
        <label class="label">${doc._id ? 'Reemplazar archivo' : 'Archivo *'}</label>
        <input id="org-doc-file" class="input" type="file" accept=".pdf,application/pdf,image/jpeg,image/png,image/webp,.jpg,.jpeg,.png,.webp">
        <p class="text-muted text-sm" style="margin-top:.2rem">PDF o imagen. Maximo 10 MB.</p>
        ${doc.file?.filename ? `<p class="text-muted text-sm">Actual: ${esc(doc.file.filename)}</p>` : ''}
      </div>
    </div>`;
}

function buildDocumentBody(requireFile = false) {
  const title = document.getElementById('org-doc-title')?.value.trim();
  const file = document.getElementById('org-doc-file')?.files?.[0];
  if (!title) {
    toast('El titulo es obligatorio.', 'warning');
    return null;
  }
  if (requireFile && !file) {
    toast('Adjunta un archivo.', 'warning');
    return null;
  }
  const fd = new FormData();
  fd.append('title', title);
  fd.append('category', document.getElementById('org-doc-category')?.value || 'other');
  fd.append('visibility', document.getElementById('org-doc-visibility')?.value || 'owners');
  const description = document.getElementById('org-doc-description')?.value.trim();
  if (description) fd.append('description', description);
  if (file) fd.append('file', file);
  return fd;
}

export function openNewOrganizationDocumentModal() {
  openModal('modal-new-organization-document', `
    <h2 style="margin-bottom:1rem">Nuevo documento</h2>
    ${documentForm()}
    <div class="flex gap-2" style="margin-top:.75rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-new-organization-document')">Cancelar</button>
      <button class="btn btn-primary" id="btn-save-org-doc" style="flex:1" data-requires-network onclick="saveOrganizationDocument()">Guardar</button>
    </div>
  `);
}

export function openEditOrganizationDocumentModal(id) {
  const doc = _documents.find(d => d._id === id);
  if (!doc) return toast('Documento no encontrado.', 'error');
  openModal('modal-edit-organization-document', `
    <h2 style="margin-bottom:1rem">Editar documento</h2>
    ${documentForm(doc)}
    <div class="flex gap-2" style="margin-top:.75rem">
      <button class="btn btn-ghost" style="flex:1" onclick="closeModal('modal-edit-organization-document')">Cancelar</button>
      <button class="btn btn-primary" id="btn-update-org-doc" style="flex:1" data-requires-network onclick="updateOrganizationDocument('${id}')">Guardar</button>
    </div>
  `);
}

export async function saveOrganizationDocument() {
  const body = buildDocumentBody(true);
  if (!body) return;
  const btn = document.getElementById('btn-save-org-doc');
  setBtnLoading(btn, true);
  try {
    await apiCall(() => api.organizationDocuments.create(body), { loading: false, silent: true });
    closeModal('modal-new-organization-document');
    toast('Documento creado correctamente.', 'success');
    await renderAdminDocuments(true);
  } catch (err) {
    toast(err.message || 'No se pudo guardar el documento.', 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

export async function updateOrganizationDocument(id) {
  const body = buildDocumentBody(false);
  if (!body) return;
  const btn = document.getElementById('btn-update-org-doc');
  setBtnLoading(btn, true);
  try {
    await apiCall(() => api.organizationDocuments.update(id, body), { loading: false, silent: true });
    closeModal('modal-edit-organization-document');
    toast('Documento actualizado correctamente.', 'success');
    await renderAdminDocuments(true);
  } catch (err) {
    toast(err.message || 'No se pudo actualizar el documento.', 'error');
  } finally {
    setBtnLoading(btn, false);
  }
}

export async function deleteOrganizationDocument(id) {
  if (!confirm('Eliminar este documento?')) return;
  try {
    await apiCall(() => api.organizationDocuments.delete(id), { loading: false, silent: true });
    toast('Documento eliminado.', 'success');
    await renderAdminDocuments(true);
  } catch (err) {
    toast(err.message || 'No se pudo eliminar el documento.', 'error');
  }
}

export async function downloadOrganizationDocument(id, filename = 'documento') {
  await downloadAttachment(api.organizationDocuments.downloadUrl(id), filename);
}

window.renderAdminDocuments = renderAdminDocuments;
window.adminDocumentsSetFilter = adminDocumentsSetFilter;
window.openNewOrganizationDocumentModal = openNewOrganizationDocumentModal;
window.openEditOrganizationDocumentModal = openEditOrganizationDocumentModal;
window.saveOrganizationDocument = saveOrganizationDocument;
window.updateOrganizationDocument = updateOrganizationDocument;
window.deleteOrganizationDocument = deleteOrganizationDocument;
window.downloadOrganizationDocument = downloadOrganizationDocument;
