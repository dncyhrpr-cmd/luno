import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';
import admin from 'firebase-admin';

// PATCH - Lock/unlock asset (admin only)
export async function PATCH(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        const { userId, assetId, locked, reason } = await request.json();

        if (!userId) {
            structuredLog('WARN', reqId, 'Missing userId for asset lock/unlock', { status: 400 });
            return NextResponse.json({ error: 'userId is required', correlationId: reqId }, { status: 400 });
        }

        if (!assetId) {
            structuredLog('WARN', reqId, 'Missing assetId for asset lock/unlock', { status: 400 });
            return NextResponse.json({ error: 'assetId is required', correlationId: reqId }, { status: 400 });
        }

        if (typeof locked !== 'boolean') {
            structuredLog('WARN', reqId, 'Invalid locked value', { status: 400 });
            return NextResponse.json({ error: 'locked must be boolean', correlationId: reqId }, { status: 400 });
        }

        structuredLog('INFO', reqId, 'Processing asset lock/unlock', { adminId: adminPayload.userId, userId, assetId, locked });

        // Update asset lock status
        await collections.assets.doc(assetId).update({
            locked
        });

        // Create notification alert
        const alertId = collections.alerts.doc().id;
        await collections.alerts.doc(alertId).set({
            id: alertId,
            userId,
            type: locked ? 'asset_lock' : 'asset_unlock',
            title: locked ? 'Asset Locked' : 'Asset Unlocked',
            message: locked ? `Your asset has been locked by administrator. Reason: ${reason || 'N/A'}` : `Your asset has been unlocked.`,
            read: false,
            deleted: false,
            createdAt: admin.firestore.Timestamp.now()
        });

        structuredLog('INFO', reqId, 'Asset lock/unlock completed successfully', { userId, assetId, locked, adminId: adminPayload.userId });
        return NextResponse.json({
            message: `Successfully ${locked ? 'locked' : 'unlocked'} asset`,
            success: true,
            correlationId: reqId
        });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to process asset lock/unlock');
    }
}

// POST - Seize assets from a user (admin only)
export async function POST(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        const { userId, symbol, quantity } = await request.json();

        if (!userId) {
            structuredLog('WARN', reqId, 'Missing userId for asset seizure', { status: 400 });
            return NextResponse.json({ error: 'userId is required', correlationId: reqId }, { status: 400 });
        }

        if (!symbol) {
            structuredLog('WARN', reqId, 'Missing symbol for asset seizure', { status: 400 });
            return NextResponse.json({ error: 'symbol is required (use "ALL" to seize all assets)', correlationId: reqId }, { status: 400 });
        }

        structuredLog('INFO', reqId, 'Processing asset seizure', { adminId: adminPayload.userId, userId, symbol, quantity });

        // Get user's current assets
        const userAssetsSnapshot = await collections.assets.where('userId', '==', userId).get();
        const userAssets = userAssetsSnapshot.docs.map((doc: admin.firestore.DocumentSnapshot) => ({ id: doc.id, ...doc.data() }));
        if (userAssets.length === 0) {
            structuredLog('WARN', reqId, 'User has no assets to seize', { userId, status: 400 });
            return NextResponse.json({ error: 'User has no assets to seize', correlationId: reqId }, { status: 400 });
        }

        let assetsToSeize: typeof userAssets = [];
        if (symbol === 'ALL') {
            assetsToSeize = userAssets;
        } else {
            const asset = userAssets.find((a: any) => a.symbol === symbol);
            if (!asset) {
                structuredLog('WARN', reqId, 'Asset not found for user', { userId, symbol, status: 404 });
                return NextResponse.json({ error: 'Asset not found for user', correlationId: reqId }, { status: 404 });
            }
            assetsToSeize = [asset];
        }

        // Process seizure - delete assets and create transaction history
        for (const asset of assetsToSeize) {
            const seizeQuantity = quantity || (asset as any).quantity;

            // Create transaction history for seizure
            const txId = collections.transactionHistory.doc().id;
            await collections.transactionHistory.doc(txId).set({
                id: txId,
                userId,
                type: 'seizure',
                amount: seizeQuantity * ((asset as any).currentPrice || (asset as any).averagePrice || 0),
                symbol: (asset as any).symbol,
                quantity: seizeQuantity,
                description: `Asset seizure by admin ${adminPayload.userId}`,
                reason: 'Admin seizure',
                balanceBefore: 0,
                balanceAfter: 0,
                createdAt: admin.firestore.Timestamp.now()
            });

            // Delete or update asset
            const assetSnapshot = await collections.assets.where('userId', '==', userId).where('symbol', '==', (asset as any).symbol).get();
            if (quantity && quantity < (asset as any).quantity) {
                if (!assetSnapshot.empty) {
                    await assetSnapshot.docs[0].ref.update({ quantity: (asset as any).quantity - seizeQuantity });
                }
            } else {
                if (!assetSnapshot.empty) {
                    await assetSnapshot.docs[0].ref.delete();
                }
            }
        }

        structuredLog('INFO', reqId, 'Asset seizure completed successfully', { userId, symbol, adminId: adminPayload.userId });
        return NextResponse.json({
            message: `Successfully seized ${symbol === 'ALL' ? 'all assets' : symbol} from user`,
            success: true,
            correlationId: reqId
        });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to process asset seizure');
    }
}

