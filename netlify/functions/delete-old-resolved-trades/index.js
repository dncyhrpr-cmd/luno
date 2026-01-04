const admin = require('firebase-admin');
const { collections } = require('../../../src/lib/db');

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

exports.handler = async (event, context) => {
    console.log('Starting scheduled deletion of old resolved trades');

    try {
        const now = admin.firestore.Timestamp.now();

        // Find all resolved or done binary orders that have exceeded the keep period
        const resolvedOrdersSnapshot = await collections.orders
            .where('orderType', '==', 'binary')
            .where('status', 'in', ['resolved', 'done'])
            .get();

        // Filter expired ones
        const toDeleteOrders = resolvedOrdersSnapshot.docs
            .map((doc) => ({ id: doc.id, ...doc.data() }))
            .filter((order) => {
                const createdAt = order.createdAt?.toDate?.() || new Date(order.createdAt);
                const expiryTime = order.expiryTime?.toDate?.() || new Date(order.expiryTime);
                const durationMs = expiryTime.getTime() - createdAt.getTime();
                const keepUntil = new Date(expiryTime.getTime() + durationMs);
                return now.toDate() >= keepUntil;
            });

        console.log(`Found ${toDeleteOrders.length} old resolved/done binary orders to delete`);

        let deletedCount = 0;

        for (const order of toDeleteOrders) {
            try {
                // Delete the order
                await collections.orders.doc(order.id).delete();

                // Delete associated binary asset if exists
                const assetSnapshot = await collections.assets
                    .where('userId', '==', order.userId)
                    .where('orderId', '==', order.id)
                    .where('type', '==', 'binary')
                    .get();
                if (!assetSnapshot.empty) {
                    await collections.assets.doc(assetSnapshot.docs[0].id).delete();
                }

                deletedCount++;
            } catch (orderError) {
                console.error(`Failed to delete order ${order.id}:`, orderError);
            }
        }

        console.log(`Scheduled deletion completed: ${deletedCount} orders deleted`);

        return {
            statusCode: 200,
            body: JSON.stringify({
                message: `Deleted ${deletedCount} old resolved/done binary trades`,
                deletedCount
            })
        };

    } catch (error) {
        console.error('Scheduled deletion failed:', error);
        return {
            statusCode: 500,
            body: JSON.stringify({ error: 'Failed to delete old resolved binary trades' })
        };
    }
};