import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../../lib/firestore-db';
import jwt from 'jsonwebtoken';

const firestoreDB = new FirestoreDatabase();

// Helper function to verify admin token
function verifyAdminToken(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return null;
  }

  const token = authHeader.substring(7);
  try {
    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'your-secret-key') as any;
    return decoded;
  } catch (error: any) {
    return null;
  }
}

// GET - Fetch analytics data
export async function GET(request: NextRequest) {
  try {
    const user = verifyAdminToken(request);
    if (!user || user.role !== 'admin') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    // Fetch all necessary data using the getAnalytics function
    const analytics = await firestoreDB.getAnalytics();

    return NextResponse.json({ analytics });

  } catch (error: any) {
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 });
  }
}
