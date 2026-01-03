import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { Asset } from '@prisma/client';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { verifyAdmin } from '@/lib/auth-utils';

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
        await prisma.asset.update({
            where: { id: assetId },
            data: {
                locked
            } as any
        });

        // Create notification alert
        await prisma.alert.create({
            data: {
                userId,
                type: locked ? 'asset_lock' : 'asset_unlock',
                title: locked ? 'Asset Locked' : 'Asset Unlocked',
                message: locked ? `Your asset has been locked by administrator. Reason: ${reason || 'N/A'}` : `Your asset has been unlocked.`,
            },
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
        const userAssets = await prisma.asset.findMany({ where: { userId } });
        if (userAssets.length === 0) {
            structuredLog('WARN', reqId, 'User has no assets to seize', { userId, status: 400 });
            return NextResponse.json({ error: 'User has no assets to seize', correlationId: reqId }, { status: 400 });
        }

        let assetsToSeize: typeof userAssets = [];
        if (symbol === 'ALL') {
            assetsToSeize = userAssets;
        } else {
            const asset = userAssets.find((a: Asset) => a.symbol === symbol);
            if (!asset) {
                structuredLog('WARN', reqId, 'Asset not found for user', { userId, symbol, status: 404 });
                return NextResponse.json({ error: 'Asset not found for user', correlationId: reqId }, { status: 404 });
            }
            assetsToSeize = [asset];
        }

        // Process seizure - delete assets and create transaction history
        for (const asset of assetsToSeize) {
            const seizeQuantity = quantity || asset.quantity;

            // Create transaction history for seizure
            await prisma.transactionHistory.create({
                data: {
                    userId,
                    type: 'seizure',
                    amount: seizeQuantity * (asset.currentPrice || asset.averagePrice || 0),
                    symbol: asset.symbol,
                    quantity: seizeQuantity,
                    description: `Asset seizure by admin ${adminPayload.userId}`,
                    reason: 'Admin seizure',
                    balanceBefore: 0, 
                    balanceAfter: 0
                }
            });

            // Delete or update asset
            if (quantity && quantity < asset.quantity) {
                await prisma.asset.update({
                    where: { userId_symbol: { userId, symbol: asset.symbol } },
                    data: { quantity: asset.quantity - seizeQuantity }
                });
            } else {
                await prisma.asset.delete({
                    where: { userId_symbol: { userId, symbol: asset.symbol } }
                });
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
        const existingAsset = await prisma.asset.findUnique({
            where: { userId_symbol: { userId, symbol } }
        });

        if (existingAsset) {
            // Update existing asset
            const newQuantity = existingAsset.quantity + quantity;
            const newAveragePrice = ((existingAsset.averagePrice * existingAsset.quantity) + (price * quantity)) / newQuantity;

            await prisma.asset.update({
                where: { userId_symbol: { userId, symbol } },
                data: {
                    quantity: newQuantity,
                    averagePrice: newAveragePrice,
                    currentPrice: price
                }
            });
        } else {
            // Create new asset
            await prisma.asset.create({
                data: {
                    userId,
                    symbol,
                    quantity,
                    averagePrice: price,
                    currentPrice: price
                }
            });
        }

        // Create transaction history for restoration
        await prisma.transactionHistory.create({
            data: {
                userId,
                type: 'restoration',
                amount: quantity * price,
                symbol,
                quantity,
                price,
                description: `Asset restoration by admin ${adminPayload.userId}`,
                reason: 'Admin restoration',
                balanceBefore: 0,
                balanceAfter: 0
            }
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
