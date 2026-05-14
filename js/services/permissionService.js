import { state } from '../core/state.js';

export const ROLE_LABELS = {
  owner_admin: 'Administrador principal',
  read_only: 'Solo lectura',
  billing_manager: 'Cobranzas',
  communications_manager: 'Reclamos y avisos',
  security_guard: 'Vigilador / Portería',
};

export const PERMISSION_LABELS = {
  'dashboard.read':                   'Dashboard: Ver dashboard',
  'owners.read':                      'Propietarios: Ver propietarios',
  'owners.create':                    'Propietarios: Agregar propietario',
  'owners.update':                    'Propietarios: Editar propietario',
  'owners.delete':                    'Propietarios: Eliminar propietario',
  'payments.read':                    'Pagos: Ver pagos',
  'payments.register':                'Pagos: Registrar pago',
  'payments.approve':                 'Pagos: Aprobar pago',
  'payments.cancel':                  'Pagos: Cancelar pago',
  'payments.remind':                  'Pagos: Enviar recordatorios',
  'debt.read':                        'Deudas: Ver deudas',
  'debt.create':                      'Deudas: Crear deuda',
  'debt.cancel':                      'Deudas: Cancelar deuda',
  'paymentPlans.read':                'Planes de pago: Ver planes',
  'paymentPlans.create':              'Planes de pago: Crear plan',
  'paymentPlans.approve':             'Planes de pago: Aprobar plan',
  'paymentPlans.cancel':              'Planes de pago: Cancelar plan',
  'paymentPlans.registerPayment':     'Planes de pago: Registrar cuota',
  'receipts.read':                    'Recibos: Ver recibos',
  'receipts.download':                'Recibos: Descargar recibos',
  'expenses.read':                    'Gastos: Ver gastos',
  'expenses.create':                  'Gastos: Registrar gasto',
  'expenses.update':                  'Gastos: Editar gasto',
  'expenses.delete':                  'Gastos: Eliminar gasto',
  'extraordinaryExpenses.read':       'Gastos extraordinarios: Ver',
  'extraordinaryExpenses.create':     'Gastos extraordinarios: Crear',
  'extraordinaryExpenses.update':     'Gastos extraordinarios: Editar',
  'extraordinaryExpenses.delete':     'Gastos extraordinarios: Eliminar',
  'claims.read':                      'Reclamos: Ver reclamos',
  'claims.respond':                   'Reclamos: Responder reclamo',
  'claims.close':                     'Reclamos: Cerrar reclamo',
  'claims.delete':                    'Reclamos: Eliminar reclamo',
  'notices.read':                     'Comunicados: Ver comunicados',
  'notices.create':                   'Comunicados: Crear comunicado',
  'notices.update':                   'Comunicados: Editar comunicado',
  'notices.delete':                   'Comunicados: Eliminar comunicado',
  'settings.read':                    'Configuración: Ver configuración',
  'settings.update':                  'Configuración: Editar configuración',
  'admins.read':                      'Administradores: Ver administradores',
  'admins.create':                    'Administradores: Invitar administrador',
  'admins.update':                    'Administradores: Cambiar rol',
  'admins.disable':                   'Administradores: Desactivar acceso',
  'reports.read':                     'Informes: Ver informes',
  'units.read':                       'Unidades: Ver unidades',
  'units.create':                     'Unidades: Crear unidad',
  'units.update':                     'Unidades: Editar unidad',
  'units.delete':                     'Unidades: Eliminar unidad',
  'providers.read':                   'Proveedores: Ver proveedores',
  'providers.create':                 'Proveedores: Agregar proveedor',
  'providers.update':                 'Proveedores: Editar proveedor',
  'providers.delete':                 'Proveedores: Eliminar proveedor',
  'employees.read':                   'Empleados: Ver empleados',
  'employees.create':                 'Empleados: Agregar empleado',
  'employees.update':                 'Empleados: Editar empleado',
  'employees.delete':                 'Empleados: Eliminar empleado',
  'salaries.read':                    'Sueldos: Ver sueldos',
  'salaries.create':                  'Sueldos: Registrar sueldo',
  'salaries.update':                  'Sueldos: Editar sueldo',
  'salaries.delete':                  'Sueldos: Eliminar sueldo',
  'documents.read':                   'Documentos: Ver documentos',
  'documents.create':                 'Documentos: Subir documento',
  'documents.update':                 'Documentos: Editar documento',
  'documents.delete':                 'Documentos: Eliminar documento',
  'votes.read':                       'Votaciones: Ver votaciones',
  'votes.create':                     'Votaciones: Crear votación',
  'votes.update':                     'Votaciones: Editar votación',
  'votes.delete':                     'Votaciones: Eliminar votación',
  'votes.close':                      'Votaciones: Cerrar votación',
  'visits.read':                      'Visitas: Ver visitas',
  'visits.update':                    'Visitas: Editar visita',
  'visits.delete':                    'Visitas: Eliminar visita',
  'visits.checkIn':                   'Visitas: Registrar ingreso',
  'visits.checkOut':                  'Visitas: Registrar egreso',
  'visits.history.read':              'Libro de visitas: Ver historial',
  'reservations.read':                'Reservas: Ver reservas',
  'reservations.update':              'Reservas: Gestionar reservas',
  'reservations.delete':              'Reservas: Eliminar reserva',
  'spaces.read':                      'Espacios: Ver espacios',
  'spaces.create':                    'Espacios: Crear espacio',
  'spaces.update':                    'Espacios: Editar espacio',
  'spaces.delete':                    'Espacios: Eliminar espacio',
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
  'page-admin-visits-log': 'visits.history.read',
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
