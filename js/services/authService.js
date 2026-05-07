import { state, setState, cache } from '../core/state.js';
import { CACHE_TTL, getCachedOrFetch } from '../core/cacheHelpers.js';
import { showLoading, showSessionRestoreError } from '../ui/loading.js';
import { toast } from '../ui/toast.js';
import { SVG, svgIcon } from '../ui/icons.js';
import { showInstallBanner, isStandalone } from '../ui/pwa.js';
import { updateOnlineStatus } from '../ui/offline.js';
import { setupPushNotifications, checkMonthlyReminder } from './pushService.js';
import { runOnboarding } from '../ui/onboarding.js';
import { isFeatureEnabled, PAGE_FEATURE_MAP } from './featureService.js';

// Devuelve el orgId desde state.organization (membership) con fallback a state.user.organization (legacy)
export function getOrgId() {
  const o = state.organization;
  return o?._id || o || state.user?.organization || null;
}

// ── Carga de feature flags ────────────────────────────────────
async function loadFeatures() {
  const orgId = getOrgId();
  if (!orgId) return;
  try {
    const res = await getCachedOrFetch(
      `features:${orgId}`,
      CACHE_TTL.FEATURES,
      () => api.organizations.getFeatures(orgId)
    );
    setState({ features: res.data.features });
  } catch (_) {
    // Sin features configuradas → todos habilitados por defecto
  }
}

// ── Toggle visibilidad de contraseña ─────────────────────────
async function handlePendingMPNavigation() {
  const mpGoto = sessionStorage.getItem('mp-goto');
  if (!mpGoto) return false;

  sessionStorage.removeItem('mp-goto');
  const mpPaymentId = sessionStorage.getItem('mp-payment-id');
  sessionStorage.removeItem('mp-payment-id');

  if (mpPaymentId) {
    try {
      await api.mercadopago.getPaymentStatus(mpPaymentId);
      cache.clear();
    } catch (err) {
      toast(err.message || 'No se pudo sincronizar el pago de MercadoPago.', 'warning');
    }
  }

  if (mpGoto === 'pagos') {
    setTimeout(() => {
      window.showPage?.('page-owner-pay');
      window.renderUploadPage?.();
    }, 200);
  }

  return true;
}

export function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

// ── Login / Forgot Password / Reset Password ──────────────────
let _resetToken           = null;
let _pendingSelectionToken = null;
let _rememberMe            = true;

export function showForgotView() {
  document.getElementById('login-fields').classList.add('hidden');
  document.getElementById('btn-login').classList.add('hidden');
  document.getElementById('forgot-link').classList.add('hidden');
  document.getElementById('forgot-view').classList.remove('hidden');
  document.getElementById('forgot-email').focus();
}

export function showLoginView() {
  document.getElementById('login-fields').classList.remove('hidden');
  document.getElementById('btn-login').classList.remove('hidden');
  document.getElementById('forgot-link').classList.remove('hidden');
  document.getElementById('forgot-view').classList.add('hidden');
  document.getElementById('org-selection-view').classList.add('hidden');
  _pendingSelectionToken = null;
}

function showOrgSelectionView(organizations) {
  document.getElementById('login-fields').classList.add('hidden');
  document.getElementById('btn-login').classList.add('hidden');
  document.getElementById('forgot-link').classList.add('hidden');
  document.getElementById('forgot-view').classList.add('hidden');

  const roleLabel = (role) => role === 'admin' ? 'Administrador' : 'Propietario';

  document.getElementById('org-list').innerHTML = organizations.map(org =>
    `<button class="btn btn-secondary w-full" onclick="window._selectOrg('${org.membershipId}')" style="text-align:left;padding:.75rem 1rem">
      <strong>${org.organizationName}</strong>
      <span style="display:block;font-size:.8rem;color:var(--text-muted)">${roleLabel(org.role)}</span>
    </button>`
  ).join('');

  document.getElementById('org-selection-view').classList.remove('hidden');
}

async function selectOrg(membershipId) {
  try {
    showLoading(true);
    const res = await api.auth.selectOrganization(membershipId, _pendingSelectionToken);
    _pendingSelectionToken = null;
    setToken(res.token, _rememberMe);
    setState({ role: res.data.user.role, user: res.data.user,
               membership: res.data.membership || null,
               organization: res.data.membership?.organization || null });
    cache.clear();
    cache.set('auth:me', res, CACHE_TTL.AUTH_ME);
    await loadFeatures();
    enterApp();
    await handlePendingMPNavigation();
  } catch (err) {
    toast(err.message || 'No se pudo seleccionar la organización', 'error');
  } finally {
    showLoading(false);
  }
}

