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
        const transactionsRef = db.collection('users').doc(userId).collection('transactions');
        const snapshot = await transactionsRef.orderBy('date', 'desc').limit(20).get();

        if (snapshot.empty) {
            // Create some sample data for the user if no data is found
            const batch = db.batch();
            const sampleTransactions = [
                { type: 'Deposit', amount: 1000, currency: 'USD', date: new Date() },
                { type: 'Buy', amount: 0.5, currency: 'ETH', price: 1500, date: new Date() },
                { type: 'Sell', amount: 0.2, currency: 'BTC', price: 30000, date: new Date() },
                { type: 'Withdrawal', amount: 500, currency: 'USD', date: new Date() },
            ];

            sampleTransactions.forEach(transaction => {
                const docRef = transactionsRef.doc();
                batch.set(docRef, transaction);
            });

            await batch.commit();

            const newSnapshot = await transactionsRef.orderBy('date', 'desc').limit(20).get();
            const history = newSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            return NextResponse.json({ history, total: history.length });
        }

        const history = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
        return NextResponse.json({ history, total: history.length });
    } catch (error: any) {
        return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
    }
}
