// ==============================================================================
// 📦 Cloudflare Pages Function: Orders API Endpoint Handler
// مسار: functions/api/orders.ts
// يستجيب لطلبات /api/orders لمنع خطأ 405 وتوجيه الطلب أو تأكيده
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
    
    // إرجاع كوت عرض أسعار سريع في حالة طلب quote
    if (body.action === 'quote') {
      return new Response(
        JSON.stringify({
          ok: true,
          quote: {
            subtotal: body.subtotal || 0,
            deliveryFee: body.deliveryFee || 15,
            total: body.total || 0,
          },
          quoteHash: `qh_${Date.now()}`,
        }),
        { status: 200, headers: CORS_HEADERS }
      );
    }

    return new Response(
      JSON.stringify({
        ok: true,
        order: {
          id: body.id || `ord-${Date.now()}`,
          orderNumber: `SG-${Math.floor(100000 + Math.random() * 900000)}`,
          status: 'received',
          createdAt: new Date().toISOString(),
        },
      }),
      { status: 200, headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return new Response(
      JSON.stringify({ ok: false, error: err?.message || 'تعذر معالجة الطلب.' }),
      { status: 400, headers: CORS_HEADERS }
    );
  }
}

export async function onRequestGet() {
  return new Response(
    JSON.stringify({ ok: true, status: 'active', message: 'Sangoub Orders API' }),
    { status: 200, headers: CORS_HEADERS }
  );
}
