import 'server-only';

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Use Firestore emulator in development
if (process.env.NODE_ENV === 'development') {
  process.env.FIRESTORE_EMULATOR_HOST = 'localhost:8080';
}

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
    }),
  });
}

export const db = getFirestore();

// Helper functions for common operations
export const collections = {
  users: db.collection('users'),
  orders: db.collection('orders'),
  assets: db.collection('assets'),
  requests: db.collection('requests'),
  transactionHistory: db.collection('transaction_history'),
  kycData: db.collection('kyc_data'),
  auditLogs: db.collection('audit_logs'),
  alerts: db.collection('alerts'),
  scheduledOrders: db.collection('scheduled_orders'),
  advancedOrders: db.collection('advanced_orders'),
  portfolioAnalytics: db.collection('portfolio_analytics'),
  tokenRevocation: db.collection('token_revocation'),
  chats: db.collection('chats'),
  messages: db.collection('messages'),
};
