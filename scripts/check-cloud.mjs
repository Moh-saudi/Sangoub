import { readFile } from "node:fs/promises";
const config = JSON.parse(
  await readFile(
    new URL("../firebase-applet-config.json", import.meta.url),
    "utf8",
  ),
);
const site = process.env.APP_URL || "https://capital-talabat.vercel.app";
let failed = false;
async function check(label, operation) {
  try {
    const result = await operation();
    if (!result.ok) failed = true;
    console.log(JSON.stringify({ check: label, ...result }));
  } catch (error) {
    failed = true;
    console.log(
      JSON.stringify({
        check: label,
        ok: false,
        error: error.cause?.code || error.code || "NETWORK_ERROR",
      }),
    );
  }
}
await check("Firebase Authentication", async () => {
  const response = await fetch(
    "https://identitytoolkit.googleapis.com/v1/projects?key=" + config.apiKey,
    { signal: AbortSignal.timeout(20000) },
  );
  const body = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    ...(response.ok
      ? { authorizedDomains: body.authorizedDomains || [] }
      : { error: body.error?.message }),
  };
});
await check("Firestore public catalog", async () => {
  const response = await fetch(
    `https://firestore.googleapis.com/v1/projects/${config.projectId}/databases/${config.firestoreDatabaseId}/documents/stores?pageSize=1&key=${config.apiKey}`,
    { signal: AbortSignal.timeout(20000) },
  );
  const body = await response.json();
  return {
    ok: response.ok,
    status: response.status,
    ...(!response.ok ? { error: body.error?.message } : {}),
  };
});
await check("Vercel frontend configuration", async () => {
  const response = await fetch(site, { signal: AbortSignal.timeout(20000) });
  const html = await response.text();
  const path = html.match(/src="(\/assets\/[^\"]+\.js)"/)?.[1];
  if (!response.ok || !path)
    return {
      ok: false,
      status: response.status,
      error: "FRONTEND_ASSET_NOT_FOUND",
    };
  const asset = await fetch(new URL(path, site), {
    signal: AbortSignal.timeout(20000),
  });
  const code = await asset.text();
  return {
    ok: asset.ok && code.includes(config.appId),
    status: response.status,
    expectedProject: config.projectId,
  };
});
await check("Order API authentication gate", async () => {
  const response = await fetch(new URL("/api/orders", site), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: "{}",
    signal: AbortSignal.timeout(20000),
  });
  return {
    ok:
      response.status === 401 &&
      response.headers.get("content-type")?.includes("application/json"),
    status: response.status,
  };
});
console.log(
  "Public checks do not establish administrative access, provider readiness, or complete production security.",
);
process.exitCode = failed ? 1 : 0;
