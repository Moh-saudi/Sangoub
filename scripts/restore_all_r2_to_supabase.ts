import fs from 'node:fs';
import { S3Client, GetObjectCommand } from '@aws-sdk/client-s3';
import { createClient } from '@supabase/supabase-js';

async function main() {
  console.log('🔄 Starting restoration of all images from R2 back to Supabase...');

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

  const r2 = new S3Client({
    region: 'auto',
    endpoint: envMap.CLOUDFLARE_R2_S3_API,
    credentials: {
      accessKeyId: envMap.CLOUDFLARE_R2_ACCESS_KEY_ID,
      secretAccessKey: envMap.CLOUDFLARE_R2_SECRET_ACCESS_KEY,
    },
  });

  const supabase = createClient(envMap.VITE_SUPABASE_URL, envMap.VITE_SUPABASE_ANON_KEY);

  const { data: products, error } = await supabase
    .from('products')
    .select('id, name, image_url')
    .like('image_url', '%r2.dev%')
    .limit(500);

  if (error || !products) {
    console.error('Failed to query products:', error);
    process.exit(1);
  }

  console.log(`Found ${products.length} products to restore from R2.`);

  let success = 0;
  let failed = 0;

  // Process in batches of 10
  const BATCH_SIZE = 10;
  for (let i = 0; i < products.length; i += BATCH_SIZE) {
    const batch = products.slice(i, i + BATCH_SIZE);
    await Promise.all(
      batch.map(async (p) => {
        try {
          // Extract key from URL (e.g. products/uuid.ext)
          const url = p.image_url;
          const match = url.match(/products\/([^/]+)$/);
          if (!match) {
            failed++;
            return;
          }
          const key = `products/${match[1]}`;

          const res = await r2.send(
            new GetObjectCommand({
              Bucket: 'sangoub',
              Key: key,
            })
          );

          const chunks: Buffer[] = [];
          for await (const chunk of res.Body as any) {
            chunks.push(chunk);
          }
          const buffer = Buffer.concat(chunks);
          const contentType = res.ContentType || 'image/jpeg';
          const dataUrl = `data:${contentType};base64,${buffer.toString('base64')}`;

          const { error: updateErr } = await supabase
            .from('products')
            .update({ image_url: dataUrl })
            .eq('id', p.id);

          if (updateErr) {
            console.error(`Failed to update product ${p.name} (${p.id}):`, updateErr.message);
            failed++;
          } else {
            success++;
          }
        } catch (err: any) {
          console.error(`Error restoring ${p.name}:`, err.message);
          failed++;
        }
      })
    );
    console.log(`Progress: ${Math.min(i + BATCH_SIZE, products.length)} / ${products.length}`);
  }

  console.log(`✅ Restoration complete! Success: ${success}, Failed: ${failed}`);
}

main().catch(console.error);
