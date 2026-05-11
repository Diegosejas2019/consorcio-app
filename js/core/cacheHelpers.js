import { cache } from './state.js';

const pendingFetches = new Map();
let cacheEpoch = 0;

export const CACHE_TTL = {
  AUTH_ME:        30 * 60 * 1000,
  FEATURES:       10 * 60 * 1000,
  CONFIG:          5 * 60 * 1000,
  OWNER_HOME:     30 * 1000,
  ADMIN_HOME:     30 * 1000,
  DASHBOARD:      60 * 1000,
  OWNERS:         60 * 1000,
  NOTICES:        60 * 1000,
  CLAIMS:         30 * 1000,
  EXPENSES:       30 * 1000,
  PAYMENTS:       20 * 1000,
  PAYMENTS_SHORT: 15 * 1000,
  REPORTS:        60 * 1000,
  PROVIDERS:      60 * 1000,
  DOCUMENTS:      60 * 1000,
  UNITS:          60 * 1000,
  VOTES:          60 * 1000,
  VISITS:         60 * 1000,
  RESERVATIONS:   60 * 1000,
  SPACES:         60 * 1000,
};

export function stableParams(params = {}) {
  return new URLSearchParams(params).toString();
}

export async function getCachedOrFetch(key, ttlMs, fetcher, opts = {}) {
  const cached = cache.get(key);
  if (cached) return cached;
  if (pendingFetches.has(key)) return pendingFetches.get(key);

  const startedEpoch = cacheEpoch;
  const pending = Promise.resolve()
    .then(fetcher)
    .then(value => {
      if (!opts.skipCache && startedEpoch === cacheEpoch) cache.set(key, value, ttlMs);
      return value;
    })
    .finally(() => pendingFetches.delete(key));
  pendingFetches.set(key, pending);
  return pending;
}

export function invalidateCachePrefixes(prefixes = []) {
  prefixes.forEach(prefix => cache.delPrefix(prefix));
}

export function invalidateAppCaches(scope) {
  const groups = {
    payments: ['payments:', 'admin-payments:', 'owner-home', 'owner-pay', 'owner-summary', 'admin-home', 'dashboard:', 'reports:'],
    notices:  ['notices:', 'owner-home', 'owner-summary', 'admin-home'],
    claims:   ['claims:', 'owner-home', 'admin-home'],
    config:   ['config', 'owner-home', 'owner-pay', 'owner-summary', 'admin-home', 'dashboard:', 'reports:'],
    features: ['features:'],
    expenses: ['expenses:', 'owner-expenses:', 'owner-summary', 'dashboard:', 'reports:', 'owner-pay'],
    owners:   ['owners:', 'units:', 'owner-home', 'owner-pay', 'owner-summary', 'admin-home', 'dashboard:'],
    units:    ['units:', 'owners:', 'owner-home', 'owner-pay', 'owner-summary', 'admin-home', 'dashboard:'],
    providers:['providers:', 'expenses:'],
    documents:['documents:'],
    votes:    ['votes:'],
    visits:   ['visits:'],
    reservations: ['reservations:'],
    spaces:   ['spaces:'],
    reports:  ['reports:'],
    all:      [''],
  };

  invalidateCachePrefixes(groups[scope] || []);
  cacheEpoch += 1;
  [...pendingFetches.keys()].forEach(key => {
    if ((groups[scope] || []).some(prefix => key.startsWith(prefix))) pendingFetches.delete(key);
  });
}

window.gestionarInvalidateCaches = invalidateAppCaches;
