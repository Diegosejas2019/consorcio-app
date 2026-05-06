import { state, setState, cache } from '../../core/state.js';
import { toast } from '../../ui/toast.js';
import { skeleton } from '../../ui/skeleton.js';
import { errorState } from '../../ui/helpers.js';
import { svgIcon } from '../../ui/icons.js';
import { CACHE_TTL, getCachedOrFetch } from '../../core/cacheHelpers.js';

// ── Helpers ───────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Render ────────────────────────────────────────────────────
export async function renderOwnerProfile() {
  const el = document.getElementById('page-owner-profile');
  el.innerHTML = `<div style="padding:16px">${skeleton(4)}</div>`;

  try {
    const res   = await getCachedOrFetch('auth:me', CACHE_TTL.AUTH_ME, () => api.auth.getMe());
    const user  = res.data.user;
    const units = res.data.units ?? [];
    setState({ user });

    const initials = (user.name || '?').split(' ').slice(0, 2).map(w => w[0]).join('').toUpperCase();

    el.innerHTML = `
      <div style="padding:0 16px 40px">

        <!-- Identity card -->
        <div class="card-hero" style="text-align:center;padding:28px 16px 20px;margin-top:16px">
          <div class="avatar-lg" style="margin:0 auto 14px">${initials}</div>
          <div class="bright" style="font:var(--t-h2)">${escapeHtml(user.name)}</div>
          <div class="muted" style="font:var(--t-sm);margin-top:4px">${escapeHtml(user.email)}</div>
          <div style="margin-top:12px;display:flex;gap:8px;justify-content:center;flex-wrap:wrap">
            <span class="badge badge-accent">Propietario</span>
            ${units.map(u => `<span class="badge badge-plain">${escapeHtml(u.name)}</span>`).join('')}
          </div>
        </div>

        <!-- Datos personales -->
        <div class="section-head" style="margin-top:20px"><h3>Datos personales</h3></div>
        <div class="card" style="padding:16px">
          <div class="stack-3">
            <div class="field">
              <label class="field-label">Nombre completo</label>
              <input class="input" type="text" id="profile-name" value="${escapeHtml(user.name)}" placeholder="Tu nombre completo">
            </div>
            <div class="field">
              <label class="field-label">Teléfono</label>
              <input class="input" type="tel" id="profile-phone" value="${escapeHtml(user.phone || '')}" placeholder="Ej: 11 1234-5678">
            </div>
            <div class="field">
              <label class="field-label" style="color:var(--muted)">Email ${svgIcon('shield', 12)}</label>
              <input class="input" type="email" value="${escapeHtml(user.email)}" disabled style="opacity:.5;cursor:not-allowed">
            </div>
            ${user.startBillingPeriod ? `
            <div class="field">
              <label class="field-label" style="color:var(--muted)">Inicio de cobro</label>
              <input class="input" value="${formatPeriodLabel(user.startBillingPeriod)}" disabled style="opacity:.5;cursor:not-allowed">
            </div>` : ''}
            <button class="btn btn-primary btn-block" id="btn-save-profile" onclick="saveOwnerProfile()">
              Guardar cambios
            </button>
          </div>
        </div>

        <!-- Seguridad -->
        <div class="section-head" style="margin-top:20px"><h3>Seguridad</h3></div>
        <div class="card" style="padding:16px">
          <div class="stack-3">
            <div class="field">
              <label class="field-label">Contraseña actual</label>
              <input class="input" type="password" id="profile-current-pass" placeholder="Tu contraseña actual">
            </div>
            <div class="field">
              <label class="field-label">Nueva contraseña</label>
              <input class="input" type="password" id="profile-new-pass" placeholder="Mínimo 6 caracteres">
            </div>
            <div class="field">
              <label class="field-label">Confirmar nueva contraseña</label>
              <input class="input" type="password" id="profile-confirm-pass" placeholder="Repetí la nueva contraseña">
            </div>
            <button class="btn btn-ghost btn-block" id="btn-change-pass" onclick="changeOwnerPassword()">
              ${svgIcon('key', 16)} Cambiar contraseña
            </button>
          </div>
        </div>

        <!-- Legal -->
        <div class="section-head" style="margin-top:20px"><h3>Legal</h3></div>
        <div class="card" style="padding:16px">
          <button class="legal-link" onclick="openTermsPage()">
            <span>${svgIcon('doc', 18)}</span>
            <span>Términos y Condiciones</span>
            <span class="legal-link-arrow">${svgIcon('chevron-r', 16)}</span>
          </button>
        </div>

        <!-- Cerrar sesión -->
        <button class="btn btn-ghost btn-block" style="margin-top:24px;color:var(--danger);border-color:var(--danger-bg)" onclick="logout()">
          ${svgIcon('logout', 16)} Cerrar sesión
        </button>

      </div>`;
  } catch (err) {
    el.innerHTML = errorState(err.message, 'renderOwnerProfile()');
  }
}

// ── Guardar datos personales ──────────────────────────────────
window.saveOwnerProfile = async function () {
  const name  = document.getElementById('profile-name')?.value.trim();
  const phone = document.getElementById('profile-phone')?.value.trim();

  if (!name) { toast('El nombre no puede estar vacío', 'error'); return; }

  const btn = document.getElementById('btn-save-profile');
  btn.disabled    = true;
  btn.textContent = 'Guardando...';

  try {
    await api.owners.update(state.user._id, { name, phone });
    cache.del('auth:me');
    setState({ user: { ...state.user, name, phone } });
    window.setupTopBar();
    toast('Perfil actualizado correctamente', 'success');
  } catch (err) {
    toast(err.message || 'No se pudo actualizar el perfil', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Guardar cambios';
  }
};

// ── Cambiar contraseña ────────────────────────────────────────
window.changeOwnerPassword = async function () {
  const currentPass = document.getElementById('profile-current-pass')?.value.trim();
  const newPass     = document.getElementById('profile-new-pass')?.value.trim();
  const confirmPass = document.getElementById('profile-confirm-pass')?.value.trim();

  if (!currentPass) { toast('Ingresá tu contraseña actual', 'error'); return; }
  if (!newPass || newPass.length < 6) { toast('La nueva contraseña debe tener al menos 6 caracteres', 'error'); return; }
  if (newPass !== confirmPass) { toast('Las contraseñas no coinciden', 'error'); return; }

  const btn = document.getElementById('btn-change-pass');
  btn.disabled    = true;
  btn.textContent = 'Cambiando...';

  try {
    await api.auth.updatePassword(currentPass, newPass);
    document.getElementById('profile-current-pass').value = '';
    document.getElementById('profile-new-pass').value     = '';
    document.getElementById('profile-confirm-pass').value = '';
    toast('Contraseña actualizada correctamente', 'success');
  } catch (err) {
    toast(err.message || 'No se pudo cambiar la contraseña', 'error');
  } finally {
    btn.disabled    = false;
    btn.textContent = 'Cambiar contraseña';
  }
};

window.renderOwnerProfile = renderOwnerProfile;
