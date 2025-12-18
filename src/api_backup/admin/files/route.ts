
import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { getRequestId, handleApiError, structuredLog } from '@/lib/correlation';
import { extractTokenFromRequest, verifyAccessToken, AuthTokenPayload } from '@/lib/auth-utils';
import { storage } from '@/lib/client-db';
import { ref, getDownloadURL } from 'firebase/storage';

const firestoreDB = new FirestoreDatabase();

// Middleware to verify admin privileges
async function verifyAdmin(request: NextRequest, reqId: string): Promise<AuthTokenPayload | null> {
    const token = extractTokenFromRequest(request);
    if (!token) {
        structuredLog('WARN', reqId, 'Unauthorized: Missing token for admin file access', { status: 401 });
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
        structuredLog('WARN', reqId, 'Auth token error on admin file access', { error: error.message, status: 401 });
        return null;
    }
}

// GET - Get file download URL
export async function GET(request: NextRequest) {
    const reqId = getRequestId(request);
    const route = request.url;
    const filePath = request.nextUrl.searchParams.get('path');

    const adminPayload = await verifyAdmin(request, reqId);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden', correlationId: reqId }, { status: 403 });
    }

    if (!filePath) {
        return NextResponse.json({ error: 'File path is required' }, { status: 400 });
    }

    try {
        structuredLog('INFO', reqId, 'Generating download URL for file', { adminId: adminPayload.userId, filePath });

        const fileRef = ref(storage, filePath);
        const downloadURL = await getDownloadURL(fileRef);

        structuredLog('INFO', reqId, 'Successfully generated download URL', { filePath });
        return NextResponse.json({ downloadURL, correlationId: reqId });

    } catch (error: any) {
        return handleApiError(reqId, error, route, 'Failed to generate file download URL');
    }
}
