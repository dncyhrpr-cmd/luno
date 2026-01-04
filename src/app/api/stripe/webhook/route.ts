import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { collections } from '@/lib/db';
import admin from 'firebase-admin';

const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
    event = stripe.webhooks.constructEvent(body, sig, endpointSecret);
  } catch (err: any) {
    console.error('Webhook signature verification failed:', err.message);
    return NextResponse.json({ error: 'Webhook signature verification failed' }, { status: 400 });
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object as Stripe.Checkout.Session;

    const userId = session.metadata?.userId;
    const amount = (session.amount_total || 0) / 100; // convert from cents

    if (!userId) {
      console.error('No userId in metadata');
      return NextResponse.json({ error: 'Invalid metadata' }, { status: 400 });
    }

    // Get current balance
    const userDoc = await collections.users.doc(userId).get();
    if (!userDoc.exists) {
      console.error('User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }
    const user = userDoc.data() as any;
    const balanceBefore = user.balance;

    // Update balance atomically
    await collections.users.doc(userId).update({
      balance: admin.firestore.FieldValue.increment(amount),
      updatedAt: admin.firestore.Timestamp.now()
    });

    // Log transaction
    const txId = collections.transactionHistory.doc().id;
    await collections.transactionHistory.doc(txId).set({
      id: txId,
      userId,
      type: 'deposit',
      amount,
      description: `Stripe deposit - ${session.id}`,
      balanceBefore,
      balanceAfter: balanceBefore + amount,
      createdAt: admin.firestore.Timestamp.now()
    });

    console.log(`Deposit completed for user ${userId}: ${amount}`);
  }

  return NextResponse.json({ received: true });
}

// Using default runtime for compatibility with Firebase Admin SDK
// export const runtime = 'edge';