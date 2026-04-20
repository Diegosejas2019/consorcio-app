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
  if (window.Sentry) Sentry.onLoad(() => Sentry.setUser({ id: state.user._id, email: state.user.email, role: state.role }));
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

// ── Nav icons ─────────────────────────────────────────────────
const SVG_TREND = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="22" height="22"><polyline points="23 6 13.5 15.5 8.5 10.5 1 18"/><polyline points="17 6 23 6 23 12"/></svg>`;
const SVG_GRID4 = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.75" width="22" height="22"><rect x="3" y="3" width="7" height="7" rx="1.5"/><rect x="14" y="3" width="7" height="7" rx="1.5"/><rect x="3" y="14" width="7" height="7" rx="1.5"/><rect x="14" y="14" width="7" height="7" rx="1.5"/></svg>`;

// Submenu-sized icons (19px)
const SVG_S_DASH  = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`;
const SVG_S_EXP   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M17 9V7a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2m2 4h10a2 2 0 002-2v-6a2 2 0 00-2-2H9a2 2 0 00-2 2v6a2 2 0 002 2zm7-5a2 2 0 11-4 0 2 2 0 014 0z"/></svg>`;
const SVG_S_USERS = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
const SVG_S_BELL  = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>`;
const SVG_S_CLAIM = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`;
const SVG_S_PROV  = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4"/></svg>`;
const SVG_S_SETT   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`;
const SVG_S_REPORT = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M9 17v-2m3 2v-4m3 4v-6M4 5h16a1 1 0 011 1v12a1 1 0 01-1 1H4a1 1 0 01-1-1V6a1 1 0 011-1z"/></svg>`;
const SVG_S_VOTE   = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="19" height="19"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7l-2 2 4 4"/></svg>`;

// ── Nav group definitions ─────────────────────────────────────
const ADMIN_NAV_GROUPS = {
  finanzas: {
    label: 'Finanzas',
    pages: ['page-admin-dashboard', 'page-admin-expenses', 'page-admin-report'],
    items: [
      { page: 'page-admin-dashboard', label: 'Dashboard', fn: 'renderAdminDashboard', icon: SVG_S_DASH   },
      { page: 'page-admin-expenses',  label: 'Gastos',    fn: 'renderAdminExpenses',  icon: SVG_S_EXP    },
      { page: 'page-admin-report',    label: 'Informe',   fn: 'renderAdminReport',    icon: SVG_S_REPORT },
    ],
  },
  comunidad: {
    label: 'Comunidad',
    pages: ['page-admin-owners', 'page-admin-notices', 'page-admin-claims', 'page-admin-votes'],
    items: [
      { page: 'page-admin-owners',  label: 'Propietarios', fn: 'renderOwnersList',   icon: SVG_S_USERS },
      { page: 'page-admin-notices', label: 'Avisos',       fn: 'renderAdminNotices', icon: SVG_S_BELL  },
      { page: 'page-admin-claims',  label: 'Reclamos',     fn: 'renderAdminClaims',  icon: SVG_S_CLAIM },
      { page: 'page-admin-votes',   label: 'Votaciones',   fn: 'renderAdminVotes',   icon: SVG_S_VOTE  },
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
    pages: ['page-owner-notices', 'page-owner-claims', 'page-owner-expenses', 'page-owner-votes'],
    items: [
      { page: 'page-owner-expenses', label: 'Gastos',      fn: 'renderOwnerExpenses', icon: SVG_S_EXP   },
      { page: 'page-owner-notices',  label: 'Avisos',      fn: 'renderOwnerNotices',  icon: SVG_S_BELL  },
      { page: 'page-owner-claims',   label: 'Reclamos',    fn: 'renderOwnerClaims',   icon: SVG_S_CLAIM },
      { page: 'page-owner-votes',    label: 'Votaciones',  fn: 'renderOwnerVotes',    icon: SVG_S_VOTE  },
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
  submenu.innerHTML =
    `<div class="nav-submenu-title">${groupDef.label}</div>` +
    groupDef.items.map(item =>
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
      <button class="nav-item" data-pages="page-admin-dashboard,page-admin-expenses" onclick="navToggleGroup('finanzas')">${SVG_TREND}<span>Finanzas</span></button>
      <button class="nav-item" data-pages="page-admin-owners,page-admin-notices,page-admin-claims,page-admin-votes" onclick="navToggleGroup('comunidad')">${SVG.users}<span>Comunidad</span></button>
      <button class="nav-item" data-pages="page-admin-providers,page-admin-settings" onclick="navToggleGroup('mas')">${SVG_GRID4}<span>Más</span></button>`;
  } else {
    _navCurrentGroups = OWNER_NAV_GROUPS;
    nav.innerHTML = `
      <button class="nav-item active" data-page="page-owner-home"    onclick="showPage('page-owner-home');renderOwnerHome()">${SVG.home}<span>Inicio</span></button>
      <button class="nav-item"        data-page="page-owner-pay"     onclick="showPage('page-owner-pay');renderUploadPage()">${SVG.upload}<span>Pagar</span></button>
      <button class="nav-item"        data-page="page-owner-history" onclick="showPage('page-owner-history');renderOwnerHistory()">${SVG.list}<span>Historial</span></button>
      <button class="nav-item" data-pages="page-owner-notices,page-owner-claims,page-owner-expenses,page-owner-votes" onclick="navToggleGroup('comunidad')">${SVG.bell}<span>Comunidad</span></button>`;
  }
}

// ── Logout ────────────────────────────────────────────────────
export function logout() {
  if (window.Sentry) Sentry.onLoad(() => Sentry.setUser(null));
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
