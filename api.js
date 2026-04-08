/* ═══════════════════════════════════════════════
   ConsorcioPro — Cliente HTTP
   Conecta el frontend con la API REST
   ═══════════════════════════════════════════════ */

// ── URL base de la API ────────────────────────────────────────
// En producción reemplazá esta URL con la de tu servidor
const API_BASE = window.CONSORCIO_API_URL || 'https://consorcio-api-production.up.railway.app/api';

// ── Gestión del JWT ───────────────────────────────────────────
const TOKEN_KEY = 'consorcio_token';

const getToken  = ()      => localStorage.getItem(TOKEN_KEY);
const setToken  = (token) => localStorage.setItem(TOKEN_KEY, token);
const clearToken = ()     => localStorage.removeItem(TOKEN_KEY);

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

  // Token expirado o inválido → desloguear
  if (response.status === 401) {
    clearToken();
    window.dispatchEvent(new CustomEvent('auth:expired'));
    throw new Error('Sesión expirada. Por favor iniciá sesión nuevamente.');
  }

  // Intentar parsear JSON
  let data;
  try {
    data = await response.json();
  } catch {
    throw new Error(`Error del servidor (${response.status})`);
  }

  if (!response.ok) {
    throw new Error(data.message || `Error ${response.status}`);
  }

  return data;
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

    getDashboard: () => request('/payments/dashboard'),

    getReceiptUrl: (id) => `${API_BASE}/payments/${id}/receipt`,
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

  // ── Configuración ─────────────────────────────────────────────
  config: {
    get: () => request('/config'),
    update: (data) =>
      request('/config', { method: 'PATCH', body: JSON.stringify(data) }),
  },

  // ── MercadoPago ───────────────────────────────────────────────
  mercadopago: {
    createPreference: () =>
      request('/mercadopago/preference', { method: 'POST' }),

    getPaymentStatus: (mpPaymentId) =>
      request(`/mercadopago/payment/${mpPaymentId}`),
  },
};

// Exponer globalmente
window.api        = api;
window.API_BASE   = API_BASE;
window.getToken   = getToken;
window.setToken   = setToken;
window.clearToken = clearToken;
