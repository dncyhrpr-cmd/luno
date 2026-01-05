import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';
import { binanceAPI } from '@/lib/binance-api';
import admin from 'firebase-admin';

// POST - Auto-resolve expired binary trades based on price movement
export async function POST(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        console.log('Starting auto-resolution of expired binary trades for admin:', adminPayload.userId);
        structuredLog('INFO', reqId, 'Starting auto-resolution of expired binary trades', { adminId: adminPayload.userId });

        const now = admin.firestore.Timestamp.now();

        // Find all active binary orders
        const activeOrdersSnapshot = await collections.orders
            .where('orderType', '==', 'binary')
            .where('status', '==', 'active')
            .get();

        // Filter expired ones in code
        const expiredOrders = activeOrdersSnapshot.docs
            .map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }))
            .filter((order: any) => {
                const expiry = order.expiryTime;
                if (!expiry) return false;
                // expiryTime is a Firestore Timestamp
                const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry.seconds * 1000);
                return expiryDate <= now.toDate();
            });

        structuredLog('INFO', reqId, `Found ${expiredOrders.length} expired binary orders to resolve`);

        let resolvedCount = 0;
        const results = [];

        for (const order of expiredOrders) {
            try {
                // Get user data for notification
                const userDoc = await collections.users.doc(order.userId).get();
                const userData = userDoc.data();

                // Check if admin has already selected outcome
                let outcome: 'win' | 'loss';
                let isAdminSelected = !!order.adminOutcome;
                let currentPrice = null;

                if (isAdminSelected) {
                    outcome = order.adminOutcome;
                } else {
                    // Get current price from Binance API
                    currentPrice = await getCurrentPrice(order.symbol);

                    if (!currentPrice) {
                        structuredLog('WARN', reqId, `Could not get current price for ${order.symbol}, skipping order ${order.id}`);
                        continue;
                    }

                    // Determine outcome based on direction and price movement
                    if (order.direction === 'UP') {
                        outcome = currentPrice > order.entryPrice ? 'win' : 'loss';
                    } else if (order.direction === 'DOWN') {
                        outcome = currentPrice < order.entryPrice ? 'win' : 'loss';
                    } else {
                        structuredLog('WARN', reqId, `Invalid direction for order ${order.id}: ${order.direction}`);
                        continue;
                    }
                }

                // Calculate PnL - for win, return stake + profit; for loss, deduct stake
                const pnl = outcome === 'win' ? order.amount + (order.amount * (order.profitPercent / 100)) : -order.amount;

                // Update order and balance in transaction
                console.log(`DEBUG: Resolving order ${order.id} for user ${order.userId}, outcome: ${outcome}, pnl: ${pnl}`);
                try {
                    await admin.firestore().runTransaction(async (transaction) => {
                        const orderRef = collections.orders.doc(order.id);
                        const userRef = collections.users.doc(order.userId);

                        // Get current balance
                        const userSnap: any = await transaction.get(userRef);
                        const balanceBefore = userSnap.exists ? userSnap.data()?.balance || 0 : 0;
                        console.log(`DEBUG: Balance before update: ${balanceBefore}`);

                        // Update order
                        transaction.update(orderRef, {
                            status: 'resolved',
                            result: outcome,
                            pnl: pnl,
                            resolvedAt: now,
                            resolvedBy: isAdminSelected ? 'admin' : 'auto',
                            updatedAt: now
                        });

                        // Update user balance
                        transaction.update(userRef, {
                            balance: admin.firestore.FieldValue.increment(pnl)
                        });

                        const balanceAfter = balanceBefore + pnl;
                        console.log(`DEBUG: Expected balance after update: ${balanceAfter}`);

                        // Create transaction history
                        const historyRef = collections.transactionHistory.doc(); // Generate new doc ID
                        transaction.set(historyRef, {
                            userId: order.userId,
                            type: 'binary_payout',
                            amount: pnl,
                            description: `${isAdminSelected ? 'Admin' : 'Auto'}-resolved binary trade ${outcome}: ${order.symbol} ${order.direction}`,
                            status: 'completed',
                            balanceBefore,
                            balanceAfter,
                            createdAt: now
                        });
                    });

                    // Delete the binary asset - find by orderId since symbol is just the crypto symbol
                    const assetSnapshot = await collections.assets
                        .where('userId', '==', order.userId)
                        .where('orderId', '==', order.id)
                        .where('type', '==', 'binary')
                        .get();
                    if (!assetSnapshot.empty) {
                        await collections.assets.doc(assetSnapshot.docs[0].id).delete();
                    }

                    // Create notification
                    const title = isAdminSelected ? 'Trade Resolved by Admin' : 'Trade Auto-Resolved';
                    const type = isAdminSelected ? 'trade_resolved_admin' : 'trade_resolved';
                    await collections.alerts.add({
                        userId: order.userId,
                        type: type,
                        title: title,
                        message: `Hi ${userData?.email}, your binary trade has been ${isAdminSelected ? 'resolved by admin' : 'auto-resolved'} as ${outcome}. ${outcome === 'win' ? `You won ${pnl.toFixed(2)} (including your stake)!` : `You lost ${Math.abs(pnl).toFixed(2)}.`}`,
                        read: false,
                        createdAt: now
                    });

                    console.log(`SUCCESS: Resolved order ${order.id} successfully`);

                } catch (transactionError: any) {
                    structuredLog('ERROR', reqId, `Transaction failed for order ${order.id}`, { error: transactionError.message, userId: order.userId });
                    console.error(`Transaction error for order ${order.id}:`, transactionError);
                    // Continue to next order instead of failing the whole batch
                }

                results.push({
                    orderId: order.id,
                    symbol: order.symbol,
                    outcome,
                    pnl,
                    entryPrice: order.entryPrice,
                    currentPrice: isAdminSelected ? null : currentPrice
                });

                resolvedCount++;

            } catch (orderError: any) {
                structuredLog('ERROR', reqId, `Failed to resolve order ${order.id}`, { error: orderError.message });
            }
        }

        structuredLog('INFO', reqId, `Auto-resolution completed: ${resolvedCount} orders resolved`, { adminId: adminPayload.userId });

        return NextResponse.json({
            message: `Auto-resolved ${resolvedCount} expired binary trades`,
            success: true,
            resolvedCount,
            results,
            correlationId: reqId
        });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to auto-resolve expired binary trades');
    }
}

// Helper function to get current price using Binance API
async function getCurrentPrice(symbol: string): Promise<number | null> {
    try {
        // Ensure symbol is in Binance format (e.g., BTCUSDT)
        const binanceSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;

        const prices = await binanceAPI.getPrices([binanceSymbol]);

        if (prices.length > 0) {
            return prices[0].price;
        }

        return null;
    } catch (error) {
        console.error('Error fetching current price from Binance:', error);
        return null;
    }
}