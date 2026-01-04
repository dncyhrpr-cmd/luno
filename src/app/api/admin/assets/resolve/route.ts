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

        structuredLog('INFO', reqId, 'Processing binary asset resolution', { adminId: adminPayload.userId, userId, assetId, outcome });

        // Get the asset
        const assetDoc = await collections.assets.doc(assetId).get();
        if (!assetDoc.exists) {
            structuredLog('WARN', reqId, 'Asset not found', { assetId, status: 404 });
            return NextResponse.json({ error: 'Asset not found', correlationId: reqId }, { status: 404 });
        }

        const asset = { id: assetDoc.id, ...assetDoc.data() } as any;

        if (!asset.symbol.startsWith('BINARY-')) {
            structuredLog('WARN', reqId, 'Asset is not a binary option', { assetId, symbol: asset.symbol, status: 400 });
            return NextResponse.json({ error: 'Asset is not a binary option', correlationId: reqId }, { status: 400 });
        }

        const orderId = asset.symbol.replace('BINARY-', '');
        const orderDoc = await collections.orders.doc(orderId).get();

        if (!orderDoc.exists) {
            structuredLog('WARN', reqId, 'Corresponding order not found', { orderId, status: 404 });
            return NextResponse.json({ error: 'Corresponding order not found', correlationId: reqId }, { status: 404 });
        }

        const order = { id: orderDoc.id, ...orderDoc.data() };

        // Set admin outcome and resolve immediately
        await collections.orders.doc(order.id).update({
            status: 'approved', // Mark as approved by admin
            direction: outcome === 'win' ? 'UP' : 'DOWN', // Override direction if needed
            resolvedAt: admin.firestore.Timestamp.now(), // Resolve immediately
            updatedAt: admin.firestore.Timestamp.now()
        });

        // Keep the asset for now, resolution at expiry

        // Create notification alert
        const alertId = collections.alerts.doc().id;
        await collections.alerts.doc(alertId).set({
            id: alertId,
            userId,
            type: 'trade_approved',
            title: 'Trade Approved',
            message: `Your binary trade has been approved as ${outcome} by administrator. It will resolve at expiry.`,
            read: false,
            deleted: false,
            createdAt: admin.firestore.Timestamp.now()
        });

        structuredLog('INFO', reqId, 'Binary approval completed successfully', { userId, assetId, outcome, adminId: adminPayload.userId });
        return NextResponse.json({
            message: `Successfully approved binary as ${outcome}`,
            success: true,
            correlationId: reqId
        });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to process binary resolution');
    }
}