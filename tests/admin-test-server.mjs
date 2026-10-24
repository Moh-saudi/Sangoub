// Exercise the actual web server, including its HMR-free Vite client.
if (process.env.FIRESTORE_EMULATOR_HOST !== '127.0.0.1:8080' ||
    process.env.FIREBASE_AUTH_EMULATOR_HOST !== '127.0.0.1:9099' ||
    process.env.FIREBASE_PROJECT_ID !== 'demo-capital-talabat') {
  throw new Error('Local demo emulators required');
}
process.env.PORT = '3105';
await import('../server.ts');
