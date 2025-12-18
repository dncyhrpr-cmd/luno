import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';

const firestoreDB = new FirestoreDatabase();

export async function GET(request: NextRequest) {
  try {
    // In a real application, you would get the user's ID from the session and then fetch the user's data from the database.
    // For this mock implementation, we will simply return a mock user.
    const user = {
      id: 'mock-user-id',
      email: 'mockuser@example.com',
      username: 'mockuser',
      role: 'user',
      roles: ['user'],
      isAdmin: false,
      migrationStatus: 'migrated',
    };
    return NextResponse.json({ user });
  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch user data' }, { status: 500 });
  }
}
