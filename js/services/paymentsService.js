import { toast } from '../ui/toast.js';
import { openModal, closeModal } from '../ui/modal.js';
import { apiCall } from '../core/apiWrapper.js';

export async function triggerReminders() {
  try {
    const res = await apiCall(() => api.payments.sendReminders());
    toast(`Recordatorios enviados: ${res.data.sent} push, ${res.data.noToken} sin token`, 'success');
  } catch {
    // el error ya lo muestra apiCall
  }
}

export async function approvePayment(payId) {
  try {
    await api.payments.approve(payId);
    toast('Pago aprobado', 'success');
    window.renderAdminHome();
  } catch (err) {
    toast(err.message, 'error');
  }
}

let _rejectPayId = null;

export function openRejectModal(payId) {
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
      <button class="btn btn-danger w-full" data-requires-network onclick="confirmReject()">Rechazar</button>
    </div>`;
  openModal();
}

export async function confirmReject() {
  const note = document.getElementById('reject-note')?.value.trim();
  if (!note) { toast('Indicá el motivo', 'error'); return; }
  try {
    await api.payments.reject(_rejectPayId, note);
    closeModal();
    toast('Comprobante rechazado', 'error');
    window.renderAdminHome();
  } catch (err) {
    toast(err.message, 'error');
  }
}

window.triggerReminders = triggerReminders;
window.approvePayment   = approvePayment;
window.openRejectModal  = openRejectModal;
window.confirmReject    = confirmReject;
