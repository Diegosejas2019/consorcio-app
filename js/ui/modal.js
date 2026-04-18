export function openModal(idOrHtml, html) {
  const content = html !== undefined ? html : idOrHtml;
  if (content) document.getElementById('modal').innerHTML = content;
  document.getElementById('modal-overlay').classList.remove('hidden');
}

export function closeModal() {
  document.getElementById('modal-overlay').classList.add('hidden');
}

document.getElementById('modal-overlay').addEventListener('click', e => {
  if (e.target === document.getElementById('modal-overlay')) closeModal();
});

window.openModal  = openModal;
window.closeModal = closeModal;
