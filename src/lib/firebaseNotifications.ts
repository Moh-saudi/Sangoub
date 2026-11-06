import { initializeApp } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import savedConfig from '../../firebase-applet-config.json';

const config = {
  ...savedConfig,
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || savedConfig.apiKey,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || savedConfig.projectId,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || savedConfig.authDomain,
  appId: import.meta.env.VITE_FIREBASE_APP_ID || savedConfig.appId,
  firestoreDatabaseId: import.meta.env.VITE_FIREBASE_DATABASE_ID || savedConfig.firestoreDatabaseId,
};

const firebaseNotificationApp = initializeApp(config, 'sangoub-notifications');
export const db = getFirestore(firebaseNotificationApp, config.firestoreDatabaseId);
