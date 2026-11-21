import fs from 'node:fs';
import { createClient } from '@supabase/supabase-js';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

async function main() {
  console.log('🚀 Starting Cloudflare R2 Migration for all Base64 products in Supabase...');

  const env = fs.readFileSync('.env', 'utf8');
  const envMap = Object.fromEntries(
    env.split('\n')
      .map(l => l.trim())
      .filter(l => l && !l.startsWith('#'))
      .map(l => {
        const idx = l.indexOf('=');
        return [l.slice(0, idx).trim(), l.slice(idx + 1).trim()];
      })
  );

  const r2 = new S3Client({
    region: 'auto',
    endpoint: envMap.CLOUDFLARE_R2_S3_API || 'https://' + envMap.CLOUDFLARE_R2_ACCOUNT_ID + '.r2.cloudflarestorage.com',
    credentials: {
      accessKeyId: envMap.CLOUDFLARE_R2_ACCESS_KEY_ID || envMap.R2_ACCESS_KEY_ID,
      secretAccessKey: envMap.CLOUDFLARE_R2_SECRET_ACCESS_KEY || envMap.R2_SECRET_ACCESS_KEY,
    },
  });

  const bucket = envMap.CLOUDFLARE_R2_BUCKET || envMap.R2_BUCKET || 'sangoub';
  const cdnBase = 'https://pub-39e754c2871845ba91c1ec271a0400e8.r2.dev';

  const supabase = createClient(
    envMap.VITE_SUPABASE_URL || 'https://tvnsqatkaqyubeznhnmu.supabase.co',
    envMap.VITE_SUPABASE_ANON_KEY || 'sb_publishable_9ORqYV9HK0AbacKtYSRZiA_K7hcJ4yI'
  );

  const { data: allProducts, error } = await supabase
    .from('products')
    .select('id, name, image_url')
    .limit(1000);

  if (error || !allProducts) {
    console.error('Failed to read products:', error);
    process.exit(1);
  }

  const base64List = allProducts.filter(
    p => p.image_url && typeof p.image_url === 'string' && p.image_url.startsWith('data:')
  );

  console.log(`Found ${base64List.length} products with Base64 images to migrate.`);

  let successCount = 0;
  let failCount = 0;
  let bytesSaved = 0;

  // Process in concurrent batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < base64List.length; i += BATCH_SIZE) {
    const batch = base64List.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async p => {
        try {
          const match = p.image_url.match(/^data:([^;]+);base64,(.+)$/);
          if (!match) {
            failCount++;
            return;
          }
          const contentType = match[1];
          const b64Data = match[2];
          const buffer = Buffer.from(b64Data, 'base64');
          const ext = contentType.includes('webp')
            ? 'webp'
            : contentType.includes('png')
            ? 'png'
            : contentType.includes('avif')
            ? 'avif'
            : 'jpg';

          const key = `products/${p.id}.${ext}`;
          await r2.send(
            new PutObjectCommand({
              Bucket: bucket,
              Key: key,
              Body: buffer,
              ContentType: contentType,
              CacheControl: 'public, max-age=31536000, immutable',
            })
          );

          const cdnUrl = `${cdnBase}/${key}`;
          const { error: updateErr } = await supabase
            .from('products')
            .update({ image_url: cdnUrl })
            .eq('id', p.id);

          if (updateErr) {
            console.error(`Failed to update DB for ${p.id}:`, updateErr.message);
            failCount++;
          } else {
            successCount++;
            bytesSaved += p.image_url.length;
          }
        } catch (err: any) {
          console.error(`Error migrating product ${p.id}:`, err.message);
          failCount++;
        }
      })
    );

    const progress = Math.min(i + BATCH_SIZE, base64List.length);
    console.log(`Progress: ${progress} / ${base64List.length} (${((bytesSaved) / 1024 / 1024).toFixed(2)} MB offloaded)`);
  }

  console.log(`\n🎉 Migration Complete!`);
  console.log(`- Successfully offloaded to R2: ${successCount} products`);
  console.log(`- Total data removed from database: ${(bytesSaved / 1024 / 1024).toFixed(2)} MB`);
  if (failCount > 0) {
    console.log(`- Failed: ${failCount}`);
  }
}

main().catch(console.error);
