const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function updateAdminPassword() {
  try {
    console.log('🔧 Updating admin password...');

    const adminEmail = 'dncyhrpr@gmail.com';
    const newPassword = 'khan212';

    // Find the admin user
    const admin = await prisma.user.findUnique({
      where: { email: adminEmail }
    });

    if (!admin) {
      console.log('❌ Admin user not found');
      return;
    }

    // Hash the new password
    const hashedPassword = await bcrypt.hash(newPassword, 12);

    // Update the password
    await prisma.user.update({
      where: { email: adminEmail },
      data: { password: hashedPassword }
    });

    console.log('✅ Admin password updated successfully');
    console.log(`   Email: ${adminEmail}`);
    console.log(`   Username: ${admin.username}`);
    console.log(`   Role: ${admin.role}`);

  } catch (error) {
    console.error('❌ Failed to update admin password:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  updateAdminPassword()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { updateAdminPassword };
