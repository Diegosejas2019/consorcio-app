import { showLoading } from '../ui/loading.js';
import { toast } from '../ui/toast.js';

export async function initMercadoPago(payload) {
  try {
    showLoading(true);
    const res = await api.mercadopago.createPreference(payload);
    const { initPoint, sandboxUrl } = res.data;
    showLoading(false);
    const url = document.location.hostname === 'localhost' ? sandboxUrl : initPoint;
    if (url) {
      window.open(url, '_blank');
      toast('Redirigiendo a MercadoPago...', 'default');
    } else {
      toast('MercadoPago no configurado. Contactá al administrador.', 'error');
    }
  } catch (err) {
    showLoading(false);
    toast(err.message, 'error');
  }
}

window.initMercadoPago = initMercadoPago;
