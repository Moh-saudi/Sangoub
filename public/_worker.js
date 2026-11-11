// ==============================================================================
// 🚀 Cloudflare Pages Advanced Mode: Native Edge Worker (_worker.js)
// Handles API routes (/api/orders, /api/geidea/session, /api/geidea/callback)
// Falls back to static assets (env.ASSETS) for frontend files
// ==============================================================================

const GEIDEA_CONFIG = {
  merchantPublicKey: '3448c010-87b1-41e7-9771-cac444268cfb',
  apiPassword: 'ecba1701-4889-4357-ba09-4d8d864f6d64',
  baseUrl: 'https://api.merchant.geidea.net',
  callbackUrl: 'https://sangoub.el7lm.com/api/geidea/callback',
  returnUrl: 'https://sangoub.el7lm.com/checkout/success',
};

function formatTimestamp(date = new Date()) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(
    date.getDate()
  )} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

async function computeHmacSha256(secret, message) {
  const enc = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    enc.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign']
  );
  const signature = await crypto.subtle.sign('HMAC', key, enc.encode(message));
  const bytes = new Uint8Array(signature);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization, X-Requested-With',
  'Content-Type': 'application/json; charset=utf-8',
};

async function handleGeideaSession(body, appOrigin) {
  const orderId = String(body.orderId || `ord-${Date.now()}`);
  const amount = Number(body.amount) || 20.0;
  const formattedAmount = amount.toFixed(2);
  const currency = 'EGP';
  const referenceId = `SNG_${orderId.replace(/[^a-zA-Z0-9]/g, '').slice(0, 20)}_${Date.now().toString().slice(-6)}`;
  const timestamp = formatTimestamp();

  const dataToSign = `${GEIDEA_CONFIG.merchantPublicKey}${formattedAmount}${currency}${referenceId}${timestamp}`;
  const signature = await computeHmacSha256(GEIDEA_CONFIG.apiPassword, dataToSign);

  const authHeader = btoa(`${GEIDEA_CONFIG.merchantPublicKey}:${GEIDEA_CONFIG.apiPassword}`);

  const nameParts = String(body.customerName || 'عميل سنجوب').trim().split(/\s+/);
  const firstName = nameParts[0] || 'عميل';
  const lastName = nameParts.slice(1).join(' ') || 'سنجوب';

  const callbackUrl = `${appOrigin}/api/geidea/callback`;
  const returnUrl = `${appOrigin}/checkout/success?orderId=${encodeURIComponent(orderId)}`;

  const geideaPayload = {
    amount,
    currency,
    merchantReferenceId: referenceId,
    timestamp,
    signature,
    callbackUrl,
    callback: callbackUrl,
    callBackUrl: callbackUrl,
    returnUrl,
    language: 'ar',
    customer: {
      email: body.customerEmail || 'customer@sangoub.el7lm.com',
      firstName,
      lastName,
      phone: body.customerPhone || '01000000000',
    },
    metadata: {
      system: 'Sangoub',
      orderId,
    },
  };

  const geideaRes = await fetch(`${GEIDEA_CONFIG.baseUrl}/payment-intent/api/v2/direct/session`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Basic ${authHeader}`,
    },
    body: JSON.stringify(geideaPayload),
  });

  const geideaData = await geideaRes.json().catch(() => ({}));

  if (!geideaRes.ok || !geideaData?.session?.id) {
    return new Response(
      JSON.stringify({
        ok: false,
        error:
          geideaData?.detailedResponseDescription ||
          geideaData?.responseDescription ||
          'تعذر تهيئة جلسة الدفع في جيديا.',
        details: geideaData,
      }),
      { status: 400, headers: CORS_HEADERS }
    );
  }

  return new Response(
    JSON.stringify({
      ok: true,
      sessionId: geideaData.session.id,
      orderId,
      referenceId,
    }),
    { status: 200, headers: CORS_HEADERS }
  );
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);

    // 1. CORS Preflight
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: CORS_HEADERS });
    }

    // 2. Geidea Direct Session Endpoint
    if (url.pathname === '/api/geidea/session' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        return await handleGeideaSession(body, url.origin);
      } catch (err) {
        return new Response(
          JSON.stringify({ ok: false, error: err?.message || 'Server error' }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // 3. Orders Endpoint (/api/orders)
    if (url.pathname === '/api/orders' && request.method === 'POST') {
      try {
        const body = await request.json().catch(() => ({}));
        if (body.action === 'payment-session') {
          return await handleGeideaSession(body, url.origin);
        }

        // Return quote or default
        return new Response(
          JSON.stringify({ ok: true, action: body.action, quoteHash: `quote_${Date.now()}` }),
          { status: 200, headers: CORS_HEADERS }
        );
      } catch (err) {
        return new Response(
          JSON.stringify({ ok: false, error: err?.message || 'Server error' }),
          { status: 500, headers: CORS_HEADERS }
        );
      }
    }

    // 4. Geidea Webhook Callback
    if (url.pathname === '/api/geidea/callback') {
      return new Response(
        JSON.stringify({ ok: true, received: true, status: 'SUCCESS' }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    // 5. Fallback to Cloudflare Pages Static Assets
    if (env && env.ASSETS && typeof env.ASSETS.fetch === 'function') {
      return env.ASSETS.fetch(request);
    }

    return new Response('Not found', { status: 404 });
  },
};
