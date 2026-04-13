/* ═══════════════════════════════════════════════
   Mi Consorcio — App Logic (integrado con API)
   ═══════════════════════════════════════════════ */

// ── Estado global ─────────────────────────────────────────────
let state = { role: null, user: null };

// ── Estado del dashboard ──────────────────────────────────────
let _dashYear    = new Date().getFullYear();
let _dashMonthly = [];
let _dashStats   = {};

// ── Cache liviano para evitar requests redundantes ────────────
let _cache = {};
const cache = {
  set: (key, val, ttlMs = 30000) => { _cache[key] = { val, exp: Date.now() + ttlMs }; },
  get: (key) => { const e = _cache[key]; return e && e.exp > Date.now() ? e.val : null; },
  del: (key) => { delete _cache[key]; },
  clear: () => { _cache = {}; },
};

// ── Sesión expirada ───────────────────────────────────────────
window.addEventListener('auth:expired', () => {
  toast('Sesión expirada. Iniciá sesión nuevamente.', 'error');
  logout();
});

// ── PWA Install Banner ────────────────────────────────────────
let _installPrompt = null;
const INSTALL_DISMISSED_KEY = 'install_dismissed_until';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches ||
  window.navigator.standalone === true;

const installDismissed = () => {
  const until = localStorage.getItem(INSTALL_DISMISSED_KEY);
  return until && Date.now() < parseInt(until, 10);
};

window.addEventListener('beforeinstallprompt', (e) => {
  e.preventDefault();
  _installPrompt = e;
});

window.addEventListener('appinstalled', () => {
  _installPrompt = null;
  hideInstallBanner();
  toast('App instalada correctamente.', 'success');
});

function showInstallBanner() {
  if (isStandalone() || installDismissed()) return;
  document.getElementById('install-banner')?.classList.remove('hidden');
}

function hideInstallBanner() {
  document.getElementById('install-banner')?.classList.add('hidden');
}

async function handleInstallClick() {
  if (_installPrompt) {
    _installPrompt.prompt();
    const { outcome } = await _installPrompt.userChoice;
    if (outcome === 'accepted') {
      _installPrompt = null;
      hideInstallBanner();
    }
  } else {
    hideInstallBanner();
    _showInstallInstructionsModal();
  }
}

function dismissInstallBanner() {
  hideInstallBanner();
  // No volver a mostrar por 7 días
  localStorage.setItem(INSTALL_DISMISSED_KEY, Date.now() + 7 * 24 * 60 * 60 * 1000);
}

function _showInstallInstructionsModal() {
  const ua = navigator.userAgent;
  let instructions;
  if (/iphone|ipad|ipod/i.test(ua)) {
    instructions = 'En Safari, tocá el botón <strong>Compartir ⬆️</strong> en la barra inferior y luego <strong>"Agregar a pantalla de inicio"</strong>.';
  } else if (/firefox/i.test(ua)) {
    instructions = 'En Firefox, abrí el menú <strong>⋮</strong> y tocá <strong>"Instalar"</strong>.';
  } else {
    instructions = 'Abrí el menú del navegador <strong>⋮</strong> y buscá <strong>"Instalar app"</strong> o <strong>"Agregar a pantalla de inicio"</strong>.';
  }
  openModal(`
    <div style="text-align:center;padding:.5rem 0">
      <img src="icons/icon-192.png" alt="" style="width:64px;height:64px;border-radius:16px;margin-bottom:1rem">
      <h2 style="margin-bottom:.75rem">Instalar Mi Consorcio</h2>
      <p style="color:var(--muted);font-size:.9rem;line-height:1.7">${instructions}</p>
      <button class="btn btn-primary w-full" style="margin-top:1.5rem" onclick="closeModal()">Entendido</button>
    </div>`);
}

// ── Toast ─────────────────────────────────────────────────────
function toast(msg, type = 'default') {
  const c = document.getElementById('toast-container');
  const t = document.createElement('div');
  t.className = `toast ${type}`;
  const icons = { success: '✓', error: '✕', default: 'ℹ' };
  t.innerHTML = `<span>${icons[type] || 'ℹ'}</span><span>${msg}</span>`;
  c.appendChild(t);
  setTimeout(() => { t.style.animation = 'slideOut .3s ease forwards'; setTimeout(() => t.remove(), 300); }, 3500);
}

// ── Loading overlay ───────────────────────────────────────────
function showLoading(show = true) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

// ── Wrapper para llamadas a API con loading + errores ─────────
async function apiCall(fn, opts = {}) {
  const { loading = true, silent = false } = opts;
  if (loading) showLoading(true);
  try {
    const result = await fn();
    return result;
  } catch (err) {
    if (!silent) toast(err.message, 'error');
    throw err;
  } finally {
    if (loading) showLoading(false);
  }
}

// ── Routing ───────────────────────────────────────────────────
function showPage(id) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  document.getElementById(id)?.classList.add('active');
  document.querySelectorAll('.nav-item').forEach(n => {
    n.classList.toggle('active', n.dataset.page === id);
  });
}

// ── Toggle visibilidad de contraseña ─────────────────────────
function togglePassword(inputId, btn) {
  const input = document.getElementById(inputId);
  if (!input) return;
  const show = input.type === 'password';
  input.type = show ? 'text' : 'password';
  btn.textContent = show ? '🙈' : '👁';
}

// ═══════════════════════════════════════════
// LOGIN / FORGOT PASSWORD / RESET PASSWORD
// ═══════════════════════════════════════════
let loginRole   = 'owner';
let _resetToken = null;

function showForgotView() {
  document.getElementById('role-tabs-container').classList.add('hidden');
  document.getElementById('owner-fields').classList.add('hidden');
  document.getElementById('admin-fields').classList.add('hidden');
  document.getElementById('btn-login').classList.add('hidden');
  document.getElementById('forgot-link').classList.add('hidden');
  document.getElementById('forgot-view').classList.remove('hidden');
  document.getElementById('forgot-email').focus();
}

function showLoginView() {
  document.getElementById('role-tabs-container').classList.remove('hidden');
  document.getElementById(loginRole === 'owner' ? 'owner-fields' : 'admin-fields').classList.remove('hidden');
  document.getElementById('btn-login').classList.remove('hidden');
  document.getElementById('forgot-link').classList.remove('hidden');
  document.getElementById('forgot-view').classList.add('hidden');
}

async function submitForgotPassword() {
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

async function submitResetPassword() {
  const newPassword = document.getElementById('reset-pass').value.trim();
  const confirmPass = document.getElementById('reset-pass-confirm').value.trim();

  if (newPassword.length < 6) { toast('La contraseña debe tener al menos 6 caracteres', 'error'); return; }
  if (newPassword !== confirmPass) { toast('Las contraseñas no coinciden', 'error'); return; }

  try {
    showLoading(true);
    const res = await api.auth.resetPassword(_resetToken, newPassword);
    setToken(res.token);
    state = { role: res.data.user.role, user: res.data.user };
    // Limpiar token de la URL sin recargar la página
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

document.querySelectorAll('.role-tab').forEach(tab => {
  tab.addEventListener('click', () => {
    loginRole = tab.dataset.role;
    document.querySelectorAll('.role-tab').forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    document.getElementById('owner-fields').classList.toggle('hidden', loginRole !== 'owner');
    document.getElementById('admin-fields').classList.toggle('hidden', loginRole !== 'admin');
  });
});

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
    state = { role: res.data.user.role, user: res.data.user };
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
  // Si hay ?token= en la URL → flujo de reset password
  const params = new URLSearchParams(window.location.search);
  const resetToken = params.get('token');
  if (resetToken) {
    _resetToken = resetToken;
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('reset-screen').style.display = 'flex';
    return;
  }

  // Intentar restaurar sesión con token guardado
  const token = getToken();
  if (!token) return;
  try {
    const res = await api.auth.getMe();
    state = { role: res.data.user.role, user: res.data.user };
    enterApp();
  } catch {
    clearToken();
  }
});

// ── Iniciar app post-login ────────────────────────────────────
function enterApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-shell').style.display    = 'flex';
  setupNav();
  setupTopBar();
  if (state.role === 'admin') {
    renderAdminView();
    setupPushNotifications();
  } else {
    renderOwnerView();
    setupPushNotifications();
    checkMonthlyReminder();
  }
  // Mostrar banner de instalación a los 4 segundos si no está instalada
  if (!isStandalone()) {
    setTimeout(showInstallBanner, 4000);
  }
}

function setupTopBar() {
  const initials = state.user.name.split(' ').slice(0,2).map(w => w[0]).join('');
  document.getElementById('avatar').textContent    = initials;
  document.getElementById('user-name').textContent = state.user.name;
  document.getElementById('user-role').textContent = state.role === 'admin' ? 'Administrador' : (state.user.unit || '');
}

function setupNav() {
  const nav = document.getElementById('bottom-nav');
  const SVG_DASH = `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="22" height="22"><path d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z"/></svg>`;
  if (state.role === 'admin') {
    nav.innerHTML = `
      <button class="nav-item active" data-page="page-admin-home"      onclick="showPage('page-admin-home');renderAdminHome()">${SVG.home}<span>Inicio</span></button>
      <button class="nav-item"        data-page="page-admin-dashboard"  onclick="showPage('page-admin-dashboard');renderAdminDashboard()">${SVG_DASH}<span>Dashboard</span></button>
      <button class="nav-item"        data-page="page-admin-owners"     onclick="showPage('page-admin-owners');renderOwnersList()">${SVG.users}<span>Propietarios</span></button>
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
document.getElementById('btn-logout').addEventListener('click', logout);
function logout() {
  clearToken();
  cache.clear();
  state = { role: null, user: null };
  document.getElementById('app-shell').style.display   = 'none';
  document.getElementById('login-screen').style.display = 'flex';
  ['owner-email','owner-pass','admin-email','admin-pass'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
}

// ── SVG Icons ─────────────────────────────────────────────────
const SVG = {
  home:     `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6"/></svg>`,
  users:    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
  bell:     `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9"/></svg>`,
  settings: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z"/><path d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"/></svg>`,
  upload:   `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"/></svg>`,
  list:     `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-3 7h3m-3 4h3m-6-4h.01M9 16h.01"/></svg>`,
  check:    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M5 13l4 4L19 7"/></svg>`,
  x:        `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M6 18L18 6M6 6l12 12"/></svg>`,
  logout:   `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1"/></svg>`,
  download: `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" y1="15" x2="12" y2="3"/></svg>`,
  claim:    `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2"><path d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2m-6 9l2 2 4-4"/></svg>`,
  pdf:      `<svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="1.5" width="28" height="28"><path d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"/><path d="M13 3v5a1 1 0 001 1h5M9 13h1.5a1 1 0 010 2H9v-4h1.5a1 1 0 010 2" stroke-linecap="round"/></svg>`,
};

// ── Skeleton loader ───────────────────────────────────────────
function skeleton(lines = 3) {
  return Array.from({ length: lines }, () =>
    `<div style="height:18px;background:linear-gradient(90deg,#e8eaed 25%,#f3f4f6 50%,#e8eaed 75%);background-size:200%;border-radius:6px;margin-bottom:10px;animation:shimmer 1.4s infinite"></div>`
  ).join('');
}

// ═══════════════════════════════════════════
// OWNER VIEWS
// ═══════════════════════════════════════════
function renderOwnerView() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  showPage('page-owner-home');
  renderOwnerHome();
}

