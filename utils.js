/* ─── Utilidades puras — sin dependencias del DOM ─── */

const MONTH_LABELS = [
  'Enero','Febrero','Marzo','Abril','Mayo','Junio',
  'Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre'
];

function getRecentMonths(n) {
  const months = [], now = new Date();
  for (let i = 0; i < n; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push({
      value: `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`,
      label: `${MONTH_LABELS[d.getMonth()]} ${d.getFullYear()}`,
    });
  }
  return months;
}

function formatPeriodLabel(yyyymm) {
  const [y, m] = yyyymm.split('-');
  return `${MONTH_LABELS[parseInt(m, 10) - 1]} ${y}`;
}

// Exportar solo cuando corre en Node.js (tests)
if (typeof module !== 'undefined') {
  module.exports = { getRecentMonths, formatPeriodLabel };
}
