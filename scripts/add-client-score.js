const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin
let credential;
if (process.env.FIREBASE_PROJECT_ID && process.env.FIREBASE_PRIVATE_KEY && process.env.FIREBASE_CLIENT_EMAIL) {
  credential = admin.credential.cert({
    projectId: process.env.FIREBASE_PROJECT_ID,
    privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
  });
} else {
  const keyPath = path.resolve(process.cwd(), 'serviceAccountKey.json');
  if (!fs.existsSync(keyPath)) {
    throw new Error(`serviceAccountKey.json not found at: ${keyPath}, and no Firebase environment variables set`);
  }
  const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
  credential = admin.credential.cert(serviceAccount);
}

admin.initializeApp({
  credential,
});

const db = admin.firestore();

async function addClientScore() {
  try {
    console.log('🔄 Adding clientScore to users without it...');

    const usersRef = db.collection('users');
    const snapshot = await usersRef.get();

    let updatedCount = 0;
    const batch = db.batch();

    for (const doc of snapshot.docs) {
      const userData = doc.data();
      if (userData.clientScore === undefined || userData.clientScore === null) {
        batch.update(doc.ref, { clientScore: 50 }); // Default client score
        updatedCount++;
      }
    }

    // Also update existing null or 0 values to 50
    const defaultScoreUsers = snapshot.docs.filter(doc => {
      const score = doc.data().clientScore;
      return score === null || score === 0;
    });
    if (defaultScoreUsers.length > 0) {
      const batch2 = db.batch();
      for (const doc of defaultScoreUsers) {
        batch2.update(doc.ref, { clientScore: 50 });
      }
      await batch2.commit();
      console.log(`✅ Set default clientScore to 50 for ${defaultScoreUsers.length} users`);
    }

    if (updatedCount > 0) {
      await batch.commit();
      console.log(`✅ Added clientScore field to ${updatedCount} users`);
    } else {
      console.log('ℹ️ All users already have clientScore field');
    }

  } catch (error) {
    console.error('❌ Failed to add clientScore:', error);
    throw error;
  }
}

addClientScore()
  .then(() => {
    console.log('🎉 Client score connection complete!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('💥 Error:', error);
    process.exit(1);
  });