window._selectOrg = selectOrg;

export async function submitForgotPassword() {
  const email = document.getElementById('forgot-email').value.trim();
  if (!email) { toast('Ingresá tu email', 'error'); return; }
  try {
    showLoading(true);
    await api.auth.forgotPassword(email);
    document.getElementById('forgot-email').value = '';
    showLoginView();
    toast('Si ese email está registrado recibirás un enlace en los próximos minutos.', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

export async function submitResetPassword() {
  const newPassword = document.getElementById('reset-pass').value.trim();
  const confirmPass = document.getElementById('reset-pass-confirm').value.trim();
  if (newPassword.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
  if (newPassword !== confirmPass) { toast('Las contraseñas no coinciden', 'error'); return; }
  try {
    showLoading(true);
    const res = await api.auth.resetPassword(_resetToken, newPassword);
    setToken(res.token);
    setState({ role: res.data.user.role, user: res.data.user,
               membership: res.data.membership || null,
               organization: res.data.membership?.organization || null });
    cache.clear();
    cache.set('auth:me', res, CACHE_TTL.AUTH_ME);
    await loadFeatures();
    window.history.replaceState({}, '', window.location.pathname);
    document.getElementById('reset-screen').style.display = 'none';
    toast('Contraseña actualizada correctamente', 'success');
    enterApp();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Login button ──────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  const email    = document.getElementById('login-email').value.trim();
  const password = document.getElementById('login-pass').value.trim();
  if (!email || !password) { toast('Completá email y contraseña', 'error'); return; }
  _rememberMe = document.getElementById('remember-me')?.checked ?? true;
  try {
    showLoading(true);
    const res = await api.auth.login(email, password);

    if (res.requiresOrganizationSelection) {
      _pendingSelectionToken = res.selectionToken;
      showOrgSelectionView(res.organizations);
      return;
    }

    setToken(res.token, _rememberMe);
    setState({ role: res.data.user.role, user: res.data.user,
               membership: res.data.membership || null,
               organization: res.data.membership?.organization || null });
    cache.clear();
    cache.set('auth:me', res, CACHE_TTL.AUTH_ME);
    await loadFeatures();
    enterApp();
    await handlePendingMPNavigation();
  } catch (err) {
    const msg = err.message || 'No se pudo iniciar sesión. Intentá nuevamente';
    toast(msg, 'error');
  } finally {
    showLoading(false);
  }
});

// ── Detectar y manejar redirect de MercadoPago ───────────────
function getMPStatus() {
  const path = window.location.pathname;
  if (path.includes('/pago/exitoso'))   return 'success';
  if (path.includes('/pago/fallido'))   return 'failure';
  if (path.includes('/pago/pendiente')) return 'pending';
  return null;
}

function getMPPaymentId() {
  const params = new URLSearchParams(window.location.search);
  return params.get('payment_id') || params.get('collection_id');
}

const MP_CONFIGS = {
  success: {
    icon: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="36" fill="rgba(34,197,94,0.12)"/><circle cx="36" cy="36" r="26" fill="rgba(34,197,94,0.18)"/><path d="M23 36l9 9 17-17" stroke="#22C55E" stroke-width="3.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
    color:    'var(--success)',
    title:    '¡Pago realizado!',
    subtitle: 'Tu pago fue procesado exitosamente. En breve recibirás una confirmación por email.',
  },
  pending: {
    icon: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="36" fill="rgba(251,191,36,0.12)"/><circle cx="36" cy="36" r="26" fill="rgba(251,191,36,0.18)"/><circle cx="36" cy="36" r="14" stroke="#FBBF24" stroke-width="2.5" fill="none"/><path d="M36 24v12l7 7" stroke="#FBBF24" stroke-width="3.5" stroke-linecap="round"/></svg>`,
    color:    'var(--warning)',
    title:    'Pago en proceso',
    subtitle: 'Tu pago está siendo verificado por MercadoPago. Te notificaremos cuando se confirme.',
  },
  failure: {
    icon: `<svg width="72" height="72" viewBox="0 0 72 72" fill="none"><circle cx="36" cy="36" r="36" fill="rgba(248,113,113,0.12)"/><circle cx="36" cy="36" r="26" fill="rgba(248,113,113,0.18)"/><path d="M27 27l18 18M45 27L27 45" stroke="#F87171" stroke-width="3.5" stroke-linecap="round"/></svg>`,
    color:    'var(--danger)',
    title:    'Pago no completado',
    subtitle: 'No se pudo procesar el pago. Podés intentarlo nuevamente desde la aplicación.',
  },
};

function showMPResultScreen(status) {
  const cfg = MP_CONFIGS[status] || MP_CONFIGS.pending;
  const paymentId = getMPPaymentId();
  if (paymentId) sessionStorage.setItem('mp-payment-id', paymentId);
  document.getElementById('mp-result-icon').innerHTML       = cfg.icon;
  document.getElementById('mp-result-title').textContent    = cfg.title;
  document.getElementById('mp-result-title').style.color    = cfg.color;
  document.getElementById('mp-result-subtitle').textContent = cfg.subtitle;
  document.getElementById('login-screen').style.display     = 'none';
  document.getElementById('mp-result-screen').style.display = 'flex';
  window.history.replaceState({}, '', '/');

  const btn = document.getElementById('mp-result-btn');
  const goToPayments = () => {
    sessionStorage.setItem('mp-goto', 'pagos');
    continueFromMPResult();
  };

  if (status === 'success') {
    btn.style.display = '';
    btn.textContent = 'Ir a Pagos';
    btn.onclick = goToPayments;
  } else if (status === 'failure') {
    btn.style.display = '';
    btn.textContent = 'Volver a Pagos';
    btn.onclick = goToPayments;
  } else {
    btn.style.display = '';
    btn.textContent = 'Volver a Pagos';
    btn.onclick = goToPayments;
  }
}

function handleMPRedirect() {
  const mpStatus = getMPStatus();
  if (!mpStatus) return false;
  showMPResultScreen(mpStatus);
  return true;
}

async function continueFromMPResult() {
  const token = getToken();
  if (!token) {
    document.getElementById('mp-result-screen').style.display = 'none';
    document.getElementById('login-screen').style.display = 'flex';
    return;
  }

  try {
    showLoading(true);
    const res = await api.auth.getMe();
    setState({ role: res.data.user.role, user: res.data.user,
               membership: res.data.membership || null,
               organization: res.data.membership?.organization || null });
    cache.clear();
    cache.set('auth:me', res, CACHE_TTL.AUTH_ME);
    await loadFeatures();
    document.getElementById('mp-result-screen').style.display = 'none';
    enterApp();
    await handlePendingMPNavigation();
  } catch (err) {
    if (err.status === 401 || err.message?.includes('Sesión expirada')) {
      clearToken();
      document.getElementById('mp-result-screen').style.display = 'none';
      document.getElementById('login-screen').style.display = 'flex';
      toast('Sesión expirada. Iniciá sesión nuevamente.', 'error');
    } else {
      showSessionRestoreError();
    }
  } finally {
    showLoading(false);
  }
}

// ── Restaurar sesión / detectar reset token ───────────────────
window.addEventListener('DOMContentLoaded', async () => {
  updateOnlineStatus();

  // MP redirect: mostrar resultado sin requerir autenticación
  if (handleMPRedirect()) return;

  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('token');
  if (resetToken) {
    _resetToken = resetToken;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('reset-screen').style.display = 'flex';
    return;
  }

  const token = getToken();
  if (!token) return;
  try {
    showLoading(true);
    const res = await api.auth.getMe();
    setState({ role: res.data.user.role, user: res.data.user,
               membership: res.data.membership || null,
               organization: res.data.membership?.organization || null });
    cache.clear();
    cache.set('auth:me', res, CACHE_TTL.AUTH_ME);
    await loadFeatures();
    enterApp();
    await handlePendingMPNavigation();
  } catch (err) {
    if (err.status === 401 || err.message?.includes('Sesión expirada')) {
      clearToken();
    } else {
      showSessionRestoreError();
    }
  } finally {
    showLoading(false);
  }
});

// ── auth:expired ──────────────────────────────────────────────
window.addEventListener('auth:expired', () => {
  toast('Sesión expirada. Iniciá sesión nuevamente.', 'error');
  logout();
});

// ── enterApp ──────────────────────────────────────────────────
export function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display    = 'flex';
  setupNav();
  setupTopBar();
  if (window.Sentry) Sentry.onLoad(() => Sentry.setUser({ id: state.user._id, email: state.user.email, role: state.role }));
  if (state.role === 'admin') {
    window.renderAdminView();
    setupPushNotifications();
  } else {
    window.renderOwnerView();
    setupPushNotifications();
    checkMonthlyReminder();
  }
  runOnboarding(state.role);
  if (!isStandalone()) {
    setTimeout(showInstallBanner, 4000);
  }
}

// ── setupTopBar ───────────────────────────────────────────────
export function setupTopBar() {
  const initials  = state.user.name.split(' ').slice(0, 2).map(w => w[0]).join('');
  const roleLabel = state.role === 'admin' ? 'Administrador' : (state.user.unit || '');
  const avatar    = document.getElementById('avatar');
  avatar.textContent = initials;
  avatar.title       = roleLabel ? `${state.user.name} · ${roleLabel}` : state.user.name;
  document.getElementById('user-name').textContent = state.user.name;
  document.getElementById('user-role').textContent = roleLabel;

  const btnReport = document.getElementById('btn-report-problem');
  const btnNotif  = document.getElementById('btn-notifications');
  btnReport.style.display = '';
  if (state.role === 'admin') {
    btnNotif.style.display  = 'none';
  } else {
    btnNotif.style.display  = '';
    btnNotif.onclick = () => {
      window.showPage('page-owner-notices');
      window.renderOwnerNotices?.();
    };
  }
}

// ── Nav icons ─────────────────────────────────────────────────
const SVG_TREND = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="22" height="22"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
const SVG_GRID4 = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" width="22" height="22"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`;

// Submenu-sized icons (19px)
const SVG_S_DASH  = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`;
const SVG_S_PAY   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><rect x="3" y="6" width="18" height="13" rx="2"/><path d="M16 12.5a1.5 1.5 0 1 0 0 3H21v-3z"/><path d="M6 9h9"/></svg>`;
const SVG_S_EXP   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`;
const SVG_S_USERS = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
const SVG_S_BELL  = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>`;
const SVG_S_CLAIM = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`;
const SVG_S_PROV  = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`;
const SVG_S_SETT   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
const SVG_S_REPORT = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M9 17v-2m3 2v-4m3 4v-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"/></svg>`;
const SVG_S_VOTE   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l-2 2 4 4"/></svg>`;
const SVG_S_VISIT  = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path stroke-linecap="round" stroke-linejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9"/></svg>`;
const SVG_S_RESV   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/><path d="M8 14h.01M12 14h.01M16 14h.01M8 18h.01M12 18h.01"/></svg>`;
const SVG_S_SPACE  = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>`;
const SVG_S_SUPPORT = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M18 10a6 6 0 10-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9"/><path d="M13.73 21a2 2 0 01-3.46 0"/><path d="M9.5 9a2.5 2.5 0 115 0c0 1.5-1 2-2.5 3v1"/></svg>`;
const SVG_S_PROF   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`;
const SVG_S_SALARY = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><rect x="2" y="7" width="20" height="14" rx="2" ry="2"/><path d="M16 7V5a2 2 0 00-2-2h-4a2 2 0 00-2 2v2"/><line x1="12" y1="12" x2="12" y2="16"/><line x1="10" y1="14" x2="14" y2="14"/></svg>`;
const SVG_S_EMP    = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M20 21v-2a4 4 0 00-4-4H8a4 4 0 00-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>`;
// Nav-bar sized profile icon (22px)
const SVG_PROFILE  = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" width="22" height="22"><path d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z"/></svg>`;

// ── Nav group definitions ─────────────────────────────────────
const ADMIN_NAV_GROUPS = {
  finanzas: {
    label: 'Finanzas',
    pages: ['page-admin-dashboard', 'page-admin-payments', 'page-admin-expenses', 'page-admin-report', 'page-admin-employees', 'page-admin-salaries'],
    items: [
      { page: 'page-admin-dashboard', label: 'Dashboard', fn: 'renderAdminDashboard', icon: SVG_S_DASH   },
      { page: 'page-admin-payments',  label: 'Pagos',     fn: 'renderAdminPayments',  icon: SVG_S_PAY    },
      { page: 'page-admin-expenses',  label: 'Gastos',    fn: 'renderAdminExpenses',  icon: SVG_S_EXP    },
      { page: 'page-admin-report',    label: 'Informe',   fn: 'renderAdminReport',    icon: SVG_S_REPORT },
      { page: 'page-admin-employees', label: 'Empleados', fn: 'renderAdminEmployees', icon: SVG_S_EMP    },
      { page: 'page-admin-salaries',  label: 'Sueldos',   fn: 'renderAdminSalaries',  icon: SVG_S_SALARY },
    ],
  },
  comunidad: {
    label: 'Comunidad',
    pages: ['page-admin-owners', 'page-admin-units', 'page-admin-notices', 'page-admin-claims', 'page-admin-votes', 'page-admin-visits', 'page-admin-reservations', 'page-admin-spaces'],
    items: [
      { page: 'page-admin-owners',        label: 'Propietarios', fn: 'renderOwnersList',        icon: SVG_S_USERS },
      { page: 'page-admin-units',         label: 'Unidades',     fn: 'renderAdminUnits',        icon: SVG_S_SPACE },
      { page: 'page-admin-notices',       label: 'Comunicados',  fn: 'renderAdminNotices',       icon: SVG_S_BELL  },
      { page: 'page-admin-claims',        label: 'Reclamos',     fn: 'renderAdminClaims',        icon: SVG_S_CLAIM },
      { page: 'page-admin-votes',         label: 'Votaciones',   fn: 'renderAdminVotes',         icon: SVG_S_VOTE  },
      { page: 'page-admin-visits',        label: 'Visitas',      fn: 'renderAdminVisits',        icon: SVG_S_VISIT },
      { page: 'page-admin-reservations',  label: 'Reservas',     fn: 'renderAdminReservations',  icon: SVG_S_RESV  },
      { page: 'page-admin-spaces',        label: 'Espacios',     fn: 'renderAdminSpaces',        icon: SVG_S_SPACE },
    ],
  },
  mas: {
    label: 'Más',
    pages: ['page-admin-providers', 'page-admin-settings'],
    items: [
      { page: 'page-admin-providers', label: 'Proveedores',   fn: 'renderAdminProviders', icon: SVG_S_PROV },
      { page: 'page-admin-settings',  label: 'Configuración', fn: 'renderAdminSettings',  icon: SVG_S_SETT },
    ],
  },
};

const OWNER_NAV_GROUPS = {
  comunidad: {
    label: 'Comunidad',
    pages: ['page-owner-notices', 'page-owner-claims', 'page-owner-expenses', 'page-owner-votes', 'page-owner-visits', 'page-owner-reservations'],
    items: [
      { page: 'page-owner-expenses',     label: 'Gastos',      fn: 'renderOwnerExpenses',     icon: SVG_S_EXP   },
      { page: 'page-owner-notices',      label: 'Comunicados', fn: 'renderOwnerNotices',      icon: SVG_S_BELL  },
      { page: 'page-owner-claims',       label: 'Reclamos',    fn: 'renderOwnerClaims',       icon: SVG_S_CLAIM },
      { page: 'page-owner-votes',        label: 'Votaciones',  fn: 'renderOwnerVotes',        icon: SVG_S_VOTE  },
      { page: 'page-owner-visits',       label: 'Visitas',     fn: 'renderOwnerVisits',       icon: SVG_S_VISIT },
      { page: 'page-owner-reservations', label: 'Reservas',    fn: 'renderOwnerReservations', icon: SVG_S_RESV  },
    ],
  },
  cuenta: {
    label: 'Mi cuenta',
    pages: ['page-owner-profile'],
    items: [
      { page: 'page-owner-profile', label: 'Mi perfil', fn: 'renderOwnerProfile', icon: SVG_S_PROF },
    ],
  },
};

// ── Submenu state & helpers ───────────────────────────────────
let _navOpenGroup    = null;
let _navCurrentGroups = null;

function navOpenGroup(group) {
  const submenu = document.getElementById('nav-submenu');
  if (!submenu) return;
  _navOpenGroup = group;
  const groupDef   = _navCurrentGroups[group];
  const activePage = document.querySelector('.page.active')?.id || '';
  const visibleItems = groupDef.items.filter(item => {
    const feature = PAGE_FEATURE_MAP[item.page];
    return !feature || isFeatureEnabled(feature);
  });
  submenu.innerHTML =
    `<div class="nav-submenu-title">${groupDef.label}</div>` +
    visibleItems.map(item =>
      `<button class="nav-submenu-item${activePage === item.page ? ' active' : ''}" onclick="navGoToPage('${item.page}','${item.fn}')">${item.icon}<span>${item.label}</span></button>`
    ).join('');
  submenu.classList.add('open');
  const bd = document.getElementById('nav-submenu-backdrop');
  if (bd) bd.style.display = 'block';
}

function navCloseSubmenu() {
  _navOpenGroup = null;
  document.getElementById('nav-submenu')?.classList.remove('open');
  const bd = document.getElementById('nav-submenu-backdrop');
  if (bd) bd.style.display = 'none';
}

window.navCloseSubmenu = navCloseSubmenu;

window.navToggleGroup = function(group) {
  if (_navOpenGroup === group) {
    navCloseSubmenu();
  } else {
    navOpenGroup(group);
  }
};

window.navGoToPage = function(pageId, renderFn) {
  navCloseSubmenu();
  window.showPage(pageId);
  window[renderFn]?.();
};

// ── setupNav ──────────────────────────────────────────────────
export function setupNav() {
  const nav = document.getElementById('bottom-nav');

  // Clean up previous submenu elements (e.g. on re-login)
  document.getElementById('nav-submenu-backdrop')?.remove();
  document.getElementById('nav-submenu')?.remove();

  // Create backdrop + submenu panel
  const backdrop = document.createElement('div');
  backdrop.id = 'nav-submenu-backdrop';
  backdrop.className = 'nav-submenu-backdrop';
  backdrop.style.display = 'none';
  backdrop.onclick = navCloseSubmenu;

  const submenu = document.createElement('div');
  submenu.id = 'nav-submenu';
  submenu.className = 'nav-submenu';

  const appShell = document.getElementById('app-shell');
  appShell.insertBefore(backdrop, nav);
  appShell.insertBefore(submenu, nav);

  if (state.role === 'admin') {
    _navCurrentGroups = ADMIN_NAV_GROUPS;
    nav.innerHTML = `
      <button class="nav-item active" data-page="page-admin-home" onclick="showPage('page-admin-home');renderAdminHome()">${SVG.home}<span>Inicio</span></button>
      <button class="nav-item" data-pages="page-admin-dashboard,page-admin-payments,page-admin-expenses,page-admin-report,page-admin-employees,page-admin-salaries" onclick="navToggleGroup('finanzas')">${SVG_TREND}<span>Finanzas</span></button>
      <button class="nav-item" data-pages="page-admin-owners,page-admin-units,page-admin-notices,page-admin-claims,page-admin-votes,page-admin-visits,page-admin-reservations,page-admin-spaces" onclick="navToggleGroup('comunidad')">${SVG.users}<span>Comunidad</span></button>
      <button class="nav-item" data-pages="page-admin-providers,page-admin-settings" onclick="navToggleGroup('mas')">${SVG_GRID4}<span>Más</span></button>`;
  } else {
    _navCurrentGroups = OWNER_NAV_GROUPS;
    nav.innerHTML = `
      <button class="bn-item is-active" data-page="page-owner-home" onclick="showPage('page-owner-home');renderOwnerHome()">${svgIcon('home',22)}<span>Inicio</span></button>
      <button class="bn-item" data-pages="page-owner-pay,page-owner-history" onclick="showPage('page-owner-pay');renderUploadPage()">${svgIcon('wallet',22)}<span>Pagar</span></button>
      <button class="bn-item" data-pages="page-owner-notices,page-owner-claims,page-owner-expenses,page-owner-votes,page-owner-visits,page-owner-reservations" onclick="navToggleGroup('comunidad')">${svgIcon('community',22)}<span>Comunidad</span></button>
      <button class="bn-item" data-page="page-owner-profile" onclick="showPage('page-owner-profile');renderOwnerProfile()">${svgIcon('profile',22)}<span>Perfil</span></button>`;
  }
}

// ── Logout ────────────────────────────────────────────────────
export function logout() {
  if (window.Sentry) Sentry.onLoad(() => Sentry.setUser(null));
  clearToken();
  cache.clear();
  setState({ role: null, user: null, features: {} });
  document.getElementById('app-shell').style.display    = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  ['login-email', 'login-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  showLoginView();
}

document.getElementById('btn-logout').addEventListener('click', logout);

window.togglePassword       = togglePassword;
window.showForgotView       = showForgotView;
window.showLoginView        = showLoginView;
window.submitForgotPassword = submitForgotPassword;
window.submitResetPassword  = submitResetPassword;
window.enterApp             = enterApp;
window.setupTopBar          = setupTopBar;
window.setupNav             = setupNav;
window.logout               = logout;
