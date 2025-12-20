import { getDb } from '@/lib/firestore-admin';

export const getFirestoreDb = () => getDb();

export async function logUserActivity(userId: string, action: string, details: string) {
    const db = getFirestoreDb();
    const activityRef = db.collection('users').doc(userId).collection('activity');
    await activityRef.add({
        action,
        time: new Date(),
        details,
    });
}
