const { getRecentMonths, formatPeriodLabel } = require('../../utils');

describe('getRecentMonths', () => {
  test('devuelve exactamente n elementos', () => {
    expect(getRecentMonths(6)).toHaveLength(6);
    expect(getRecentMonths(1)).toHaveLength(1);
    expect(getRecentMonths(3)).toHaveLength(3);
  });

  test('el primer item es el mes actual en YYYY-MM', () => {
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    expect(getRecentMonths(1)[0].value).toBe(expected);
  });

  test('todos los values tienen formato YYYY-MM', () => {
    const months = getRecentMonths(6);
    months.forEach(({ value }) => {
      expect(value).toMatch(/^\d{4}-\d{2}$/);
    });
  });
});

describe('formatPeriodLabel', () => {
  test('"2025-04" → "Abril 2025"', () => {
    expect(formatPeriodLabel('2025-04')).toBe('Abril 2025');
  });

  test('"2025-12" → "Diciembre 2025"', () => {
    expect(formatPeriodLabel('2025-12')).toBe('Diciembre 2025');
  });

  test('"2024-01" → "Enero 2024"', () => {
    expect(formatPeriodLabel('2024-01')).toBe('Enero 2024');
  });
});