async function renderOwnerHome() {
  const el = document.getElementById('page-owner-home');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(5)}</div>`;

  try {
    const [cfgRes, payRes] = await Promise.all([
      api.config.get(),
      api.payments.getAll({ limit: 10 }),
    ]);

    const cfg      = cfgRes.data.config;
    const payments = payRes.data.payments;
    const owner    = state.user;

    const pending  = payments.filter(p => p.status === 'pending').length;
    const lastPay  = payments.find(p => p.status === 'approved');
    const balance  = owner.balance || 0;
    const isDebtor = owner.isDebtor;

    const balanceColor = balance < 0 ? 'var(--danger)' : 'var(--success)';
    const balanceBadge = isDebtor ? 'badge-danger' : 'badge-success';
    const balanceLabel = isDebtor ? 'Deuda pendiente' : 'Al día';

    // Avisos recientes
    let noticesHtml = '';
    try {
      const notRes = await api.notices.getAll({ limit: 2 });
      noticesHtml = notRes.data.notices.map(n => noticeCard(n)).join('');
    } catch { noticesHtml = ''; }

    el.innerHTML = `
      <div class="flex col gap-3">
        <div>
          <p class="text-muted text-sm">Bienvenido/a,</p>
          <h1>${owner.name}</h1>
          <small>${[owner.unit, owner.phone].filter(Boolean).join(' · ')}</small>
        </div>

        <div class="card">
          <div class="card-header flex between">
            <h3>Estado de Cuenta</h3>
            <span class="badge ${balanceBadge}">${balanceLabel}</span>
          </div>
          <div class="card-body flex col gap-2">
            <div class="flex between">
              <span class="text-muted text-sm">Saldo</span>
              <span class="bold" style="font-size:1.5rem;color:${balanceColor}">
                ${balance < 0 ? '-' : ''}$${Math.abs(balance).toLocaleString('es-AR')}
              </span>
            </div>
            <div class="flex between">
              <span class="text-muted text-sm">Expensa del mes</span>
              <span class="bold">$${(cfg.expenseAmount || 0).toLocaleString('es-AR')}</span>
            </div>
            <div class="flex between">
              <span class="text-muted text-sm">Período actual</span>
              <span>${cfg.expenseMonth || ''}</span>
            </div>
            ${pending > 0 ? `<div style="background:var(--warning-lt);color:var(--warning);padding:.6rem .9rem;border-radius:8px;font-size:.82rem;font-weight:500;">⚠ Tenés ${pending} comprobante${pending > 1 ? 's' : ''} pendiente${pending > 1 ? 's' : ''} de revisión.</div>` : ''}
            <button class="btn-upload-cta" onclick="showPage('page-owner-pay');renderUploadPage()">
              <span class="btn-upload-cta-icon">${SVG.upload}</span>
              <span class="btn-upload-cta-text">
                <span class="btn-upload-cta-label">Subir Comprobante</span>
                <span class="btn-upload-cta-sub">PDF · pago del mes</span>
              </span>
              <span class="btn-upload-cta-arrow">›</span>
            </button>
          </div>
        </div>

        ${lastPay ? `
        <div class="card">
          <div class="card-header"><h3>Último Pago Aprobado</h3></div>
          <div class="card-body flex between">
            <div>
              <p class="bold">$${lastPay.amount.toLocaleString('es-AR')}</p>
              <small>${formatMonth(lastPay.month)}</small>
            </div>
            <div class="flex col" style="align-items:flex-end;gap:.3rem">
              <span class="badge badge-success">${SVG.check} Aprobado</span>
              <small>${formatDate(lastPay.createdAt)}</small>
            </div>
          </div>
        </div>` : ''}

        <div>
          <div class="flex between mt-1" style="margin-bottom:.75rem">
            <h2>Avisos recientes</h2>
            <button class="btn btn-ghost btn-sm" onclick="showPage('page-owner-notices');renderOwnerNotices()">Ver todos</button>
          </div>
          <div class="flex col gap-1">
            ${noticesHtml || '<p class="text-muted text-sm">Sin avisos por el momento.</p>'}
          </div>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerHome()');
  }
}

async function renderUploadPage() {
  const el = document.getElementById('page-owner-pay');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;

  try {
    const cfgRes = await api.config.get();
    const cfg    = cfgRes.data.config;
    const months = cfg.paymentPeriods?.length
      ? cfg.paymentPeriods.map(v => ({ value: v, label: formatPeriodLabel(v) }))
      : getRecentMonths(6);

    el.innerHTML = `
      <div class="flex col gap-3">
        <div>
          <h1>Subir Comprobante</h1>
          <p class="text-muted text-sm mt-1">Adjuntá tu comprobante y completá los datos.</p>
        </div>
        <div class="card">
          <div class="card-body flex col gap-2">
            <div class="form-group">
              <label>Período a pagar</label>
              <select class="select" id="pay-month">
                ${months.map(m => `<option value="${m.value}">${m.label}</option>`).join('')}
              </select>
            </div>
            <div class="form-group">
              <label>Importe abonado ($)</label>
              <input class="input" type="number" id="pay-amount" placeholder="${cfg.expenseAmount}" min="1">
            </div>
            <div class="form-group">
              <label>Comprobante de pago (PDF)</label>
              <div class="upload-zone" id="upload-zone" onclick="document.getElementById('file-input').click()">
                <div class="upload-icon-wrap">${SVG.pdf}</div>
                <p class="upload-title">Arrastrá tu PDF aquí</p>
                <p class="upload-desc">o hacé clic para seleccionar</p>
                <span class="upload-badge">Solo PDF · máx. 10 MB</span>
              </div>
              <input type="file" id="file-input" accept=".pdf,application/pdf" class="hidden" onchange="handleFileSelect(event)">
              <div id="file-preview" class="hidden"></div>
            </div>
            <div class="form-group">
              <label>Nota adicional (opcional)</label>
              <textarea class="input" id="pay-note" placeholder="Ej: Transferencia N° 12345..."></textarea>
            </div>
            <button class="btn btn-primary w-full" id="btn-submit-receipt" onclick="submitReceipt()">
              ${SVG.upload} Enviar Comprobante
            </button>
          </div>
        </div>

        <!-- MercadoPago -->
        <div class="card">
          <div class="card-header flex between">
            <h3>💳 Pagar online</h3>
            <span class="badge badge-neutral">MercadoPago</span>
          </div>
          <div class="card-body flex col gap-2">
            <p class="text-sm text-muted">Pagá con tarjeta, débito o saldo de MP. Sin adjuntar comprobante.</p>
            <div class="flex between text-sm">
              <span>Expensa ${cfg.expenseMonth}</span>
              <span class="bold">$${(cfg.expenseAmount || 0).toLocaleString('es-AR')}</span>
            </div>
            <div class="mp-btn-wrap">
              <button onclick="initMercadoPago()">
                <img src="https://http2.mlstatic.com/frontend-assets/mp-web-navigation/svg/mercadopago-logo.svg"
                     alt="MercadoPago" style="height:20px;vertical-align:middle;margin-right:.5rem;filter:brightness(10)">
                Pagar con MercadoPago
              </button>
            </div>
            <p style="font-size:.72rem;color:var(--muted);text-align:center">Serás redirigido al checkout seguro de MercadoPago</p>
          </div>
        </div>
      </div>`;

    // Drag & drop
    const zone = document.getElementById('upload-zone');
    zone.addEventListener('dragover', e => { e.preventDefault(); zone.classList.add('drag'); });
    zone.addEventListener('dragleave', () => zone.classList.remove('drag'));
    zone.addEventListener('drop', e => { e.preventDefault(); zone.classList.remove('drag'); handleFileDrop(e.dataTransfer.files[0]); });
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderUploadPage()');
  }
}

// ── Manejo de archivo ─────────────────────────────────────────
let selectedFile = null;
function handleFileSelect(e) { selectedFile = e.target.files[0]; showFilePreview(selectedFile); }
function handleFileDrop(file)  { selectedFile = file; showFilePreview(file); }
function showFilePreview(file) {
  if (!file) return;
  if (file.type !== 'application/pdf') {
    toast('Solo se aceptan archivos PDF.', 'error');
    clearFile();
    return;
  }
  document.getElementById('upload-zone').classList.add('hidden');
  const preview = document.getElementById('file-preview');
  preview.classList.remove('hidden');
  preview.innerHTML = `
    <div class="upload-preview">
      <div class="upload-preview-icon">${SVG.pdf}</div>
      <div style="flex:1;min-width:0">
        <p class="bold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${file.name}</p>
        <small class="text-muted">${(file.size/1024).toFixed(1)} KB · PDF</small>
      </div>
      <button class="btn-icon" onclick="clearFile()" title="Quitar">✕</button>
    </div>`;
}
function clearFile() {
  selectedFile = null;
  document.getElementById('file-preview').classList.add('hidden');
  document.getElementById('upload-zone').classList.remove('hidden');
  document.getElementById('file-input').value = '';
}

