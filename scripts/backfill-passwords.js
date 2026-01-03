const { FirestoreDatabase } = require('../src/lib/firestore-db');
const bcryptjs = require('bcryptjs');

async function backfillPasswords() {
  const firestoreDB = new FirestoreDatabase();

  try {
    console.log('Fetching all users...');
    const { users } = await firestoreDB.getUsers();

    let updated = 0;
    for (const user of users) {
      if (!user.passwordHash) {
        console.log(`User ${user.email} (${user.id}) has no passwordHash.`);
        // For backfilling, we can't know the original password.
        // Users should use password reset.
        // Optionally, set a default password, but not recommended.
        // console.log(`Setting default password for ${user.email}`);
   
        // const passwordHash = await bcryptjs.hash(defaultPassword, 10);
        // await firestoreDB.updateUser(user.id, { passwordHash });
        // console.log(`Updated ${user.email} with default password. They should change it.`);
        // updated++;
      }
    }

    console.log(`Backfill complete. ${updated} users updated.`);
    console.log('Users without passwordHash should use the password reset functionality.');

  } catch (error) {
    console.error('Error backfilling passwords:', error);
  }
}

backfillPasswords();