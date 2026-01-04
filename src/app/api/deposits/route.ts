import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  try {
    const token = extractTokenFromRequest(request);
    if (!token) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const { amount } = await request.json();

    if (!amount || typeof amount !== 'number' || amount <= 0) {
      return NextResponse.json({ error: 'Valid amount is required' }, { status: 400 });
    }

    // Get current user
    const userDoc = await collections.users.doc(userId).get();
    if (!userDoc.exists) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const user = { id: userDoc.id, ...userDoc.data() } as any;
    const newBalance = user.balance + amount;

    // Update balance atomically
    await collections.users.doc(userId).update({ balance: admin.firestore.FieldValue.increment(amount) });

    // Create transaction history
    const txId = collections.transactionHistory.doc().id;
    await collections.transactionHistory.doc(txId).set({
      id: txId,
      userId,
      type: 'deposit',
      amount,
      description: 'Manual deposit',
      status: 'completed',
      balanceBefore: user.balance,
      balanceAfter: newBalance,
      createdAt: admin.firestore.Timestamp.now()
    });

    return NextResponse.json({
      message: 'Deposit successful',
      newBalance
    });
  } catch (error: any) {
    console.error('Deposit error:', error);
    return NextResponse.json({ error: 'Deposit failed' }, { status: 500 });
  }
}