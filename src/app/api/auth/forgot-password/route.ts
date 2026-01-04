import { NextRequest, NextResponse } from 'next/server';
import { collections } from '@/lib/db';
import { checkAndIncrementRateLimit } from '@/lib/rate-limit';
import crypto from 'crypto';
import admin from 'firebase-admin';

export async function POST(request: NextRequest) {
  const { email } = await request.json();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return NextResponse.json({ error: 'Invalid email' }, { status: 400 });
  }

  // Rate limit by email: 3 attempts per hour
  const rateLimit = await checkAndIncrementRateLimit(
    `forgot-password:${email}`,
    60 * 60 * 1000,
    3
  );

  if (!rateLimit.allowed) {
    return NextResponse.json({ error: 'Too many requests. Try again later.' }, { status: 429 });
  }

  const normalizedEmail = email.toLowerCase().trim();

  try {
    // Check if user exists
    const userQuery = await collections.users.where('email', '==', normalizedEmail).get();
    if (userQuery.empty) {
      // Don't reveal if user exists or not for security
      return NextResponse.json({ message: 'If an account with that email exists, a reset link has been sent.' });
    }

    const user = userQuery.docs[0].data();

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenExpiry = new Date(Date.now() + 60 * 60 * 1000); // 1 hour

    // Store reset token in Firestore
    await collections.users.doc(user.id).update({
      resetToken,
      resetTokenExpiry: admin.firestore.Timestamp.fromDate(resetTokenExpiry)
    });

    // In a real application, you would send an email here
    // For now, we'll just log the reset link
    const resetLink = `${process.env.NEXT_PUBLIC_APP_URL}/reset-password?token=${resetToken}&email=${encodeURIComponent(normalizedEmail)}`;

    console.log('Password reset link generated:', resetLink);
    console.log('Reset token:', resetToken);
    console.log('For user:', normalizedEmail);

    // TODO: Send email with reset link
    // You would integrate with an email service like SendGrid, Mailgun, etc.

    return NextResponse.json({ message: 'If an account with that email exists, a reset link has been sent.' });
  } catch (error) {
    console.error('Password reset error:', error);
    return NextResponse.json({ error: 'Failed to process reset request' }, { status: 500 });
  }
}
