/**
 * @jest-environment jsdom
 */

// Mocks globales
global.toast = jest.fn();
global.cache = { del: jest.fn() };
global.SVG   = { upload: '<svg/>' };

// Función submitReceipt extraída e instrumentada para tests
function makeSubmitReceipt(apiMock) {
  let selectedFile = null;

  function setFile(f) { selectedFile = f; }

  async function clearFile() {
    selectedFile = null;
    const preview = document.getElementById('file-preview');
    const zone    = document.getElementById('upload-zone');
    if (preview) preview.classList.add('hidden');
    if (zone)    zone.classList.remove('hidden');
  }

  async function submitReceipt() {
    const month  = document.getElementById('pay-month')?.value;
    const amount = document.getElementById('pay-amount')?.value;
    const note   = document.getElementById('pay-note')?.value?.trim();

    if (!month)              { global.toast('Seleccioná el período', 'error'); return; }
    if (!amount || amount < 1){ global.toast('Ingresá un importe válido', 'error'); return; }
    if (!selectedFile)        { global.toast('Adjuntá el comprobante en PDF', 'error'); return; }

    const formData = new FormData();
    formData.append('month', month);
    formData.append('amount', amount);
    if (note) formData.append('ownerNote', note);
    formData.append('receipt', selectedFile);

    const btn = document.getElementById('btn-submit-receipt');
    if (btn) { btn.disabled = true; btn.textContent = 'Enviando...'; }

    try {
      await apiMock(formData);
      global.toast('Comprobante enviado. Pendiente de revisión.', 'success');
      await clearFile();
      global.cache.del('owner_home');
    } catch (err) {
      global.toast(err.message, 'error');
    } finally {
      if (btn) { btn.disabled = false; btn.innerHTML = `${global.SVG.upload} Enviar Comprobante`; }
    }
  }

  return { submitReceipt, setFile };
}

function buildDOM() {
  document.body.innerHTML = `
    <select id="pay-month"><option value="2025-04">Abril 2025</option></select>
    <input  id="pay-amount" type="number" value="15000" />
    <input  id="pay-note"   type="text"   value="" />
    <button id="btn-submit-receipt">Enviar</button>
    <div id="upload-zone"></div>
    <div id="file-preview"></div>
  `;
}

beforeEach(() => {
  jest.clearAllMocks();
  buildDOM();
});

describe('submitReceipt', () => {
  test('sin selectedFile → toast de error, api NO llamada', async () => {
    const apiMock = jest.fn().mockResolvedValue({});
    const { submitReceipt } = makeSubmitReceipt(apiMock);

    await submitReceipt();

    expect(global.toast).toHaveBeenCalledWith('Adjuntá el comprobante en PDF', 'error');
    expect(apiMock).not.toHaveBeenCalled();
  });

  test('sin amount → toast de error, api NO llamada', async () => {
    const apiMock = jest.fn().mockResolvedValue({});
    const { submitReceipt, setFile } = makeSubmitReceipt(apiMock);
    setFile({ name: 'comp.pdf', type: 'application/pdf', size: 1024 });
    document.getElementById('pay-amount').value = '0';

    await submitReceipt();

    expect(global.toast).toHaveBeenCalledWith('Ingresá un importe válido', 'error');
    expect(apiMock).not.toHaveBeenCalled();
  });

  test('datos válidos → api llamada, toast de éxito, cache.del', async () => {
    const apiMock = jest.fn().mockResolvedValue({ success: true });
    const { submitReceipt, setFile } = makeSubmitReceipt(apiMock);
    setFile({ name: 'comp.pdf', type: 'application/pdf', size: 1024 });

    await submitReceipt();

    expect(apiMock).toHaveBeenCalledTimes(1);
    expect(global.toast).toHaveBeenCalledWith('Comprobante enviado. Pendiente de revisión.', 'success');
    expect(global.cache.del).toHaveBeenCalledWith('owner_home');
  });

  test('API falla → toast con mensaje de error, botón re-habilitado', async () => {
    const apiMock = jest.fn().mockRejectedValue(new Error('Error del servidor'));
    const { submitReceipt, setFile } = makeSubmitReceipt(apiMock);
    setFile({ name: 'comp.pdf', type: 'application/pdf', size: 1024 });

    await submitReceipt();

    expect(global.toast).toHaveBeenCalledWith('Error del servidor', 'error');
    const btn = document.getElementById('btn-submit-receipt');
    expect(btn.disabled).toBe(false);
  });
});
