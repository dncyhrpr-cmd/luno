const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function removeAllUsers() {
  try {
    console.log('Removing all users...');
    await prisma.user.deleteMany({});
    console.log('All users removed.');
  } catch (error) {
    console.error('Error removing users:', error);
  } finally {
    await prisma.$disconnect();
  }
}

removeAllUsers();