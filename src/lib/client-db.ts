'use client';

import { initializeApp, getApp, getApps, FirebaseOptions } from 'firebase/app';
import { getFirestore } from 'firebase/firestore';
import { getAuth } from 'firebase/auth';
import { getStorage } from 'firebase/storage';

// This function safely builds the config object
const getFirebaseConfig = (): FirebaseOptions | null => {
  const apiKey = process.env.NEXT_PUBLIC_FIREBASE_API_KEY;
  const authDomain = process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN;
  const projectId = process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID;

  // Essential check: Ensure the core config values are present
  if (apiKey && authDomain && projectId) {
    return {
      apiKey,
      authDomain,
      projectId,
      storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
      messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
      appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
      measurementId: process.env.NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID,
    };
  } 

  console.error('CRITICAL: Firebase configuration is missing or incomplete in .env.local');
  return null;
};

function getFirebaseApp() {
  if (getApps().length === 0) {
    const firebaseConfig = getFirebaseConfig();
    if (!firebaseConfig) {
        // This error will be caught by the application
        throw new Error('Firebase initialization failed due to missing configuration.');
    }
    return initializeApp(firebaseConfig);
  } else {
    return getApp();
  }
}

// Memoization for Firestore instance
const getFirestoreInstance = () => {
  const app = getFirebaseApp();
  return getFirestore(app);
};

// Memoization for Auth instance
const getAuthInstance = () => {
  const app = getFirebaseApp();
  return getAuth(app);
};

// Memoization for Storage instance
const getStorageInstance = () => {
    const app = getFirebaseApp();
    return getStorage(app);
}

// Export singleton instances
export const getDb = getFirestoreInstance;
export const getAuth2 = getAuthInstance;
export const storage = getStorageInstance();
