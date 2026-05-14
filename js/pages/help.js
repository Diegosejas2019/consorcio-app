import { HELP_CONTENT } from '../content/helpContent.js';
import { state } from '../core/state.js';
import { hasPermission } from '../services/permissionService.js';
import { isFeatureEnabled, PAGE_FEATURE_MAP } from '../services/featureService.js';

let _helpActiveSection = '';

function _escAttr(str) {
  return (str || '').toLowerCase().replace(/"/g, '&quot;');
}

export function renderHelpPage() {
  const el = document.getElementById('page-help');
  if (!el) return;
  _helpActiveSection = '';

  const isGuard = state.role === 'admin' && state.adminRole === 'security_guard';
  const content = isGuard
    ? HELP_CONTENT.guard
    : state.role === 'owner' ? HELP_CONTENT.owner : HELP_CONTENT.admin;

  const visibleSections = content.sections.filter(s => {
    if (s.permission && !hasPermission(s.permission)) return false;
    if (s.page && PAGE_FEATURE_MAP[s.page] && !isFeatureEnabled(PAGE_FEATURE_MAP[s.page])) return false;
    return true;
  });

  const visibleIds = new Set(visibleSections.map(s => s.id));
  const visibleFaqs = content.faqs.filter(f => !f.section || visibleIds.has(f.section));

  el.innerHTML = `
    <div class="help-page">
      <div class="help-header">
        <h2>Ayuda</h2>
        <input type="search" class="input" id="help-search" placeholder="Buscar en la ayuda…" autocomplete="off">
      </div>

      <div class="help-chips" id="help-chips">
        <button class="help-chip is-active" data-section="" onclick="helpFilterSection(this,'')">Todas</button>
        ${visibleSections.map(s =>
          `<button class="help-chip" data-section="${s.id}" onclick="helpFilterSection(this,'${s.id}')">${s.title}</button>`
        ).join('')}
      </div>

      <div id="help-faqs">
        ${visibleFaqs.map(faq => {
          const showLink = faq.page && (!faq.permission || hasPermission(faq.permission));
          return `
          <details class="help-faq" data-section="${faq.section || ''}" data-text="${_escAttr(faq.q + ' ' + faq.a)}">
            <summary class="help-faq-q">${faq.q}</summary>
            <div class="help-faq-a">
              <p>${faq.a}</p>
              ${showLink ? `<button class="btn btn-ghost btn-sm" style="margin-top:.5rem" onclick="helpGoTo('${faq.page}','${faq.fn || ''}')">Ir a la sección →</button>` : ''}
            </div>
          </details>`;
        }).join('')}
      </div>

      <p id="help-no-results" class="text-muted hidden" style="text-align:center;padding:2rem 0">
        No se encontraron resultados para esa búsqueda.
      </p>
    </div>`;

  document.getElementById('help-search').addEventListener('input', e => {
    const q = e.target.value.toLowerCase().trim();
    _helpApplyFilters(q, _helpActiveSection);
  });
}

function _helpApplyFilters(query, section) {
  let anyVisible = false;
  document.querySelectorAll('#help-faqs .help-faq').forEach(el => {
    const matchSection = !section || el.dataset.section === section;
    const matchQuery   = !query   || (el.dataset.text || '').includes(query);
    const visible = matchSection && matchQuery;
    el.classList.toggle('hidden', !visible);
    if (visible) anyVisible = true;
  });
  const noResults = document.getElementById('help-no-results');
  if (noResults) noResults.classList.toggle('hidden', anyVisible);
}

window.helpFilterSection = function(btn, sectionId) {
  _helpActiveSection = sectionId;
  document.querySelectorAll('.help-chip').forEach(b => b.classList.remove('is-active'));
  btn.classList.add('is-active');
  const q = document.getElementById('help-search')?.value.toLowerCase().trim() || '';
  _helpApplyFilters(q, sectionId);
};

window.helpGoTo = function(pageId, fn) {
  showPage(pageId);
  window[fn]?.();
};
