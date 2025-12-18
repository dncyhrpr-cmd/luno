import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/db';
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

        const activityRef = db.collection('users').doc(userId).collection('activity');

        let query = activityRef.orderBy('time', 'desc');
        if (!full) {
            query = query.limit(10);
        }
        const snapshot = await query.get();

        if (snapshot.empty) {
            // Create some sample data for the user if no data is found
            const batch = db.batch();
            const sampleActivity = [
                {
                    action: 'User Login',
                    time: new Date(),
                    details: 'Logged in from IP: 192.168.1.1',
                },
                {
                    action: 'Password Change',
                    time: new Date(),
                    details: 'Password was successfully updated',
                },
            ];

            sampleActivity.forEach(activity => {
                const docRef = activityRef.doc();
                batch.set(docRef, activity);
            });

            await batch.commit();

            const newSnapshot = await activityRef.orderBy('time', 'desc').get();
            const activityLog = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return NextResponse.json(activityLog);
        }

        const activityLog = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json(activityLog);
    } catch (error: any) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
}