import { NextRequest, NextResponse } from 'next/server';
import { getDb } from '@/lib/firestore-admin';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
    const token = extractTokenFromRequest(request);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = await verifyAccessToken(token);
        const userId = payload.userId;
        const db = getDb();
        const userRef = db.collection('users').doc(userId);
        const userDoc = await userRef.get();

        if (!userDoc.exists) {
            // Return empty profile if no data is found
            return NextResponse.json({});
        }

        return NextResponse.json(userDoc.data());
    } catch (error: any) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
}