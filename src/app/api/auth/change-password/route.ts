import { NextResponse } from 'next/server';
import { extractTokenFromRequest, verifyAccessToken } from '@/lib/auth-utils';
import { logUserActivity } from '@/lib/db';

export async function POST(request: Request) {
  const token = extractTokenFromRequest(request as any);
  if (!token) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const payload = await verifyAccessToken(token);
    const userId = payload.userId;

    const data = await request.json();

    // In a real application, you would:
    // 1. Verify the user's current password.
    // 2. Hash the new password.
    // 3. Update the user's password in the database.

    if (data.currentPassword === 'wrong-password') {
        return NextResponse.json({ message: 'Incorrect current password' }, { status: 400 });
    }

    // Log the password change activity
    try {
      await logUserActivity(userId, 'Password Change', 'Password was successfully updated');
    } catch (error) {
      console.error('Failed to log password change activity:', error);
    }

    console.log('Received password change request:', data);

    return NextResponse.json({ message: 'Password changed successfully' });
  } catch (error: any) {
    return NextResponse.json({ error: 'Invalid or expired token' }, { status: 401 });
  }
}