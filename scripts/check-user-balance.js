// Script to check user balance in Firestore
const admin = require('firebase-admin');
const fs = require('fs');

const keyPath = require('path').resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('serviceAccountKey.json not found at:', keyPath);
  console.error('Please ensure it exists in the project root directory.');
  console.error('Download it from Firebase Console > Project Settings > Service Accounts > Generate new private key.');
  process.exit(1);
}

// Initialize Firebase Admin SDK
const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();

async function checkUserBalance(email) {
  try {
    console.log(`🔍 Checking balance for user: ${email}`);

    const usersRef = db.collection('users');
    const snapshot = await usersRef.where('email', '==', email).get();

    if (snapshot.empty) {
      console.log('❌ User not found');
      return;
    }

    const userDoc = snapshot.docs[0];
    const userData = userDoc.data();

    console.log('✅ User found:');
    console.log(`   ID: ${userDoc.id}`);
    console.log(`   Email: ${userData.email}`);
    console.log(`   Username: ${userData.username}`);
    console.log(`   Balance: ${userData.balance}`);
    console.log(`   Status: ${userData.status || 'active'}`);
    console.log(`   Created: ${userData.createdAt ? new Date(userData.createdAt.seconds * 1000) : 'Unknown'}`);

  } catch (error) {
    console.error('❌ Error checking user:', error);
  } finally {
    process.exit(0);
  }
}

// Get email from command line
const email = process.argv[2] || 'p2p@gmail.com';
checkUserBalance(email);