import admin from 'firebase-admin';

// Initialize Firebase Admin globally to prevent multiple initializations
if (!admin.apps.length) {
  try {
    // Determine the path to the service account or read it from environment variables
    // For production, it's best to parse FIREBASE_SERVICE_ACCOUNT_JSON from process.env
    // But for simplicity during dev, requiring the key or using logic
    if (process.env.FIREBASE_SERVICE_ACCOUNT_JSON) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT_JSON);
      
      // Fix for private_key newlines in env variables
      if (serviceAccount.private_key) {
        serviceAccount.private_key = serviceAccount.private_key.replace(/\\n/g, '\n');
      }
      
      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount)
      });
      console.log('🔥 Firebase Admin initialized via JSON ENV');
    } else {
      console.warn('⚠️ FIREBASE_SERVICE_ACCOUNT_JSON is missing! Google Auth will likely fail.');
      // Optional fallback if there's a file path
      // admin.initializeApp({ credential: admin.credential.applicationDefault() });
    }
  } catch (error) {
    console.error('🔥 Firebase Admin initialization error', error);
  }
}

export default admin;
