import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
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
        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user) {
            return NextResponse.json({ error: 'User not found', correlationId: reqId }, { status: 404 });
        }

        const newBalance = user.balance + amount;
        if (newBalance < 0) {
            return NextResponse.json({ error: 'Insufficient balance for debit', correlationId: reqId }, { status: 400 });
        }

        // Update balance
        await prisma.user.update({ where: { id: userId }, data: { balance: newBalance } });

        // Create transaction history
        await prisma.transactionHistory.create({
            data: {
                userId,
                type: amount > 0 ? 'deposit' : 'withdrawal',
                amount: Math.abs(amount),
                description: `Admin ${amount > 0 ? 'credit' : 'debit'}: ${reason || 'Manual adjustment'}`,
                status: 'completed',
                balanceBefore: user.balance,
                balanceAfter: newBalance,
            }
        });

        // Create audit log
        await prisma.auditLog.create({
            data: {
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
                status: 'success'
            }
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
