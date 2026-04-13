global.toast       = jest.fn();
global.clearFile   = jest.fn();
global.SVG         = { pdf: '<svg data-icon="pdf"/>', upload: '<svg data-icon="upload"/>' };
global.api         = { payments: { create: jest.fn() } };
global.cache       = { del: jest.fn(), set: jest.fn(), get: jest.fn(() => null), clear: jest.fn() };
global.selectedFile = null;
