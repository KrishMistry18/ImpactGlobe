import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    if (!projectId || !clientEmail || !privateKey) {
      throw new Error(`Missing Firebase Admin environment variables. projectId: ${!!projectId}, clientEmail: ${!!clientEmail}, privateKey: ${!!privateKey}`);
    }

    // Clean up private key if it was pasted with quotes or escaped newlines
    privateKey = privateKey.trim().replace(/^["']+|["']+$/g, '').replace(/\\n/g, '\n').replace(/\\r/g, '');
    
    if (!privateKey.includes('\n')) {
      const beginMarker = '-----BEGIN PRIVATE KEY-----';
      const endMarker = '-----END PRIVATE KEY-----';
      if (privateKey.includes(beginMarker) && privateKey.includes(endMarker)) {
        let base64 = privateKey.substring(privateKey.indexOf(beginMarker) + beginMarker.length, privateKey.indexOf(endMarker));
        base64 = base64.replace(/\s+/g, '');
        const wrappedBase64 = base64.match(/.{1,64}/g)?.join('\n') || '';
        privateKey = `${beginMarker}\n${wrappedBase64}\n${endMarker}\n`;
      }
    }

    admin.initializeApp({
      credential: admin.credential.cert({
        projectId,
        clientEmail,
        privateKey,
      }),
    });
    console.log('Firebase Admin Initialized successfully.');
  } catch (error: any) {
    console.error('Firebase Admin Initialization Error:', error);
    // Rethrow to ensure any usage of adminDb crashes with this exact error, exposing it via the API 500 response.
    throw new Error(`Firebase Admin Init Failed: ${error.message}`);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
