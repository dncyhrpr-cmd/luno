import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../../lib/firestore-db';
import { getRequestId, handleApiError, structuredLog } from '../../../../../lib/correlation';
import { extractTokenFromRequest, verifyAccessToken, AuthTokenPayload } from '../../../../../lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

// Middleware to verify admin privileges
async function verifyAdmin(request: NextRequest, reqId: string): Promise<AuthTokenPayload | null> {
    const token = extractTokenFromRequest(request);
    if (!token) {
        structuredLog('WARN', reqId, 'Unauthorized: Missing token for admin KYC action', { status: 401 });
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
        structuredLog('WARN', reqId, 'Auth token error on admin KYC action', { error: error.message, status: 401 });
        return null;
    }
}

// PUT - Update KYC status
export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
    const reqId = getRequestId(request);
    const route = request.url;
    const kycId = params.id;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        const { status, reason } = await request.json();

        if (!status || !['approved', 'rejected'].includes(status)) {
            return NextResponse.json({ error: 'Invalid status provided' }, { status: 400 });
        }

        if (status === 'rejected' && !reason) {
            return NextResponse.json({ error: 'Rejection reason is required' }, { status: 400 });
        }

        structuredLog('INFO', reqId, 'Updating KYC status', { adminId: adminPayload.userId, kycId, status, reason });

        await firestoreDB.updateKYCStatus(kycId, status, adminPayload.userId, reason);

        // Audit log
        await firestoreDB.createAuditLog({
            adminId: adminPayload.userId,
            action: `kyc_${status}`,
            resourceType: 'kyc',
            resourceId: kycId,
            changes: { status, reason },
            status: 'success'
        });

        structuredLog('INFO', reqId, 'Successfully updated KYC status', { kycId });
        return NextResponse.json({ message: `KYC request ${status} successfully.`, correlationId: reqId });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to update KYC status');
    }
}
