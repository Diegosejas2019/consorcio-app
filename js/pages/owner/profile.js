import { state, setState } from '../../core/state.js';
import { toast } from '../../ui/toast.js';
import { skeleton } from '../../ui/skeleton.js';
import { errorState } from '../../ui/helpers.js';

// ── Helpers ───────────────────────────────────────────────────
function escapeHtml(str) {
  return String(str ?? '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ── Render ────────────────────────────────────────────────────
export async function renderOwnerProfile() {
  const el = document.getElementById('page-owner-profile');
  el.innerHTML = `<div class="oh-wrap">${skeleton(4)}</div>`;

  try {
    const res   = await api.auth.getMe();
    const user  = res.data.user;
    const units = res.data.units ?? [];
    setState({ user });

    el.innerHTML = `
      <div class="oh-wrap">

        <div class="oh-greeting oh-entry" style="--delay:0ms">
          <div>
            <p class="oh-greeting-sub">Cuenta</p>
            <h1 class="oh-greeting-name">Mi perfil</h1>
          </div>
        </div>

        <!-- Datos personales -->
        <div class="card oh-entry" style="--delay:60ms">
          <div class="card-header" style="padding:.9rem 1.1rem">
            <span style="font-size:.85rem;font-weight:600;letter-spacing:.03em;color:var(--muted)">DATOS PERSONALES</span>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>Nombre completo</label>
              <input class="input" type="text" id="profile-name"
                value="${escapeHtml(user.name)}"
                placeholder="Tu nombre completo">
            </div>
            <div class="form-group" style="margin-top:1rem">
              <label>Teléfono</label>
              <input class="input" type="tel" id="profile-phone"
                value="${escapeHtml(user.phone)}"
                placeholder="Ej: 11 1234-5678">
            </div>
            <div class="form-group" style="margin-top:1rem">
              <label style="color:var(--muted)">Email</label>
              <input class="input" type="email"
                value="${escapeHtml(user.email)}"
                disabled
                style="opacity:.5;cursor:not-allowed">
              <small style="color:var(--muted);font-size:.78rem;margin-top:.3rem;display:block">El email no puede modificarse.</small>
            </div>
            ${user.startBillingPeriod ? `
            <div class="form-group" style="margin-top:1rem">
              <label style="color:var(--muted)">Inicio de cobro</label>
              <input class="input"
                value="${formatPeriodLabel(user.startBillingPeriod)}"
                disabled
                style="opacity:.5;cursor:not-allowed">
            </div>` : ''}
            <button class="btn btn-primary w-full" style="margin-top:1.5rem"
              id="btn-save-profile" onclick="saveOwnerProfile()">
              Guardar cambios
            </button>
          </div>
        </div>

        ${units.length > 0 ? `
        <!-- Unidades funcionales -->
        <div class="card oh-entry" style="--delay:120ms">
          <div class="card-header" style="padding:.9rem 1.1rem">
            <span style="font-size:.85rem;font-weight:600;letter-spacing:.03em;color:var(--muted)">MIS UNIDADES</span>
          </div>
          <div class="card-body" style="padding:0">
            ${units.map((u, i) => `
            <div style="display:flex;justify-content:space-between;align-items:center;padding:.85rem 1.1rem;${i < units.length - 1 ? 'border-bottom:1px solid var(--border)' : ''}">
              <span style="font-weight:500">${escapeHtml(u.name)}</span>
              <span style="font-size:.82rem;color:var(--muted)">
                ${u.customFee != null
                  ? `$${u.customFee.toLocaleString('es-AR')}`
                  : `Coef. ${u.coefficient}`}
              </span>
            </div>`).join('')}
          </div>
        </div>` : ''}

        <!-- Cambiar contraseña -->
        <div class="card oh-entry" style="--delay:180ms">
          <div class="card-header" style="padding:.9rem 1.1rem">
            <span style="font-size:.85rem;font-weight:600;letter-spacing:.03em;color:var(--muted)">CAMBIAR CONTRASEÑA</span>
          </div>
          <div class="card-body">
            <div class="form-group">
              <label>Contraseña actual</label>
              <input class="input" type="password" id="profile-current-pass"
                placeholder="Tu contraseña actual">
            </div>
            <div class="form-group" style="margin-top:1rem">
              <label>Nueva contraseña</label>
              <input class="input" type="password" id="profile-new-pass"
                placeholder="Mínimo 6 caracteres">
            </div>
            <div class="form-group" style="margin-top:1rem">
              <label>Confirmar nueva contraseña</label>
              <input class="input" type="password" id="profile-confirm-pass"
                placeholder="Repetí la nueva contraseña">
            </div>
            <button class="btn btn-secondary w-full" style="margin-top:1.5rem"
              id="btn-change-pass" onclick="changeOwnerPassword()">
              Cambiar contraseña
            </button>
          </div>
        </div>

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