// ── Enviar comprobante ────────────────────────────────────────
async function submitReceipt() {
  const month  = document.getElementById('pay-month')?.value;
  const amount = document.getElementById('pay-amount')?.value;
  const note   = document.getElementById('pay-note')?.value?.trim();

  if (!month)              { toast('Seleccioná el período', 'error'); return; }
  if (!amount || amount < 1){ toast('Ingresá un importe válido', 'error'); return; }
  if (!selectedFile)       { toast('Adjuntá el comprobante en PDF', 'error'); return; }

  const formData = new FormData();
  formData.append('month', month);
  formData.append('amount', amount);
  if (note) formData.append('ownerNote', note);
  formData.append('receipt', selectedFile);

  const btn = document.getElementById('btn-submit-receipt');
  if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

  try {
    await api.payments.create(formData);
    toast('Comprobante enviado. Pendiente de revisión.', 'success');
    clearFile();
    document.getElementById('pay-amount').value = '';
    document.getElementById('pay-note').value   = '';
    // Refrescar home del propietario
    cache.del('owner_home');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    if (btn) { btn.disabled = false; btn.innerHTML = `${SVG.upload} Enviar Comprobante`; }
  }
}

async function renderOwnerHistory() {
  const el = document.getElementById('page-owner-history');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const res      = await api.payments.getAll({ limit: 50 });
    const payments = res.data.payments;
    el.innerHTML = `
      <div class="flex col gap-3">
        <h1>Historial de Pagos</h1>
        ${payments.length === 0
          ? `<div class="card card-body" style="text-align:center;color:var(--muted)">No hay pagos registrados aún.</div>`
          : `<div class="card">
              <div class="table-wrap">
                <table>
                  <thead><tr><th>Período</th><th>Importe</th><th>Canal</th><th>Estado</th><th></th></tr></thead>
                  <tbody>${payments.map(p => `
                    <tr>
                      <td class="bold">${formatMonth(p.month)}</td>
                      <td>$${p.amount.toLocaleString('es-AR')}</td>
                      <td><span style="font-size:.75rem">${p.paymentMethod === 'mercadopago' ? '💳 MP' : '📄 Manual'}</span></td>
                      <td>${statusBadge(p.status)}</td>
                      <td>${p.receipt?.url ? `<button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" title="Descargar comprobante" style="padding:.3rem .5rem">${SVG.download}</button>` : ''}</td>
                    </tr>
                    ${p.rejectionNote ? `<tr><td colspan="5" style="padding:.25rem 1rem .75rem;color:var(--danger);font-size:.78rem">↳ ${p.rejectionNote}</td></tr>` : ''}
                  `).join('')}</tbody>
                </table>
              </div>
            </div>`}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerHistory()');
  }
}

