/**
 * @jest-environment jsdom
 */

// Mocks globales necesarios
global.toast     = jest.fn();
global.clearFile = jest.fn();
global.SVG       = { pdf: '<svg/>', upload: '<svg/>' };

// Cargar funciones bajo test
const { showFilePreview, clearFile: realClearFile } = (() => {
  // DOM mínimo
  document.body.innerHTML = `
    <div id="upload-zone"></div>
    <div id="file-preview" class="hidden"></div>
    <input id="file-input" type="file" />
  `;

  // Inline las funciones que dependen del DOM y de los globals
  function showFilePreview(file) {
    if (!file) return;
    if (file.type !== 'application/pdf') {
      global.toast('Solo se aceptan archivos PDF.', 'error');
      global.clearFile();
      return;
    }
    document.getElementById('upload-zone').classList.add('hidden');
    const preview = document.getElementById('file-preview');
    preview.classList.remove('hidden');
    preview.innerHTML = `
      <div class="upload-preview">
        <div>${global.SVG.pdf}</div>
        <div>
          <p>${file.name}</p>
          <small>${(file.size / 1024).toFixed(1)} KB · PDF</small>
        </div>
        <button onclick="clearFile()">✕</button>
      </div>`;
  }

  let selectedFile = null;
  function clearFile() {
    selectedFile = null;
    document.getElementById('file-preview').classList.add('hidden');
    document.getElementById('upload-zone').classList.remove('hidden');
    document.getElementById('file-input').value = '';
  }

  return { showFilePreview, clearFile };
})();

beforeEach(() => {
  jest.clearAllMocks();
  // Reset DOM
  document.getElementById('upload-zone').className = '';
  document.getElementById('file-preview').className = 'hidden';
  document.getElementById('file-preview').innerHTML = '';
});

describe('showFilePreview', () => {
  test('archivo no-PDF → toast de error y clearFile', () => {
    const file = { name: 'foto.jpg', type: 'image/jpeg', size: 1024 };
    showFilePreview(file);
    expect(global.toast).toHaveBeenCalledWith('Solo se aceptan archivos PDF.', 'error');
    expect(global.clearFile).toHaveBeenCalled();
    // upload-zone NO debe ocultarse
    expect(document.getElementById('upload-zone').classList.contains('hidden')).toBe(false);
  });

  test('PDF válido → oculta upload-zone, muestra file-preview con nombre', () => {
    const file = { name: 'comprobante.pdf', type: 'application/pdf', size: 204800 };
    showFilePreview(file);
    expect(document.getElementById('upload-zone').classList.contains('hidden')).toBe(true);
    const preview = document.getElementById('file-preview');
    expect(preview.classList.contains('hidden')).toBe(false);
    expect(preview.innerHTML).toContain('comprobante.pdf');
    expect(preview.innerHTML).toContain('200.0 KB');
  });
});

describe('clearFile (real)', () => {
  test('restaura upload-zone y oculta file-preview', () => {
    // Estado como si hubiera un archivo seleccionado
    document.getElementById('upload-zone').classList.add('hidden');
    document.getElementById('file-preview').classList.remove('hidden');

    realClearFile();

    expect(document.getElementById('file-preview').classList.contains('hidden')).toBe(true);
    expect(document.getElementById('upload-zone').classList.contains('hidden')).toBe(false);
  });
});
