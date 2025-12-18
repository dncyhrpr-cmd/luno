import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import { extractTokenFromRequest, verifyAccessToken, AuthTokenPayload } from '@/lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

// Middleware to verify admin privileges
async function verifyAdmin(request: NextRequest): Promise<AuthTokenPayload | null> {
    const token = extractTokenFromRequest(request);
    if (!token) {
        return null;
    }

    try {
        const payload = await verifyAccessToken(token);
        if (!payload.roles?.includes('admin')) {
            return null;
        }
        return payload;
    } catch (error: any) {
        return null;
    }
}

// GET - Fetch all pending KYC requests
export async function GET(request: NextRequest) {
    const adminPayload = await verifyAdmin(request);
    if (!adminPayload) {
        return NextResponse.json({ error: 'Unauthorized or Forbidden' }, { status: 403 });
    }

    try {
        const pendingKYC = await firestoreDB.getAllPendingKYC();
        return NextResponse.json({ kycRequests: pendingKYC });
    } catch (error: any) {
        console.error('Failed to fetch pending KYC requests:', error);
        return NextResponse.json({ error: 'Failed to fetch pending KYC requests' }, { status: 500 });
    }
}