async function renderOwnerNotices() {
  const el = document.getElementById('page-owner-notices');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res = await api.notices.getAll({ limit: 30 });
    el.innerHTML = `
      <div class="flex col gap-3">
        <h1>Avisos y Comunicados</h1>
        <div class="flex col gap-2">
          ${res.data.notices.length
            ? res.data.notices.map(n => noticeCard(n, true)).join('')
            : '<p class="text-muted text-sm">Sin avisos por el momento.</p>'}
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerNotices()');
  }
}

// ═══════════════════════════════════════════
// ADMIN VIEWS
// ═══════════════════════════════════════════
async function renderAdminView() {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  // Si el admin no tiene org configurada, ir directo a Settings para crearla
  if (!state.user?.organization) {
    showPage('page-admin-settings');
    renderAdminSettings();
    return;
  }
  showPage('page-admin-home');
  renderAdminHome();
}

async function renderAdminHome() {
  const el = document.getElementById('page-admin-home');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(5)}</div>`;
  try {
    const [statsRes, pendingRes, cfgRes, claimsRes] = await Promise.all([
      api.owners.getStats(),
      api.payments.getAll({ status: 'pending', limit: 20 }),
      api.config.get(),
      api.claims.getAll({ status: 'open', limit: 10 }),
    ]);

    const stats      = statsRes.data;
    const pending    = pendingRes.data.payments;
    const cfg        = cfgRes.data.config;
    const openClaims = claimsRes.data.claims;

    el.innerHTML = `
      <div class="flex col gap-3">
        <div>
          <p class="text-muted text-sm">Panel de</p>
          <h1>Administración</h1>
          <small>${cfg.consortiumName || 'Consorcio'} · ${cfg.expenseMonth || ''}</small>
        </div>

        <div class="stats-grid">
          <div class="stat-card stat-card-clickable" onclick="openStatDetail('pending')">
            <span class="stat-label">Pendientes</span>
            <span class="stat-value" style="color:var(--warning)">${stats.pendingPayments || 0}</span>
            <span class="stat-sub">por revisar ›</span>
          </div>
          <div class="stat-card stat-card-clickable" onclick="openStatDetail('compliance')">
            <span class="stat-label">Cumplimiento</span>
            <span class="stat-value" style="color:var(--success)">${stats.complianceRate || 0}%</span>
            <span class="stat-sub">${stats.upToDate || 0} de ${stats.totalOwners || 0} ›</span>
          </div>
          <div class="stat-card stat-card-clickable" onclick="openStatDetail('debtors')">
            <span class="stat-label">Morosos</span>
            <span class="stat-value" style="color:var(--danger)">${stats.debtors || 0}</span>
            <span class="stat-sub">propietarios ›</span>
          </div>
          <div class="stat-card stat-card-clickable" onclick="openStatDetail('collected')">
            <span class="stat-label">Recaudado</span>
            <span class="stat-value" style="color:var(--accent);font-size:1.3rem">$${((stats.totalCollected || 0)/1000).toFixed(0)}k</span>
            <span class="stat-sub">histórico ›</span>
          </div>
        </div>

        <div class="card">
          <div class="card-header flex between">
            <h3>Comprobantes Pendientes</h3>
            ${pending.length > 0 ? `<span class="badge badge-warning">${pending.length}</span>` : ''}
          </div>
          <div class="card-body flex col gap-2">
            ${pending.length === 0
              ? '<p class="text-muted text-sm">No hay comprobantes pendientes.</p>'
              : pending.map(p => `
                <div class="flex between" style="padding:.6rem 0;border-bottom:1px solid var(--border)">
                  <div>
                    <p class="bold text-sm">${p.owner?.name || '—'}</p>
                    <small>${p.owner?.unit || ''} · ${formatMonth(p.month)} · $${p.amount.toLocaleString('es-AR')}</small>
                    ${p.receipt?.url ? `<br><button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" style="font-size:.72rem;color:var(--accent);padding:0;background:none;border:none;cursor:pointer;text-decoration:underline">Ver comprobante ↗</button>` : ''}
                  </div>
                  <div class="flex gap-1">
                    <button class="btn btn-success btn-sm" onclick="approvePayment('${p._id}')">${SVG.check}</button>
                    <button class="btn btn-danger  btn-sm" onclick="openRejectModal('${p._id}')">${SVG.x}</button>
                  </div>
                </div>`).join('')}
          </div>
        </div>

        <div class="card">
          <div class="card-header flex between">
            <h3>Reclamos Abiertos</h3>
            <div class="flex gap-1" style="align-items:center">
              ${openClaims.length > 0 ? `<span class="badge badge-warning">${openClaims.length}</span>` : ''}
              <button class="btn btn-ghost btn-sm" onclick="showPage('page-admin-claims');renderAdminClaims()">Ver todos</button>
            </div>
          </div>
          <div class="card-body flex col gap-2">
            ${openClaims.length === 0
              ? '<p class="text-muted text-sm">No hay reclamos abiertos.</p>'
              : openClaims.map(c => `
                <div style="padding:.5rem 0;border-bottom:1px solid var(--border);display:flex;justify-content:space-between;align-items:center;gap:.5rem">
                  <div style="flex:1;min-width:0">
                    <p class="bold text-sm" style="white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${c.title}</p>
                    <small style="color:var(--muted)">${c.owner?.name || '—'} · ${c.owner?.unit || ''} · ${CLAIM_CATEGORIES[c.category] || c.category}</small>
                  </div>
                  <button class="btn btn-success btn-sm" onclick="openResolveClaimModal('${c._id}','${c.title.replace(/'/g,'\\\'').replace(/"/g,'&quot;')}')">Resolver</button>
                </div>`).join('')}
          </div>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminHome()');
  }
}

async function renderAdminDashboard(year) {
  if (year !== undefined) _dashYear = year;
  const el = document.getElementById('page-admin-dashboard');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(5)}</div>`;
  try {
    const [dashRes, statsRes] = await Promise.all([
      api.payments.getDashboard(_dashYear),
      api.owners.getStats(),
    ]);
    const dash  = dashRes.data;
    const stats = statsRes.data;
    _dashMonthly = dash.monthly || [];
    _dashStats   = stats;

    const maxTotal = Math.max(..._dashMonthly.map(m => m.total), 1);
    const barW = 36, barGap = 16, chartH = 120;
    const chartW = _dashMonthly.length * (barW + barGap);
    const bars = _dashMonthly.map((m) => {
      const h = Math.max(Math.round((m.total / maxTotal) * chartH), m.total > 0 ? 4 : 0);
      const x = _dashMonthly.indexOf(m) * (barW + barGap);
      const label = formatMonth(m._id).slice(0,3);
      return `<g style="cursor:pointer" onclick="openStatDetail('monthDetail','${m._id}')">
        <rect x="${x}" y="${chartH - h}" width="${barW}" height="${h}" rx="5" fill="var(--accent)" opacity=".85"/>
        <rect x="${x}" y="0" width="${barW}" height="${chartH}" rx="5" fill="transparent"/>
        <text x="${x + barW/2}" y="${chartH + 16}" text-anchor="middle" font-size="9" fill="var(--muted)">${label}</text>
        ${m.total > 0 ? `<text x="${x + barW/2}" y="${chartH - h - 5}" text-anchor="middle" font-size="8" fill="var(--accent)" font-weight="600">$${(m.total/1000).toFixed(0)}k</text>` : ''}
        ${m.pending > 0 ? `<circle cx="${x + barW - 4}" cy="${chartH - h - 2}" r="5" fill="var(--warning)"/><text x="${x + barW - 4}" y="${chartH - h + 2}" text-anchor="middle" font-size="6" fill="#fff" font-weight="700">${m.pending}</text>` : ''}
      </g>`;
    }).join('');

    const totalYear = _dashMonthly.reduce((s, m) => s + (m.total || 0), 0);

    el.innerHTML = `
      <div class="flex col gap-3">
        <div class="flex between" style="align-items:center">
          <h1>Dashboard de Pagos</h1>
          <button class="btn btn-secondary btn-sm" onclick="exportDashboardExcel()" style="gap:.4rem;display:flex;align-items:center">
            ${SVG.download} Excel
          </button>
        </div>
        <div class="stats-grid">
          <div class="stat-card" style="cursor:pointer" onclick="openStatDetail('compliance')">
            <span class="stat-label">Cumplimiento</span>
            <span class="stat-value" style="color:${stats.complianceRate>=70?'var(--success)':'var(--danger)'}">${stats.complianceRate}%</span>
            <span class="stat-sub">${stats.upToDate} de ${stats.totalOwners} ›</span>
          </div>
          <div class="stat-card" style="cursor:pointer" onclick="openStatDetail('collected')">
            <span class="stat-label">Recaudado ${_dashYear}</span>
            <span class="stat-value" style="color:var(--accent);font-size:1.3rem">$${(totalYear/1000).toFixed(0)}k</span>
            <span class="stat-sub">Ver detalle ›</span>
          </div>
          <div class="stat-card" style="cursor:pointer" onclick="openStatDetail('debtors')">
            <span class="stat-label">Morosos</span>
            <span class="stat-value" style="color:var(--danger)">${stats.debtors}</span>
            <span class="stat-sub">propietarios ›</span>
          </div>
          <div class="stat-card" style="cursor:pointer" onclick="openStatDetail('pending')">
            <span class="stat-label">Por revisar</span>
            <span class="stat-value" style="color:var(--warning)">${stats.pendingPayments}</span>
            <span class="stat-sub">comprobantes ›</span>
          </div>
        </div>
        <div class="card">
          <div class="card-header" style="display:flex;align-items:center;justify-content:space-between">
            <h3>Recaudación mensual</h3>
            <div class="flex gap-1" style="align-items:center">
              <button class="btn btn-ghost btn-sm" style="padding:.2rem .5rem;font-size:1rem" onclick="renderAdminDashboard(${_dashYear - 1})">‹</button>
              <span style="font-size:.9rem;font-weight:600;min-width:2.5rem;text-align:center">${_dashYear}</span>
              <button class="btn btn-ghost btn-sm" style="padding:.2rem .5rem;font-size:1rem" onclick="renderAdminDashboard(${_dashYear + 1})" ${_dashYear >= new Date().getFullYear() ? 'disabled' : ''}>›</button>
            </div>
          </div>
          <div class="card-body" style="overflow-x:auto">
            ${_dashMonthly.length > 0
              ? `<svg width="${Math.max(chartW, 300)}" height="${chartH + 30}" style="display:block;margin:0 auto">${bars}</svg>
                 <p style="text-align:center;font-size:.73rem;color:var(--muted);margin-top:.25rem">Tocá una barra para ver el detalle del mes</p>`
              : '<p class="text-muted text-sm">Sin datos para este año.</p>'}
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Detalle por período — ${_dashYear}</h3></div>
          <div class="table-wrap">
            <table>
              <thead><tr><th>Período</th><th>Aprobados</th><th>Pendientes</th><th>Rechazados</th><th>Recaudado</th></tr></thead>
              <tbody>${_dashMonthly.length > 0
                ? _dashMonthly.map(m => `<tr style="cursor:pointer" onclick="openStatDetail('monthDetail','${m._id}')">
                    <td class="bold">${formatMonth(m._id)}</td>
                    <td><span class="badge badge-success">${m.count}</span></td>
                    <td><span class="badge badge-warning">${m.pending || 0}</span></td>
                    <td><span class="badge badge-danger">${m.rejected || 0}</span></td>
                    <td class="bold">$${(m.total||0).toLocaleString('es-AR')}</td>
                  </tr>`).join('')
                : '<tr><td colspan="5" style="text-align:center;color:var(--muted)">Sin datos</td></tr>'
              }</tbody>
            </table>
          </div>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminDashboard()');
  }
}

async function openStatDetail(type, arg) {
  openModal();
  document.getElementById('modal').innerHTML = `<div class="modal-handle"></div>${skeleton(4)}`;
  try {
    let html = '<div class="modal-handle"></div>';

    if (type === 'pending') {
      const res = await api.payments.getAll({ status: 'pending', limit: 50 });
      const payments = res.data.payments;
      html += `<h2 style="margin-bottom:1.25rem">Comprobantes Pendientes</h2>
        ${payments.length === 0
          ? '<p class="text-muted text-sm">No hay comprobantes pendientes.</p>'
          : `<div class="flex col" style="gap:.6rem">
              ${payments.map(p => `
                <div style="padding:.85rem;background:var(--bg);border-radius:10px">
                  <div class="flex between" style="align-items:center">
                    <div>
                      <p style="font-weight:600;font-size:.9rem">${p.owner?.name || '—'}</p>
                      <p style="font-size:.78rem;color:var(--muted)">${p.owner?.unit || ''} · ${formatMonth(p.month)} · $${p.amount.toLocaleString('es-AR')}</p>
                    </div>
                    <div class="flex gap-1">
                      ${p.receipt?.url ? `<button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" title="Descargar" style="padding:.3rem .5rem">${SVG.download}</button>` : ''}
                      <button class="btn btn-success btn-sm" onclick="approvePayment('${p._id}');closeModal()">${SVG.check}</button>
                      <button class="btn btn-danger btn-sm" onclick="closeModal();openRejectModal('${p._id}')">${SVG.x}</button>
                    </div>
                  </div>
                </div>`).join('')}
            </div>`}
        <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
    }

    else if (type === 'compliance') {
      const res = await api.owners.getAll({ limit: 100 });
      const owners = res.data.owners;
      const upToDate = owners.filter(o => !o.isDebtor);
      const debtors  = owners.filter(o => o.isDebtor);
      html += `<h2 style="margin-bottom:1rem">Cumplimiento de Pagos</h2>
        <div class="flex gap-2" style="margin-bottom:1.25rem">
          <div style="flex:1;background:var(--success-lt);color:var(--success);border-radius:10px;padding:.85rem;text-align:center">
            <div style="font-size:1.6rem;font-weight:700">${upToDate.length}</div>
            <div style="font-size:.78rem;margin-top:.2rem">Al día</div>
          </div>
          <div style="flex:1;background:var(--danger-lt);color:var(--danger);border-radius:10px;padding:.85rem;text-align:center">
            <div style="font-size:1.6rem;font-weight:700">${debtors.length}</div>
            <div style="font-size:.78rem;margin-top:.2rem">Con deuda</div>
          </div>
        </div>
        ${upToDate.length > 0 ? `
          <p style="font-size:.72rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.5rem">Al día</p>
          <div class="flex col" style="gap:.3rem;margin-bottom:1rem">
            ${upToDate.map(o => `
              <div class="flex between" style="padding:.5rem .75rem;background:var(--bg);border-radius:8px;font-size:.85rem">
                <span>${o.name}</span><span style="color:var(--muted);font-size:.78rem">${o.unit || ''}</span>
              </div>`).join('')}
          </div>` : ''}
        ${debtors.length > 0 ? `
          <p style="font-size:.72rem;font-weight:600;color:var(--muted);text-transform:uppercase;letter-spacing:.5px;margin-bottom:.5rem">Con deuda</p>
          <div class="flex col" style="gap:.3rem;margin-bottom:1rem">
            ${debtors.map(o => `
              <div class="flex between" style="padding:.5rem .75rem;background:var(--danger-lt);border-radius:8px;font-size:.85rem">
                <span>${o.name}</span><span style="color:var(--muted);font-size:.78rem">${o.unit || ''}</span>
              </div>`).join('')}
          </div>` : ''}
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cerrar</button>`;
    }

    else if (type === 'debtors') {
      const res = await api.owners.getAll({ limit: 100 });
      const debtors = res.data.owners.filter(o => o.isDebtor);
      html += `<h2 style="margin-bottom:1.25rem">Propietarios Morosos</h2>
        ${debtors.length === 0
          ? '<p class="text-muted text-sm">No hay morosos actualmente.</p>'
          : `<div class="flex col" style="gap:.5rem">
              ${debtors.map(o => `
                <div class="flex between" style="padding:.85rem;background:var(--bg);border-radius:10px;align-items:center">
                  <div>
                    <p style="font-weight:600;font-size:.9rem">${o.name}</p>
                    <p style="font-size:.78rem;color:var(--muted)">${o.unit || ''} · ${o.email}</p>
                  </div>
                  <div style="text-align:right">
                    <span class="badge badge-danger">Deuda</span>
                    ${o.balance ? `<p style="font-size:.78rem;color:var(--danger);margin-top:.25rem">$${Math.abs(o.balance).toLocaleString('es-AR')}</p>` : ''}
                  </div>
                </div>`).join('')}
            </div>`}
        <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
    }

    else if (type === 'collected') {
      const monthly = _dashMonthly.length > 0 ? _dashMonthly : (await api.payments.getDashboard(_dashYear)).data.monthly || [];
      const total = monthly.reduce((sum, m) => sum + (m.total || 0), 0);
      html += `<h2 style="margin-bottom:1rem">Recaudación ${_dashYear}</h2>
        <div style="background:var(--bg);border-radius:10px;padding:.85rem 1rem;margin-bottom:1rem;display:flex;justify-content:space-between;align-items:center">
          <span style="font-size:.85rem;color:var(--muted)">Total del año</span>
          <span style="font-size:1.4rem;font-weight:700;color:var(--accent)">$${total.toLocaleString('es-AR')}</span>
        </div>
        ${monthly.length > 0
          ? `<div class="flex col" style="gap:.35rem">
              ${[...monthly].reverse().map(m => `
                <div class="flex between" style="padding:.6rem .75rem;background:var(--bg);border-radius:8px;font-size:.85rem;align-items:center;cursor:pointer" onclick="openStatDetail('monthDetail','${m._id}')">
                  <span style="font-weight:500">${formatMonth(m._id)}</span>
                  <div class="flex gap-2" style="align-items:center">
                    <span style="font-size:.78rem;color:var(--muted)">${m.count} pago${m.count !== 1 ? 's' : ''}</span>
                    <span style="font-weight:600;color:var(--accent)">$${(m.total||0).toLocaleString('es-AR')} ›</span>
                  </div>
                </div>`).join('')}
            </div>`
          : '<p class="text-muted text-sm">Sin datos disponibles.</p>'}
        <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
    }

    else if (type === 'monthDetail') {
      const month = arg;
      const res = await api.payments.getAll({ month, limit: 100 });
      const payments = res.data.payments || [];
      const approved = payments.filter(p => p.status === 'approved');
      const pending  = payments.filter(p => p.status === 'pending');
      const rejected = payments.filter(p => p.status === 'rejected');
      const totalRec = approved.reduce((s, p) => s + (p.amount || 0), 0);
      html += `<h2 style="margin-bottom:.75rem">${formatMonth(month)}</h2>
        <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:.5rem;margin-bottom:1.25rem">
          <div style="background:var(--success-lt);color:var(--success);border-radius:8px;padding:.6rem;text-align:center">
            <div style="font-size:1.4rem;font-weight:700">${approved.length}</div><div style="font-size:.72rem">Aprobados</div>
          </div>
          <div style="background:var(--warning-lt);color:var(--warning);border-radius:8px;padding:.6rem;text-align:center">
            <div style="font-size:1.4rem;font-weight:700">${pending.length}</div><div style="font-size:.72rem">Pendientes</div>
          </div>
          <div style="background:var(--danger-lt);color:var(--danger);border-radius:8px;padding:.6rem;text-align:center">
            <div style="font-size:1.4rem;font-weight:700">${rejected.length}</div><div style="font-size:.72rem">Rechazados</div>
          </div>
        </div>
        <div style="background:var(--bg);border-radius:8px;padding:.7rem 1rem;display:flex;justify-content:space-between;margin-bottom:1rem">
          <span style="font-size:.85rem;color:var(--muted)">Recaudado</span>
          <span style="font-weight:700;color:var(--accent)">$${totalRec.toLocaleString('es-AR')}</span>
        </div>
        ${payments.length > 0 ? `
        <div class="flex col" style="gap:.35rem">
          ${payments.map(p => `
            <div class="flex between" style="padding:.6rem .75rem;background:var(--bg);border-radius:8px;font-size:.84rem;align-items:center">
              <div>
                <p style="font-weight:600">${p.owner?.name || '—'}</p>
                <p style="font-size:.75rem;color:var(--muted)">${p.owner?.unit || ''} · $${(p.amount||0).toLocaleString('es-AR')}</p>
              </div>
              <div class="flex gap-1" style="align-items:center">
                ${statusBadge(p.status)}
                ${p.receipt?.url ? `<button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" style="padding:.25rem .4rem">${SVG.download}</button>` : ''}
              </div>
            </div>`).join('')}
        </div>` : '<p class="text-muted text-sm">Sin pagos registrados en este período.</p>'}
        <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
    }

    document.getElementById('modal').innerHTML = html;
  } catch (err) {
    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      <p style="color:var(--danger)">${err.message}</p>
      <button class="btn btn-secondary w-full mt-3" onclick="closeModal()">Cerrar</button>`;
  }
}

async function exportDashboardExcel() {
  try {
    // Fetch pagos del año con datos completos
    const res = await api.payments.getAll({ limit: 500, ...((() => {
      const params = {};
      // Filtramos en el cliente por año ya que el endpoint no tiene filtro de año
      return params;
    })()) });
    const allPayments = (res.data.payments || []).filter(p => {
      const year = p.month ? p.month.slice(0, 4) : '';
      return year === String(_dashYear);
    });

    // Hoja 1: resumen mensual
    const summaryData = [
      ['Período', 'Recaudado ($)', 'Pagos aprobados', 'Pendientes', 'Rechazados'],
      ..._dashMonthly.map(m => [
        formatMonth(m._id),
        m.total || 0,
        m.count || 0,
        m.pending || 0,
        m.rejected || 0,
      ]),
      [],
      ['TOTAL', _dashMonthly.reduce((s, m) => s + (m.total || 0), 0),
               _dashMonthly.reduce((s, m) => s + (m.count || 0), 0), '', ''],
    ];

    // Hoja 2: pagos individuales
    const paymentsData = [
      ['Propietario', 'Unidad', 'Período', 'Monto ($)', 'Estado', 'Canal', 'Fecha'],
      ...allPayments.map(p => [
        p.owner?.name || '—',
        p.owner?.unit || '—',
        p.month || '—',
        p.amount || 0,
        p.status === 'approved' ? 'Aprobado' : p.status === 'pending' ? 'Pendiente' : 'Rechazado',
        p.paymentMethod === 'mercadopago' ? 'MercadoPago' : 'Manual',
        p.createdAt ? new Date(p.createdAt).toLocaleDateString('es-AR') : '—',
      ]),
    ];

    const wb = XLSX.utils.book_new();

    const ws1 = XLSX.utils.aoa_to_sheet(summaryData);
    ws1['!cols'] = [{ wch: 18 }, { wch: 16 }, { wch: 18 }, { wch: 12 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws1, 'Resumen mensual');

    const ws2 = XLSX.utils.aoa_to_sheet(paymentsData);
    ws2['!cols'] = [{ wch: 22 }, { wch: 10 }, { wch: 12 }, { wch: 12 }, { wch: 12 }, { wch: 14 }, { wch: 14 }];
    XLSX.utils.book_append_sheet(wb, ws2, 'Pagos');

    XLSX.writeFile(wb, `consorcio_informe_${_dashYear}.xlsx`);
    toast('Informe descargado correctamente.', 'success');
  } catch (err) {
    toast('Error al generar el informe: ' + err.message, 'error');
  }
}

async function renderOwnersList() {
  const el = document.getElementById('page-admin-owners');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const res    = await api.owners.getAll({ limit: 100 });
    const owners = res.data.owners;
    el.innerHTML = `
      <div class="flex col gap-3">
        <div class="flex between">
          <h1>Propietarios</h1>
          <button class="btn btn-primary btn-sm" onclick="openNewOwnerModal()">+ Agregar</button>
        </div>
        <div class="card">
          <div class="card-body flex col" style="gap:0">
            ${owners.map(o => `
              <div class="owner-row">
                <div class="owner-avatar">${o.name.split(' ').slice(0,2).map(w=>w[0]).join('')}</div>
                <div class="owner-info">
                  <p class="name">${o.name}</p>
                  <p class="unit">${o.unit || '—'}${o.phone ? ` · ${o.phone}` : ''}</p>
                </div>
                <div class="flex col" style="align-items:flex-end;gap:.25rem">
                  <span class="badge ${o.isDebtor ? 'badge-danger' : 'badge-success'}">${o.isDebtor ? 'Deuda' : 'Al día'}</span>
                  ${o.lastPayment ? `<small>${formatMonth(o.lastPayment.month)}</small>` : '<small class="text-muted">Sin pagos</small>'}
                </div>
                <button class="btn btn-ghost btn-sm" onclick="viewOwnerDetail('${o._id}')">Ver</button>
              </div>`).join('')}
          </div>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnersList()');
  }
}

