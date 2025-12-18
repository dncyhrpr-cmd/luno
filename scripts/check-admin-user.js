const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function checkAdminUser() {
  try {
    console.log('🔍 Checking admin user...');

    const adminEmail = 'dncyhrpr@gmail.com';

    // Find the admin user
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!admin) {
      console.log('❌ Admin user not found');
      return;
    }

    console.log('✅ Admin user found:');
    console.log(`   ID: ${admin.id}`);
    console.log(`   Email: ${admin.email}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Role: ${admin.role}`);
    console.log(`   Balance: ${admin.balance}`);
    console.log(`   Created: ${admin.createdAt}`);

    // Test password verification
    const testPassword = 'khan212';
    const isValidPassword = await bcrypt.compare(testPassword, admin.password);
    console.log(`   Password verification (khan212): ${isValidPassword ? '✅ Valid' : '❌ Invalid'}`);

    // Test with old password
    const oldPassword = 'admin123';
    const isOldPasswordValid = await bcrypt.compare(oldPassword, admin.password);
    console.log(`   Password verification (admin123): ${isOldPasswordValid ? '✅ Valid' : '❌ Invalid'}`);

    // Show password hash (first few chars for debugging)
    console.log(`   Password hash: ${admin.password.substring(0, 30)}...`);

  } catch (error) {
    console.error('❌ Error checking admin user:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  checkAdminUser()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { checkAdminUser };
