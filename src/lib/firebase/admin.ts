import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-project';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    // Clean up private key if it was pasted with quotes or escaped newlines
    if (privateKey) {
      privateKey = privateKey.trim().replace(/^["']+|["']+$/g, '').replace(/\\n/g, '\n').replace(/\\r/g, '');
      if (!privateKey.includes('\n')) {
        const beginMarker = '-----BEGIN PRIVATE KEY-----';
        const endMarker = '-----END PRIVATE KEY-----';
        if (privateKey.includes(beginMarker) && privateKey.includes(endMarker)) {
          const base64 = privateKey.substring(privateKey.indexOf(beginMarker) + beginMarker.length, privateKey.indexOf(endMarker)).trim();
          const wrappedBase64 = base64.match(/.{1,64}/g)?.join('\n') || '';
          privateKey = `${beginMarker}\n${wrappedBase64}\n${endMarker}\n`;
        }
      }
    }

    if (projectId && clientEmail && privateKey) {
      try {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey,
          }),
        });
      } catch (certError) {
        console.error('Firebase cert initialization error, falling back to dummy init', certError);
        admin.initializeApp({ projectId });
      }
    } else {
      // For build time where env vars might be missing
      admin.initializeApp({
        projectId,
      });
    }
  } catch (error) {
    console.error('Firebase admin initialization error', error);
  }
}

export const adminDb = admin.firestore();
export const adminAuth = admin.auth();
