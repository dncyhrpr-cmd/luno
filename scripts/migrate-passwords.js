const admin = require('firebase-admin');
const bcryptjs = require('bcryptjs');

const serviceAccount = require('../firebase-admin-key.json');

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.FIREBASE_DATABASE_URL || 'https://luno-3eba2.firebaseio.com',
});

const db = admin.firestore();

async function migratePasswords() {
  console.log('Starting password migration...');

  try {
    const usersSnapshot = await db.collection('users').get();
    let migratedCount = 0;
    let skippedCount = 0;

    for (const doc of usersSnapshot.docs) {
      const user = doc.data();
      const userId = doc.id;

      // Skip if password hash already exists
      if (user.passwordHash) {
        console.log(`✓ User ${user.email} already has password hash`);
        skippedCount++;
        continue;
      }

      // Generate a temporary password hash if no password exists
      const tempPassword = `TempPassword${Math.random().toString(36).substr(2, 9)}!@`;
      const passwordHash = await bcryptjs.hash(tempPassword, 10);

      await db.collection('users').doc(userId).update({
        passwordHash: passwordHash,
        updatedAt: admin.firestore.FieldValue.serverTimestamp(),
      });

      console.log(`✓ Migrated user ${user.email} (temp password set, user should reset)`);
      migratedCount++;
    }

    console.log(`\nMigration complete!`);
    console.log(`- Migrated: ${migratedCount} users`);
    console.log(`- Skipped: ${skippedCount} users (already migrated)`);
    console.log(`\n⚠️  Important: Users without passwords need to use password reset functionality.`);
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
}

migratePasswords();
