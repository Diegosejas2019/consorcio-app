import { skeleton } from '../../ui/skeleton.js';
import { svgIcon } from '../../ui/icons.js';
import { errorState, downloadAttachment } from '../../ui/helpers.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';

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

let _ownerDocuments = [];
let _ownerCategory = '';

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

function visibleDocuments() {
  return _ownerCategory
    ? _ownerDocuments.filter(doc => doc.category === _ownerCategory)
    : _ownerDocuments;
}

function renderOwnerDocumentsView(el) {
  const docs = visibleDocuments();
  const categories = Object.entries(CATEGORY_LABELS)
    .filter(([key]) => _ownerDocuments.some(doc => doc.category === key));

  el.innerHTML = `
    <div style="padding:0 16px 32px">
      <p class="page-eyebrow" style="padding-top:16px">Comunidad</p>
      <h1 class="page-title">Documentacion</h1>
      <p class="page-sub">Archivos compartidos por la administracion.</p>

      ${categories.length > 1 ? `
        <div class="doc-chip-row">
          <button class="doc-chip ${!_ownerCategory ? 'active' : ''}" onclick="ownerDocumentsSetCategory('')">Todos</button>
          ${categories.map(([key, label]) => `<button class="doc-chip ${_ownerCategory === key ? 'active' : ''}" onclick="ownerDocumentsSetCategory('${key}')">${label}</button>`).join('')}
        </div>` : ''}

      <div style="margin-top:16px">
        ${docs.length ? docs.map(doc => {
          const filename = doc.file?.filename || 'documento';
          const meta = [CATEGORY_LABELS[doc.category] || doc.category, doc.fileTypeLabel, doc.formattedSize].filter(Boolean).join(' · ');
          return `
            <div class="card doc-card owner-doc-card">
              <div class="doc-card-main">
                <div class="doc-icon">${svgIcon('doc', 20)}</div>
                <div class="doc-content">
                  <strong>${esc(doc.title)}</strong>
                  ${doc.description ? `<p class="text-muted text-sm">${esc(doc.description)}</p>` : ''}
                  <p class="text-muted text-sm">${esc(meta)}</p>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="downloadOwnerOrganizationDocument('${doc._id}','${jsString(filename)}')">
                ${svgIcon('download', 14)} Descargar
              </button>
            </div>`;
        }).join('') : `
          <div class="empty" style="padding:32px 0">
            <div class="empty-icon">${svgIcon('doc', 24)}</div>
            <p class="empty-title">Sin documentos</p>
            <p class="empty-sub">Todavia no hay documentacion compartida.</p>
          </div>`}
      </div>
    </div>`;
}

export async function renderOwnerDocuments(force = false) {
  const el = document.getElementById('page-owner-documents');
  el.innerHTML = `<div style="padding:0 16px 32px">${skeleton(4)}</div>`;
  try {
    const res = await getCachedOrFetch(
      'documents:owner',
      CACHE_TTL.DOCUMENTS,
      () => api.organizationDocuments.getAll(),
      { skipCache: force }
    );
    _ownerDocuments = res.data.documents || [];
    renderOwnerDocumentsView(el);
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerDocuments()');
  }
}

export function ownerDocumentsSetCategory(category) {
  _ownerCategory = category;
  const el = document.getElementById('page-owner-documents');
  if (el) renderOwnerDocumentsView(el);
}

export async function downloadOwnerOrganizationDocument(id, filename = 'documento') {
  await downloadAttachment(api.organizationDocuments.downloadUrl(id), filename);
}

window.renderOwnerDocuments = renderOwnerDocuments;
window.ownerDocumentsSetCategory = ownerDocumentsSetCategory;
window.downloadOwnerOrganizationDocument = downloadOwnerOrganizationDocument;
