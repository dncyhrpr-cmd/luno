import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import jwt from 'jsonwebtoken';
import admin from 'firebase-admin';

function verifyAdminToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    if (decoded.role !== 'admin') return null;
    return decoded;
  } catch (error: any) {
    return null;
  }
}

// GET - Fetch all pending transaction requests (admin only)
export async function GET(request: NextRequest) {
  try {
    const adminUser = verifyAdminToken(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const requestsSnapshot = await collections.requests.where('status', '==', 'pending').get();
    const pendingRequests = requestsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    const requestsWithUserDetails = await Promise.all(
      pendingRequests.map(async (req: any) => {
        const userDoc = await collections.users.doc(req.userId).get();
        const userData = userDoc.exists ? userDoc.data() : null;
        return {
          ...req,
          username: userData?.username,
          email: userData?.email
        };
      })
    );

    return NextResponse.json({ 
      requests: requestsWithUserDetails,
      total: requestsWithUserDetails.length
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 });
  }
}

// PUT - Approve or reject a transaction request (admin only)
export async function PUT(request: NextRequest) {
  try {
    const adminUser = verifyAdminToken(request);
    if (!adminUser) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { requestId, action, reason } = await request.json();

    if (!requestId || !action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action or missing requestId' }, { status: 400 });
    }

    const requestDoc = await collections.requests.doc(requestId).get();
    if (!requestDoc.exists) {
      return NextResponse.json({ error: 'Request not found or already processed' }, { status: 404 });
    }

    const transactionRequest = { id: requestDoc.id, ...requestDoc.data() } as any;

    if (transactionRequest.status !== 'pending') {
      return NextResponse.json({ error: `Request already ${transactionRequest.status}` }, { status: 409 });
    }

    if (action === 'approve') {
      await handleApprove(transactionRequest, adminUser.userId);
    } else { // action === 'reject'
      if (!reason) {
        return NextResponse.json({ error: 'Reason required for rejection' }, { status: 400 });
      }
      await handleReject(transactionRequest, reason, adminUser.userId);
    }

    return NextResponse.json({
      message: `Request ${action}d successfully`,
      success: true
    });
  } catch (error: any) {
    const message = error instanceof Error ? error.message : 'Failed to process request';
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

async function handleApprove(request: any, adminId: string) {
  // 1. Get user and update balance
  const userDoc = await collections.users.doc(request.userId).get();
  const userData = userDoc.data();
  const balanceChange = request.type === 'deposit' ? request.amount : -request.amount;

  // Check sufficient balance for withdrawal
  if (request.type === 'withdraw' && userData!.balance < request.amount) {
    throw new Error('Insufficient balance');
  }

  const newBalance = userData!.balance + balanceChange;

  // 2. Atomic transaction
  const batch = admin.firestore().batch();

  // Update user balance
  batch.update(collections.users.doc(request.userId), {
    balance: newBalance,
    updatedAt: admin.firestore.Timestamp.now()
  });

  // Update request status
  batch.update(collections.requests.doc(request.id), {
    status: 'executed',
    processedBy: adminId,
    executedAt: admin.firestore.Timestamp.now()
  });

  // Create transaction history
  const txId = collections.transactionHistory.doc().id;
  batch.set(collections.transactionHistory.doc(txId), {
    id: txId,
    userId: request.userId,
    type: request.type,
    amount: request.amount,
    description: `${request.type.charAt(0).toUpperCase() + request.type.slice(1)} processed by admin`,
    status: 'completed',
    balanceBefore: userData!.balance,
    balanceAfter: newBalance,
    createdAt: admin.firestore.Timestamp.now()
  });

  // Create audit log
  const auditId = collections.auditLogs.doc().id;
  batch.set(collections.auditLogs.doc(auditId), {
    id: auditId,
    userId: request.userId,
    adminId: adminId,
    action: `${request.type}_executed`,
    resourceType: 'transaction_request',
    resourceId: request.id,
    changes: JSON.stringify({ status: 'executed', amount: request.amount }),
    status: 'success',
    createdAt: admin.firestore.Timestamp.now()
  });

  // Create alert
  const alertId = collections.alerts.doc().id;
  batch.set(collections.alerts.doc(alertId), {
    id: alertId,
    userId: request.userId,
    type: 'transaction',
    title: `${request.type.charAt(0).toUpperCase() + request.type.slice(1)} Approved and Executed`,
    message: `Your ${request.type} of ${request.amount.toFixed(2)} has been successfully processed.`,
    read: false,
    deleted: false,
    createdAt: admin.firestore.Timestamp.now()
  });

  await batch.commit();
}

async function handleReject(request: any, reason: string, adminId: string) {
  const batch = require('firebase-admin').firestore().batch();

  // Update request status
  batch.update(collections.requests.doc(request.id), {
    status: 'rejected',
    reason,
    processedBy: adminId,
    updatedAt: require('firebase-admin').firestore.Timestamp.now()
  });

  // Create audit log
  const auditId = collections.auditLogs.doc().id;
  batch.set(collections.auditLogs.doc(auditId), {
    id: auditId,
    userId: request.userId,
    adminId: adminId,
    action: `${request.type}_rejected`,
    resourceType: 'transaction_request',
    resourceId: request.id,
    changes: JSON.stringify({ status: 'rejected', reason }),
    status: 'success',
    createdAt: require('firebase-admin').firestore.Timestamp.now()
  });

  // Create alert
  const alertId = collections.alerts.doc().id;
  batch.set(collections.alerts.doc(alertId), {
    id: alertId,
    userId: request.userId,
    type: 'transaction',
    title: `${request.type.charAt(0).toUpperCase() + request.type.slice(1)} Rejected`,
    message: `Your ${request.type} request for ${request.amount.toFixed(2)} has been rejected. Reason: ${reason}`,
    read: false,
    deleted: false,
    createdAt: require('firebase-admin').firestore.Timestamp.now()
  });

  await batch.commit();
}
