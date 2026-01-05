import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';
import admin from 'firebase-admin';

// POST - Freeze or unfreeze user balance
export async function POST(request: NextRequest) {
  const reqId = getRequestId(request);
  const route = request.url;

  const adminPayload = await verifyAdmin(request, reqId);
  if (!adminPayload) {
    return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
  }

  try {
    const { userId, action, amount, reason } = await request.json();

    if (!userId || !action || typeof amount !== 'number' || amount <= 0) {
      structuredLog('WARN', reqId, 'Invalid parameters for freeze/unfreeze', { userId, action, amount });
      return NextResponse.json({ error: 'userId, valid action (freeze/unfreeze), and positive amount are required', correlationId: reqId }, { status: 400 });
    }

    if (!['freeze', 'unfreeze'].includes(action)) {
      structuredLog('WARN', reqId, 'Invalid action', { action });
      return NextResponse.json({ error: 'Action must be freeze or unfreeze', correlationId: reqId }, { status: 400 });
    }

    structuredLog('INFO', reqId, 'Processing freeze/unfreeze request', { adminId: adminPayload.userId, userId, action, amount, reason });

    // Get user data
    const userDoc = await collections.users.doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found', correlationId: reqId }, { status: 404 });
    }

    const user = userDoc.data()!;
    const totalBalance = user.balance || 0;
    const frozenBalance = user.frozenBalance || 0;
    const availableBalance = totalBalance - frozenBalance;

    // Validation
    if (action === 'freeze') {
      if (amount > availableBalance) {
        structuredLog('WARN', reqId, 'Insufficient available balance for freeze', { availableBalance, amount });
        return NextResponse.json({ error: 'Cannot freeze more than available balance', correlationId: reqId }, { status: 400 });
      }
    } else { // unfreeze
      if (amount > frozenBalance) {
        structuredLog('WARN', reqId, 'Cannot unfreeze more than frozen balance', { frozenBalance, amount });
        return NextResponse.json({ error: 'Cannot unfreeze more than frozen balance', correlationId: reqId }, { status: 400 });
      }
    }

    // Update frozen balance
    const newFrozenBalance = action === 'freeze' ? frozenBalance + amount : frozenBalance - amount;
    await collections.users.doc(userId).update({
      frozenBalance: newFrozenBalance,
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Create freeze history
    const historyId = collections.freezeHistory.doc().id;
    await collections.freezeHistory.doc(historyId).set({
      id: historyId,
      userId,
      adminId: adminPayload.userId,
      action,
      amount,
      reason: reason || null,
      frozenBefore: frozenBalance,
      frozenAfter: newFrozenBalance,
      createdAt: admin.firestore.Timestamp.now()
    });

    // Create audit log
    const auditId = collections.auditLogs.doc().id;
    await collections.auditLogs.doc(auditId).set({
      id: auditId,
      userId,
      adminId: adminPayload.userId,
      action: `balance_${action}`,
      resourceType: 'user',
      resourceId: userId,
      changes: JSON.stringify({ action, amount, reason, frozenBefore: frozenBalance, frozenAfter: newFrozenBalance }),
      status: 'success',
      createdAt: admin.firestore.Timestamp.now()
    });

    // Send email notification
    

    structuredLog('INFO', reqId, 'Freeze/unfreeze completed successfully', { userId, action, amount, newFrozenBalance });
    return NextResponse.json({
      message: `Balance ${action}d successfully`,
      newFrozenBalance,
      correlationId: reqId
    });

  } catch (error: any) {
    return handleApiError(reqId, error, route, 'Failed to process freeze/unfreeze');
  }
}