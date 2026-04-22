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

// ── Función base de fetch ─────────────────────────────────────
async function request(endpoint, options = {}) {
  const token = getToken();

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
    // Token expirado o inválido fuera del login → desloguear
    if (response.status === 401 && endpoint !== '/auth/login') {
      clearToken();
      window.dispatchEvent(new CustomEvent('auth:expired'));
    }
    throw err;
  }

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
  },

  // ── Propietarios ────────────────────────────────────────────
  owners: {
    getAll: (params = {}) =>
      request(`/owners?${new URLSearchParams(params)}`),

    getOne: (id) => request(`/owners/${id}`),

    getStats: () => request('/owners/stats'),

    create: (data) =>
      request('/owners', { method: 'POST', body: JSON.stringify(data) }),

    update: (id, data) =>
      request(`/owners/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    delete: (id) =>
      request(`/owners/${id}`, { method: 'DELETE' }),

    notify: (id, title, body) =>
      request(`/owners/${id}/notify`, { method: 'POST', body: JSON.stringify({ title, body }) }),

    bulkCreate: (formData) =>
      request('/owners/bulk', { method: 'POST', body: formData }),

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

    getReceiptUrl: (id) => `${API_BASE}/payments/${id}/receipt`,

    sendReminders: () => request('/payments/send-reminders', { method: 'POST' }),
  },

  // ── Avisos ───────────────────────────────────────────────────
  notices: {
    getAll: (params = {}) =>
      request(`/notices?${new URLSearchParams(params)}`),

    getOne: (id) => request(`/notices/${id}`),

    create: (data) =>
      request('/notices', { method: 'POST', body: JSON.stringify(data) }),

    update: (id, data) =>
      request(`/notices/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),

    delete: (id) =>
      request(`/notices/${id}`, { method: 'DELETE' }),
  },

  // ── Reclamos ─────────────────────────────────────────────────
  claims: {
    getAll: (params = {}) => request(`/claims?${new URLSearchParams(params)}`),
    create: (data) => request('/claims', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, status, adminNote) =>
      request(`/claims/${id}/status`, {
        method: 'PATCH',
        body: JSON.stringify({ status, adminNote }),
      }),
    delete: (id) => request(`/claims/${id}`, { method: 'DELETE' }),
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
    createPreference: () =>
      request('/mercadopago/preference', { method: 'POST' }),

    getPaymentStatus: (mpPaymentId) =>
      request(`/mercadopago/payment/${mpPaymentId}`),
  },

  // ── Proveedores ───────────────────────────────────────────────
  providers: {
    getAll:  (params = {}) => request(`/providers?${new URLSearchParams(params)}`),
    create:  (data) => request('/providers', { method: 'POST', body: JSON.stringify(data) }),
    update:  (id, data) => request(`/providers/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete:  (id) => request(`/providers/${id}`, { method: 'DELETE' }),
  },

  // ── Gastos ────────────────────────────────────────────────────
  expenses: {
    getSummary: (month) => request(`/expenses/summary${month ? `?month=${encodeURIComponent(month)}` : ''}`),
    getAll:    (params = {}) => request(`/expenses?${new URLSearchParams(params)}`),
    create:    (data) => request('/expenses', {
      method: 'POST',
      body: data instanceof FormData ? data : JSON.stringify(data),
    }),
    update:    (id, data) => request(`/expenses/${id}`, { method: 'PATCH', body: JSON.stringify(data) }),
    markAsPaid:(id, data = {}) => request(`/expenses/${id}/paid`, { method: 'PATCH', body: JSON.stringify(data) }),
    delete:    (id) => request(`/expenses/${id}`, { method: 'DELETE' }),
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
    getAll: (params = {}) => request(`/visits?${new URLSearchParams(params)}`),
    getMy:  ()             => request('/visits?limit=50'),
    create: (data)         => request('/visits', { method: 'POST', body: JSON.stringify(data) }),
    updateStatus: (id, status) =>
      request(`/visits/${id}/status`, { method: 'PATCH', body: JSON.stringify({ status }) }),
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
