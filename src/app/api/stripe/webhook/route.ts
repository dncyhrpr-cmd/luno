import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';
import { prisma } from '@/lib/db';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);
const endpointSecret = process.env.STRIPE_WEBHOOK_SECRET!;

export async function POST(request: NextRequest) {
  const body = await request.text();
  const sig = request.headers.get('stripe-signature')!;

  let event: Stripe.Event;

  try {
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
    const user = await prisma.user.findUnique({ where: { id: userId } });
    if (!user) {
      console.error('User not found');
      return NextResponse.json({ error: 'User not found' }, { status: 404 });
    }

    const balanceBefore = user.balance;

    // Update balance
    await prisma.user.update({
      where: { id: userId },
      data: { balance: { increment: amount } },
    });

    // Log transaction
    await prisma.transactionHistory.create({
      data: {
        userId,
        type: 'deposit',
        amount,
        description: `Stripe deposit - ${session.id}`,
        balanceBefore,
        balanceAfter: balanceBefore + amount,
      },
    });

    console.log(`Deposit completed for user ${userId}: ${amount}`);
  }

  return NextResponse.json({ received: true });
}

// Disable body parsing for webhook
export const config = {
  api: {
    bodyParser: false,
  },
};