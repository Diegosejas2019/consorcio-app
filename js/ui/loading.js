export function showLoading(show = true) {
  document.getElementById('loading-overlay').classList.toggle('hidden', !show);
}

export function showSessionRestoreError() {
  const box = document.querySelector('.login-box');
  if (!box) return;
  const existing = document.getElementById('session-restore-err');
  if (existing) return;
  const msg = document.createElement('div');
  msg.id = 'session-restore-err';
  msg.style.cssText = 'margin-top:1rem;padding:.75rem 1rem;background:rgba(251,191,36,.1);border:1px solid rgba(251,191,36,.3);border-radius:10px;font-size:.85rem;color:#FBBF24;display:flex;flex-direction:column;gap:.6rem;';
  msg.innerHTML = `<span>No se pudo conectar al servidor. Tu sesión está guardada.</span>
    <button onclick="location.reload()" style="background:none;border:1px solid rgba(251,191,36,.4);border-radius:7px;padding:.4rem .85rem;font-size:.82rem;color:#FBBF24;cursor:pointer;font-family:inherit;font-weight:600;align-self:flex-start">Reintentar</button>`;
  box.appendChild(msg);
}

export function setBtnLoading(btn, loading) {
  if (!btn) return;
  btn.disabled = loading;
  btn.classList.toggle('btn-loading', loading);
}
