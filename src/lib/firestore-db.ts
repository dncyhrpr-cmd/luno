import { getDb, admin } from './firestore-admin';
import { QueryDocumentSnapshot } from 'firebase-admin/firestore';
import { structuredLog } from './correlation'; // Assuming structuredLog is available here

export const KYC_STATUSES = {
    UNSUBMITTED: 'unsubmitted',
    PENDING: 'pending',
    APPROVED: 'approved',
    REJECTED: 'rejected',
} as const;

// ... (rest of the interfaces are the same)

export interface User {
  id: string;
  username: string;
  email: string;
  role: string;
  roles: string[]; 
  balance: number;
  twoFactorEnabled: boolean;
  migrationStatus: 'legacy' | 'migrated'; 
  createdAt: any;
  status?: 'active' | 'inactive' | 'banned';
  lastLogin?: any;
  updatedAt?: any;
}

export interface Order {
  id: string;
  userId: string;
  type: string;
  symbol: string;
  quantity: number;
  price: number;
  status: string;
  executedQuantity: number;
  createdAt: any;
}

export interface Asset {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  averagePrice: number;
  currentPrice?: number;
  createdAt: any;
}

export interface TransactionRequest {
  id: string;
  userId: string;
  type: 'deposit' | 'withdraw';
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  reason?: string;
  createdAt: any;
  approvedAt?: any;
  approvedBy?: string;
  executedAt?: any;
  processedBy?: string;
}

export interface TransactionHistory {
  id: string;
  userId: string;
  type: 'deposit' | 'withdraw' | 'buy' | 'sell' | 'fee';
  amount: number;
  symbol?: string;
  quantity?: number;
  price?: number;
  description: string;
  status: 'completed' | 'pending' | 'failed';
  balanceBefore: number;
  balanceAfter: number;
  createdAt: any;
}

export interface KYCData {
    id: string;
    userId: string;
    fullName: string;
    dateOfBirth: string;
    phoneNumber?: string;
    nationality?: string;
    idType?: 'passport' | 'driving_license' | 'national_id';
    idNumber?: string;
    address: string;
    city?: string;
    postalCode?: string;
    country?: string;
    status: typeof KYC_STATUSES[keyof typeof KYC_STATUSES];
    selfieUrl: string;
    documentUrl: string;
    rejectionReason?: string;
    submittedAt: any;
    verifiedAt?: any;
    verifiedBy?: string;
    createdAt: any;
    adminNotes?: string;
}

const REQUIRED_KYC_FIELDS: Array<keyof KYCData> = [
    'fullName',
    'dateOfBirth',
    'address',
    'documentUrl', // Corresponds to national identity card image
];

function checkKycDataCompleteness(kycData: Partial<KYCData>): string[] {
    const missingFields: string[] = [];
    
    // Map internal field names to client-facing names
    const fieldMap: Record<keyof KYCData, string> = {
        fullName: 'fullName',
        dateOfBirth: 'dateOfBirth',
        address: 'address',
        documentUrl: 'documentImage', // Use client-facing name
    } as any; // Cast as any to simplify type checking for missing properties

    for (const field of REQUIRED_KYC_FIELDS) {
        const value = kycData[field];
        // Check for null, undefined, empty string (and 0 for numeric fields if any, but none here)
        if (value === null || typeof value === 'undefined' || (typeof value === 'string' && value.trim() === '')) {
            missingFields.push(fieldMap[field]);
        }
    }
    return missingFields;
}

export interface AuditLog {
  id: string;
  userId?: string;
  adminId?: string;
  action: string;
  resourceType: string;
  resourceId: string;
  changes: Record<string, any>;
  ipAddress?: string;
  userAgent?: string;
  status: 'success' | 'failure';
  errorMessage?: string;
  createdAt: any;
}

export interface TwoFactorAuth {
  id: string;
  userId: string;
  enabled: boolean;
  secret?: string;
  backupCodes?: string[];
  lastUsedAt?: any;
  createdAt: any;
}

