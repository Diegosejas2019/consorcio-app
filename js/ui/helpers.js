import { SVG } from './icons.js';

export function debounce(fn, ms = 350) {
  let timer;
  return (...args) => { clearTimeout(timer); timer = setTimeout(() => fn(...args), ms); };
}

export function formatDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('es-AR', { day: '2-digit', month: '2-digit', year: 'numeric' });
}

export function formatMonth(m) {
  if (!m) return '—';
  const months = ['Ene', 'Feb', 'Mar', 'Abr', 'May', 'Jun', 'Jul', 'Ago', 'Sep', 'Oct', 'Nov', 'Dic'];
  const [y, mo] = m.split('-');
  return `${months[parseInt(mo) - 1]} ${y}`;
}

export function statusBadge(s) {
  return {
    pending:  '<span class="badge badge-warning">⏳ Pendiente</span>',
    approved: '<span class="badge badge-success">✓ Aprobado</span>',
    rejected: '<span class="badge badge-danger">✕ Rechazado</span>',
  }[s] || s;
}

export function tagLabel(tag) {
  return { info: '📢 Info', warning: '⚠ Aviso', urgent: '🔴 Urgente' }[tag] || tag;
}

export function noticeCard(n, full = false) {
  return `<div class="notice-card">
    <span class="notice-tag tag-${n.tag}">${tagLabel(n.tag)}</span>
    <h3>${n.title}</h3>
    <p class="text-sm text-muted">${full ? n.body : (n.body.slice(0, 80) + (n.body.length > 80 ? '…' : ''))}</p>
    <span class="notice-date">${formatDate(n.createdAt)}</span>
  </div>`;
}

export async function downloadReceipt(paymentId) {
  if (!paymentId) return;
  try {
    const resp = await fetch(api.payments.getReceiptUrl(paymentId), {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!resp.ok) { toast('Error al descargar el comprobante.', 'error'); return; }
    const blob    = await resp.blob();
    const url     = URL.createObjectURL(blob);
    const isImage = blob.type.startsWith('image/');
    if (isImage) {
      window.open(url, '_blank');
    } else {
      const a    = document.createElement('a');
      a.href     = url;
      a.download = 'comprobante.pdf';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }
  } catch {
    toast('No se pudo descargar el comprobante.', 'error');
  }
}

export function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
}

export function formatPhone(phone) {
  return (phone || '').replace(/\D/g, '');
}

export function buildWhatsAppLink(phone, message) {
  return `https://wa.me/${formatPhone(phone)}?text=${encodeURIComponent(message)}`;
}

export function errorState(msg, fn = '') {
  return `<div style="text-align:center;padding:2rem;color:var(--danger)">
    <p style="font-size:2rem">⚠</p>
    <p class="bold">${msg}</p>
    ${fn ? `<button class="btn btn-ghost btn-sm mt-2" onclick="${fn}">Reintentar</button>` : ''}
  </div>`;
}

window.downloadReceipt = downloadReceipt;

export async function downloadAttachment(url, filename = 'archivo') {
  try {
    const resp = await fetch(url, {
      headers: { Authorization: `Bearer ${getToken()}` },
    });
    if (!resp.ok) { toast('Error al descargar el archivo.', 'error'); return; }
    const blob    = await resp.blob();
    const objUrl  = URL.createObjectURL(blob);
    const isImage = blob.type.startsWith('image/');
    if (isImage) {
      window.open(objUrl, '_blank');
    } else {
      const a    = document.createElement('a');
      a.href     = objUrl;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(objUrl);
    }
  } catch {
    toast('No se pudo descargar el archivo.', 'error');
  }
}

window.downloadAttachment = downloadAttachment;
