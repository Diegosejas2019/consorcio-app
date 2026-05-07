let closeOnBackdrop = true;

export function openModal(idOrHtml, html, options = {}) {
  const content = html !== undefined ? html : idOrHtml;
  if (content) document.getElementById('modal').innerHTML = content;
  closeOnBackdrop = options.closeOnBackdrop !== false;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
  closeOnBackdrop = true;
}

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (closeOnBackdrop && e.target === document.getElementById('modal-overlay')) closeModal();
});

window.openModal  = openModal;
window.closeModal = closeModal;
