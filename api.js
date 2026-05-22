/* ═══════════════════════════════════════════════
   GestionAr — Cliente HTTP
   Conecta el frontend con la API REST
   ═══════════════════════════════════════════════ */

// ── URL base de la API ────────────────────────────────────────
// En producción reemplazá esta URL con la de tu servidor
const API_BASE = window.CONSORCIO_API_URL || 'https://consorcio-api-production.up.railway.app/api';

// ── Gestión del JWT ───────────────────────────────────────────
const TOKEN_KEY = 'consorcio_token';

// getToken: busca en localStorage primero (recordarme), luego en sessionStorage (sesión)
const getToken   = ()              => localStorage.getItem(TOKEN_KEY) || sessionStorage.getItem(TOKEN_KEY);
const setToken   = (token, remember = true) => {
  if (remember) {
    localStorage.setItem(TOKEN_KEY, token);
    sessionStorage.removeItem(TOKEN_KEY);
  } else {
    sessionStorage.setItem(TOKEN_KEY, token);
    localStorage.removeItem(TOKEN_KEY);
  }
};
const clearToken = ()              => {
  localStorage.removeItem(TOKEN_KEY);
  sessionStorage.removeItem(TOKEN_KEY);
};

// ── Cache key ─────────────────────────────────────────────────
function buildCacheKey(method, endpoint) {
  return `${method}:${endpoint}`;
}

const API_DEBUG_DUP_WINDOW_MS = 2500;
const _apiDebugLastCalls = {};

function isApiDebugEnabled() {
  try {
    return localStorage.getItem('debugApi') === 'true';
  } catch {
    return false;
  }
}

function logApiDebug({ method, endpoint, startedAt, status = '', cache = '' }) {
  if (!isApiDebugEnabled()) return;
  const key = buildCacheKey(method, endpoint);
  const now = Date.now();
  const prev = _apiDebugLastCalls[key];
  const duplicated = prev && (now - prev) < API_DEBUG_DUP_WINDOW_MS;
  _apiDebugLastCalls[key] = now;
  const duration = Math.round(performance.now() - startedAt);
  const suffix = [cache, `${duration}ms`, status, duplicated ? 'DUPLICATED' : '']
    .filter(Boolean)
    .join(' ');
  console.info(`[API] ${method} ${endpoint} ${suffix}`);
}

window.__apiDebugLogCache = function(key, status) {
  if (!isApiDebugEnabled()) return;
  console.info(`[API cache] ${status} ${key} ${new Date().toISOString()}`);
};

function inferInvalidationScope(endpoint, method) {
  if (method === 'GET') return null;
  if (endpoint.startsWith('/payments')) return 'payments';
  if (endpoint.startsWith('/notices')) return 'notices';
  if (endpoint.startsWith('/notice-templates')) return 'notices';
  if (endpoint.startsWith('/claims')) return 'claims';
  if (endpoint.startsWith('/config')) return 'config';
  if (/^\/organizations\/[^/]+\/features/.test(endpoint)) return 'features';
  if (endpoint.startsWith('/expenses')) return 'expenses';
  if (endpoint.startsWith('/salaries')) return 'expenses';
  if (endpoint.startsWith('/salary-payments')) return 'expenses';
  if (endpoint.startsWith('/owners')) return 'owners';
  if (endpoint.startsWith('/units')) return 'units';
  if (endpoint.startsWith('/providers')) return 'providers';
  if (endpoint.startsWith('/organization-documents')) return 'documents';
  if (endpoint.startsWith('/votes')) return 'votes';
  if (endpoint.startsWith('/visits')) return 'visits';
  if (endpoint.startsWith('/reservations')) return 'reservations';
  if (endpoint.startsWith('/spaces')) return 'spaces';
  if (endpoint.startsWith('/payment-plans')) return 'payment-plans';
  if (endpoint.startsWith('/debt-items')) return 'owners';
  if (/^\/owners\/[^/]+\/debt-items/.test(endpoint)) return 'owners';
  if (endpoint.startsWith('/admin/users')) return 'admin-users';
  return null;
}

function notifyCacheInvalidation(endpoint, method) {
  const scope = inferInvalidationScope(endpoint, method);
  if (scope) window.gestionarInvalidateCaches?.(scope);
}

