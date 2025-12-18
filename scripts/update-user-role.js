const { FirestoreDatabaseScript } = require('./firestore-db-js'); // Adjust path if necessary
const admin = require('firebase-admin'); // Need this for FieldValue

async function updateUserRoleToAdmin() {
  const firestoreDB = new FirestoreDatabaseScript();
  const targetEmail = 'dncyhrpr@gmail.com';
  const newRole = 'admin';

  try {
    console.log(`Attempting to update user: ${targetEmail} to role: ${newRole}`);

    const user = await firestoreDB.findUserByEmail(targetEmail);

    if (!user) {
      console.log(`User with email "${targetEmail}" not found.`);
      return;
    }

    console.log(`Found user: ${user.username || user.email} with current role: ${user.role}`);

    if (user.role === newRole && user.roles.includes(newRole) && user.roles.length === 1) {
      console.log(`User "${targetEmail}" is already an ${newRole}. No update needed.`);
      return;
    }

    // Update the user document
    const userRef = admin.firestore().collection(firestoreDB.USERS_COLLECTION).doc(user.id);
    await userRef.update({
      role: newRole,
      roles: [newRole], // Ensure only 'admin' role is present in the array
      updatedAt: admin.firestore.FieldValue.serverTimestamp(),
    });

    console.log(`Successfully updated user "${targetEmail}" to role "${newRole}" and updated their roles array.`);

  } catch (error) {
    console.error(`Error updating user role for "${targetEmail}":`, error);
  }
}

// Run the script
if (require.main === module) {
  updateUserRoleToAdmin()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}