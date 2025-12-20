// Script to check all users in Firestore
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

async function checkUsers() {
  try {
    console.log('🔍 Checking all users in Firestore...');

    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    if (snapshot.empty) {
      console.log('❌ No users found in Firestore');
      return;
    }

    console.log(`✅ Found ${snapshot.size} users:`);
    snapshot.forEach((doc) => {
      const user = doc.data();
      console.log(`\nUser ID: ${doc.id}`);
      console.log(`  Email: ${user.email}`);
      console.log(`  Username: ${user.username}`);
      console.log(`  Role: ${user.role}`);
      console.log(`  Roles: ${user.roles}`);
      console.log(`  Status: ${user.status}`);
      console.log(`  Balance: ${user.balance}`);
      console.log(`  Created At: ${user.createdAt}`);
    });

  } catch (error) {
    console.error('❌ Error checking users:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  checkUsers()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { checkUsers };