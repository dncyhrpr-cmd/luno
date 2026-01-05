const admin = require('firebase-admin');

// Initialize Firebase if not already
if (!admin.apps.length) {
    admin.initializeApp({
        credential: admin.credential.cert({
            projectId: process.env.FIREBASE_PROJECT_ID,
            privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
            clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
        }),
        databaseURL: `https://${process.env.FIREBASE_PROJECT_ID}.firebaseio.com`,
    });
}

const db = admin.firestore();
const collections = {
    users: db.collection('users'),
    orders: db.collection('orders'),
    assets: db.collection('assets'),
    transactionHistory: db.collection('transaction_history'),
    kycData: db.collection('kyc_data'),
    alerts: db.collection('alerts'),
};

// Helper function to get current price using Binance API
async function getCurrentPrice(symbol) {
    try {
        const binanceSymbol = symbol.includes('USDT') ? symbol : `${symbol}USDT`;
        const url = `https://api.binance.com/api/v3/ticker/price?symbol=${binanceSymbol}`;
        
        const response = await fetch(url);
        if (!response.ok) {
            throw new Error(`Failed to fetch price: ${response.status}`);
        }
        const data = await response.json();
        return parseFloat(data.price);
    } catch (error) {
        console.error('Error fetching current price from Binance:', error);
        return null;
    }
}

exports.handler = async (event, context) => {
    console.log('Starting scheduled binary trade resolution');

    try {
        const now = admin.firestore.Timestamp.now();

        // Find all active binary orders
        const activeOrdersSnapshot = await collections.orders
            .where('orderType', '==', 'binary')
            .where('status', '==', 'active')
            .get();

        // Filter expired ones
        const expiredOrders = activeOrdersSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((order) => {
                const expiry = order.expiryTime;
                if (!expiry) return false;
                const expiryDate = expiry.toDate ? expiry.toDate() : new Date(expiry.seconds * 1000);
                return expiryDate <= now.toDate();
            });

        console.log(`Found ${expiredOrders.length} expired binary orders to resolve`);

        let resolvedCount = 0;
        const results = [];

        for (const order of expiredOrders) {
            try {
                // Get user data for notification
                const userDoc = await collections.users.doc(order.userId).get();
                const userData = userDoc.data();

                // Get current price from Binance API
                const currentPrice = await getCurrentPrice(order.symbol);

                if (!currentPrice) {
                    console.error(`Could not get current price for ${order.symbol}, skipping order ${order.id}`);
                    continue;
                }

                // Determine outcome: use adminOutcome if set, else based on direction and price movement
                let outcome;
                let isAdminSelected = !!order.adminOutcome;
                if (isAdminSelected) {
                    outcome = order.adminOutcome;
                } else {
                    if (order.direction === 'UP') {
                        outcome = currentPrice > order.entryPrice ? 'win' : 'loss';
                    } else if (order.direction === 'DOWN') {
                        outcome = currentPrice < order.entryPrice ? 'win' : 'loss';
                    } else {
                        console.error(`Invalid direction for order ${order.id}: ${order.direction}`);
                        continue;
                    }
                }

                // Calculate PnL (since amount is deducted upfront, for win add back amount + profit, for loss 0)
                const pnl = outcome === 'win' ? order.amount + (order.amount * (order.profitPercent / 100)) : 0;

                // Update order and balance in transaction
                await admin.firestore().runTransaction(async (transaction) => {
                    const orderRef = collections.orders.doc(order.id);
                    const userRef = collections.users.doc(order.userId);

                    // Get current balance
                    const userSnap = await transaction.get(userRef);
                    const balanceBefore = userSnap.exists ? userSnap.data()?.balance || 0 : 0;

                    // Update order
                    const finalStatus = isAdminSelected ? 'done' : 'resolved';
                    transaction.update(orderRef, {
                        status: finalStatus,
                        result: outcome,
                        pnl: pnl,
                        resolvedAt: now,
                        resolvedBy: isAdminSelected ? 'admin' : 'scheduled',
                        updatedAt: now
                    });

                    // Update user balance
                    transaction.update(userRef, {
                        balance: admin.firestore.FieldValue.increment(pnl)
                    });

                    // Create transaction history
                    const historyRef = collections.transactionHistory.doc();
                    transaction.set(historyRef, {
                        userId: order.userId,
                        type: 'binary_payout',
                        amount: pnl,
                        description: `Auto-resolved binary trade ${outcome}: ${order.symbol} ${order.direction}`,
                        status: 'completed',
                        balanceBefore,
                        balanceAfter: balanceBefore + pnl,
                        createdAt: now
                    });
                });

                // Delete the binary asset
                const assetSnapshot = await collections.assets
                    .where('userId', '==', order.userId)
                    .where('orderId', '==', order.id)
                    .where('type', '==', 'binary')
                    .get();
                if (!assetSnapshot.empty) {
                    await collections.assets.doc(assetSnapshot.docs[0].id).delete();
                }

                // Delete the order if admin selected
                if (isAdminSelected) {
                    await collections.orders.doc(order.id).delete();
                }

                // Create notification
                const title = isAdminSelected ? 'Trade Resolved by Admin' : 'Trade Auto-Resolved';
                const type = isAdminSelected ? 'trade_resolved_admin' : 'trade_resolved';
                await collections.alerts.add({
                    userId: order.userId,
                    type: type,
                    title: title,
                    message: `Hi ${userData?.email}, your binary trade has been resolved as ${outcome}. ${outcome === 'win' ? `You won ${pnl.toFixed(2)} (including your stake)!` : `You lost ${order.amount.toFixed(2)}.`}`,
                    read: false,
                    createdAt: now
                });

                results.push({
                    orderId: order.id,
                    symbol: order.symbol,
                    outcome,
                    pnl,
                    entryPrice: order.entryPrice,
                    currentPrice
                });

                resolvedCount++;

            } catch (orderError) {
                console.error(`Failed to resolve order ${order.id}:`, orderError);
            }
        }

        console.log(`Scheduled resolution completed: ${resolvedCount} orders resolved`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Auto-resolved ${resolvedCount} expired binary trades`,
                resolvedCount,
                results
            })
        };

    } catch (error) {
        console.error('Scheduled resolution failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to auto-resolve expired binary trades' })
        };
    }
};