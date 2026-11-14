import { copyFile, mkdir, readdir, rename } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const mobileOutput = path.join(projectRoot, 'dist-mobile');
await rename(path.join(mobileOutput, 'mobile.html'), path.join(mobileOutput, 'index.html'));

const copyAsset = async (source, destination = source) => {
  const outputPath = path.join(mobileOutput, destination);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await copyFile(path.join(projectRoot, 'public', source), outputPath);
};

const customerAssets = [
  'brand/sangoub-mark-white-32.png',
  'brand/sangoub-mark-white-64.png',
  'brand/sangoub-mark-white-128.png',
  'brand/sangoub-mark-white-192.png',
  'brand/sangoub-mark-white-256.png',
  'brand/sangoub-mark-white-512.png',
  'brand/sangoub-mark-white-1024.png',
  'brand/sangoub-logo-256x256.png',
  'brand/sangoub-market-logo.jpg',
  'brand/capital-talabat-mascot-logo-256x256.png',
  'assets/sangoub/sangoub-trio-7.png',
  'assets/sangoub/mascot-delivery.png',
  'assets/sangoub/mascot-icon.png',
  'payments/instapay.png',
  'payments/visa-mastercard.png',
  'payments/vodafone-cash.png',
  'favicon.ico',
  'privacy.html',
  'terms.html',
];

for (const asset of customerAssets) await copyAsset(asset);

const categoryDirectory = path.join(projectRoot, 'public', 'categories');
for (const entry of await readdir(categoryDirectory, { withFileTypes: true })) {
  if (entry.isFile() && entry.name.toLowerCase().endsWith('.jpg')) {
    await copyAsset(path.join('categories', entry.name));
  }
}
