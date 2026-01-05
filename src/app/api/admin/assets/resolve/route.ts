import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';
import admin from 'firebase-admin';

// POST - Resolve binary asset as win/loss (admin only)
export async function POST(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        const { userId, assetId, outcome } = await request.json();

        if (!userId) {
            structuredLog('WARN', reqId, 'Missing userId for binary resolution', { status: 400 });
            return NextResponse.json({ error: 'userId is required', correlationId: reqId }, { status: 400 });
        }

        if (!assetId) {
            structuredLog('WARN', reqId, 'Missing assetId for binary resolution', { status: 400 });
            return NextResponse.json({ error: 'assetId is required', correlationId: reqId }, { status: 400 });
        }

        if (!outcome || !['win', 'loss'].includes(outcome)) {
            structuredLog('WARN', reqId, 'Invalid outcome for binary resolution', { status: 400 });
            return NextResponse.json({ error: 'outcome must be "win" or "loss"', correlationId: reqId }, { status: 400 });
        }

        structuredLog('INFO', reqId, 'Setting admin outcome for binary trade', { adminId: adminPayload.userId, userId, assetId, outcome });
        console.log('DEBUG: Starting admin outcome selection for asset', assetId, 'outcome', outcome);

        // Get the asset
        const assetDoc = await collections.assets.doc(assetId).get();
        if (!assetDoc.exists) {
            structuredLog('WARN', reqId, 'Asset not found', { assetId, status: 404 });
            return NextResponse.json({ error: 'Asset not found', correlationId: reqId }, { status: 404 });
        }

        const asset = { id: assetDoc.id, ...assetDoc.data() } as any;

        if (asset.type !== 'binary') {
            structuredLog('WARN', reqId, 'Asset is not a binary option', { assetId, type: asset.type, status: 400 });
            return NextResponse.json({ error: 'Asset is not a binary option', correlationId: reqId }, { status: 400 });
        }

        const orderId = asset.orderId;
        const orderDoc = await collections.orders.doc(orderId).get();

        if (!orderDoc.exists) {
            structuredLog('WARN', reqId, 'Corresponding order not found', { orderId, status: 404 });
            return NextResponse.json({ error: 'Corresponding order not found', correlationId: reqId }, { status: 404 });
        }

        const order = { id: orderDoc.id, ...orderDoc.data() };
        console.log('DEBUG: Order found', order.id, 'current status', order.status);

        // Check if trade is expired
        const expiryTime = order.expiryTime?.toDate?.() || new Date(order.expiryTime);
        const currentTime = new Date();
        const isExpired = expiryTime <= currentTime;
        console.log('DEBUG: Trade expiry check', { expiryTime: expiryTime.toISOString(), currentTime: currentTime.toISOString(), isExpired, orderExpiryTime: order.expiryTime });

        // Get user data for notification
        const userDoc = await collections.users.doc(userId).get();
        const userData = userDoc.data();

        const now = admin.firestore.Timestamp.now();

        if (isExpired) {
            // Trade is expired, resolve immediately
            console.log('DEBUG: Trade is expired, resolving immediately');

            // Calculate PnL
            const pnl = outcome === 'win' ? order.amount + (order.amount * (order.profitPercent / 100)) : -order.amount;
            console.log('DEBUG: Calculated PNL', pnl, 'for outcome', outcome);

            // Resolve immediately
            await admin.firestore().runTransaction(async (transaction) => {
                const orderRef = collections.orders.doc(order.id);
                const userRef = collections.users.doc(userId);

                // Get current balance
                const userSnap: any = await transaction.get(userRef);
                const balanceBefore = userSnap.exists ? userSnap.data()?.balance || 0 : 0;

                // Update order to resolved
                transaction.update(orderRef, {
                    status: 'resolved',
                    result: outcome,
                    pnl: pnl,
                    resolvedAt: now,
                    resolvedBy: 'admin',
                    adminOutcome: outcome,
                    adminSelectedAt: now,
                    updatedAt: now
                });

                // Update user balance
                transaction.update(userRef, {
                    balance: admin.firestore.FieldValue.increment(pnl)
                });

                // Create transaction history
                const historyRef = collections.transactionHistory.doc();
                transaction.set(historyRef, {
                    userId,
                    type: 'binary_payout',
                    amount: pnl,
                    description: `Admin-resolved binary trade ${outcome}: ${order.symbol} ${order.direction}`,
                    status: 'completed',
                    balanceBefore,
                    balanceAfter: balanceBefore + pnl,
                    createdAt: now
                });
            });

            // Delete the binary asset
            await collections.assets.doc(assetId).delete();

            // Create notification
            await collections.alerts.add({
                userId,
                type: 'trade_resolved_admin',
                title: 'Trade Resolved by Admin',
                message: `Hi ${userData?.email}, your binary trade has been resolved as ${outcome} by admin. ${outcome === 'win' ? `You won ${Math.abs(pnl).toFixed(2)} (including your stake)!` : `You lost ${Math.abs(pnl).toFixed(2)}.`}`,
                read: false,
                createdAt: now
            });

            structuredLog('INFO', reqId, 'Admin immediately resolved expired trade', { userId, assetId, outcome, pnl: outcome === 'win' ? order.amount + (order.amount * (order.profitPercent / 100)) : -order.amount, adminId: adminPayload.userId });
            return NextResponse.json({
                message: `Trade resolved as ${outcome} immediately (was expired)`,
                success: true,
                correlationId: reqId
            });
        } else {
            // Trade is not expired, just set admin outcome
            console.log('DEBUG: Trade is not expired, setting outcome and waiting for expiry');

            await collections.orders.doc(order.id).update({
                adminOutcome: outcome,
                adminSelectedAt: now,
                updatedAt: now
            });

            structuredLog('INFO', reqId, 'Admin set outcome for trade, will resolve at expiry', { userId, assetId, outcome, adminId: adminPayload.userId });
            return NextResponse.json({
                message: `Admin outcome set to ${outcome}, trade will resolve at expiry`,
                success: true,
                correlationId: reqId
            });
        }

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to process binary resolution');
    }
}