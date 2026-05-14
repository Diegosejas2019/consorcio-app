import { state } from '../core/state.js';

export const ROLE_LABELS = {
  owner_admin: 'Administrador principal',
  read_only: 'Solo lectura',
  billing_manager: 'Cobranzas',
  communications_manager: 'Reclamos y avisos',
};

export const PAGE_PERMISSION_MAP = {
  'page-admin-home': 'dashboard.read',
  'page-admin-dashboard': 'dashboard.read',
  'page-admin-payments': 'payments.read',
  'page-admin-payment-plans': 'paymentPlans.read',
  'page-admin-owners': 'owners.read',
  'page-admin-units': 'units.read',
  'page-admin-notices': 'notices.read',
  'page-admin-claims': 'claims.read',
  'page-admin-expenses': 'expenses.read',
  'page-admin-providers': 'providers.read',
  'page-admin-documents': 'documents.read',
  'page-admin-report': 'reports.read',
  'page-admin-votes': 'votes.read',
  'page-admin-visits': 'visits.read',
  'page-admin-reservations': 'reservations.read',
  'page-admin-spaces': 'spaces.read',
  'page-admin-support': 'dashboard.read',
  'page-admin-employees': 'employees.read',
  'page-admin-salaries': 'salaries.read',
  'page-admin-settings': 'settings.read',
};

export function hasPermission(permission) {
  if (state.role !== 'admin') return true;
  if (state.adminRole === 'owner_admin') return true;
  return Array.isArray(state.permissions) && state.permissions.includes(permission);
}

export function hasAnyPermission(permissions = []) {
  return permissions.some(hasPermission);
}

export function canAccessPage(pageId) {
  const permission = PAGE_PERMISSION_MAP[pageId];
  return !permission || hasPermission(permission);
}

export function firstAllowedAdminPage(fallback = 'page-admin-home') {
  if (canAccessPage(fallback)) return fallback;
  return Object.keys(PAGE_PERMISSION_MAP).find(canAccessPage) || 'page-admin-home';
}

export function roleLabel(role = state.adminRole) {
  return ROLE_LABELS[role] || 'Administrador';
}

window.hasPermission = hasPermission;
window.hasAnyPermission = hasAnyPermission;