async function viewOwnerDetail(ownerId) {
  openModal();
  document.getElementById('modal').innerHTML = `<div class="modal-handle"></div>${skeleton(4)}`;
  try {
    const res      = await api.owners.getOne(ownerId);
    const owner    = res.data.owner;
    const payments = res.data.payments || [];
    document.getElementById('modal').innerHTML = `
      <div class="modal-handle"></div>
      <div class="flex between" style="margin-bottom:1.25rem">
        <div>
          <h2>${owner.name}</h2>
          <small>${[owner.unit, owner.phone, owner.email].filter(Boolean).join(' · ')}</small>
        </div>
        <span class="badge ${owner.isDebtor ? 'badge-danger' : 'badge-success'}">${owner.isDebtor ? 'Deudor' : 'Al día'}</span>
      </div>
      <div style="background:var(--bg);border-radius:8px;padding:.75rem;margin-bottom:1rem" class="flex between">
        <span class="text-sm text-muted">Saldo</span>
        <span class="bold" style="color:${(owner.balance||0)<0?'var(--danger)':'var(--success)'}">
          ${(owner.balance||0)<0?'-':''}$${Math.abs(owner.balance||0).toLocaleString('es-AR')}
        </span>
      </div>
      <h3 style="margin-bottom:.75rem">Historial de Pagos</h3>
      ${payments.length === 0
        ? '<p class="text-muted text-sm">Sin pagos registrados.</p>'
        : `<div class="table-wrap"><table>
            <thead><tr><th>Período</th><th>Importe</th><th>Estado</th><th></th></tr></thead>
            <tbody>${payments.map(p=>`
              <tr>
                <td>${formatMonth(p.month)}</td>
                <td>$${p.amount.toLocaleString('es-AR')}</td>
                <td>${statusBadge(p.status)}</td>
                <td>${p.receipt?.url ? `<button class="btn btn-ghost btn-sm" onclick="downloadReceipt('${p._id}')" title="Descargar comprobante" style="padding:.3rem .5rem">${SVG.download}</button>` : ''}</td>
              </tr>`).join('')}
            </tbody>
          </table></div>`}
      <div class="flex gap-1 mt-3" style="flex-wrap:wrap">
        <button class="btn btn-secondary" onclick="closeModal()">Cerrar</button>
        <button class="btn btn-ghost" onclick="openEditOwnerModal('${owner._id}', '${owner.name.replace(/'/g,"\\'")}', '${owner.unit||''}', '${owner.phone||''}')">Editar</button>
        <button class="btn btn-ghost" onclick="openNotifyOwnerModal('${owner._id}', '${owner.name.replace(/'/g,"\\'")}')">Notificar</button>
        <button class="btn btn-primary" onclick="toggleDebt('${owner._id}', ${owner.isDebtor})">
          ${owner.isDebtor ? 'Al día' : 'Moroso'}
        </button>
      </div>`;
  } catch (err) {
    document.getElementById('modal').innerHTML = `<div class="modal-handle"></div><p style="color:var(--danger)">${err.message}</p>`;
  }
}