export interface Alert {
  id: string;
  userId: string;
  type: 'price' | 'order' | 'balance' | 'transaction' | 'system';
  title: string;
  message: string;
  read: boolean;
  deleted?: boolean;
  actionUrl?: string;
  createdAt: any;
}

export interface ScheduledOrder {
  id: string;
  userId: string;
  symbol: string;
  type: 'buy' | 'sell';
  quantity: number;
  price?: number;
  orderType: 'limit' | 'market';
  scheduledTime: any;
  triggerCondition?: string;
  status: 'pending' | 'executed' | 'cancelled' | 'failed';
  createdAt: any;
  executedAt?: any;
  failureReason?: string;
}

export interface AdvancedOrder {
  id: string;
  userId: string;
  symbol: string;
  baseOrderType: 'stop_loss' | 'take_profit' | 'trailing_stop' | 'oco';
  quantity: number;
  status: 'active' | 'triggered' | 'executed' | 'cancelled';
  stopPrice?: number;
  targetPrice?: number;
  limitPrice?: number;
  trailingPercent?: number;
  linkedOrderIds?: string[];
  createdAt: any;
  triggeredAt?: any;
  executedAt?: any;
}

export interface PortfolioAnalytics {
  id: string;
  userId: string;
  date: string;
  totalValue: number;
  cash: number;
  investedValue: number;
  gainLoss: number;
  gainLossPercent: number;
  dayChange: number;
  dayChangePercent: number;
  allTimeReturn: number;
  assetBreakdown: Record<string, number>;
  createdAt: any;
}

// Firestore Database Service
export class FirestoreDatabase {
  private get db() {
    return getDb();
  }
  private readonly USERS_COLLECTION = 'users';
  private readonly ORDERS_COLLECTION = 'orders';
  private readonly ASSETS_COLLECTION = 'assets';
  private readonly REQUESTS_COLLECTION = 'requests';
  private readonly TRANSACTION_HISTORY_COLLECTION = 'transaction_history';
  private readonly KYC_COLLECTION = 'kyc_data';
  private readonly AUDIT_LOG_COLLECTION = 'audit_logs';
  private readonly TWO_FACTOR_COLLECTION = 'two_factor_auth';
  private readonly ALERTS_COLLECTION = 'alerts';
  private readonly SCHEDULED_ORDERS_COLLECTION = 'scheduled_orders';
  private readonly ADVANCED_ORDERS_COLLECTION = 'advanced_orders';
  private readonly PORTFOLIO_ANALYTICS_COLLECTION = 'portfolio_analytics';

  async findUserById(userId: string): Promise<User | null> {
    const reqId = 'unknown'; // In a real app, you'd pass the request ID here
    try {
      const doc = await this.db.collection(this.USERS_COLLECTION).doc(userId).get();
      if (!doc.exists) {
          structuredLog('WARN', reqId, `User not found in DB for userId: ${userId}`, { file: 'firestore-db.ts' });
          return null;
      }
      return { id: doc.id, ...doc.data() } as User;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in findUserById', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error; // Re-throw the error to be caught by the API route
    }
  }

