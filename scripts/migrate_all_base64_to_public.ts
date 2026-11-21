import fs from 'node:fs';
import path from 'node:path';
import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('🚀 Migrating remaining Base64 products to public CDN assets...');

  const env = fs.readFileSync('.env', 'utf8');
  const envMap = Object.fromEntries(
    env
      .split('\n')
      .map((l) => l.trim())
      .filter((l) => l && !l.startsWith('#'))
      .map((l) => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );

  const supabase = createClient(envMap.VITE_SUPABASE_URL, envMap.VITE_SUPABASE_ANON_KEY);

  const outDir = path.join('public', 'products');
  if (!fs.existsSync(outDir)) {
    fs.mkdirSync(outDir, { recursive: true });
  }

  let totalMigrated = 0;
  let totalFailed = 0;

  while (true) {
    const { data: products, error } = await supabase
      .from('products')
      .select('id, name, image_url')
      .like('image_url', 'data:%')
      .limit(10);

    if (error) {
      console.error('Error querying batch:', error.message);
      await new Promise((r) => setTimeout(r, 1000));
      continue;
    }

    if (!products || products.length === 0) {
      console.log('No more base64 products found! All done.');
      break;
    }

    for (const p of products) {
      try {
        const match = p.image_url.match(/^data:([^;]+);base64,(.+)$/);
        if (!match) {
          console.warn(`Invalid data URL for ${p.name}`);
          totalFailed++;
          continue;
        }

        const contentType = match[1];
        const b64Data = match[2];
        const buffer = Buffer.from(b64Data, 'base64');
        const ext = contentType.includes('webp')
          ? 'webp'
          : contentType.includes('png')
          ? 'png'
          : 'jpg';

        const fileName = `${p.id}.${ext}`;
        const diskPath = path.join(outDir, fileName);

        // 1. Write file to public/products/
        fs.writeFileSync(diskPath, buffer);

        // 2. Update Supabase with lightweight CDN asset URL
        const cdnPath = `/products/${fileName}`;
        const { error: dbErr } = await supabase
          .from('products')
          .update({ image_url: cdnPath })
          .eq('id', p.id);

        if (dbErr) {
          console.error(`Failed to update DB for ${p.name}:`, dbErr.message);
          totalFailed++;
        } else {
          totalMigrated++;
          console.log(`[${totalMigrated}] Migrated: ${p.name} -> ${cdnPath}`);
        }
      } catch (err: any) {
        console.error(`Error processing ${p.name}:`, err.message);
        totalFailed++;
      }
    }
  }

  console.log('\n=============================================');
  console.log(`✅ All remaining base64 items migrated!`);
  console.log(`Newly migrated: ${totalMigrated}`);
  console.log(`Failed: ${totalFailed}`);
  console.log('=============================================\n');
}

main().catch(console.error);
