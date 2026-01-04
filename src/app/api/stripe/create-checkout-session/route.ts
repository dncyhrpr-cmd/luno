import { NextRequest, NextResponse } from 'next/server';
import Stripe from 'stripe';

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY || process.env.STRIPE_SECRET_KEY.trim() === '') {
      console.error('STRIPE_SECRET_KEY not configured or empty');
      return NextResponse.json({ error: 'Payment service not configured' }, { status: 400 });
    }

    let body;
    try {
      body = await request.json();
    } catch (parseError) {
      return NextResponse.json({ error: 'Invalid JSON in request body' }, { status: 400 });
    }

    const { amount, userId } = body;

    if (!amount || typeof amount !== 'number' || amount <= 0 || amount > 10000) {
      return NextResponse.json({ error: 'Amount must be a number between 0.01 and 10000' }, { status: 400 });
    }

    if (!userId || typeof userId !== 'string') {
      return NextResponse.json({ error: 'Valid userId is required' }, { status: 400 });
    }

    const stripe = new Stripe(process.env.STRIPE_SECRET_KEY.trim());

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
      success_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/assets?success=true`,
      cancel_url: `${process.env.NEXTAUTH_URL || 'http://localhost:3000'}/assets?canceled=true`,
      metadata: {
        userId,
      },
    });

    return NextResponse.json({ url: session.url });
  } catch (error: any) {
    console.error('Stripe checkout session creation failed:', error.message || error);
    if (error.type === 'StripeInvalidRequestError') {
      return NextResponse.json({ error: 'Invalid payment request' }, { status: 400 });
    }
    if (error.type === 'StripeAPIError') {
      return NextResponse.json({ error: 'Payment service temporarily unavailable' }, { status: 503 });
    }
    return NextResponse.json({ error: 'Failed to create checkout session' }, { status: 500 });
  }
}