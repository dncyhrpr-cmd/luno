import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { checkAndIncrementRateLimit } from '@/lib/rate-limit';

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

  console.log('Attempting to send reset email for:', email);
  const { data, error } = await supabase.auth.resetPasswordForEmail(email, {
    redirectTo: `${process.env.NEXT_PUBLIC_APP_URL}/reset-password`,
  });

  if (error) {
    console.error('Supabase reset password error:', error);
    return NextResponse.json({ error: 'Failed to send reset email: ' + error.message }, { status: 500 });
  }

  console.log('Reset email sent successfully for:', email, data);
  return NextResponse.json({ message: 'Reset email sent' });
}
