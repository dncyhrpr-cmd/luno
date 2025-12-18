import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '@/lib/firestore-db';
import bcrypt from 'bcryptjs';

const firestoreDB = new FirestoreDatabase();

export async function POST(request: NextRequest) {
  try {
    const body = await request.json().catch(() => ({}));
    const { clear = false } = body;



    if (clear) {
  
      await firestoreDB.clearAllData();
  
    }

    return NextResponse.json({
      message: 'Firestore initialization complete!',
    });

  } catch (error: any) {

    return NextResponse.json(
      { error: 'Firestore initialization failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}

export async function GET() {
  try {
    return NextResponse.json({
      message: 'Firestore connection endpoint is working!',
      status: 'ready'
    });
  } catch (error: any) {

    return NextResponse.json(
      { error: 'Firestore connection check failed', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    );
  }
}
