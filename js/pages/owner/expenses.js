import { skeleton } from '../../ui/skeleton.js';
import { svgIcon } from '../../ui/icons.js';
import { errorState } from '../../ui/helpers.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';

const CATEGORY_COLORS = {
  cleaning:       '#00D68F',
  security:       '#3B82F6',
  maintenance:    '#F59E0B',
  utilities:      '#8B5CF6',
  administration: '#EC4899',
  other:          '#6B7280',
};

let _currentMonth = new Date().toISOString().slice(0, 7);

const MONTH_NAMES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];

function _prevMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function _nextMonth(ym) {
  const [y, m] = ym.split('-').map(Number);
  const d = new Date(y, m, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

function _monthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  return `${MONTH_NAMES[m - 1]} ${y}`;
}

function _categoryRow(cat, total) {
  const color = CATEGORY_COLORS[cat.category] || '#6B7280';
  const pct   = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
  return `
    <div class="list-item" style="padding:12px 16px;align-items:flex-start">
      <div style="width:10px;height:10px;border-radius:50%;background:${color};flex-shrink:0;margin-top:5px"></div>
      <div class="list-body">
        <div class="row-between">
          <span class="list-title">${cat.label}</span>
          <span class="bright tnum">$${cat.amount.toLocaleString('es-AR')}</span>
        </div>
        <div style="margin-top:8px;background:var(--surface-3);border-radius:4px;height:5px;overflow:hidden">
          <div style="width:${pct}%;background:${color};height:5px;border-radius:4px;transition:width .4s"></div>
        </div>
        <div class="muted" style="font:var(--t-xs);margin-top:4px">${pct}%</div>
      </div>
    </div>`;
}

async function _loadAndRender() {
  const el    = document.getElementById('page-owner-expenses');
  const today = new Date().toISOString().slice(0, 7);

  el.innerHTML = `
    <div style="padding:0 16px 32px">
      <p class="page-eyebrow" style="padding-top:16px">Comunidad</p>
      <h1 class="page-title">Gastos del consorcio</h1>

      <div style="display:flex;align-items:center;justify-content:space-between;margin-top:18px;background:var(--surface);border-radius:var(--r-lg);padding:6px 4px;border:1px solid var(--border)">
        <button class="btn-icon" id="exp-prev">${svgIcon('chevron-l', 20)}</button>
        <span class="bright" style="font:var(--t-body-md)" id="exp-month-label">${_monthLabel(_currentMonth)}</span>
        <button class="btn-icon" id="exp-next" ${_currentMonth >= today ? 'disabled style="opacity:.3"' : ''}>${svgIcon('chevron-r', 20)}</button>
      </div>

      <div id="exp-content" style="margin-top:16px">${skeleton(3)}</div>
    </div>`;

  document.getElementById('exp-prev').onclick = () => { _currentMonth = _prevMonth(_currentMonth); _loadAndRender(); };
  document.getElementById('exp-next').onclick = () => { if (_currentMonth < today) { _currentMonth = _nextMonth(_currentMonth); _loadAndRender(); } };

  try {
    const res = await getCachedOrFetch(
      `owner-expenses:${_currentMonth}`,
      CACHE_TTL.EXPENSES,
      () => api.expenses.getSummary(_currentMonth)
    );
    const { total, categories } = res.data;

    const content = document.getElementById('exp-content');
    if (!content) return;

    if (categories.length === 0) {
      content.innerHTML = `<div class="empty" style="padding:32px 0">
        <div class="empty-icon">${svgIcon('pie', 24)}</div>
        <p class="empty-title">Sin gastos</p>
        <p class="empty-sub">No hay gastos registrados para este mes.</p>
      </div>`;
      return;
    }

    content.innerHTML = `
      <div class="card-hero" style="padding:20px">
        <div class="muted" style="font:var(--t-xs);letter-spacing:.12em;text-transform:uppercase">Total del mes</div>
        <div class="h-amount-xl tnum" style="margin-top:8px">$${total.toLocaleString('es-AR')}</div>
        <div class="muted" style="font:var(--t-sm);margin-top:4px">${categories.length} categoría${categories.length !== 1 ? 's' : ''}</div>
      </div>

      <div class="card" style="padding:0;overflow:hidden;margin-top:14px">
        <div class="section-head" style="padding:12px 16px"><h3>Por categoría</h3></div>
        ${categories.map(c => _categoryRow(c, total)).join('<div style="height:1px;background:var(--border)"></div>')}
      </div>`;
  } catch (err) {
    const content = document.getElementById('exp-content');
    if (content) content.innerHTML = errorState(err.message, 'renderOwnerExpenses()');
  }
}

export async function renderOwnerExpenses() {
  _currentMonth = new Date().toISOString().slice(0, 7);
  await _loadAndRender();
}

window.renderOwnerExpenses = renderOwnerExpenses;
