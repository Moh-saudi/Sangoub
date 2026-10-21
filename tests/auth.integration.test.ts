import { test, after } from "node:test";
import assert from "node:assert/strict";
import { initializeApp, deleteApp } from "firebase/app";
import {
  getAuth,
  connectAuthEmulator,
  createUserWithEmailAndPassword,
  sendEmailVerification,
  applyActionCode,
  signOut,
  signInWithEmailAndPassword,
  sendPasswordResetEmail,
  confirmPasswordReset,
  signInWithCredential,
  GoogleAuthProvider,
} from "firebase/auth";
import handler from "../api/orders.ts";
process.env.FIREBASE_AUTH_EMULATOR_HOST = "127.0.0.1:9099";
process.env.FIRESTORE_EMULATOR_HOST = "127.0.0.1:8080";
process.env.FIREBASE_PROJECT_ID = "demo-capital-talabat";
process.env.FIREBASE_DATABASE_ID = "(default)";
const project = "demo-capital-talabat";
const app = initializeApp(
  { apiKey: "demo-key", projectId: project },
  "auth-integration",
);
const auth = getAuth(app);
connectAuthEmulator(auth, "http://127.0.0.1:9099", { disableWarnings: true });
const api = async (token?: string, body: any = {}) => {
  let status = 200;
  let result: any;
  await handler(
    {
      method: "POST",
      headers: token ? { authorization: "Bearer " + token } : {},
      body,
    },
    {
      setHeader() {},
      status(code: number) {
        status = code;
        return this;
      },
      json(value: any) {
        result = value;
        return this;
      },
    },
  );
  return { status, result };
};
const codes = async () => {
  const result = await fetch(
    `http://127.0.0.1:9099/emulator/v1/projects/${project}/oobCodes`,
  );
  return (await result.json()).oobCodes;
};
after(async () => {
  await deleteApp(app);
});
test("API rejects unauthenticated order creation", async () => {
  assert.equal((await api()).status, 401);
});
test("email signup, verification, login and password recovery use Firebase Auth", async () => {
  const email = `customer-${Date.now()}@example.com`;
  const user = await createUserWithEmailAndPassword(
    auth,
    email,
    "FirstPassword123!",
  );
  assert.equal(user.user.emailVerified, false);
  assert.equal((await api(await user.user.getIdToken())).status, 403);
  await sendEmailVerification(user.user);
  const verification = (await codes()).find(
    (item: any) => item.email === email && item.requestType === "VERIFY_EMAIL",
  );
  assert.ok(verification);
  await applyActionCode(auth, verification.oobCode);
  await signOut(auth);
  const login = await signInWithEmailAndPassword(
    auth,
    email,
    "FirstPassword123!",
  );
  assert.equal(login.user.emailVerified, true);
  assert.equal((await api(await login.user.getIdToken())).status, 400);
  await sendPasswordResetEmail(auth, email);
  const reset = (await codes()).find(
    (item: any) =>
      item.email === email && item.requestType === "PASSWORD_RESET",
  );
  assert.ok(reset);
  await confirmPasswordReset(auth, reset.oobCode, "NewPassword123!");
  await signOut(auth);
  const changed = await signInWithEmailAndPassword(
    auth,
    email,
    "NewPassword123!",
  );
  assert.equal(changed.user.uid, user.user.uid);
});
test("Google provider credential is handled by Firebase Auth emulator", async () => {
  const payload = {
    sub: "google-emulator-user",
    email: "google-emulator@example.com",
    email_verified: true,
    name: "Emulator Google User",
  };
  const token =
    Buffer.from(JSON.stringify({ alg: "none", typ: "JWT" })).toString(
      "base64url",
    ) +
    "." +
    Buffer.from(JSON.stringify(payload)).toString("base64url") +
    ".";
  const result = await signInWithCredential(
    auth,
    GoogleAuthProvider.credential(token),
  );
  assert.equal(result.user.providerData[0].providerId, "google.com");
  assert.equal(result.user.emailVerified, true);
});
test("phone verification uses Firebase SMS session and confirmation", async () => {
  const request = async (path: string, data: object) => {
    const response = await fetch(
      `http://127.0.0.1:9099/identitytoolkit.googleapis.com/v1/accounts:${path}?key=demo-key`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      },
    );
    const result = await response.json();
    assert.ok(response.ok, JSON.stringify(result));
    return result;
  };
  const phone = "+201012345678";
  const session = await request("sendVerificationCode", {
    phoneNumber: phone,
    recaptchaToken: "emulator-only",
  });
  const codes = await (
    await fetch(
      `http://127.0.0.1:9099/emulator/v1/projects/${project}/verificationCodes`,
    )
  ).json();
  const code = codes.verificationCodes.find(
    (item: any) => item.phoneNumber === phone,
  );
  assert.ok(code);
  const result = await request("signInWithPhoneNumber", {
    sessionInfo: session.sessionInfo,
    code: code.code,
  });
  assert.equal(result.phoneNumber, phone);
  assert.equal((await api(result.idToken)).status, 400);
});
