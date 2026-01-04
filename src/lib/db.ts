import 'server-only';

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Connect to production Firestore

let dbInstance: any = null;

export const getDb = () => {
  if (!dbInstance) {
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
      });
    }
    dbInstance = getFirestore();
  }
  return dbInstance;
};

export const db = getDb();

// Helper functions for common operations
export const collections = {
  get users() { return getDb().collection('users'); },
  get orders() { return getDb().collection('orders'); },
  get assets() { return getDb().collection('assets'); },
  get requests() { return getDb().collection('requests'); },
  get transactionHistory() { return getDb().collection('transaction_history'); },
  get kycData() { return getDb().collection('kyc_data'); },
  get auditLogs() { return getDb().collection('audit_logs'); },
  get alerts() { return getDb().collection('alerts'); },
  get scheduledOrders() { return getDb().collection('scheduled_orders'); },
  get advancedOrders() { return getDb().collection('advanced_orders'); },
  get portfolioAnalytics() { return getDb().collection('portfolio_analytics'); },
  get tokenRevocation() { return getDb().collection('token_revocation'); },
  get chats() { return getDb().collection('chats'); },
  get messages() { return getDb().collection('messages'); },
};
