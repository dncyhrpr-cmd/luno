
import admin, { ServiceAccount } from 'firebase-admin';
import serviceAccountJSON from '../../serviceAccountKey.json';

let db: admin.firestore.Firestore;
let auth: admin.auth.Auth;

try {
    // Create a correctly formatted service account object
    const serviceAccount = {
        ...serviceAccountJSON,
        private_key: serviceAccountJSON.private_key.replace(/\\n/g, '\n'),
    };

    if (!admin.apps.length) {
        admin.initializeApp({
            credential: admin.credential.cert(serviceAccount as unknown as ServiceAccount),
            databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
        });
        console.log('Firebase Admin SDK initialized successfully.');
    } else {
        console.log('Firebase Admin SDK already initialized.');
    }

    db = admin.firestore();
    auth = admin.auth();

} catch (error: any) {
    console.error('CRITICAL: Firebase Admin SDK initialization failed:', error);
}

export { admin, db, auth };
