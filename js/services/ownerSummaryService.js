import { cache, setState } from '../core/state.js';
import { CACHE_TTL, getCachedOrFetch } from '../core/cacheHelpers.js';

const OWNER_SUMMARY_KEY = 'owner-summary';
const OWNER_PAYMENTS_KEY = 'payments:owner:limit=50';
const OWNER_UNITS_KEY = 'units:owner';
const OWNER_AVAILABLE_ITEMS_KEY = 'payments:owner:available-items';
const OWNER_NOTICES_KEY = 'notices:owner:limit=3';

function normalizeSummaryResponse(res) {
  const data = res?.data || {};
  const availableItems = data.availableItems || { periods: [], extraordinary: [] };
  return {
    config: data.config || {},
    membership: data.membership || null,
    units: data.units || [],
    payments: data.payments || [],
    availableItems,
    notices: data.notices || [],
    cfgRes: { success: true, data: { config: data.config || {} } },
    unitsRes: { success: true, data: { units: data.units || [] } },
    payRes: {
      success: true,
      data: {
        payments: data.payments || [],
        availableItems,
        periods: availableItems.periods || [],
        extraordinary: availableItems.extraordinary || [],
        extraordinaryExpenses: availableItems.extraordinary || [],
      },
    },
    availRes: { success: true, data: availableItems },
  };
}

function rememberSummary(summary) {
  if (summary.membership) setState({ membership: summary.membership });
  cache.set('config:api', summary.cfgRes, CACHE_TTL.CONFIG);
  cache.set(OWNER_PAYMENTS_KEY, summary.payRes, CACHE_TTL.PAYMENTS);
  cache.set(OWNER_UNITS_KEY, summary.unitsRes, CACHE_TTL.UNITS);
  cache.set(OWNER_AVAILABLE_ITEMS_KEY, summary.availRes, CACHE_TTL.PAYMENTS_SHORT);
  cache.set(OWNER_NOTICES_KEY, { success: true, data: { notices: summary.notices } }, CACHE_TTL.NOTICES);
  return summary;
}

async function fetchOwnerSummary() {
  try {
    const res = await api.owners.getMySummary({ paymentsLimit: 50, noticesLimit: 3 });
    return rememberSummary(normalizeSummaryResponse(res));
  } catch (err) {
    const [cfgRes, availRes, payRes, unitsRes, noticesRes] = await Promise.all([
      getCachedOrFetch('config:api', CACHE_TTL.CONFIG, () => api.config.get()),
      getCachedOrFetch(OWNER_AVAILABLE_ITEMS_KEY, CACHE_TTL.PAYMENTS_SHORT, () => api.payments.getAvailableItems()),
      getCachedOrFetch(OWNER_PAYMENTS_KEY, CACHE_TTL.PAYMENTS, () => api.payments.getAll({ limit: 50 })),
      getCachedOrFetch(OWNER_UNITS_KEY, CACHE_TTL.UNITS, () => api.units.getAll()),
      getCachedOrFetch(OWNER_NOTICES_KEY, CACHE_TTL.NOTICES, () => api.notices.getAll({ limit: 3 }).catch(() => ({ data: { notices: [] } }))),
    ]);
    return rememberSummary({
      config: cfgRes.data.config,
      membership: null,
      units: unitsRes.data.units || [],
      payments: payRes.data.payments || [],
      availableItems: availRes.data,
      notices: noticesRes.data.notices || [],
      cfgRes,
      unitsRes,
      payRes,
      availRes,
    });
  }
}

export function getOwnerSummary() {
  return getCachedOrFetch(OWNER_SUMMARY_KEY, CACHE_TTL.OWNER_HOME, fetchOwnerSummary);
}

export function getOwnerPayments(limit = 50) {
  if (limit <= 50) {
    return getOwnerSummary().then(summary => summary.payRes);
  }
  return getCachedOrFetch(
    `payments:owner:limit=${limit}`,
    CACHE_TTL.PAYMENTS,
    () => api.payments.getAll({ limit })
  );
}

export function getOwnerAvailableItems() {
  return getOwnerSummary().then(summary => summary.availRes);
}

