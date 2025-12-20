import { NextRequest, NextResponse } from 'next/server';
import { getFirestoreDb } from '@/lib/db';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';

export async function GET(request: NextRequest) {
    const token = extractTokenFromRequest(request);
    if (!token) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    try {
        const payload = await verifyAccessToken(token);
        const userId = payload.userId;
        const { searchParams } = new URL(request.url);
        const full = searchParams.get('full');

        const db = getFirestoreDb();
        const activityRef = db.collection('users').doc(userId).collection('activity');

        let query = activityRef.orderBy('time', 'desc');
        if (!full) {
            query = query.limit(10);
        }
        const snapshot = await query.get();

        if (snapshot.empty) {
            // Return empty array if no data is found
            return NextResponse.json([]);
        }

        const activityLog = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(activityLog);
    } catch (error: any) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
}