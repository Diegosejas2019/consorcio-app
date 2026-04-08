// Genera icon-192.png e icon-512.png desde icon.svg
// Requiere: npm install -g sharp-cli  O  node con sharp instalado
// Uso: node generate-icons.mjs

import { readFileSync, writeFileSync } from 'fs';
import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import path from 'path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const svgPath   = path.join(__dirname, 'icon.svg');

let sharp;
try {
  const require = createRequire(import.meta.url);
  sharp = require('sharp');
} catch {
  console.error('sharp no está instalado. Ejecutá: npm install sharp');
  process.exit(1);
}

const svgBuffer = readFileSync(svgPath);

for (const size of [192, 512]) {
  const out = path.join(__dirname, `icon-${size}.png`);
  await sharp(svgBuffer).resize(size, size).png().toFile(out);
  console.log(`✓ icon-${size}.png generado`);
}
