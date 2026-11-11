export async function onRequest(context) {
  return new Response(JSON.stringify({ ok: true, message: "Functions are alive!" }), {
    status: 200,
    headers: { "Content-Type": "application/json", "Access-Control-Allow-Origin": "*" },
  });
}

