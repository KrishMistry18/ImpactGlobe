import * as admin from 'firebase-admin';

if (!admin.apps.length) {
  try {
    const projectId = process.env.FIREBASE_PROJECT_ID || 'demo-project';
    const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
    let privateKey = process.env.FIREBASE_PRIVATE_KEY;

    // Clean up private key if it was pasted with quotes or escaped newlines
    if (privateKey) {
      privateKey = privateKey.trim().replace(/^["']+|["']+$/g, '');
      privateKey = privateKey.replace(/\\n/g, '\n');
      privateKey = privateKey.replace(/\\r/g, '');
      
      // Ensure proper newlines around the header and footer in case they were stripped
      if (!privateKey.includes('\n')) {
        privateKey = privateKey.replace('-----BEGIN PRIVATE KEY-----', '-----BEGIN PRIVATE KEY-----\n')
                               .replace('-----END PRIVATE KEY-----', '\n-----END PRIVATE KEY-----');
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
