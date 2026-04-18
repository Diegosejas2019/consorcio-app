import { skeleton } from '../../ui/skeleton.js';
import { errorState } from '../../ui/helpers.js';

const CATEGORY_COLORS = {
  cleaning:       '#00D68F',
  security:       '#3B82F6',
  maintenance:    '#F59E0B',
  utilities:      '#8B5CF6',
  administration: '#EC4899',
  other:          '#6B7280',
};

// Estado: mes seleccionado (formato YYYY-MM)
let _currentMonth = new Date().toISOString().slice(0, 7);

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

function _formatMonthLabel(ym) {
  const [y, m] = ym.split('-').map(Number);
  const months = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'];
  return `${months[m - 1]} ${y}`;
}

function _buildPieChart(categories, total) {
  if (total === 0 || categories.length === 0) {
    return `<div style="width:200px;height:200px;border-radius:50%;background:var(--bg);display:flex;align-items:center;justify-content:center;margin:0 auto">
      <span class="text-muted text-sm">Sin datos</span>
    </div>`;
  }

  const R  = 80;
  const cx = 100;
  const cy = 100;
  let paths = '';
  let startAngle = -Math.PI / 2;

  for (const cat of categories) {
    if (cat.amount <= 0) continue;
    const fraction = cat.amount / total;
    const endAngle = startAngle + fraction * 2 * Math.PI;
    const color    = CATEGORY_COLORS[cat.category] || '#6B7280';

    if (fraction >= 0.9999) {
      // Círculo completo (solo una categoría)
      paths += `<circle cx="${cx}" cy="${cy}" r="${R}" fill="${color}"/>`;
    } else {
      const x1 = cx + R * Math.cos(startAngle);
      const y1 = cy + R * Math.sin(startAngle);
      const x2 = cx + R * Math.cos(endAngle);
      const y2 = cy + R * Math.sin(endAngle);
      const lg = fraction > 0.5 ? 1 : 0;
      paths += `<path d="M${cx} ${cy} L${x1.toFixed(2)} ${y1.toFixed(2)} A${R} ${R} 0 ${lg} 1 ${x2.toFixed(2)} ${y2.toFixed(2)} Z" fill="${color}"/>`;
    }
    startAngle = endAngle;
  }

  // Donut hole
  const holeR = R * 0.58;
  paths += `<circle cx="${cx}" cy="${cy}" r="${holeR}" fill="var(--card-bg,#0f1729)"/>`;

  // Total en el centro
  const totalStr = total >= 1000000
    ? `$${(total / 1000000).toFixed(1)}M`
    : total >= 1000
    ? `$${Math.round(total / 1000)}k`
    : `$${total}`;
  paths += `<text x="${cx}" y="${cy - 7}" text-anchor="middle" font-size="10" fill="var(--text-muted,#8899aa)" font-family="DM Sans,sans-serif">Total</text>`;
  paths += `<text x="${cx}" y="${cy + 11}" text-anchor="middle" font-size="15" font-weight="600" fill="var(--text,#C8D6F0)" font-family="DM Sans,sans-serif">${totalStr}</text>`;

  return `<svg viewBox="0 0 200 200" width="200" height="200" style="display:block;margin:0 auto">${paths}</svg>`;
}

function _buildLegend(categories, total) {
  if (categories.length === 0) return '';
  return categories.map(cat => {
    const color = CATEGORY_COLORS[cat.category] || '#6B7280';
    const pct   = total > 0 ? Math.round((cat.amount / total) * 100) : 0;
    return `
      <div style="display:flex;align-items:center;gap:.75rem;padding:.65rem 0;border-bottom:1px solid var(--border,rgba(255,255,255,.06))">
        <div style="width:12px;height:12px;border-radius:50%;background:${color};flex-shrink:0"></div>
        <span style="flex:1;font-size:.9rem">${cat.label}</span>
        <span style="font-size:.8rem;color:var(--text-muted)">${pct}%</span>
        <span style="font-weight:600;font-size:.9rem">$${cat.amount.toLocaleString('es-AR')}</span>
      </div>`;
  }).join('');
}

async function _loadAndRender() {
  const el = document.getElementById('page-owner-expenses');
  const today = new Date().toISOString().slice(0, 7);

  el.innerHTML = `
    <div class="oh-wrap">
      <div class="flex between" style="align-items:center;margin-bottom:1rem">
        <h1 style="margin:0">Gastos del consorcio</h1>
      </div>
      <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:1.5rem;background:var(--card-bg,#0f1729);border-radius:12px;padding:.5rem .75rem">
        <button class="btn btn-ghost btn-sm" id="exp-prev">‹</button>
        <span id="exp-month-label" style="font-weight:600;font-size:.95rem">${_formatMonthLabel(_currentMonth)}</span>
        <button class="btn btn-ghost btn-sm" id="exp-next" ${_currentMonth >= today ? 'disabled style="opacity:.3"' : ''}>›</button>
      </div>
      <div id="exp-content">${skeleton(3)}</div>
    </div>`;

  document.getElementById('exp-prev').onclick = () => {
    _currentMonth = _prevMonth(_currentMonth);
    _loadAndRender();
  };
  document.getElementById('exp-next').onclick = () => {
    if (_currentMonth >= today) return;
    _currentMonth = _nextMonth(_currentMonth);
    _loadAndRender();
  };

  try {
    const res = await api.expenses.getSummary(_currentMonth);
    const { total, categories } = res.data;

    document.getElementById('exp-content').innerHTML = `
      <div style="margin-bottom:1.5rem">
        ${_buildPieChart(categories, total)}
      </div>
      <div class="card">
        <div class="card-body" style="padding-top:.25rem;padding-bottom:.25rem">
          ${categories.length === 0
            ? '<p class="text-muted text-sm" style="padding:.75rem 0">No hay gastos registrados para este mes.</p>'
            : _buildLegend(categories, total)}
        </div>
      </div>
      <div style="margin-top:1rem;padding:.75rem;background:var(--card-bg,#0f1729);border-radius:12px;display:flex;justify-content:space-between;align-items:center">
        <span class="text-muted text-sm">Total del mes</span>
        <span style="font-size:1.1rem;font-weight:700">$${total.toLocaleString('es-AR')}</span>
      </div>`;
  } catch (err) {
    document.getElementById('exp-content').innerHTML = errorState(err.message, 'renderOwnerExpenses()');
  }
}

export async function renderOwnerExpenses() {
  _currentMonth = new Date().toISOString().slice(0, 7);
  await _loadAndRender();
}

window.renderOwnerExpenses = renderOwnerExpenses;