async function toggleDebt(ownerId, currentDebt) {
  try {
    await api.owners.update(ownerId, { isDebtor: !currentDebt, balance: !currentDebt ? -15000 : 0 });
    closeModal();
    toast('Propietario actualizado', 'success');
    renderOwnersList();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Notificar propietario ─────────────────────────────────────
function openNotifyOwnerModal(id, name) {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.25rem">Enviar notificación</h2>
    <p class="text-sm text-muted" style="margin-bottom:1rem">Para: ${name}</p>
    <div class="flex col gap-2">
      <div class="form-group"><label>Título</label><input class="input" id="notif-title" placeholder="Ej: Aviso importante"></div>
      <div class="form-group"><label>Mensaje</label><textarea class="input" id="notif-body" style="min-height:90px" placeholder="Escribí el mensaje..."></textarea></div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="viewOwnerDetail('${id}')">Cancelar</button>
        <button class="btn btn-primary w-full" onclick="sendOwnerNotification('${id}')">Enviar</button>
      </div>
    </div>`;
  openModal();
}

async function sendOwnerNotification(id) {
  const title = document.getElementById('notif-title')?.value.trim();
  const body  = document.getElementById('notif-body')?.value.trim();
  if (!title || !body) { toast('Completá título y mensaje', 'error'); return; }
  try {
    showLoading(true);
    await api.owners.notify(id, title, body);
    closeModal();
    toast('Notificación enviada', 'success');
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

// ── Editar propietario ────────────────────────────────────────
function openEditOwnerModal(id, name, unit, phone) {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Editar Propietario</h2>
    <div class="flex col gap-2">
      <div class="form-group"><label>Nombre completo</label><input class="input" id="eo-name" value="${name}"></div>
      <div class="form-group"><label>Unidad (lote/casa)</label><input class="input" id="eo-unit" value="${unit}" placeholder="Lote 12"></div>
      <div class="form-group"><label>Teléfono</label><input class="input" type="tel" id="eo-phone" value="${phone}" placeholder="1122334455"></div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="viewOwnerDetail('${id}')">Cancelar</button>
        <button class="btn btn-primary w-full" onclick="saveEditOwner('${id}')">Guardar</button>
      </div>
    </div>`;
  openModal();
}

async function saveEditOwner(id) {
  const name  = document.getElementById('eo-name')?.value.trim();
  const unit  = document.getElementById('eo-unit')?.value.trim();
  const phone = document.getElementById('eo-phone')?.value.trim();
  if (!name) { toast('El nombre es obligatorio', 'error'); return; }
  try {
    await api.owners.update(id, { name, unit, phone });
    toast('Propietario actualizado', 'success');
    viewOwnerDetail(id);
    renderOwnersList();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Nuevo propietario ─────────────────────────────────────────
function openNewOwnerModal() {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nuevo Propietario</h2>
    <div class="flex col gap-2">
      <div class="form-group"><label>Nombre completo</label><input class="input" id="no-name" placeholder="María García"></div>
      <div class="form-group"><label>Email</label><input class="input" type="email" id="no-email" placeholder="propietario@mail.com"></div>
      <div class="form-group"><label>Contraseña temporal</label><input class="input" id="no-pass" placeholder="Mín. 6 caracteres"></div>
      <div class="form-group"><label>Unidad (lote/casa)</label><input class="input" id="no-unit" placeholder="Lote 12"></div>
      <div class="form-group"><label>Teléfono</label><input class="input" id="no-phone" placeholder="1122334455"></div>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" onclick="saveNewOwner()">Crear</button>
      </div>
    </div>`;
  openModal();
}

async function saveNewOwner() {
  const name  = document.getElementById('no-name')?.value.trim();
  const email = document.getElementById('no-email')?.value.trim();
  const pass  = document.getElementById('no-pass')?.value.trim();
  const unit  = document.getElementById('no-unit')?.value.trim();
  const phone = document.getElementById('no-phone')?.value.trim();
  if (!name || !email || !pass) { toast('Nombre, email y contraseña son obligatorios', 'error'); return; }
  try {
    await api.owners.create({ name, email, password: pass, unit, phone });
    closeModal();
    toast('Propietario creado exitosamente', 'success');
    renderOwnersList();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Aprobar / Rechazar ────────────────────────────────────────
async function approvePayment(payId) {
  try {
    await api.payments.approve(payId);
    toast('Pago aprobado', 'success');
    renderAdminHome();
  } catch (err) {
    toast(err.message, 'error');
  }
}

let _rejectPayId = null;
function openRejectModal(payId) {
  _rejectPayId = payId;
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.75rem">Rechazar Comprobante</h2>
    <p class="text-muted text-sm" style="margin-bottom:1rem">Indicá el motivo para notificar al propietario.</p>
    <div class="form-group">
      <label>Motivo</label>
      <textarea class="input" id="reject-note" placeholder="Ej: Importe incorrecto, imagen ilegible..."></textarea>
    </div>
    <div class="flex gap-1 mt-3">
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
      <button class="btn btn-danger w-full" onclick="confirmReject()">Rechazar</button>
    </div>`;
  openModal();
}

async function confirmReject() {
  const note = document.getElementById('reject-note')?.value.trim();
  if (!note) { toast('Indicá el motivo', 'error'); return; }
  try {
    await api.payments.reject(_rejectPayId, note);
    closeModal();
    toast('Comprobante rechazado', 'error');
    renderAdminHome();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Avisos Admin ──────────────────────────────────────────────
async function renderAdminNotices() {
  const el = document.getElementById('page-admin-notices');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res = await api.notices.getAll({ limit: 30 });
    el.innerHTML = `
      <div class="flex col gap-3">
        <div class="flex between">
          <h1>Avisos</h1>
          <button class="btn btn-primary btn-sm" onclick="openNewNoticeModal()">+ Nuevo</button>
        </div>
        <div class="flex col gap-2">
          ${res.data.notices.map(n => `
            <div class="notice-card">
              <div class="flex between">
                <span class="notice-tag tag-${n.tag}">${tagLabel(n.tag)}</span>
                <button class="btn-icon" style="font-size:.75rem" onclick="deleteNotice('${n._id}')">🗑</button>
              </div>
              <h3>${n.title}</h3>
              <p class="text-sm text-muted">${n.body.slice(0,100)}${n.body.length>100?'…':''}</p>
              <span class="notice-date">${formatDate(n.createdAt)}</span>
            </div>`).join('') || '<p class="text-muted text-sm">Sin avisos.</p>'}
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminNotices()');
  }
}

function openNewNoticeModal() {
  const modal = document.getElementById('modal');
  modal.innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nuevo Aviso</h2>
    <div class="flex col gap-2">
      <div class="form-group"><label>Título</label><input class="input" id="n-title" placeholder="Título del aviso"></div>
      <div class="form-group"><label>Mensaje</label><textarea class="input" id="n-body" style="min-height:110px" placeholder="Contenido del comunicado..."></textarea></div>
      <div class="form-group">
        <label>Tipo</label>
        <select class="select" id="n-tag">
          <option value="info">📢 Informativo</option>
          <option value="warning">⚠ Advertencia</option>
          <option value="urgent">🔴 Urgente</option>
        </select>
      </div>
      <label style="font-size:.85rem;display:flex;align-items:center;gap:.5rem;cursor:pointer">
        <input type="checkbox" id="n-push" checked> Enviar push notification a propietarios
      </label>
      <div class="flex gap-1 mt-1">
        <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
        <button class="btn btn-primary w-full" onclick="saveNotice()">Publicar</button>
      </div>
    </div>`;
  openModal();
}

async function saveNotice() {
  const title   = document.getElementById('n-title')?.value.trim();
  const body    = document.getElementById('n-body')?.value.trim();
  const tag     = document.getElementById('n-tag')?.value;
  const sendPush = document.getElementById('n-push')?.checked;
  if (!title || !body) { toast('Completá todos los campos', 'error'); return; }
  try {
    await api.notices.create({ title, body, tag, sendPush });
    closeModal();
    toast('Aviso publicado', 'success');
    renderAdminNotices();
  } catch (err) {
    toast(err.message, 'error');
  }
}

async function deleteNotice(id) {
  if (!confirm('¿Eliminar este aviso?')) return;
  try {
    await api.notices.delete(id);
    toast('Aviso eliminado');
    renderAdminNotices();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Reclamos — Vista Admin ────────────────────────────────────
const CLAIM_CATEGORIES = {
  infrastructure: 'Infraestructura',
  security:       'Seguridad',
  noise:          'Ruidos',
  cleaning:       'Limpieza',
  billing:        'Facturación',
  other:          'Otro',
};

function claimStatusBadge(status) {
  if (status === 'open')        return `<span class="badge badge-warning">Abierto</span>`;
  if (status === 'in_progress') return `<span class="badge badge-neutral" style="background:var(--accent-lt,#ede9fe);color:var(--accent)">En proceso</span>`;
  if (status === 'resolved')    return `<span class="badge badge-success">Resuelto</span>`;
  return `<span class="badge">${status}</span>`;
}

async function renderAdminClaims() {
  const el = document.getElementById('page-admin-claims');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(4)}</div>`;
  try {
    const res    = await api.claims.getAll({ limit: 100 });
    const claims = res.data.claims;

    const open       = claims.filter(c => c.status === 'open');
    const inProgress = claims.filter(c => c.status === 'in_progress');
    const resolved   = claims.filter(c => c.status === 'resolved');

    const renderClaimCard = (c) => `
      <div style="background:var(--bg);border-radius:10px;padding:.85rem;display:flex;flex-direction:column;gap:.5rem">
        <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem">
          <div style="flex:1;min-width:0">
            <p style="font-weight:600;font-size:.9rem;margin-bottom:.15rem">${c.title}</p>
            <p style="font-size:.75rem;color:var(--muted)">${c.owner?.name || '—'} · ${c.owner?.unit || ''} · ${CLAIM_CATEGORIES[c.category] || c.category}</p>
            <p style="font-size:.75rem;color:var(--muted)">${formatDate(c.createdAt)}</p>
          </div>
          ${claimStatusBadge(c.status)}
        </div>
        <p style="font-size:.83rem;color:var(--text);line-height:1.4">${c.body}</p>
        ${c.adminNote ? `<p style="font-size:.78rem;color:var(--muted);font-style:italic">Nota: ${c.adminNote}</p>` : ''}
        <div class="flex gap-1" style="flex-wrap:wrap">
          ${c.status !== 'in_progress' && c.status !== 'resolved' ? `<button class="btn btn-secondary btn-sm" onclick="updateClaimStatus('${c._id}','in_progress')">En proceso</button>` : ''}
          ${c.status !== 'resolved' ? `<button class="btn btn-success btn-sm" onclick="openResolveClaimModal('${c._id}','${c.title.replace(/'/g,'\\\'').replace(/"/g,'&quot;')}')">Resolver</button>` : ''}
          <button class="btn btn-ghost btn-sm" onclick="deleteClaim('${c._id}',true)" style="margin-left:auto;color:var(--muted)">${SVG.x}</button>
        </div>
      </div>`;

    el.innerHTML = `
      <div class="flex col gap-3">
        <h1>Reclamos</h1>
        ${open.length === 0 && inProgress.length === 0 && resolved.length === 0
          ? '<div class="card"><div class="card-body"><p class="text-muted text-sm">No hay reclamos registrados.</p></div></div>'
          : `
          ${open.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Abiertos</h3><span class="badge badge-warning">${open.length}</span>
              </div>
              <div class="card-body flex col gap-2">${open.map(renderClaimCard).join('')}</div>
            </div>` : ''}
          ${inProgress.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>En proceso</h3><span class="badge badge-neutral">${inProgress.length}</span>
              </div>
              <div class="card-body flex col gap-2">${inProgress.map(renderClaimCard).join('')}</div>
            </div>` : ''}
          ${resolved.length > 0 ? `
            <div class="card">
              <div class="card-header flex between">
                <h3>Resueltos</h3><span class="badge badge-success">${resolved.length}</span>
              </div>
              <div class="card-body flex col gap-2">${resolved.map(renderClaimCard).join('')}</div>
            </div>` : ''}`}
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderAdminClaims()');
  }
}

async function updateClaimStatus(id, status, adminNote) {
  try {
    await api.claims.updateStatus(id, status, adminNote);
    toast(status === 'resolved' ? 'Reclamo resuelto.' : 'Estado actualizado.', 'success');
    renderAdminClaims();
  } catch (err) {
    toast(err.message, 'error');
  }
}

function openResolveClaimModal(id, title) {
  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:.75rem">Resolver reclamo</h2>
    <p style="font-size:.85rem;color:var(--muted);margin-bottom:1rem">${title}</p>
    <div class="form-group">
      <label>Nota para el propietario (opcional)</label>
      <textarea class="input" id="resolve-note" placeholder="Ej: Se realizó la reparación el día..." rows="3"></textarea>
    </div>
    <div class="flex col gap-1 mt-3">
      <button class="btn btn-success w-full" onclick="confirmResolveClaim('${id}')">Marcar como resuelto</button>
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
    </div>`;
}

async function confirmResolveClaim(id) {
  const note = document.getElementById('resolve-note')?.value?.trim();
  closeModal();
  await updateClaimStatus(id, 'resolved', note);
}

async function deleteClaim(id, isAdmin = false) {
  try {
    await api.claims.delete(id);
    toast('Reclamo eliminado.', 'success');
    if (isAdmin) renderAdminClaims();
    else renderOwnerClaims();
  } catch (err) {
    toast(err.message, 'error');
  }
}

// ── Reclamos — Vista Owner ────────────────────────────────────
async function renderOwnerClaims() {
  const el = document.getElementById('page-owner-claims');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res    = await api.claims.getAll({ limit: 50 });
    const claims = res.data.claims;

    el.innerHTML = `
      <div class="flex col gap-3">
        <div class="flex between" style="align-items:center">
          <h1>Mis Reclamos</h1>
          <button class="btn btn-primary btn-sm" onclick="openNewClaimModal()">+ Nuevo</button>
        </div>
        <div class="card">
          <div class="card-body flex col gap-2">
            ${claims.length === 0
              ? '<p class="text-muted text-sm">No tenés reclamos registrados.</p>'
              : claims.map(c => `
                <div style="padding:.75rem 0;border-bottom:1px solid var(--border)">
                  <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:.5rem;margin-bottom:.35rem">
                    <p style="font-weight:600;font-size:.9rem">${c.title}</p>
                    ${claimStatusBadge(c.status)}
                  </div>
                  <p style="font-size:.75rem;color:var(--muted);margin-bottom:.3rem">${CLAIM_CATEGORIES[c.category] || c.category} · ${formatDate(c.createdAt)}</p>
                  <p style="font-size:.83rem;color:var(--text);line-height:1.4">${c.body}</p>
                  ${c.adminNote ? `<p style="font-size:.78rem;color:var(--accent);margin-top:.35rem;font-style:italic">Respuesta: ${c.adminNote}</p>` : ''}
                  ${c.status === 'open' ? `<button class="btn btn-ghost btn-sm" style="margin-top:.4rem;color:var(--danger);font-size:.75rem" onclick="deleteClaim('${c._id}')">Eliminar</button>` : ''}
                </div>`).join('')}
          </div>
        </div>
      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerClaims()');
  }
}

function openNewClaimModal() {
  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Nuevo Reclamo</h2>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Categoría</label>
        <select class="input" id="claim-category">
          ${Object.entries(CLAIM_CATEGORIES).map(([v,l]) => `<option value="${v}">${l}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Título</label>
        <input class="input" id="claim-title" placeholder="Ej: Pérdida de agua en pasillo" maxlength="150">
      </div>
      <div class="form-group">
        <label>Descripción</label>
        <textarea class="input" id="claim-body" placeholder="Describí el problema con el mayor detalle posible..." rows="4" maxlength="2000"></textarea>
      </div>
      <button class="btn btn-primary w-full" id="btn-submit-claim" onclick="submitClaim()">Enviar reclamo</button>
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
    </div>`;
}

async function submitClaim() {
  const category = document.getElementById('claim-category')?.value;
  const title    = document.getElementById('claim-title')?.value?.trim();
  const body     = document.getElementById('claim-body')?.value?.trim();

  if (!title) { toast('El título es obligatorio.', 'error'); return; }
  if (!body)  { toast('La descripción es obligatoria.', 'error'); return; }

  const btn = document.getElementById('btn-submit-claim');
  btn.disabled = true;
  btn.textContent = 'Enviando…';
  try {
    await api.claims.create({ category, title, body });
    closeModal();
    toast('Reclamo enviado correctamente.', 'success');
    renderOwnerClaims();
  } catch (err) {
    toast(err.message, 'error');
    btn.disabled = false;
    btn.textContent = 'Enviar reclamo';
  }
}

// ── Config Admin ──────────────────────────────────────────────
async function renderAdminSettings() {
  const el = document.getElementById('page-admin-settings');
  el.innerHTML = `<div class="flex col gap-3">${skeleton(3)}</div>`;
  try {
    const res = await api.config.get();
    const cfg = res.data.config;
    el.innerHTML = `
      <div class="flex col gap-3">
        <h1>Configuración</h1>
        <div class="card">
          <div class="card-header"><h3>Expensas del Período</h3></div>
          <div class="card-body flex col gap-2">
            <div class="form-group"><label>Período (nombre)</label><input class="input" id="cfg-month" value="${cfg.expenseMonth || ''}" placeholder="Ej: Abril 2025"></div>
            <div class="form-group"><label>Código de mes</label><input class="input" id="cfg-month-code" value="${cfg.expenseMonthCode || ''}" placeholder="YYYY-MM"></div>
            <div class="form-group"><label>Importe ($)</label><input class="input" type="number" id="cfg-amount" value="${cfg.expenseAmount || ''}" min="1"></div>
            <div class="form-group"><label>Día de vencimiento</label><input class="input" type="number" id="cfg-due" value="${cfg.dueDayOfMonth || 10}" min="1" max="28"></div>
            <button class="btn btn-primary" onclick="saveSettings()">Guardar cambios</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Datos del Consorcio</h3></div>
          <div class="card-body flex col gap-2">
            <div class="form-group"><label>Nombre del consorcio</label><input class="input" id="cfg-name" value="${cfg.consortiumName || ''}" placeholder="Barrio Privado Los Pinos"></div>
            <div class="form-group"><label>Email de contacto</label><input class="input" id="cfg-email" value="${cfg.adminEmail || ''}"></div>
            <button class="btn btn-primary" onclick="saveConsortiumSettings()">Guardar</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Integración MercadoPago</h3></div>
          <div class="card-body flex col gap-2">
            <p class="text-sm text-muted">Credenciales desde developers.mercadopago.com</p>
            <div class="form-group"><label>Public Key</label><input class="input" id="cfg-mp-key" placeholder="APP_USR-..." value="${cfg.mpPublicKey || ''}"></div>
            <div class="form-group"><label>Access Token</label><input class="input" type="password" id="cfg-mp-token" placeholder="APP_USR-..."></div>
            <button class="btn btn-primary" onclick="saveMPSettings()">Guardar credenciales</button>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Períodos de pago disponibles</h3></div>
          <div class="card-body flex col gap-2">
            <p class="text-sm text-muted">Definí qué meses pueden seleccionar los propietarios al subir un comprobante. Si no hay ninguno, se muestran los últimos 6 meses automáticamente.</p>
            <div id="periods-list" class="flex gap-2" style="flex-wrap:wrap;min-height:2rem">
              ${(cfg.paymentPeriods || []).map(p => periodChip(p)).join('') || '<span class="text-sm text-muted">Sin períodos configurados</span>'}
            </div>
            <div class="flex gap-2" style="align-items:center">
              <input class="input" type="month" id="cfg-new-period" style="flex:1">
              <button class="btn btn-secondary" onclick="addPaymentPeriod()">Agregar</button>
            </div>
          </div>
        </div>
        <div class="card">
          <div class="card-header"><h3>Cuenta</h3></div>
          <div class="card-body">
            <button class="btn btn-danger w-full" onclick="logout()">${SVG.logout} Cerrar sesión</button>
          </div>
        </div>
      </div>`;
  } catch (err) {
    if (err.status === 404 || (err.message && err.message.toLowerCase().includes('configurada'))) {
      // Cargar templates para el selector
      let templateOptions = '<option value="consorcio">Consorcio / Barrio Privado</option>';
      try {
        const tRes = await api.organizations.getTemplates();
        templateOptions = tRes.data.templates.map(t =>
          `<option value="${t.businessType}">${t.displayName}</option>`
        ).join('');
      } catch (_) { /* usar default */ }

      el.innerHTML = `
        <div class="flex col gap-3">
          <h1>Configuración</h1>
          <div class="card">
            <div class="card-header"><h3>Configurar organización</h3></div>
            <div class="card-body flex col gap-2">
              <p class="text-sm text-muted">Todavía no configuraste tu organización. Completá los datos para comenzar.</p>
              <div class="form-group">
                <label>Tipo de organización *</label>
                <select class="input" id="setup-org-template">${templateOptions}</select>
              </div>
              <div class="form-group"><label>Nombre *</label><input class="input" id="setup-org-name" placeholder="Barrio Privado Los Pinos"></div>
              <div class="form-group"><label>Dirección</label><input class="input" id="setup-org-address" placeholder="Av. Siempre Viva 742"></div>
              <div class="form-group"><label>Email de contacto</label><input class="input" type="email" id="setup-org-email" placeholder="admin@consorcio.com"></div>
              <button class="btn btn-primary" onclick="createOrganization()">Crear organización</button>
            </div>
          </div>
        </div>`;
    } else {
      el.innerHTML = errorState(err.message, 'renderAdminSettings()');
    }
  }
}

async function createOrganization() {
  const template = document.getElementById('setup-org-template')?.value || 'consorcio';
  const name     = document.getElementById('setup-org-name')?.value.trim();
  const address  = document.getElementById('setup-org-address')?.value.trim();
  const email    = document.getElementById('setup-org-email')?.value.trim();

  if (!name) { toast('El nombre es requerido', 'error'); return; }

  try {
    showLoading(true);
    await api.organizations.create({ template, name, address, adminEmail: email });
    // Refrescar estado del usuario para que req.org se popule en siguientes requests
    const me = await api.auth.getMe();
    state.user = me.data.user;
    toast('Organización creada correctamente', 'success');
    renderAdminSettings();
  } catch (err) {
    toast(err.message, 'error');
  } finally {
    showLoading(false);
  }
}

async function saveSettings() {
  try {
    await api.config.update({
      expenseMonth:     document.getElementById('cfg-month')?.value.trim(),
      expenseMonthCode: document.getElementById('cfg-month-code')?.value.trim(),
      expenseAmount:    Number(document.getElementById('cfg-amount')?.value),
      dueDayOfMonth:    Number(document.getElementById('cfg-due')?.value),
    });
    toast('Configuración guardada', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function saveConsortiumSettings() {
  try {
    await api.config.update({
      consortiumName: document.getElementById('cfg-name')?.value.trim(),
      adminEmail:     document.getElementById('cfg-email')?.value.trim(),
    });
    toast('Datos del consorcio guardados', 'success');
    setupTopBar();
  } catch (err) { toast(err.message, 'error'); }
}

function periodChip(value) {
  return `<span data-period="${value}" style="display:inline-flex;align-items:center;gap:.35rem;background:var(--primary-lt);color:var(--primary);padding:.25rem .65rem;border-radius:99px;font-size:.82rem;font-weight:500">
    ${formatPeriodLabel(value)}
    <button onclick="removePaymentPeriod('${value}')" style="background:none;border:none;cursor:pointer;color:inherit;line-height:1;padding:0;font-size:.9rem">✕</button>
  </span>`;
}

async function addPaymentPeriod() {
  const input = document.getElementById('cfg-new-period');
  const value = input?.value;
  if (!value) { toast('Seleccioná un mes', 'error'); return; }

  const current = Array.from(document.querySelectorAll('#periods-list [data-period]')).map(el => el.dataset.period);
  if (current.includes(value)) { toast('Ese período ya está en la lista', 'error'); return; }

  const updated = [...current, value].sort();
  try {
    await api.config.update({ paymentPeriods: updated });
    document.getElementById('periods-list').innerHTML = updated.map(p => periodChip(p)).join('');
    input.value = '';
    toast('Período agregado', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function removePaymentPeriod(value) {
  const current = Array.from(document.querySelectorAll('#periods-list [data-period]')).map(el => el.dataset.period);
  const updated = current.filter(p => p !== value);
  try {
    await api.config.update({ paymentPeriods: updated });
    document.getElementById('periods-list').innerHTML = updated.length
      ? updated.map(p => periodChip(p)).join('')
      : '<span class="text-sm text-muted">Sin períodos configurados</span>';
    toast('Período eliminado', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

async function saveMPSettings() {
  const update = {};
  const key   = document.getElementById('cfg-mp-key')?.value.trim();
  const token = document.getElementById('cfg-mp-token')?.value.trim();
  if (key)   update.mpPublicKey   = key;
  if (token) update.mpAccessToken = token;
  if (!Object.keys(update).length) { toast('Ingresá al menos una credencial', 'error'); return; }
  try {
    await api.config.update(update);
    toast('Credenciales MP guardadas', 'success');
  } catch (err) { toast(err.message, 'error'); }
}

// ── MercadoPago ───────────────────────────────────────────────
async function initMercadoPago() {
  try {
    showLoading(true);
    const res = await api.mercadopago.createPreference();
    const { initPoint, sandboxUrl } = res.data;
    showLoading(false);

    const url = document.location.hostname === 'localhost' ? sandboxUrl : initPoint;
    if (url) {
      window.open(url, '_blank');
      toast('Redirigiendo a MercadoPago...', 'default');
    } else {
      toast('MercadoPago no configurado. Contactá al administrador.', 'error');
    }
  } catch (err) {
    showLoading(false);
    toast(err.message, 'error');
  }
}

// ── Push Notifications (Firebase Messaging) ───────────────────
const FIREBASE_WEB_CONFIG = {
  apiKey:            'AIzaSyALo-U8cuAO3smKa-pD0u47TFpnFZYhRj0',
  authDomain:        'consorcio-app-15e78.firebaseapp.com',
  projectId:         'consorcio-app-15e78',
  storageBucket:     'consorcio-app-15e78.firebasestorage.app',
  messagingSenderId: '822644970609',
  appId:             '1:822644970609:web:29df8183cfbf20cf0937d0',
};
// VAPID key opcional: si se genera desde Firebase Console (Configuración →
// Cloud Messaging → Certificados web push), pasarla aquí. Si no se configura,
// Firebase usa su propia clave por defecto asociada al messagingSenderId.
const FIREBASE_VAPID_KEY = 'BDzNAjBShFNHPbWyWCBTbv31_uqRfuVzyf27A-iCtQafSt5s-6HIZCFh1J7tp1P-T8WEZsxnYQoEZNKwAFygyxw';

let _messaging = null;

function _firebaseConfigured() {
  return !!FIREBASE_WEB_CONFIG.apiKey;
}

async function setupPushNotifications() {
  if (!('Notification' in window) || !('serviceWorker' in navigator)) return;
  if (!_firebaseConfigured()) {
    console.warn('FCM: configurá FIREBASE_WEB_CONFIG en app.js para habilitar push notifications.');
    return;
  }

  try {
    // Inicializar Firebase (solo una vez)
    if (!firebase.apps.length) firebase.initializeApp(FIREBASE_WEB_CONFIG);
    _messaging = firebase.messaging();

    // Mensajes en foreground → mostrar toast
    _messaging.onMessage((payload) => {
      const { title = '', body = '' } = payload.data || {};
      if (title || body) toast(`${title}${title && body ? ': ' : ''}${body}`, 'default');
    });

    // Pedir permiso y obtener token FCM
    const permission = Notification.permission === 'default'
      ? await Notification.requestPermission()
      : Notification.permission;

    if (permission !== 'granted') return;

    const swReg = await navigator.serviceWorker.register('/firebase-messaging-sw.js');
    const tokenOpts = { serviceWorkerRegistration: swReg };
    if (FIREBASE_VAPID_KEY) tokenOpts.vapidKey = FIREBASE_VAPID_KEY;
    const token = await _messaging.getToken(tokenOpts);

    if (token) {
      await api.auth.updateFcmToken(token);
    }
  } catch (err) {
    console.warn('Push notification setup failed:', err.message);
  }
}

async function checkMonthlyReminder() {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  const today = new Date().getDate();
  if (today > 5) return;

  try {
    const cfgRes  = await api.config.get();
    const cfg     = cfgRes.data.config;
    const month   = cfg.expenseMonthCode;
    const sentKey = `notif_sent_${state.user._id}_${month}`;
    if (localStorage.getItem(sentKey)) return;

    const payRes = await api.payments.getAll({ month });
    const paid   = payRes.data.payments.find(p => p.status === 'approved');
    if (!paid) {
      new Notification('Mi Consorcio 🏘️', {
        body: `Recordatorio: las expensas de ${cfg.expenseMonth} vencen el día ${cfg.dueDayOfMonth}. ¡No olvides pagar!`,
        icon: 'icons/icon-192.png',
        tag:  `expensa-${month}`,
      });
      localStorage.setItem(sentKey, '1');
    }
  } catch { /* silencioso */ }
}

// ── Modal ─────────────────────────────────────────────────────
function openModal(html) {
  if (html) document.getElementById('modal').innerHTML = html;
  document.getElementById('modal-overlay').classList.remove('hidden');
}
function closeModal() { document.getElementById('modal-overlay').classList.add('hidden'); }
document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

// ── Helpers ───────────────────────────────────────────────────
function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day:'2-digit', month:'2-digit', year:'numeric' });
}
function formatMonth(m) {
  if (!m) return '—';
  const months = ['Ene','Feb','Mar','Abr','May','Jun','Jul','Ago','Sep','Oct','Nov','Dic'];
  const [y, mo] = m.split('-');
  return `${months[parseInt(mo)-1]} ${y}`;
}
function statusBadge(s) {
  return {
    pending:  '<span class="badge badge-warning">⏳ Pendiente</span>',
    approved: '<span class="badge badge-success">✓ Aprobado</span>',
    rejected: '<span class="badge badge-danger">✕ Rechazado</span>',
  }[s] || s;
}
function tagLabel(tag) {
  return { info:'📢 Info', warning:'⚠ Aviso', urgent:'🔴 Urgente' }[tag] || tag;
}
function noticeCard(n, full = false) {
  return `<div class="notice-card">
    <span class="notice-tag tag-${n.tag}">${tagLabel(n.tag)}</span>
    <h3>${n.title}</h3>
    <p class="text-sm text-muted">${full ? n.body : (n.body.slice(0,80)+(n.body.length>80?'…':''))}</p>
    <span class="notice-date">${formatDate(n.createdAt)}</span>
  </div>`;
}
async function downloadReceipt(paymentId) {
  if (!paymentId) return;
  try {
    const resp = await fetch(api.payments.getReceiptUrl(paymentId), {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!resp.ok) { toast('Error al descargar el comprobante.', 'error'); return; }
    const blob = await resp.blob();
    const url  = URL.createObjectURL(blob);
    const a    = document.createElement('a');
    a.href     = url;
    a.download = 'comprobante.pdf';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  } catch {
    toast('No se pudo descargar el comprobante.', 'error');
  }
}

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}`;
}
// getRecentMonths y formatPeriodLabel viven en utils.js
function errorState(msg, fn = '') {
  return `<div style="text-align:center;padding:2rem;color:var(--danger)">
    <p style="font-size:2rem">⚠</p>
    <p class="bold">${msg}</p>
    ${fn ? `<button class="btn btn-ghost btn-sm mt-2" onclick="${fn}">Reintentar</button>` : ''}
  </div>`;
}

// ── Service Worker ────────────────────────────────────────────
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});

    // Recargar la página cuando un nuevo SW toma el control (nueva versión deployada)
    let reloading = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (reloading) return;
      reloading = true;
      window.location.reload();
    });
  });
}
