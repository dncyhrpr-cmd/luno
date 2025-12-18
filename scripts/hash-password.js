const bcrypt = require('bcryptjs');

async function hashPassword(password) {
  const hashedPassword = await bcrypt.hash(password, 12);
  return hashedPassword;
}

// Run if called directly
if (require.main === module) {
  const password = process.argv[2];
  if (!password) {
    console.error("Please provide a password to hash.");
    process.exit(1);
  }
  hashPassword(password)
    .then(hash => {
      console.log(`Original password: ${password}`);
      console.log(`Hashed password (use this for Firestore 'password' field): ${hash}`);
      process.exit(0);
    })
    .catch(error => {
      console.error('Error hashing password:', error);
      process.exit(1);
    });
}

module.exports = { hashPassword };