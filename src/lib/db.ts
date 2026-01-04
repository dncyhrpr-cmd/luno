import 'server-only';

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Initialize Firebase Admin SDK
if (!admin.apps.length) {
  const serviceAccount = require('../../serviceAccountKey.json');

  admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
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