  async getAssets(userId: string): Promise<Asset[]> {
    const reqId = 'unknown'; // In a real app, you'd pass the request ID here
    try {
      const snapshot = await this.db.collection(this.ASSETS_COLLECTION).where('userId', '==', userId).get();
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() } as Asset));
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getAssets', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async updateUserBalance(userId: string, newBalance: number): Promise<void> {
    const reqId = 'unknown'; // In a real app, you'd pass the request ID here
    try {
      await this.db.collection(this.USERS_COLLECTION).doc(userId).update({ 
        balance: newBalance,
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in updateUserBalance', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getAlerts(userId: string): Promise<Alert[]> {
    const reqId = 'unknown';
    try {
      const snapshot = await this.db.collection(this.ALERTS_COLLECTION)
        .where('userId', '==', userId)
        .where('deleted', '==', false)
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }) as Alert);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getAlerts', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async createAlert(alertData: Omit<Alert, 'id' | 'createdAt' | 'deleted'>): Promise<Alert> {
    const reqId = 'unknown';
    try {
      const docRef = await this.db.collection(this.ALERTS_COLLECTION).add({
        ...alertData,
        read: false,
        deleted: false,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newAlert = await docRef.get();
      return { id: newAlert.id, ...newAlert.data() } as Alert;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createAlert', { file: 'firestore-db.ts', alertData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async markAlertAsRead(alertId: string): Promise<void> {
    const reqId = 'unknown';
    try {
      await this.db.collection(this.ALERTS_COLLECTION).doc(alertId).update({
        read: true,
      });
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in markAlertAsRead', { file: 'firestore-db.ts', alertId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async deleteAlert(alertId: string): Promise<void> {
    const reqId = 'unknown';
    try {
      await this.db.collection(this.ALERTS_COLLECTION).doc(alertId).update({
        deleted: true,
      });
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in deleteAlert', { file: 'firestore-db.ts', alertId, error: error.message, stack: error.stack });
      throw error;
    }
  }
  
  async clearAllData(): Promise<void> {
    if (process.env.NODE_ENV === 'production') {
      throw new Error('This operation is not allowed in production.');
    }

    const collections = [
      this.USERS_COLLECTION,
      this.ORDERS_COLLECTION,
      this.ASSETS_COLLECTION,
      this.REQUESTS_COLLECTION,
      this.TRANSACTION_HISTORY_COLLECTION,
      this.KYC_COLLECTION,
      this.AUDIT_LOG_COLLECTION,
      this.TWO_FACTOR_COLLECTION,
      this.ALERTS_COLLECTION,
      this.SCHEDULED_ORDERS_COLLECTION,
      this.ADVANCED_ORDERS_COLLECTION,
      this.PORTFOLIO_ANALYTICS_COLLECTION,
    ];

    for (const collectionName of collections) {
      const snapshot = await this.db.collection(collectionName).get();
      const batch = this.db.batch();
      snapshot.docs.forEach(doc => {
        batch.delete(doc.ref);
      });
      await batch.commit();
    }
  }

  async getOrders(userId: string): Promise<Order[]> {
    const reqId = 'unknown';
    try {
      const snapshot = await this.db.collection(this.ORDERS_COLLECTION).where('userId', '==', userId).get();
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data() as Order);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getOrders', { file: 'firestore-db.ts', error: error.message, stack: error.stack });
      throw error;
    }
  }

  async createOrder(orderData: Omit<Order, 'id' | 'createdAt'>): Promise<Order> {
    const reqId = 'unknown';
    try {
      const docRef = await this.db.collection(this.ORDERS_COLLECTION).add({
        ...orderData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newOrder = await docRef.get();
      return { id: newOrder.id, ...newOrder.data() } as Order;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createOrder', { file: 'firestore-db.ts', orderData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async updateAsset(assetId: string, assetData: Partial<Asset>): Promise<void> {
    const reqId = 'unknown';
    try {
      await this.db.collection(this.ASSETS_COLLECTION).doc(assetId).update(assetData);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in updateAsset', { file: 'firestore-db.ts', assetId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async deleteAsset(assetId: string): Promise<void> {
    const reqId = 'unknown';
    try {
      await this.db.collection(this.ASSETS_COLLECTION).doc(assetId).delete();
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in deleteAsset', { file: 'firestore-db.ts', assetId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async createAsset(assetData: Omit<Asset, 'id' | 'createdAt'>): Promise<Asset> {
    const reqId = 'unknown';
    try {
      const docRef = await this.db.collection(this.ASSETS_COLLECTION).add({
        ...assetData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newAsset = await docRef.get();
      return { id: newAsset.id, ...newAsset.data() } as Asset;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createAsset', { file: 'firestore-db.ts', assetData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async createTransactionHistory(transactionData: Omit<TransactionHistory, 'id' | 'createdAt'>): Promise<TransactionHistory> {
    const reqId = 'unknown';
    try {
      const docRef = await this.db.collection(this.TRANSACTION_HISTORY_COLLECTION).add({
        ...transactionData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newTransaction = await docRef.get();
      return { id: newTransaction.id, ...newTransaction.data() } as TransactionHistory;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createTransactionHistory', { file: 'firestore-db.ts', transactionData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async createTransactionRequest(requestData: Omit<TransactionRequest, 'id' | 'createdAt' | 'status'>): Promise<TransactionRequest> {
    const reqId = 'unknown';
    try {
      const docRef = await this.db.collection(this.REQUESTS_COLLECTION).add({
        ...requestData,
        status: 'pending',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newRequest = await docRef.get();
      return { id: newRequest.id, ...newRequest.data() } as TransactionRequest;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createTransactionRequest', { file: 'firestore-db.ts', requestData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async createAuditLog(auditData: Omit<AuditLog, 'id' | 'createdAt'>): Promise<AuditLog> {
    const reqId = 'unknown';
    try {
      const docRef = await this.db.collection(this.AUDIT_LOG_COLLECTION).add({
        ...auditData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newAuditLog = await docRef.get();
      return { id: newAuditLog.id, ...newAuditLog.data() } as AuditLog;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createAuditLog', { file: 'firestore-db.ts', auditData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async updateUser(userId: string, userData: Partial<User>): Promise<void> {
    const reqId = 'unknown';
    try {
      await this.db.collection(this.USERS_COLLECTION).doc(userId).update({
        ...userData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in updateUser', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async createKYC(kycData: Omit<KYCData, 'id' | 'createdAt' | 'submittedAt' | 'status'>): Promise<KYCData> {
    const reqId = 'unknown';
    try {
      const docRef = await this.db.collection(this.KYC_COLLECTION).add({
        ...kycData,
        status: 'pending',
        submittedAt: admin.firestore.FieldValue.serverTimestamp(),
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newKYC = await docRef.get();
      return { id: newKYC.id, ...newKYC.data() } as KYCData;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createKYC', { file: 'firestore-db.ts', kycData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getKYCByUserId(userId: string): Promise<KYCData | null> {
    const reqId = 'unknown';
    try {
      const snapshot = await this.db.collection(this.KYC_COLLECTION).where('userId', '==', userId).orderBy('submittedAt', 'desc').limit(1).get();
      if (snapshot.empty) {
        return null;
      }
      const doc = snapshot.docs[0];
      return { id: doc.id, ...doc.data() } as KYCData;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getKYCByUserId', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  // New method to get KYC Status, handling the 'unsubmitted' case and missing fields
  async getKycStatus(userId: string): Promise<{ status: typeof KYC_STATUSES[keyof typeof KYC_STATUSES], missingFields: string[] }> {
    const reqId = 'unknown'; // assuming reqId should be used for structuredLog
    try {
      const kycData = await this.getKYCByUserId(userId);
      
      // 1. No KYC document found: Treat as unsubmitted with all fields missing.
      if (!kycData) {
        const allRequiredFields = REQUIRED_KYC_FIELDS.map(key => ({
            fullName: 'fullName',
            dateOfBirth: 'dateOfBirth',
            address: 'address',
            documentUrl: 'documentImage',
        } as any)[key]);

        return { status: KYC_STATUSES.UNSUBMITTED, missingFields: allRequiredFields };
      }
      
      // 2. Already approved: Return approved status with no missing fields.
      if (kycData.status === KYC_STATUSES.APPROVED) {
          return { status: kycData.status, missingFields: [] };
      }

      // 3. Check for completeness only if not approved
      const missingFields = checkKycDataCompleteness(kycData);

      if (missingFields.length > 0) {
        // If fields are missing, and status is not APPROVED, return UNSUBMITTED status
        // along with the list of missing fields. This triggers the client-side KYC prompt.
        if (kycData.status !== KYC_STATUSES.UNSUBMITTED) {
             structuredLog('WARN', reqId, `Incomplete KYC data found for status: ${kycData.status}`, { userId, missingFields });
        }
        
        return { status: KYC_STATUSES.UNSUBMITTED, missingFields };
      }

      // 4. Fields are complete: Return the actual status (PENDING or REJECTED)
      return { status: kycData.status, missingFields: [] };

    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getKycStatus', { userId, error: error.message, stack: error.stack });
      // Default to unsubmitted for safety
      return { status: KYC_STATUSES.UNSUBMITTED, missingFields: [] };
    }
  }

  async getAllPendingKYC(): Promise<KYCData[]> {
    const reqId = 'unknown';
    try {
      const snapshot = await this.db.collection(this.KYC_COLLECTION).where('status', '==', 'pending').get();
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ 
        id: doc.id, 
        ...doc.data(),
        selfieUrl: doc.data().selfieUrl, // Ensure these fields are explicitly returned
        documentUrl: doc.data().documentUrl
      }) as KYCData);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getAllPendingKYC', { file: 'firestore-db.ts', error: error.message, stack: error.stack });
      throw error;
    }
  }

  async updateKYCStatus(kycId: string, status: 'approved' | 'rejected', adminId: string, reason?: string): Promise<void> {
    const reqId = 'unknown';
    try {
      const kycRef = this.db.collection(this.KYC_COLLECTION).doc(kycId);
      const updateData: any = {
        status,
        verifiedAt: admin.firestore.FieldValue.serverTimestamp(),
        verifiedBy: adminId,
      };

      if (status === 'rejected') {
        updateData.rejectionReason = reason;
      }

      await kycRef.update(updateData);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in updateKYCStatus', { file: 'firestore-db.ts', kycId, status, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getAnalytics(): Promise<any> {
    const reqId = 'unknown';
    try {
      const [userSnapshot, orderSnapshot, kycSnapshot] = await Promise.all([
        this.db.collection(this.USERS_COLLECTION).get(),
        this.db.collection(this.ORDERS_COLLECTION).get(),
        this.db.collection(this.KYC_COLLECTION).get(),
      ]);

      const totalUsers = userSnapshot.size;
      const totalOrders = orderSnapshot.size;
      const pendingKyc = kycSnapshot.docs.filter(doc => doc.data().status === 'pending').length;
      const approvedKyc = kycSnapshot.docs.filter(doc => doc.data().status === 'approved').length;

      return {
        totalUsers,
        totalOrders,
        pendingKyc,
        approvedKyc,
      };
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getAnalytics', { file: 'firestore-db.ts', error: error.message, stack: error.stack });
      throw error;
    }
  }
  async getUsers(): Promise<{ users: User[], total: number }> {
    const reqId = 'unknown';
    try {
      const snapshot = await this.db.collection(this.USERS_COLLECTION).get();
      const users = snapshot.docs.map((doc: QueryDocumentSnapshot) => doc.data() as User);
      return { users, total: users.length };
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getUsers', { file: 'firestore-db.ts', error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getAuditLogs(): Promise<AuditLog[]> {
    const reqId = 'unknown';
    try {
        const snapshot = await this.db.collection(this.AUDIT_LOG_COLLECTION).orderBy('createdAt', 'desc').get();
        return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }) as AuditLog);
    } catch (error: any) {
        structuredLog('ERROR', reqId, 'Error in getAuditLogs', { file: 'firestore-db.ts', error: error.message, stack: error.stack });
        throw error;
    }
  }

  async getRequests(): Promise<TransactionRequest[]> {
    const reqId = 'unknown';
    try {
        const snapshot = await this.db.collection(this.REQUESTS_COLLECTION).orderBy('createdAt', 'desc').get();
        return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }) as TransactionRequest);
    } catch (error: any) {
        structuredLog('ERROR', reqId, 'Error in getRequests', { file: 'firestore-db.ts', error: error.message, stack: error.stack });
        throw error;
    }
  }

  async updateRequest(requestId: string, data: { status: string, reason?: string, processedBy: string }): Promise<void> {
    const reqId = 'unknown';
    try {
        await this.db.collection(this.REQUESTS_COLLECTION).doc(requestId).update(data);
    } catch (error: any) {
        structuredLog('ERROR', reqId, 'Error in updateRequest', { file: 'firestore-db.ts', requestId, error: error.message, stack: error.stack });
        throw error;
    }
  }

  async processTransactionRequest(request: TransactionRequest, adminId: string): Promise<void> {
    const reqId = 'unknown';
    const transaction = this.db.runTransaction(async (t) => {
      // 1. Fetch user data (within transaction for atomicity)
      const userRef = this.db.collection(this.USERS_COLLECTION).doc(request.userId);
      const userDoc = await t.get(userRef);

      if (!userDoc.exists) {
        throw new Error('User not found');
      }

      const userData = { id: userDoc.id, ...userDoc.data() } as User;
      const balanceBefore = userData.balance;
      let newBalance = balanceBefore;

      if (request.type === 'withdraw') {
        if (balanceBefore < request.amount) {
          throw new Error('Insufficient balance');
        }
        newBalance -= request.amount;
      } else { // deposit
        newBalance += request.amount;
      }

      // 2. Update user balance
      t.update(userRef, { balance: newBalance, updatedAt: admin.firestore.FieldValue.serverTimestamp() });

      // 3. Create Transaction History entry
      const historyRef = this.db.collection(this.TRANSACTION_HISTORY_COLLECTION).doc();
      const historyData: Omit<TransactionHistory, 'id' | 'createdAt'> = {
        userId: request.userId,
        type: request.type,
        amount: request.amount,
        description: `${request.type.charAt(0).toUpperCase() + request.type.slice(1)} processed by Admin`,
        status: 'completed',
        balanceBefore: balanceBefore,
        balanceAfter: newBalance,
      };
      t.set(historyRef, { ...historyData, createdAt: admin.firestore.FieldValue.serverTimestamp() });

      // 4. Update Transaction Request status
      const requestRef = this.db.collection(this.REQUESTS_COLLECTION).doc(request.id);
      t.update(requestRef, {
        status: 'executed',
        executedAt: admin.firestore.FieldValue.serverTimestamp(),
        processedBy: adminId,
      });

      structuredLog('INFO', reqId, `Transaction executed for user ${request.userId}`, {
        requestId: request.id,
        type: request.type,
        amount: request.amount
      });

    });

    await transaction;
  }


  async createUser(userData: Omit<User, 'id' | 'createdAt'>, uid: string): Promise<User | null> {
    const reqId = 'unknown';
    try {
      await this.db.collection(this.USERS_COLLECTION).doc(uid).set({
        ...userData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newUserDoc = await this.db.collection(this.USERS_COLLECTION).doc(uid).get();
      return { id: newUserDoc.id, ...newUserDoc.data() } as User;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createUser', { file: 'firestore-db.ts', uid, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async get2FAByUserId(userId: string): Promise<TwoFactorAuth | null> {
    return null;
  }

  async create2FA(twoFactorData: Omit<TwoFactorAuth, 'id' | 'createdAt'>): Promise<TwoFactorAuth | null> {
    return null;
  }

  async update2FA(userId: string, twoFactorData: Partial<TwoFactorAuth>): Promise<void> {}

  async getActiveAdvancedOrders(userId: string): Promise<AdvancedOrder[]> {
    const reqId = 'unknown';
    try {
      const snapshot = await this.db.collection(this.ADVANCED_ORDERS_COLLECTION)
        .where('userId', '==', userId)
        .where('status', '==', 'active')
        .get();
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }) as AdvancedOrder);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getActiveAdvancedOrders', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getAdvancedOrders(userId: string): Promise<AdvancedOrder[]> {
    const reqId = 'unknown';
    try {
      const snapshot = await this.db.collection(this.ADVANCED_ORDERS_COLLECTION).where('userId', '==', userId).get();
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }) as AdvancedOrder);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getAdvancedOrders', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async createAdvancedOrder(orderData: Omit<AdvancedOrder, 'id' | 'createdAt'>): Promise<AdvancedOrder> {
    const reqId = 'unknown';
    try {
      const docRef = await this.db.collection(this.ADVANCED_ORDERS_COLLECTION).add({
        ...orderData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newOrder = await docRef.get();
      return { id: newOrder.id, ...newOrder.data() } as AdvancedOrder;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createAdvancedOrder', { file: 'firestore-db.ts', orderData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async updateAdvancedOrder(orderId: string, orderData: Partial<AdvancedOrder>): Promise<void> {
    const reqId = 'unknown';
    try {
      await this.db.collection(this.ADVANCED_ORDERS_COLLECTION).doc(orderId).update({
        ...orderData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in updateAdvancedOrder', { file: 'firestore-db.ts', orderId, orderData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getScheduledOrders(userId: string): Promise<ScheduledOrder[]> {
    const reqId = 'unknown';
    try {
      const snapshot = await this.db.collection(this.SCHEDULED_ORDERS_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('scheduledTime', 'asc')
        .get();
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }) as ScheduledOrder);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getScheduledOrders', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async createScheduledOrder(orderData: Omit<ScheduledOrder, 'id' | 'createdAt'>): Promise<ScheduledOrder> {
    const reqId = 'unknown';
    try {
      const docRef = await this.db.collection(this.SCHEDULED_ORDERS_COLLECTION).add({
        ...orderData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newOrder = await docRef.get();
      return { id: newOrder.id, ...newOrder.data() } as ScheduledOrder;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createScheduledOrder', { file: 'firestore-db.ts', orderData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async updateScheduledOrder(orderId: string, orderData: Partial<ScheduledOrder>): Promise<void> {
    const reqId = 'unknown';
    try {
      await this.db.collection(this.SCHEDULED_ORDERS_COLLECTION).doc(orderId).update({
        ...orderData,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in updateScheduledOrder', { file: 'firestore-db.ts', orderId, orderData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getTransactionHistory(userId: string): Promise<TransactionHistory[]> {
    const reqId = 'unknown';
    try {
      const snapshot = await this.db.collection(this.TRANSACTION_HISTORY_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }) as TransactionHistory);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getTransactionHistory', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async createPortfolioAnalytics(analyticsData: Omit<PortfolioAnalytics, 'id' | 'createdAt'>): Promise<PortfolioAnalytics> {
    const reqId = 'unknown';
    try {
      const docRef = await this.db.collection(this.PORTFOLIO_ANALYTICS_COLLECTION).add({
        ...analyticsData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      const newAnalytics = await docRef.get();
      return { id: newAnalytics.id, ...newAnalytics.data() } as PortfolioAnalytics;
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in createPortfolioAnalytics', { file: 'firestore-db.ts', analyticsData, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getPortfolioAnalytics(userId: string, days: number = 30): Promise<PortfolioAnalytics[]> {
    const reqId = 'unknown';
    try {
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - days);

      const snapshot = await this.db.collection(this.PORTFOLIO_ANALYTICS_COLLECTION)
        .where('userId', '==', userId)
        .where('createdAt', '>=', startDate)
        .orderBy('createdAt', 'desc')
        .get();
      
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }) as PortfolioAnalytics);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getPortfolioAnalytics', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

  async getUserRequests(userId: string): Promise<TransactionRequest[]> {
    const reqId = 'unknown';
    try {
      const snapshot = await this.db.collection(this.REQUESTS_COLLECTION)
        .where('userId', '==', userId)
        .orderBy('createdAt', 'desc')
        .get();
      return snapshot.docs.map((doc: QueryDocumentSnapshot) => ({ id: doc.id, ...doc.data() }) as TransactionRequest);
    } catch (error: any) {
      structuredLog('ERROR', reqId, 'Error in getUserRequests', { file: 'firestore-db.ts', userId, error: error.message, stack: error.stack });
      throw error;
    }
  }

}
