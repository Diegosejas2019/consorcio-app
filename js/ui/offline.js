export function updateOnlineStatus() {
  const offline = !navigator.onLine;
  document.getElementById('offline-banner')?.classList.toggle('hidden', !offline);
  document.body.classList.toggle('is-offline', offline);
  document.querySelectorAll('[data-requires-network]').forEach(el => {
    el.disabled = offline;
    el.title = offline ? 'No disponible sin conexión' : '';
  });
}

window.addEventListener('online',  updateOnlineStatus);
window.addEventListener('offline', updateOnlineStatus);