// PUT - Restore assets to a user (admin only)
export async function PUT(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        const { userId, symbol, quantity, price } = await request.json();

        if (!userId) {
            structuredLog('WARN', reqId, 'Missing userId for asset restoration', { status: 400 });
            return NextResponse.json({ error: 'userId is required', correlationId: reqId }, { status: 400 });
        }

        if (!symbol) {
            structuredLog('WARN', reqId, 'Missing symbol for asset restoration', { status: 400 });
            return NextResponse.json({ error: 'symbol is required', correlationId: reqId }, { status: 400 });
        }

        if (!quantity || quantity <= 0) {
            structuredLog('WARN', reqId, 'Invalid quantity for asset restoration', { status: 400 });
            return NextResponse.json({ error: 'quantity must be positive', correlationId: reqId }, { status: 400 });
        }

        if (!price || price <= 0) {
            structuredLog('WARN', reqId, 'Invalid price for asset restoration', { status: 400 });
            return NextResponse.json({ error: 'price must be positive', correlationId: reqId }, { status: 400 });
        }

        structuredLog('INFO', reqId, 'Processing asset restoration', { adminId: adminPayload.userId, userId, symbol, quantity, price });

        // Process restoration - create/update asset and transaction history
        const existingSnapshot = await collections.assets.where('userId', '==', userId).where('symbol', '==', symbol).get();
        const existingAsset = !existingSnapshot.empty ? { id: existingSnapshot.docs[0].id, ...existingSnapshot.docs[0].data() } : null;

        if (existingAsset) {
            // Update existing asset
            const existing = existingAsset as any;
            const newQuantity = existing.quantity + quantity;
            const newAveragePrice = ((existing.averagePrice * existing.quantity) + (price * quantity)) / newQuantity;

            await existingSnapshot.docs[0].ref.update({
                quantity: newQuantity,
                averagePrice: newAveragePrice,
                currentPrice: price
            });
        } else {
            // Create new asset
            const assetId = collections.assets.doc().id;
            await collections.assets.doc(assetId).set({
                id: assetId,
                userId,
                symbol,
                quantity,
                averagePrice: price,
                currentPrice: price,
                createdAt: admin.firestore.Timestamp.now(),
                updatedAt: admin.firestore.Timestamp.now()
            });
        }

        // Create transaction history for restoration
        const txId = collections.transactionHistory.doc().id;
        await collections.transactionHistory.doc(txId).set({
            id: txId,
            userId,
            type: 'restoration',
            amount: quantity * price,
            symbol,
            quantity,
            price,
            description: `Asset restoration by admin ${adminPayload.userId}`,
            reason: 'Admin restoration',
            balanceBefore: 0,
            balanceAfter: 0,
            createdAt: admin.firestore.Timestamp.now()
        });

        structuredLog('INFO', reqId, 'Asset restoration completed successfully', { userId, symbol, adminId: adminPayload.userId });
        return NextResponse.json({
            message: `Successfully restored ${quantity} ${symbol.replace('USDT', '')} to user`,
            success: true,
            correlationId: reqId
        });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to process asset restoration');
    }
}
