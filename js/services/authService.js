import { state, setState, cache } from '../core/state.js';
import { showLoading, showSessionRestoreError } from '../ui/loading.js';
import { toast } from '../ui/toast.js';
import { SVG } from '../ui/icons.js';
import { showInstallBanner, isStandalone } from '../ui/pwa.js';
import { updateOnlineStatus } from '../ui/offline.js';
import { setupPushNotifications, checkMonthlyReminder } from './pushService.js';

// ── Toggle visibilidad de contraseña ─────────────────────────
export function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

// ── Login / Forgot Password / Reset Password ──────────────────
let loginRole   = 'owner';
let _resetToken = null;

export function showForgotView() {
  document.getElementById('role-tabs-container').classList.add('hidden');
  document.getElementById('owner-fields').classList.add('hidden');
  document.getElementById('admin-fields').classList.add('hidden');
  document.getElementById('btn-login').classList.add('hidden');
  document.getElementById('forgot-link').classList.add('hidden');
  document.getElementById('forgot-view').classList.remove('hidden');
  document.getElementById('forgot-email').focus();
}

export function showLoginView() {
  document.getElementById('role-tabs-container').classList.remove('hidden');
  document.getElementById(loginRole === 'owner' ? 'owner-fields' : 'admin-fields').classList.remove('hidden');
  document.getElementById('btn-login').classList.remove('hidden');
  document.getElementById('forgot-link').classList.remove('hidden');
  document.getElementById('forgot-view').classList.add('hidden');
}

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
    setState({ role: res.data.user.role, user: res.data.user });
    window.history.replaceState({}, '', window.location.pathname);
    document.getElementById('reset-screen').style.display = 'none';
    cache.clear();
    toast('Contraseña actualizada correctamente', 'success');
    enterApp();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Role tabs ─────────────────────────────────────────────────
document.querySelectorAll('.role-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    loginRole = tab.dataset.role;
    document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('owner-fields').classList.toggle('hidden', loginRole !== 'owner');
    document.getElementById('admin-fields').classList.toggle('hidden', loginRole !== 'admin');
  });
});

// ── Login button ──────────────────────────────────────────────
document.getElementById('btn-login').addEventListener('click', async () => {
  const emailField = loginRole === 'admin' ? 'admin-email' : 'owner-email';
  const passField  = loginRole === 'admin' ? 'admin-pass'  : 'owner-pass';
  const email      = document.getElementById(emailField).value.trim();
  const password   = document.getElementById(passField).value.trim();
  if (!email || !password) { toast('Completá email y contraseña', 'error'); return; }
  const remember = document.getElementById('remember-me')?.checked ?? true;
  try {
    showLoading(true);
    const res = await api.auth.login(email, password);
    setToken(res.token, remember);
    setState({ role: res.data.user.role, user: res.data.user });
    cache.clear();
    enterApp();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
});

// ── Restaurar sesión / detectar reset token ───────────────────
window.addEventListener('DOMContentLoaded', async () => {
  updateOnlineStatus();

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
    setState({ role: res.data.user.role, user: res.data.user });
    enterApp();
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
  if (window.Sentry) Sentry.setUser({ id: state.user._id, email: state.user.email, role: state.role });
  if (state.role === 'admin') {
    window.renderAdminView();
    setupPushNotifications();
  } else {
    window.renderOwnerView();
    setupPushNotifications();
    checkMonthlyReminder();
  }
  if (!isStandalone()) {
    setTimeout(showInstallBanner, 4000);
  }
}

// ── setupTopBar ───────────────────────────────────────────────
export function setupTopBar() {
  const initials = state.user.name.split(' ').slice(0, 2).map(w => w[0]).join('');
  document.getElementById('avatar').textContent    = initials;
  document.getElementById('user-name').textContent = state.user.name;
  document.getElementById('user-role').textContent = state.role === 'admin' ? 'Administrador' : (state.user.unit || '');
}

// ── setupNav ──────────────────────────────────────────────────
export function setupNav() {
  const nav = document.getElementById('bottom-nav');
  const SVG_DASH     = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`;
  const SVG_EXPENSE  = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`;
  const SVG_PROVIDER = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`;
  if (state.role === 'admin') {
    nav.innerHTML = `
      <button class="nav-item active" data-page="page-admin-home"      onclick="showPage('page-admin-home');renderAdminHome()">${SVG.home}<span>Inicio</span></button>
      <button class="nav-item"        data-page="page-admin-dashboard"  onclick="showPage('page-admin-dashboard');renderAdminDashboard()">${SVG_DASH}<span>Dashboard</span></button>
      <button class="nav-item"        data-page="page-admin-owners"     onclick="showPage('page-admin-owners');renderOwnersList()">${SVG.users}<span>Propietarios</span></button>
      <button class="nav-item"        data-page="page-admin-expenses"   onclick="showPage('page-admin-expenses');renderAdminExpenses()">${SVG_EXPENSE}<span>Gastos</span></button>
      <button class="nav-item"        data-page="page-admin-providers"  onclick="showPage('page-admin-providers');renderAdminProviders()">${SVG_PROVIDER}<span>Proveedores</span></button>
      <button class="nav-item"        data-page="page-admin-notices"    onclick="showPage('page-admin-notices');renderAdminNotices()">${SVG.bell}<span>Avisos</span></button>
      <button class="nav-item"        data-page="page-admin-claims"     onclick="showPage('page-admin-claims');renderAdminClaims()">${SVG.claim}<span>Reclamos</span></button>
      <button class="nav-item"        data-page="page-admin-settings"   onclick="showPage('page-admin-settings');renderAdminSettings()">${SVG.settings}<span>Config</span></button>`;
  } else {
    nav.innerHTML = `
      <button class="nav-item active" data-page="page-owner-home"    onclick="showPage('page-owner-home');renderOwnerHome()">${SVG.home}<span>Inicio</span></button>
      <button class="nav-item"        data-page="page-owner-pay"     onclick="showPage('page-owner-pay');renderUploadPage()">${SVG.upload}<span>Pagar</span></button>
      <button class="nav-item"        data-page="page-owner-history" onclick="showPage('page-owner-history');renderOwnerHistory()">${SVG.list}<span>Historial</span></button>
      <button class="nav-item"        data-page="page-owner-notices" onclick="showPage('page-owner-notices');renderOwnerNotices()">${SVG.bell}<span>Avisos</span></button>
      <button class="nav-item"        data-page="page-owner-claims"  onclick="showPage('page-owner-claims');renderOwnerClaims()">${SVG.claim}<span>Reclamos</span></button>`;
  }
}

// ── Logout ────────────────────────────────────────────────────
export function logout() {
  if (window.Sentry) Sentry.setUser(null);
  clearToken();
  cache.clear();
  setState({ role: null, user: null });
  document.getElementById('app-shell').style.display    = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  ['owner-email', 'owner-pass', 'admin-email', 'admin-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

document.getElementById('btn-logout').addEventListener('click', logout);

window.togglePassword       = togglePassword;
window.showForgotView       = showForgotView;
window.showLoginView        = showLoginView;
window.submitForgotPassword = submitForgotPassword;
window.submitResetPassword  = submitResetPassword;
window.enterApp             = enterApp;
window.setupTopBar          = setupTopBar;
window.logout               = logout;
