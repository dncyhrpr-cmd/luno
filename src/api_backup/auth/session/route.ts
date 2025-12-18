
import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';
import { getRequestId, structuredLog } from '@/lib/correlation';
import { admin } from '@/lib/firestore-admin';
import { generateAuthTokens } from '@/lib/auth-utils';

const firestoreDB = new FirestoreDatabase();

async function verifyFirebaseToken(token: string) {
    try {
        const decodedToken = await admin.auth().verifyIdToken(token);
        return decodedToken;
    } catch (error: any) {
        return null;
    }
}


export async function POST(request: NextRequest) {
    const reqId = getRequestId(request);
    structuredLog('INFO', reqId, 'Session POST request received', { file: 'session/route.ts' });

    try {
        const authHeader = request.headers.get('authorization');
        if (!authHeader || !authHeader.startsWith('Bearer ')) {
            structuredLog('WARN', reqId, 'Authorization header missing or invalid', { file: 'session/route.ts' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const idToken = authHeader.substring(7);
        const decodedToken = await verifyFirebaseToken(idToken);

        if (!decodedToken) {
            structuredLog('WARN', reqId, 'Invalid Firebase token', { file: 'session/route.ts' });
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
        }

        const userId = decodedToken.uid;
        const user = await firestoreDB.findUserById(userId);

        if (!user) {
            structuredLog('WARN', reqId, `User not found for userId: ${userId}`, { file: 'session/route.ts' });
            return NextResponse.json({ error: 'User not found' }, { status: 404 });
        }

        const { accessToken } = await generateAuthTokens(user);

        const response = {
            user: {
                id: user.id,
                email: user.email,
                username: user.username,
                role: user.role,
            },
            accessToken,
        };

        return NextResponse.json(response);
    } catch (error: any) {
        structuredLog('ERROR', reqId, 'Failed to process session request', { file: 'session/route.ts', error: error.message, stack: error.stack });
        return NextResponse.json({ error: 'Failed to process session' }, { status: 500 });
    }
}
