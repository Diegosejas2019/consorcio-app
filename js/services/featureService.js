import { state } from '../core/state.js';

// Mapeo de página → feature key
export const PAGE_FEATURE_MAP = {
  'page-admin-visits':       'visits',
  'page-owner-visits':       'visits',
  'page-admin-reservations': 'reservations',
  'page-owner-reservations': 'reservations',
  'page-admin-spaces':       'reservations',
  'page-admin-votes':        'votes',
  'page-owner-votes':        'votes',
  'page-admin-expenses':     'expenses',
  'page-owner-expenses':     'expenses',
  'page-admin-providers':    'providers',
};

/**
 * Devuelve true si la feature está habilitada.
 * Si no está configurada explícitamente, por defecto está habilitada.
 */
export function isFeatureEnabled(key) {
  if (!(key in state.features)) return true;
  return !!state.features[key];
}
