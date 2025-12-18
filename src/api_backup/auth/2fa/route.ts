import { NextRequest, NextResponse } from 'next/server';

export async function GET(request: NextRequest) {
  return NextResponse.json({ enabled: false, hasBackupCodes: false });
}

export async function POST(request: NextRequest) {
  return NextResponse.json({ message: '2FA functionality is not implemented in this mock version.' });
}
