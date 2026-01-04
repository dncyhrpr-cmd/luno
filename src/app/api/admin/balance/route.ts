import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';
import NodeCache from 'node-cache';
import admin from 'firebase-admin';

const adminUsersCache = new NodeCache({ stdTTL: 300 }); // Same as in users API

// POST - Adjust user balance (admin only)
export async function POST(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        const { userId, amount, reason } = await request.json();

        if (!userId || typeof amount !== 'number' || amount === 0) {
            structuredLog('WARN', reqId, 'Invalid parameters for balance adjustment', { userId, amount });
            return NextResponse.json({ error: 'userId and non-zero amount are required', correlationId: reqId }, { status: 400 });
        }

        if (!reason || reason.trim() === '') {
            structuredLog('WARN', reqId, 'Reason required for balance adjustment');
            return NextResponse.json({ error: 'Reason is required', correlationId: reqId }, { status: 400 });
        }

        structuredLog('INFO', reqId, 'Adjusting user balance', { adminId: adminPayload.userId, userId, amount, reason });

        // Get current user balance
        const userDoc = await collections.users.doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found', correlationId: reqId }, { status: 404 });
        }

        const user = userDoc.data()!;
        const balanceBefore = user.balance || 0;
        const balanceAfter = balanceBefore + amount;

        // Update balance atomically
        await collections.users.doc(userId).update({
            balance: admin.firestore.FieldValue.increment(amount),
            updatedAt: admin.firestore.Timestamp.now()
        });

        // Clear cache to ensure updated data is fetched
        adminUsersCache.flushAll();

        // Create transaction history
        const txId = collections.transactionHistory.doc().id;
        await collections.transactionHistory.doc(txId).set({
            id: txId,
            userId,
            type: amount > 0 ? 'credit' : 'debit',
            amount: Math.abs(amount),
            description: reason,
            status: 'completed',
            balanceBefore,
            balanceAfter,
            createdAt: admin.firestore.Timestamp.now()
        });

        // Create audit log
        const auditId = collections.auditLogs.doc().id;
        await collections.auditLogs.doc(auditId).set({
            id: auditId,
            userId,
            adminId: adminPayload.userId,
            action: 'balance_adjustment',
            resourceType: 'user',
            resourceId: userId,
            changes: JSON.stringify({ amount, reason, balanceBefore, balanceAfter }),
            status: 'success',
            createdAt: admin.firestore.Timestamp.now()
        });

        structuredLog('INFO', reqId, 'Balance adjusted successfully', { userId, amount, balanceAfter, adminId: adminPayload.userId });
        return NextResponse.json({
            message: `Balance ${amount > 0 ? 'credited' : 'debited'} successfully`,
            newBalance: balanceAfter,
            correlationId: reqId
        });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to adjust balance');
    }
}