// ── Función base de fetch ─────────────────────────────────────
async function request(endpoint, options = {}) {
  const method   = (options.method || 'GET').toUpperCase();
  const isWrite  = method !== 'GET';
  const cacheKey = buildCacheKey(method, endpoint);
  const token    = getToken();
  const startedAt = performance.now();

  // ── Offline path ─────────────────────────────────────────────
  if (!navigator.onLine) {
    if (isWrite) {
      if (options.body instanceof FormData) {
        throw new Error('Esta acción requiere conexión a internet.');
      }
      if (window.offlineQueue) {
        await window.offlineQueue.enqueue({
          url:       endpoint,
          method,
          body:      options.body ?? null,
          headers:   options.headers ?? null,
          createdAt: Date.now(),
        });
      }
      notifyCacheInvalidation(endpoint, method);
      logApiDebug({ method, endpoint, startedAt, status: 'OFFLINE_QUEUED' });
      return { success: true, offline: true };
    }
    // GET offline → try IDB cache
    if (window.idbService) {
      const cached = await window.idbService.get('cache', cacheKey);
      if (cached) {
        logApiDebug({ method, endpoint, startedAt, cache: 'IDB_HIT' });
        return cached.value;
      }
    }
    logApiDebug({ method, endpoint, startedAt, status: 'OFFLINE_MISS' });
    throw new Error('Sin conexión y sin datos cacheados.');
  }

  // ── Online path ──────────────────────────────────────────────
  const headers = {
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };

  // Si el body NO es FormData, agregamos Content-Type JSON
  if (!(options.body instanceof FormData)) {
    headers['Content-Type'] = 'application/json';
  }

  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, { ...options, headers });
  } catch (networkErr) {
    // Network failure while nominally online → try IDB cache for GETs
    if (!isWrite && window.idbService) {
      const cached = await window.idbService.get('cache', cacheKey);
      if (cached) {
        logApiDebug({ method, endpoint, startedAt, cache: 'IDB_HIT', status: 'NETWORK_FALLBACK' });
        return cached.value;
      }
    }
    logApiDebug({ method, endpoint, startedAt, status: 'NETWORK_ERROR' });
    throw new Error('Sin conexión con el servidor. Verificá tu internet.');
  }

  // Intentar parsear JSON
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Error del servidor (${response.status})`);
  }

  if (!response.ok) {
    const err = new Error(data.message || `Error ${response.status}`);
    err.status = response.status;
    err.mustChangePassword = data.mustChangePassword || false;
    // Token expirado o inválido fuera del login → desloguear
    if (response.status === 401 && endpoint !== '/auth/login' && endpoint !== '/auth/select-organization') {
      clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    // Contraseña temporal pendiente → redirigir a cambio de contraseña
    if (response.status === 403 && data.mustChangePassword) {
      window.dispatchEvent(new CustomEvent('auth:mustChangePassword'));
    }
    logApiDebug({ method, endpoint, startedAt, status: `HTTP_${response.status}` });
    throw err;
  }

  // Cache successful GET responses in IDB (fire-and-forget)
  if (!isWrite && window.idbService) {
    window.idbService.set('cache', cacheKey, { value: data, cachedAt: Date.now() });
  }

  if (isWrite) notifyCacheInvalidation(endpoint, method);
  logApiDebug({ method, endpoint, startedAt, status: `HTTP_${response.status}` });
  return data;
}

// Variante de request para descargas de archivos binarios (PDF, etc.)
async function requestBlob(endpoint) {
  const token = getToken();
  let response;
  try {
    response = await fetch(`${API_BASE}${endpoint}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
  } catch {
    throw new Error('Sin conexión con el servidor. Verificá tu internet.');
  }
  if (!response.ok) {
    let msg = `Error ${response.status}`;
    try { const d = await response.json(); msg = d.message || msg; } catch {}
    throw new Error(msg);
  }
  return response.blob();
}

