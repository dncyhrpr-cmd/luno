import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';
import { getRequestId, handleApiError, structuredLog } from '../../../../lib/correlation';
import { extractTokenFromRequest, verifyAccessToken, AuthTokenPayload } from '../../../../lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

// Middleware to verify admin privileges
async function verifyAdmin(request: NextRequest, reqId: string): Promise<AuthTokenPayload | null> {
    const token = extractTokenFromRequest(request);
    if (!token) {
        structuredLog('WARN', reqId, 'Unauthorized: Missing token for admin asset seizure', { status: 401 });
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
        structuredLog('WARN', reqId, 'Auth token error on admin asset seizure', { error: error.message, status: 401 });
        return null;
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
        const userAssets = await firestoreDB.getAssets(userId);
        if (userAssets.length === 0) {
            structuredLog('WARN', reqId, 'User has no assets to seize', { userId, status: 400 });
            return NextResponse.json({ error: 'User has no assets to seize', correlationId: reqId }, { status: 400 });
        }

        let assetsToSeize: typeof userAssets = [];
        if (symbol === 'ALL') {
            assetsToSeize = userAssets;
        } else {
            const asset = userAssets.find(a => a.symbol === symbol);
            if (!asset) {
                structuredLog('WARN', reqId, 'Asset not found for user', { userId, symbol, status: 404 });
                return NextResponse.json({ error: 'Asset not found for user', correlationId: reqId }, { status: 404 });
            }
            assetsToSeize = [asset];
        }

        // Process seizure in transaction
        await firestoreDB.processAssetSeizure(userId, assetsToSeize, adminPayload.userId, quantity);

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

        // Process restoration in transaction
        await firestoreDB.processAssetRestoration(userId, symbol, quantity, price, adminPayload.userId);

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