const { PrismaClient } = require('@prisma/client');
const bcrypt = require('bcryptjs');

const prisma = new PrismaClient();

async function initializePrisma() {
  try {
    console.log('🚀 Initializing Prisma database...');

    // Check if admin user already exists
    const existingAdmin = await prisma.user.findUnique({
      where: { email: 'dncyhrpr@gmail.com' }
    });

    if (!existingAdmin) {
      // Create admin user
      const hashedPassword = await bcrypt.hash('khan212', 12);

      const adminUser = await prisma.user.create({
        data: {
          username: 'dncyhrpr_admin',
          email: 'dncyhrpr@gmail.com',
          password: hashedPassword,
          role: 'admin',
          balance: 1000000.0,
          twoFactorEnabled: false,
          status: 'active'
        }
      });

      console.log('👤 Admin user created in Prisma');
      console.log(`   Email: ${adminUser.email}`);
      console.log(`   Username: ${adminUser.username}`);
      console.log(`   Role: ${adminUser.role}`);
      console.log(`   Balance: ${adminUser.balance}`);
    } else {
      console.log('👤 Admin user already exists in Prisma');
      console.log(`   Email: ${existingAdmin.email}`);
      console.log(`   Username: ${existingAdmin.username}`);
      console.log(`   Role: ${existingAdmin.role}`);
    }

    console.log('\n🎉 Prisma initialization complete!');

  } catch (error) {
    console.error('❌ Prisma initialization failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  initializePrisma()
    .then(() => process.exit(0))
    .catch(() => process.exit(1));
}

module.exports = { initializePrisma };