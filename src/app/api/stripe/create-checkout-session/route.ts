import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!);

export async function POST(request: NextRequest) {
  try {
    const { amount, userId } = await request.json();

    if (!amount || amount <= 0) {
      return NextResponse.json({ error: 'Invalid amount' }, { status: 400 });
    }

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      line_items: [{
        price_data: {
          currency: 'usd',
          product_data: {
            name: 'Deposit to Luno',
          },
          unit_amount: Math.round(amount * 100), // in cents
        },
        quantity: 1,
      }],
      mode: 'payment',
      success_url: `${process.env.NEXTAUTH_URL}/profile?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL}/profile?canceled=true`,
      metadata: {
        userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}