import { cache } from './state.js';

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
};

export function stableParams(params = {}) {
  return new URLSearchParams(params).toString();
}

export async function getCachedOrFetch(key, ttlMs, fetcher, opts = {}) {
  const cached = cache.get(key);
  if (cached) return cached;

  const value = await fetcher();
  if (!opts.skipCache) cache.set(key, value, ttlMs);
  return value;
}

export function invalidateCachePrefixes(prefixes = []) {
  prefixes.forEach(prefix => cache.delPrefix(prefix));
}

export function invalidateAppCaches(scope) {
  const groups = {
    payments: ['payments:', 'admin-payments:', 'owner-home', 'admin-home', 'dashboard:', 'reports:'],
    notices:  ['notices:', 'owner-home', 'admin-home'],
    claims:   ['claims:', 'owner-home', 'admin-home'],
    config:   ['config', 'owner-home', 'admin-home', 'dashboard:', 'reports:', 'owner-pay'],
    features: ['features:'],
    expenses: ['expenses:', 'owner-expenses:', 'dashboard:', 'reports:', 'owner-pay'],
    owners:   ['owners:', 'units:', 'owner-home', 'owner-pay', 'admin-home', 'dashboard:'],
    units:    ['units:', 'owners:', 'owner-home', 'owner-pay', 'admin-home', 'dashboard:'],
    providers:['providers:', 'expenses:'],
    documents:['documents:'],
    reports:  ['reports:'],
    all:      [''],
  };

  invalidateCachePrefixes(groups[scope] || []);
}

window.gestionarInvalidateCaches = invalidateAppCaches;
