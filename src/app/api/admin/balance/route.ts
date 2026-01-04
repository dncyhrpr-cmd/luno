import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
 import admin from 'firebase-admin';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';

// POST - Admin direct balance update (credit/debit)
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
            structuredLog('WARN', reqId, 'Invalid parameters for balance update', { status: 400 });
            return NextResponse.json({ error: 'User ID and non-zero amount are required', correlationId: reqId }, { status: 400 });
        }

        structuredLog('INFO', reqId, 'Admin balance update requested', { adminId: adminPayload.userId, targetUserId: userId, amount, reason });

        // Get current user balance
        const userDoc = await collections.users.doc(userId).get();
        if (!userDoc.exists) {
            return NextResponse.json({ error: 'User not found', correlationId: reqId }, { status: 404 });
        }
        const user = { id: userDoc.id, ...userDoc.data() } as any;

        const newBalance = user.balance + amount;
        if (newBalance < 0) {
            return NextResponse.json({ error: 'Insufficient balance for debit', correlationId: reqId }, { status: 400 });
        }

        // Update balance
        await collections.users.doc(userId).update({ balance: newBalance });

        // Create transaction history
        const txId = collections.transactionHistory.doc().id;
        await collections.transactionHistory.doc(txId).set({
            id: txId,
            userId,
            type: amount > 0 ? 'deposit' : 'withdrawal',
            amount: Math.abs(amount),
            description: `Admin ${amount > 0 ? 'credit' : 'debit'}: ${reason || 'Manual adjustment'}`,
            status: 'completed',
            balanceBefore: user.balance,
            balanceAfter: newBalance,
            createdAt: admin.firestore.Timestamp.now()
        });

        // Create audit log
        const auditId = collections.auditLogs.doc().id;
        await collections.auditLogs.doc(auditId).set({
            id: auditId,
            userId,
            adminId: adminPayload.userId,
            action: 'balance_update',
            resourceType: 'user_balance',
            resourceId: userId,
            changes: JSON.stringify({
                amount,
                reason: reason || 'Manual adjustment',
                balanceBefore: user.balance,
                balanceAfter: newBalance
            }),
            status: 'success',
            createdAt: admin.firestore.Timestamp.now()
        });

        structuredLog('INFO', reqId, 'Admin balance update completed', { adminId: adminPayload.userId, targetUserId: userId, amount, newBalance });
        return NextResponse.json({
            message: `Balance ${amount > 0 ? 'credited' : 'debited'} successfully`,
            newBalance,
            correlationId: reqId
        }, { status: 200 });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to update balance');
    }
}
