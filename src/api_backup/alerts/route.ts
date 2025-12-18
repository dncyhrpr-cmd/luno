import { NextRequest, NextResponse } from 'next/server';
import { FirestoreDatabase } from '../../../lib/firestore-db';
import jwt from 'jsonwebtoken';

const firestoreDB = new FirestoreDatabase();

function verifyToken(request: NextRequest) {
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

export async function GET(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const alerts = await firestoreDB.getAlerts(user.userId);
    const unreadCount = alerts.filter(a => !a.read).length;
    
    return NextResponse.json({ 
      alerts,
      unreadCount,
      total: alerts.length
    });
  } catch (error) {

    return NextResponse.json({ error: 'Failed to fetch alerts' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = verifyToken(request);
    if (!user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const { alertId, action } = await request.json();

    if (!alertId || !action) {
      return NextResponse.json({ error: 'Missing alertId or action' }, { status: 400 });
    }

    if (action === 'read') {
      await firestoreDB.markAlertAsRead(alertId);
    } else if (action === 'delete') {
      await firestoreDB.deleteAlert(alertId);
    } else {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 });
    }

    return NextResponse.json({
      message: `Alert ${action}ed successfully`,
      success: true
    });
  } catch (error) {

    return NextResponse.json({ error: 'Failed to process alert' }, { status: 500 });
  }
}
