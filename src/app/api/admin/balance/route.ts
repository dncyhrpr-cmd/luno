import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';
import { getRequestId, handleApiError, structuredLog } from '../../../../lib/correlation';
import { extractTokenFromRequest, verifyAccessToken, AuthTokenPayload } from '../../../../lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

// Middleware to verify admin privileges
async function verifyAdmin(request: NextRequest, reqId: string): Promise<AuthTokenPayload | null> {
    const token = extractTokenFromRequest(request);
    if (!token) {
        structuredLog('WARN', reqId, 'Unauthorized: Missing token for admin balance action', { status: 401 });
        return null;
    }

    try {
        const payload = await verifyAccessToken(token);
        if (!payload.roles?.includes('admin')) {
            structuredLog('WARN', reqId, 'Forbidden: User is not an admin', { userId: payload.userId, status: 403 });
            return null;
        }
        return payload;
    } catch (error: any) {
        structuredLog('WARN', reqId, 'Auth token error on admin balance action', { error: error.message, status: 401 });
        return null;
    }
}

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
        const user = await firestoreDB.findUserById(userId);
        if (!user) {
            return NextResponse.json({ error: 'User not found', correlationId: reqId }, { status: 404 });
        }

        const newBalance = user.balance + amount;
        if (newBalance < 0) {
            return NextResponse.json({ error: 'Insufficient balance for debit', correlationId: reqId }, { status: 400 });
        }

        // Update balance
        await firestoreDB.updateUserBalance(userId, newBalance);

        // Create transaction history
        await firestoreDB.createTransactionHistory({
            userId,
            type: amount > 0 ? 'deposit' : 'withdraw',
            amount: Math.abs(amount),
            description: `Admin ${amount > 0 ? 'credit' : 'debit'}: ${reason || 'Manual adjustment'}`,
            status: 'completed',
            balanceBefore: user.balance,
            balanceAfter: newBalance,
        });

        // Create audit log
        await firestoreDB.createAuditLog({
            adminId: adminPayload.userId,
            action: 'balance_update',
            resourceType: 'user_balance',
            resourceId: userId,
            changes: {
                amount,
                reason: reason || 'Manual adjustment',
                balanceBefore: user.balance,
                balanceAfter: newBalance
            },
            status: 'success'
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