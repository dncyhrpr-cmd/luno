
import admin, { ServiceAccount } from 'firebase-admin';

let db: admin.firestore.Firestore | null = null;
let auth: admin.auth.Auth | null = null;

function initializeFirebaseAdmin() {
    if (db && auth) return { db, auth };

    try {
        let serviceAccount: ServiceAccount | null = null;

        // Try to load from environment variable first (for production)
        const serviceAccountJson = process.env.FIREBASE_SERVICE_ACCOUNT_JSON;
        if (serviceAccountJson && serviceAccountJson.trim() !== '' && !serviceAccountJson.includes('/') && !serviceAccountJson.includes('\\')) {
            // If it's not a file path, treat it as JSON string
            try {
                serviceAccount = JSON.parse(serviceAccountJson);
                console.log('Loaded Firebase service account from environment variable.');
            } catch (parseError) {
                console.warn('Could not parse FIREBASE_SERVICE_ACCOUNT_JSON as JSON:', parseError);
            }
        }

        // Try to load from JSON file (for local development)
        if (!serviceAccount) {
            const serviceAccountPath = serviceAccountJson || 'serviceAccountKey.json';
            try {
                const fs = require('fs');
                const path = require('path');
                const filePath = path.resolve(process.cwd(), serviceAccountPath);
                if (fs.existsSync(filePath)) {
                    const serviceAccountFileJson = fs.readFileSync(filePath, 'utf8');
                    serviceAccount = JSON.parse(serviceAccountFileJson);
                    console.log('Loaded Firebase service account from JSON file.');
                }
            } catch (fileError) {
                console.warn('Could not load Firebase service account from JSON file:', fileError);
            }
        }

        // If JSON loading failed, try individual environment variables
        if (!serviceAccount) {
            // Try to get individual Firebase environment variables
            const projectId = process.env.FIREBASE_PROJECT_ID || process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;
            const privateKey = process.env.FIREBASE_PRIVATE_KEY;
            const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || process.env.NEXT_PUBLIC_FIREBASE_CLIENT_EMAIL;

            if (!projectId || !privateKey || !clientEmail) {
                console.warn('Firebase service account environment variables not found. Available env vars:', {
                    hasProjectId: !!projectId,
                    hasPrivateKey: !!privateKey,
                    hasClientEmail: !!clientEmail
                });
                console.warn('Skipping Firebase initialization.');
                return { db: null, auth: null };
            }

            // Create a service account object from environment variables
            serviceAccount = {
                type: "service_account",
                project_id: projectId,
                private_key_id: process.env.FIREBASE_PRIVATE_KEY_ID || "default",
                private_key: privateKey.replace(/\\n/g, '\n'),
                client_email: clientEmail,
                client_id: process.env.FIREBASE_CLIENT_ID || "default",
                auth_uri: "https://accounts.google.com/o/oauth2/auth",
                token_uri: "https://oauth2.googleapis.com/token",
                auth_provider_x509_cert_url: "https://www.googleapis.com/oauth2/v1/certs",
                client_x509_cert_url: `https://www.googleapis.com/robot/v1/metadata/x509/${clientEmail}`,
                universe_domain: "googleapis.com"
            } as ServiceAccount;
            console.log('Using Firebase service account from individual environment variables.');
        }

        if (!admin.apps.length) {
            admin.initializeApp({
                credential: admin.credential.cert(serviceAccount),
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
