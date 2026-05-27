import { toast } from './toast.js';
import { openModal, closeModal } from './modal.js';
import { setBtnLoading } from './loading.js';

const SUPPORT_TYPES = {
  bug: 'Error en la app',
  question: 'Consulta',
  payment_issue: 'Problema con pago',
  suggestion: 'Sugerencia',
  other: 'Otro',
};

function buildSupportContext() {
  const activePage = document.querySelector('.page.active');
  return {
    route: window.location.pathname,
    userAgent: navigator.userAgent,
    action: 'support_ticket_form',
    metadata: {
      timestamp: new Date().toISOString(),
      pageId: activePage?.id || null,
    },
  };
}

export function openSupportTicketModal() {
  openModal();
  document.getElementById('modal').innerHTML = `
    <div class="modal-handle"></div>
    <h2 style="margin-bottom:1rem">Reportar problema</h2>
    <div class="flex col gap-2">
      <div class="form-group">
        <label>Tipo</label>
        <select class="input" id="support-type">
          ${Object.entries(SUPPORT_TYPES).map(([value, label]) => `<option value="${value}">${label}</option>`).join('')}
        </select>
      </div>
      <div class="form-group">
        <label>Titulo</label>
        <input class="input" id="support-title" placeholder="Ej: No puedo cargar un comprobante" maxlength="150">
      </div>
      <div class="form-group">
        <label>Descripcion</label>
        <textarea class="input" id="support-description" placeholder="Contanos que paso y que estabas intentando hacer..." rows="5" maxlength="3000"></textarea>
      </div>
      <button class="btn btn-primary w-full" id="btn-submit-support-ticket" onclick="submitSupportTicket()">Enviar reporte</button>
      <button class="btn btn-secondary w-full" onclick="closeModal()">Cancelar</button>
    </div>`;
}

export async function submitSupportTicket() {
  const type = document.getElementById('support-type')?.value;
  const title = document.getElementById('support-title')?.value?.trim();
  const description = document.getElementById('support-description')?.value?.trim();

  if (!title || title.length < 3) {
    toast('El titulo debe tener al menos 3 caracteres.', 'error');
    return;
  }

  if (!description || description.length < 10) {
    toast('La descripcion debe tener al menos 10 caracteres.', 'error');
    return;
  }

  const btn = document.getElementById('btn-submit-support-ticket');
  setBtnLoading(btn, true);

  try {
    await api.supportTickets.create({
      type,
      title,
      description,
      context: buildSupportContext(),
    });
    closeModal();
    toast('Ticket enviado. Podés seguirlo en Mis tickets.', 'success');
    setTimeout(() => { showPage?.('page-my-support'); renderMySupport?.(); }, 1500);
  } catch (err) {
    toast(err.message || 'No se pudo enviar el reporte.', 'error');
    setBtnLoading(btn, false);
  }
}

window.openSupportTicketModal = openSupportTicketModal;
window.submitSupportTicket = submitSupportTicket;
