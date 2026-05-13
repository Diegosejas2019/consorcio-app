import { state, setState, cache } from '../../core/state.js';
import { toast } from '../../ui/toast.js';
import { showLoading } from '../../ui/loading.js';

export function renderChangeTemporaryPassword() {
  const el = document.getElementById('page-change-temp-password');
  if (!el) return;

  el.innerHTML = `
    <div style="padding:0 16px 40px;max-width:480px;margin:0 auto">

      <div style="text-align:center;padding:32px 0 24px">
        <div style="width:56px;height:56px;border-radius:50%;background:rgba(251,191,36,0.12);display:flex;align-items:center;justify-content:center;margin:0 auto 16px">
          <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" stroke-width="2" width="28" height="28" style="color:var(--warning)"><path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"/></svg>
        </div>
        <h2 style="font:var(--t-h2);margin-bottom:8px">Cambiar contraseña temporal</h2>
        <p style="color:var(--text);font-size:.9rem;line-height:1.5">
          Por seguridad, debés cambiar la contraseña temporal antes de continuar.
        </p>
      </div>

      <div class="card" style="padding:20px">
        <div class="stack-3">
          <div class="field">
            <label class="field-label">Contraseña actual (temporal)</label>
            <input class="input" type="password" id="ctp-current" placeholder="Tu contraseña temporal" autocomplete="current-password">
          </div>
          <div class="field">
            <label class="field-label">Nueva contraseña</label>
            <input class="input" type="password" id="ctp-new" placeholder="Mínimo 6 caracteres" autocomplete="new-password">
          </div>
          <div class="field">
            <label class="field-label">Confirmar nueva contraseña</label>
            <input class="input" type="password" id="ctp-confirm" placeholder="Repetí la nueva contraseña" autocomplete="new-password">
          </div>
          <button class="btn btn-primary btn-block" id="btn-change-temp-pass" onclick="submitChangeTempPassword()">
            Cambiar contraseña
          </button>
        </div>
      </div>

      <button class="btn btn-ghost btn-block" style="margin-top:12px;color:var(--danger);border-color:var(--danger-bg)" onclick="logout()">
        Cerrar sesión
      </button>

    </div>`;

  // Foco automático en primer campo
  setTimeout(() => document.getElementById('ctp-current')?.focus(), 100);
}

window.renderChangeTemporaryPassword = renderChangeTemporaryPassword;

window.submitChangeTempPassword = async function () {
  const currentPass = document.getElementById('ctp-current')?.value.trim();
  const newPass     = document.getElementById('ctp-new')?.value.trim();
  const confirmPass = document.getElementById('ctp-confirm')?.value.trim();

  if (!currentPass) { toast('Ingresá tu contraseña actual', 'error'); return; }
  if (!newPass || newPass.length < 6) { toast('La nueva contraseña debe tener al menos 6 caracteres', 'error'); return; }
  if (newPass !== confirmPass) { toast('Las contraseñas no coinciden', 'error'); return; }
  if (newPass === currentPass) { toast('La nueva contraseña no puede ser igual a la contraseña temporal', 'error'); return; }

  const btn = document.getElementById('btn-change-temp-pass');
  if (btn) btn.disabled = true;

  try {
    showLoading(true);
    const res = await api.auth.changeTempPassword(currentPass, newPass, confirmPass);

    // Actualizar token con el nuevo emitido por el backend
    if (res.token) {
      const remember = !!localStorage.getItem('consorcio_token');
      window.setToken(res.token, remember);
    }

    // Actualizar estado: mustChangePassword ya no aplica
    setState({ user: { ...state.user, mustChangePassword: false } });
    cache.del('auth:me');

    toast('Contraseña cambiada correctamente.', 'success');

    const homePage = state.role === 'admin' ? 'page-admin-home' : 'page-owner-home';
    window.showPage(homePage);
    if (state.role === 'admin') window.renderAdminHome?.();
    else window.renderOwnerHome?.();
  } catch (err) {
    toast(err.message || 'No se pudo cambiar la contraseña. Intentá nuevamente.', 'error');
    if (btn) btn.disabled = false;
  } finally {
    showLoading(false);
  }
};
