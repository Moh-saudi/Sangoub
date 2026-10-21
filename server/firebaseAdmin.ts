import {
  getApps,
  initializeApp,
  cert,
  applicationDefault,
} from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import config from "../firebase-applet-config.json" with { type: "json" };
export function adminServices() {
  const projectId = process.env.FIREBASE_PROJECT_ID || config.projectId;
  if (
    !process.env.FIRESTORE_EMULATOR_HOST &&
    !(process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY)
  )
    throw new Error("Firebase server credentials are not configured");
  const app =
    getApps()[0] ||
    initializeApp({
      projectId,
      credential:
        process.env.FIREBASE_CLIENT_EMAIL && process.env.FIREBASE_PRIVATE_KEY
          ? cert({
              projectId,
              clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
              privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(
                /\\n/g,
                "\n",
              ),
            })
          : applicationDefault(),
    });
  return {
    auth: getAuth(app),
    db: getFirestore(
      app,
      process.env.FIREBASE_DATABASE_ID || config.firestoreDatabaseId,
    ),
  };
}
