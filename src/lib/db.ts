import 'server-only';

import admin from 'firebase-admin';
import { getFirestore } from 'firebase-admin/firestore';

// Connect to production Firestore

let dbInstance: any = null;

export const getDb = () => {
  if (!dbInstance) {
    try {
      if (!admin.apps.length) {
        const projectId = process.env.FIREBASE_PROJECT_ID;
        const privateKey = process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n');
        const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;

        if (!projectId || !privateKey || !clientEmail) {
          throw new Error(`Missing Firebase credentials: projectId=${!!projectId}, privateKey=${!!privateKey}, clientEmail=${!!clientEmail}`);
        }

        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            privateKey,
            clientEmail,
          }),
        });
        console.log('Firebase Admin initialized successfully');
      }
      dbInstance = getFirestore();
      console.log('Firestore instance created successfully');
    } catch (error) {
      console.error('Failed to initialize Firebase:', error);
      throw error;
    }
  }
  return dbInstance;
};

export const db = getDb();

// Helper functions for common operations
export const collections = {
  get users() {
    try {
      return getDb().collection('users');
    } catch (error) {
      console.error('Failed to get users collection:', error);
      throw error;
    }
  },
  get orders() {
    try {
      return getDb().collection('orders');
    } catch (error) {
      console.error('Failed to get orders collection:', error);
      throw error;
    }
  },
  get assets() {
    try {
      return getDb().collection('assets');
    } catch (error) {
      console.error('Failed to get assets collection:', error);
      throw error;
    }
  },
  get requests() {
    try {
      return getDb().collection('requests');
    } catch (error) {
      console.error('Failed to get requests collection:', error);
      throw error;
    }
  },
  get transactionHistory() {
    try {
      return getDb().collection('transaction_history');
    } catch (error) {
      console.error('Failed to get transactionHistory collection:', error);
      throw error;
    }
  },
  get kycData() {
    try {
      return getDb().collection('kyc_data');
    } catch (error) {
      console.error('Failed to get kycData collection:', error);
      throw error;
    }
  },
  get auditLogs() {
    try {
      return getDb().collection('audit_logs');
    } catch (error) {
      console.error('Failed to get auditLogs collection:', error);
      throw error;
    }
  },
  get alerts() {
    try {
      return getDb().collection('alerts');
    } catch (error) {
      console.error('Failed to get alerts collection:', error);
      throw error;
    }
  },
  get scheduledOrders() {
    try {
      return getDb().collection('scheduled_orders');
    } catch (error) {
      console.error('Failed to get scheduledOrders collection:', error);
      throw error;
    }
  },
  get advancedOrders() {
    try {
      return getDb().collection('advanced_orders');
    } catch (error) {
      console.error('Failed to get advancedOrders collection:', error);
      throw error;
    }
  },
  get portfolioAnalytics() {
    try {
      return getDb().collection('portfolio_analytics');
    } catch (error) {
      console.error('Failed to get portfolioAnalytics collection:', error);
      throw error;
    }
  },
  get tokenRevocation() {
    try {
      return getDb().collection('token_revocation');
    } catch (error) {
      console.error('Failed to get tokenRevocation collection:', error);
      throw error;
    }
  },
  get chats() {
    try {
      return getDb().collection('chats');
    } catch (error) {
      console.error('Failed to get chats collection:', error);
      throw error;
    }
  },
  get messages() {
    try {
      return getDb().collection('messages');
    } catch (error) {
      console.error('Failed to get messages collection:', error);
      throw error;
    }
  },
};