// ── API client ────────────────────────────────────────────────
const api = {

  // ── Auth ────────────────────────────────────────────────────
  auth: {
    login: (email, password, fcmToken) =>
      request('/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password, ...(fcmToken && { fcmToken }) }),
      }),

    getMe: () => request('/auth/me'),

    register: (data) =>
      request('/auth/register', { method: 'POST', body: JSON.stringify(data) }),

    updatePassword: (currentPassword, newPassword) =>
      request('/auth/update-password', {
        method: 'PATCH',
        body: JSON.stringify({ currentPassword, newPassword }),
      }),

    updateFcmToken: (fcmToken) =>
      request('/auth/fcm-token', {
        method: 'PATCH',
        body: JSON.stringify({ fcmToken }),
      }),

    forgotPassword: (email) =>
      request('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({ email }),
      }),

    resetPassword: (token, newPassword) =>
      request(`/auth/reset-password/${token}`, {
        method: 'POST',
        body: JSON.stringify({ newPassword }),
      }),

    selectOrganization: (membershipId, selectionToken) =>
      request('/auth/select-organization', {
        method:  'POST',
        body:    JSON.stringify({ membershipId }),
        ...(selectionToken ? { headers: { Authorization: `Bearer ${selectionToken}` } } : {}),
      }),

    changeTempPassword: (currentPassword, newPassword, confirmPassword = newPassword) =>
      request('/auth/change-temporary-password', {
        method: 'POST',
        body: JSON.stringify({ currentPassword, newPassword, confirmPassword }),
      }),
  },

  // ── Propietarios ────────────────────────────────────────────
  owners: {
    getAll: (params = {}) =>
      request(`/owners?${new URLSearchParams(params)}`),

    getMySummary: (params = {}) =>
      request(`/owners/me/summary?${new URLSearchParams(params)}`),

    getOne: (id) => request(`/owners/${id}`),

    getAvailableItems: (id) => request(`/owners/${id}/available-items`),

    getStats: () => request('/owners/stats'),

    create: (data) =>
      request('/owners', { method: 'POST', body: JSON.stringify(data) }),

    update: (id, data) =>
      request(`/owners/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    delete: (id) =>
      request(`/owners/${id}`, { method: 'DELETE' }),

    requestEmailChange: (newEmail) =>
      request('/owners/me/request-email-change', { method: 'POST', body: JSON.stringify({ newEmail }) }),

    confirmEmailChange: (token) =>
      request('/owners/confirm-email-change', { method: 'POST', body: JSON.stringify({ token }) }),

    cancelEmailChange: () =>
      request('/owners/me/cancel-email-change', { method: 'POST' }),

    notify: (id, title, body) =>
      request(`/owners/${id}/notify`, { method: 'POST', body: JSON.stringify({ title, body }) }),

    bulkCreate: (formData) =>
      request('/owners/bulk', { method: 'POST', body: formData }),

    checkEmail: (email) =>
      request(`/owners/check-email?${new URLSearchParams({ email })}`),

    downloadTemplate: () => `${API_BASE}/owners/bulk/template`,
  },

  // ── Pagos ────────────────────────────────────────────────────
  payments: {
    getAll: (params = {}) =>
      request(`/payments?${new URLSearchParams(params)}`),

    getOne: (id) => request(`/payments/${id}`),

    // FormData para subir archivo
    create: (formData) =>
      request('/payments', { method: 'POST', body: formData }),

    approve: (id) =>
      request(`/payments/${id}/approve`, { method: 'PATCH' }),

    reject: (id, rejectionNote) =>
      request(`/payments/${id}/reject`, {
        method: 'PATCH',
        body: JSON.stringify({ rejectionNote }),
      }),

    delete: (id) =>
      request(`/payments/${id}`, { method: 'DELETE' }),

    getDashboard: (year) => request(`/payments/dashboard${year ? `?year=${year}` : ''}`),

    getAdminOwners: (params = {}) =>
      request(`/payments/admin/owners?${new URLSearchParams(params)}`),

    getReceiptUrl: (id) => `${API_BASE}/payments/${id}/receipt`,

    getSystemReceipt: (id) => request(`/payments/${id}/system-receipt`),
    getSystemReceiptUrl: (id) => `${API_BASE}/payments/${id}/system-receipt?download=1`,

    sendReminders: () => request('/payments/send-reminders', { method: 'POST' }),

    getAvailableItems: (params = {}) =>
      request(`/payments/available-items?${new URLSearchParams(params)}`),
  },

  // ── Avisos ───────────────────────────────────────────────────
  notices: {
    getAll: (params = {}) =>
      request(`/notices?${new URLSearchParams(params)}`),

    getOne: (id) => request(`/notices/${id}`),

    create: (data) =>
      request('/notices', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),

    update: (id, data) =>
      request(`/notices/${id}`, { method: 'PATCH', body: data instanceof FormData ? data : JSON.stringify(data) }),

    delete: (id) =>
      request(`/notices/${id}`, { method: 'DELETE' }),

    sendNow: (id) =>
      request(`/notices/${id}/send-now`, { method: 'POST' }),

    cancel: (id) =>
      request(`/notices/${id}/cancel`, { method: 'POST' }),

    processScheduled: () =>
      request('/notices/process-scheduled', { method: 'POST' }),

    stats: (id) =>
      request(`/notices/${id}/stats`),

    markRead: (id) =>
      request(`/notices/${id}/read`, { method: 'PATCH' }),

    markUnread: (id) =>
      request(`/notices/${id}/unread`, { method: 'PATCH' }),

    getAttachmentUrl: (id, index) => `${API_BASE}/notices/${id}/attachment/${index}`,
  },

  noticeTemplates: {
    getAll: (params = {}) =>
      request(`/notice-templates?${new URLSearchParams(params)}`),

    create: (data) =>
      request('/notice-templates', { method: 'POST', body: JSON.stringify(data) }),

    update: (id, data) =>
      request(`/notice-templates/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    delete: (id) =>
      request(`/notice-templates/${id}`, { method: 'DELETE' }),
  },

  // ── Reclamos ─────────────────────────────────────────────────
  claims: {
    getAll: (params = {}) => request(`/claims?${new URLSearchParams(params)}`),
    create: (data) => request('/claims', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
    updateStatus: (id, status, adminNote) =>
      request(`/claims/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNote }),
      }),
    delete: (id) => request(`/claims/${id}`, { method: 'DELETE' }),
    getAttachmentUrl: (id, index) => `${API_BASE}/claims/${id}/attachment/${index}`,
  },

  // Soporte tecnico
  supportTickets: {
    create: (data) => request('/support-tickets', { method: 'POST', body: JSON.stringify(data) }),
    getAll: (params = {}) => request(`/support-tickets?${new URLSearchParams(params)}`),
    getMy: () => request('/support-tickets/my'),
    update: (id, data) => request(`/support-tickets/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete: (id) => request(`/support-tickets/${id}`, { method: 'DELETE' }),
  },

  // ── Configuración ─────────────────────────────────────────────
  config: {
    get: () => request('/config'),
    update: (data) =>
      request('/config', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // ── Organizaciones ─────────────────────────────────────────────
  organizations: {
    getTemplates: () => request('/organizations/templates'),

    create: (data) =>
      request('/organizations', { method: 'POST', body: JSON.stringify(data) }),

    getFeatures: (orgId) =>
      request(`/organizations/${orgId}/features`),

    updateFeatures: (orgId, features) =>
      request(`/organizations/${orgId}/features`, {
        method: 'PUT',
        body: JSON.stringify(features),
      }),
  },

  // ── MercadoPago ───────────────────────────────────────────────
  mercadopago: {
    createPreference: (payload) =>
      request('/mercadopago/preference', {
        method: 'POST',
        body: JSON.stringify(Array.isArray(payload) ? { periods: payload } : (payload || {})),
      }),

    getPaymentStatus: (mpPaymentId) =>
      request(`/mercadopago/payment/${mpPaymentId}`),
  },

  // ── Proveedores ───────────────────────────────────────────────
  adminUsers: {
    permissionsMe: () => request('/admin/permissions/me'),
    getAll: () => request('/admin/users'),
    searchOwners: (query = '') => request(`/admin/owners/search?${new URLSearchParams({ query })}`),
    invite: (data) => request('/admin/users/invite', { method: 'POST', body: JSON.stringify(data) }),
    updateRole: (userId, role) =>
      request(`/admin/users/${userId}/role`, { method: 'PATCH', body: JSON.stringify({ role }) }),
    disable: (userId) =>
      request(`/admin/users/${userId}/disable`, { method: 'PATCH' }),
  },

  providers: {
    getAll:           (params = {}) => request(`/providers?${new URLSearchParams(params)}`),
    create:           (data) => request('/providers', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
    update:           (id, data) => request(`/providers/${id}`, { method: 'PATCH', body: data instanceof FormData ? data : JSON.stringify(data) }),
    delete:           (id) => request(`/providers/${id}`, { method: 'DELETE' }),
    getDocumentUrl:   (id, index) => `${API_BASE}/providers/${id}/document/${index}`,
    deleteDocument:   (id, index) => request(`/providers/${id}/document/${index}`, { method: 'DELETE' }),
  },

  // ── Gastos ────────────────────────────────────────────────────
  organizationDocuments: {
    getAll:      (params = {}) => request(`/organization-documents?${new URLSearchParams(params)}`),
    getOne:      (id)          => request(`/organization-documents/${id}`),
    create:      (data)        => request('/organization-documents', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
    update:      (id, data)    => request(`/organization-documents/${id}`, { method: 'PATCH', body: data instanceof FormData ? data : JSON.stringify(data) }),
    delete:      (id)          => request(`/organization-documents/${id}`, { method: 'DELETE' }),
    downloadUrl: (id)          => `${API_BASE}/organization-documents/${id}/download`,
  },

  expenses: {
    getSummary:       (month) => request(`/expenses/summary${month ? `?month=${encodeURIComponent(month)}` : ''}`),
    getAll:           (params = {}) => request(`/expenses?${new URLSearchParams(params)}`),
    create:           (data) => request('/expenses', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
    update:           (id, data) => request(`/expenses/${id}`, { method: 'PATCH', body: data instanceof FormData ? data : JSON.stringify(data) }),
    markAsPaid:       (id, data = {}) => request(`/expenses/${id}/paid`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete:           (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
    getAttachmentUrl: (id, index) => `${API_BASE}/expenses/${id}/attachment/${index}`,
    deleteAttachment: (id, index) => request(`/expenses/${id}/attachment/${index}`, { method: 'DELETE' }),
  },

  // ── Empleados ─────────────────────────────────────────────────
  employees: {
    getAll:  (params = {}) => request(`/employees?${new URLSearchParams(params)}`),
    create:  (data)        => request('/employees', { method: 'POST', body: data instanceof FormData ? data : JSON.stringify(data) }),
    getOne:  (id)          => request(`/employees/${id}`),
    update:  (id, data)    => request(`/employees/${id}`, { method: 'PATCH', body: data instanceof FormData ? data : JSON.stringify(data) }),
    delete:  (id)          => request(`/employees/${id}`, { method: 'DELETE' }),
    getDocumentUrl: (id, index) => `${API_BASE}/employees/${id}/document/${index}`,
    deleteDocument: (id, index) => request(`/employees/${id}/document/${index}`, { method: 'DELETE' }),
  },

  // ── Sueldos ───────────────────────────────────────────────────
  salaries: {
    getAll:  (params = {}) => request(`/salaries?${new URLSearchParams(params)}`),
    create:  (data)        => request('/salaries', { method: 'POST', body: JSON.stringify(data) }),
    getOne:  (id)          => request(`/salaries/${id}`),
    update:  (id, data)    => request(`/salaries/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete:  (id)          => request(`/salaries/${id}`, { method: 'DELETE' }),
  },

  salaryPayments: {
    getAll: (params = {}) => request(`/salary-payments?${new URLSearchParams(params)}`),
    create: (data)        => request('/salary-payments', { method: 'POST', body: JSON.stringify(data) }),
    delete: (id)          => request(`/salary-payments/${id}`, { method: 'DELETE' }),
  },

  // ── Reportes ──────────────────────────────────────────────────
  reports: {
    getMonthlySummary: (month) =>
      request(`/reports/monthly-summary?month=${encodeURIComponent(month)}`),
    downloadExpensasPdf: (month) =>
      requestBlob(`/reports/expensas-pdf?month=${encodeURIComponent(month)}`),
  },

  // ── Visitas ───────────────────────────────────────────────────
  visits: {
    getAll:       (params = {}) => request(`/visits?${new URLSearchParams(params)}`),
    getMy:        ()             => request('/visits?limit=50'),
    getToday:     ()             => request('/visits/today'),
    getHistory:   (params = {}) => request(`/visits/history?${new URLSearchParams(params)}`),
    getLogs:      (id)           => request(`/visits/${id}/logs`),
    create:       (data)         => request('/visits', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, status)   =>
      request(`/visits/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    checkIn:  (id, comment) =>
      request(`/visits/${id}/check-in`,  { method: 'POST', body: JSON.stringify({ comment }) }),
    checkOut: (id, comment) =>
      request(`/visits/${id}/check-out`, { method: 'POST', body: JSON.stringify({ comment }) }),
    delete: (id) => request(`/visits/${id}`, { method: 'DELETE' }),
  },

  // ── Espacios comunes ──────────────────────────────────────────
  spaces: {
    getAll:  ()          => request('/spaces'),
    create:  (data)      => request('/spaces', { method: 'POST', body: JSON.stringify(data) }),
    update:  (id, data)  => request(`/spaces/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete:  (id)        => request(`/spaces/${id}`, { method: 'DELETE' }),
  },

  // ── Reservas ──────────────────────────────────────────────────
  reservations: {
    getAll:       (params = {}) => request(`/reservations?${new URLSearchParams(params)}`),
    getMine:      ()            => request('/reservations?limit=50'),
    create:       (data)        => request('/reservations', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, status)  => request(`/reservations/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
    delete:       (id)          => request(`/reservations/${id}`, { method: 'DELETE' }),
  },

  // ── Unidades ──────────────────────────────────────────────────
  units: {
    getAll: (params = {}) =>
      request(`/units?${new URLSearchParams(params)}`),

    create: (data) =>
      request('/units', { method: 'POST', body: JSON.stringify(data) }),

    bulkCreate: (data) =>
      request('/units/bulk', { method: 'POST', body: JSON.stringify(data) }),

    update: (id, data) =>
      request(`/units/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    releaseOwner: (id) =>
      request(`/units/${id}/release-owner`, { method: 'PATCH', body: JSON.stringify({}) }),

    delete: (id) =>
      request(`/units/${id}`, { method: 'DELETE' }),
  },

  // ── Planes de pago ────────────────────────────────────────────
  paymentPlans: {
    request:  (data)          => request('/payment-plans/request', { method: 'POST', body: JSON.stringify(data) }),
    getMy:    ()               => request('/payment-plans/my'),
    listAdmin: (params = {})  => request(`/payment-plans/admin?${new URLSearchParams(params)}`),
    getAdmin: (id)             => request(`/payment-plans/admin/${id}`),
    approve:  (id, data)      => request(`/payment-plans/admin/${id}/approve`, { method: 'POST', body: JSON.stringify(data) }),
    reject:   (id, data)      => request(`/payment-plans/admin/${id}/reject`, { method: 'POST', body: JSON.stringify(data) }),
    create:   (data)          => request('/payment-plans/admin', { method: 'POST', body: JSON.stringify(data) }),
    cancel:   (id)            => request(`/payment-plans/admin/${id}/cancel`, { method: 'PATCH' }),
    delete:   (id)            => request(`/payment-plans/admin/${id}`, { method: 'DELETE' }),
    registerInstallmentPayment: (id) =>
      request(`/payment-plans/admin/installments/${id}/register-payment`, { method: 'POST' }),
    submitInstallmentPayment: (id, formData) =>
      request(`/payment-plans/installments/${id}/pay`, { method: 'POST', body: formData }),
  },

  // ── Deudas adicionales ────────────────────────────────────────
  debtItems: {
    create:     (ownerId, data) => request(`/owners/${ownerId}/debt-items`, { method: 'POST', body: JSON.stringify(data) }),
    getByOwner: (ownerId)       => request(`/owners/${ownerId}/debt-items`),
    markAsPaid: (id)            => request(`/debt-items/${id}/paid`, { method: 'PATCH' }),
    cancel:     (id, reason)    => request(`/debt-items/${id}/cancel`, { method: 'PATCH', body: JSON.stringify({ cancellationReason: reason }) }),
    getMine:    ()              => request('/debt-items/mine'),
  },

  // ── Votaciones ────────────────────────────────────────────────
  votes: {
    getAll:   (params = {}) => request(`/votes?${new URLSearchParams(params)}`),
    getOne:   (id)          => request(`/votes/${id}`),
    create:   (data)        => request('/votes', { method: 'POST', body: JSON.stringify(data) }),
    update:   (id, data)    => request(`/votes/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    close:    (id)          => request(`/votes/${id}/close`, { method: 'PATCH' }),
    delete:   (id)          => request(`/votes/${id}`, { method: 'DELETE' }),
    cast:     (id, optionIndex) => request(`/votes/${id}/cast`, { method: 'POST', body: JSON.stringify({ optionIndex }) }),
    results:  (id)          => request(`/votes/${id}/results`),
  },
};

// Exponer globalmente
window.api        = api;
window.API_BASE   = API_BASE;
window.getToken   = getToken;
window.setToken   = setToken;
window.clearToken = clearToken;
