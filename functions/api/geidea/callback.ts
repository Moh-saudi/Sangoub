// ==============================================================================
// 💳 Cloudflare Pages Function: Geidea Webhook Callback Handler
// مسار: functions/api/geidea/callback.ts
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

export async function onRequestPost(context: any) {
  try {
    const body = await context.request.json().catch(() => ({}));
    console.log('Geidea webhook callback received:', JSON.stringify(body));

    // Acknowledge receipt to Geidea
    return new Response(
      JSON.stringify({
        ok: true,
        received: true,
        status: 'SUCCESS',
        timestamp: new Date().toISOString(),
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'Callback error' }),
      { status: 200, headers: CORS_HEADERS }
    );
  }
}

export async function onRequestGet(context: any) {
  return new Response(
    JSON.stringify({ ok: true, service: 'Sangoub Geidea Callback Endpoint Active' }),
    { status: 200, headers: CORS_HEADERS }
  );
}
