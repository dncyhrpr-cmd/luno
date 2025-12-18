
import admin, { ServiceAccount } from 'firebase-admin';

let db: admin.firestore.Firestore | null = null;
let auth: admin.auth.Auth | null = null;

function initializeFirebaseAdmin() {
    if (db && auth) return { db, auth };

    try {
        // Check if required environment variables are present
        if (!process.env.FIREBASE_PROJECT_ID || !process.env.FIREBASE_PRIVATE_KEY || !process.env.FIREBASE_CLIENT_EMAIL) {
            console.warn('Firebase service account environment variables not found. Skipping Firebase initialization.');
            // Don't throw, just return null
            return { db: null, auth: null };
        }

        // Create a service account object from environment variables
        const serviceAccount = {
            type: "service_account",
            project_id: process.env.FIREBASE_PROJECT_ID,
            private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID,
            private_key: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
            client_email: process.env.FIREBASE_CLIENT_EMAIL,
            client_id: process.env.FIREBASE_CLIENT_ID,
            auth_uri: "https://accounts.google.com/o/oauth2/auth",
            token_uri: "https://oauth2.googleapis.com/token",
            auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
            client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${process.env.FIREBASE_CLIENT_EMAIL}`
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

        return { db, auth };
    } catch (error: any) {
        console.error('CRITICAL: Firebase Admin SDK initialization failed:', error);
        // Don't throw, return null
        return { db: null, auth: null };
    }
}

export { admin };

export const getDb = () => {
    if (!db) {
        const result = initializeFirebaseAdmin();
        if (!result.db) {
            throw new Error('Firebase Firestore not initialized. Check environment variables.');
        }
        db = result.db;
    }
    return db;
};

export const getAuth = () => {
    if (!auth) {
        const result = initializeFirebaseAdmin();
        if (!result.auth) {
            throw new Error('Firebase Auth not initialized. Check environment variables.');
        }
        auth = result.auth;
    }
    return auth;
};
