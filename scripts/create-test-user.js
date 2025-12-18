const admin = require('firebase-admin');
const serviceAccount = require('../serviceAccountKey.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function createTestUser() {
  try {
    const userId = 'uid-test0001';
    const userRef = db.collection('users').doc(userId);
    const userDoc = await userRef.get();
    if (!userDoc.exists) {
      await userRef.set({
        username: 'testuser',
        email: 'testuser@example.com',
        role: 'trader',
        roles: ['trader'],
        balance: 1000.0,
        twoFactorEnabled: false,
        migrationStatus: 'migrated',
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Created test user with id', userId);
    } else {
      console.log('Test user already exists:', userId);
    }

    // Create an asset for the user
    const assetsRef = db.collection('assets');
    const assetSnapshot = await assetsRef.where('userId', '==', userId).where('symbol', '==', 'BTC').get();
    if (assetSnapshot.empty) {
      const newAssetRef = assetsRef.doc();
      await newAssetRef.set({
        id: newAssetRef.id,
        userId,
        symbol: 'BTC',
        quantity: 0.01,
        averagePrice: 30000,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
      });
      console.log('Created BTC asset for test user');
    } else {
      console.log('BTC asset already exists for test user');
    }

    process.exit(0);
  } catch (err) {
    console.error('Failed to create test user or asset:', err);
    process.exit(1);
  }
}

createTestUser();
