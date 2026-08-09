#!/usr/bin/env node
/**
 * Génère les icônes PWA (PNG) à partir de public/icons/icon-source.svg.
 *
 * Usage : npm run generate-icons
 *
 * Ce script tourne UNIQUEMENT en local (pas dans le CI GitHub Actions) :
 * il te permet de régénérer rapidement les icônes après une modification
 * du SVG source, sans dépendre d'une étape de build automatisée.
 */
import { existsSync } from 'node:fs';
import { mkdir, readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import sharp from 'sharp';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ICONS_DIR = path.resolve(__dirname, '../public/icons');
const SOURCE_SVG = path.join(ICONS_DIR, 'icon-source.svg');

const ICON_TARGETS = [
  { file: 'icon-192.png', size: 192 },
  { file: 'icon-512.png', size: 512 },
  { file: 'apple-touch-icon-180.png', size: 180 },
];

/**
 * Convertit le SVG source en un fichier PNG carré pour une cible donnée.
 */
async function renderIcon(svgBuffer, target) {
  const outputPath = path.join(ICONS_DIR, target.file);
  await sharp(svgBuffer, { density: 384 }).resize(target.size, target.size).png().toFile(outputPath);
  console.log(`✓ ${target.file} (${target.size}x${target.size})`);
}

async function main() {
  if (!existsSync(SOURCE_SVG)) {
    console.error(
      `Fichier introuvable : ${SOURCE_SVG}\n` +
        "Ajoute d'abord public/icons/icon-source.svg (voir étape 6 du projet), puis relance ce script.",
    );
    process.exitCode = 1;
    return;
  }

  await mkdir(ICONS_DIR, { recursive: true });
  const svgBuffer = await readFile(SOURCE_SVG);

  for (const target of ICON_TARGETS) {
    await renderIcon(svgBuffer, target);
  }
}

main();
