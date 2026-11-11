// ==============================================================================
// 💳 Cloudflare Pages Function: Geidea Webhook Callback Receiver
// مسار: functions/api/geidea/callback.ts
// يستقبل إشعارات Geidea بعد إتمام أو إلغاء الدفع (Server-to-Server webhook)
// ==============================================================================

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Content-Type': 'application/json',
};

export async function onRequestOptions() {
  return new Response(null, { status: 204, headers: CORS_HEADERS });
}

export async function onRequest(context: any) {
  if (context.request.method === 'OPTIONS') {
    return onRequestOptions();
  }
  if (context.request.method === 'POST') {
    return onRequestPost(context);
  }
  return onRequestGet();
}

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => ({}));
    console.log('[Geidea Callback] Received webhook:', JSON.stringify(body).slice(0, 500));

    return new Response(
      JSON.stringify({ ok: true, received: true, timestamp: new Date().toISOString() }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: true, received: true, error: err?.message }),
      { status: 200, headers: CORS_HEADERS }
    );
  }
}

export async function onRequestGet() {
  return new Response(
    JSON.stringify({ ok: true, service: 'Sangoub Geidea Callback', status: 'active' }),
    { status: 200, headers: CORS_HEADERS }
  );
}

