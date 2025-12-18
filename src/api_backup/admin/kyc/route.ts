import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';
import { getRequestId, handleApiError, structuredLog } from '../../../../lib/correlation';
import { extractTokenFromRequest, verifyAccessToken, AuthTokenPayload } from '../../../../lib/auth-utils';

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

// GET - Fetch all pending KYC requests
export async function GET(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    try {
        structuredLog('INFO', reqId, 'Fetching all pending KYC requests', { adminId: adminPayload.userId });
        const pendingKYC = await firestoreDB.getAllPendingKYC();

        structuredLog('INFO', reqId, 'Successfully fetched pending KYC requests', { count: pendingKYC.length });
        return NextResponse.json({ kycRequests: pendingKYC, correlationId: reqId });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to fetch pending KYC requests');
    }
}
