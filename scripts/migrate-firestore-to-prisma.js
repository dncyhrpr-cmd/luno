const admin = require('firebase-admin');
const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

// Initialize Firebase Admin SDK
const keyPath = path.resolve(__dirname, '../serviceAccountKey.json');
if (!fs.existsSync(keyPath)) {
  console.error('serviceAccountKey.json not found at:', keyPath);
  console.error('Please ensure it exists in the project root directory.');
  process.exit(1);
}

const serviceAccount = JSON.parse(fs.readFileSync(keyPath, 'utf8'));
admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
});

const firestoreDb = admin.firestore();
const prisma = new PrismaClient();

async function exportFirestoreData() {
  console.log('🚀 Starting Firestore data export...');

  const collections = [
    'users',
    'orders',
    'assets',
    'requests',
    'transaction_history',
    'kyc_data',
    'audit_logs',
    'alerts',
    'scheduled_orders',
    'advanced_orders',
    'portfolio_analytics',
    'token_revocation'
  ];

  const exportedData = {};

  for (const collectionName of collections) {
    console.log(`📄 Exporting collection: ${collectionName}`);
    const snapshot = await firestoreDb.collection(collectionName).get();
    const documents = [];

    snapshot.forEach(doc => {
      documents.push({
        id: doc.id,
        ...doc.data()
      });
    });

    exportedData[collectionName] = documents;
    console.log(`   Exported ${documents.length} documents`);
  }

  // Save to JSON file
  const exportPath = path.join(__dirname, '../firestore-export.json');
  fs.writeFileSync(exportPath, JSON.stringify(exportedData, null, 2));
  console.log(`💾 Exported data saved to: ${exportPath}`);

  return exportedData;
}

async function transformDataForPrisma(exportedData) {
  console.log('🔄 Transforming data for Prisma...');

  const transformedData = {
    users: exportedData.users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      password: user.password || user.passwordHash, // Handle legacy password field
      role: user.role || 'user',
      balance: parseFloat(user.balance) || 0,
      twoFactorEnabled: user.twoFactorEnabled || false,
      twoFactorSecret: user.twoFactorSecret || null,
      backupCodes: user.backupCodes || null,
      roles: user.roles || [],
      migrationStatus: user.migrationStatus || 'legacy',
      status: user.status || 'active',
      lastLogin: user.lastLogin ? new Date(user.lastLogin._seconds * 1000) : null,
      createdAt: user.createdAt ? new Date(user.createdAt._seconds * 1000) : new Date(),
      updatedAt: user.updatedAt ? new Date(user.updatedAt._seconds * 1000) : new Date()
    })),
    orders: exportedData.orders.map(order => ({
      id: order.id,
      userId: order.userId,
      type: order.type,
      symbol: order.symbol,
      quantity: parseFloat(order.quantity),
      price: parseFloat(order.price),
      status: order.status || 'pending',
      executedQuantity: parseFloat(order.executedQuantity) || 0,
      leverage: order.leverage ? parseFloat(order.leverage) : null,
      marginUsed: order.marginUsed ? parseFloat(order.marginUsed) : null,
      pnl: order.pnl ? parseFloat(order.pnl) : null,
      orderType: order.orderType || null,
      exitPrice: order.exitPrice ? parseFloat(order.exitPrice) : null,
      resolvedAt: order.resolvedAt ? new Date(order.resolvedAt._seconds * 1000) : null,
      createdAt: order.createdAt ? new Date(order.createdAt._seconds * 1000) : new Date(),
      updatedAt: order.updatedAt ? new Date(order.updatedAt._seconds * 1000) : new Date()
    })),
    assets: exportedData.assets.map(asset => ({
      id: asset.id,
      userId: asset.userId,
      symbol: asset.symbol,
      quantity: parseFloat(asset.quantity),
      averagePrice: parseFloat(asset.averagePrice),
      currentPrice: asset.currentPrice ? parseFloat(asset.currentPrice) : null,
      createdAt: asset.createdAt ? new Date(asset.createdAt._seconds * 1000) : new Date(),
      updatedAt: asset.updatedAt ? new Date(asset.updatedAt._seconds * 1000) : new Date()
    })),
    transactionRequests: exportedData.requests.map(request => ({
      id: request.id,
      userId: request.userId,
      type: request.type,
      amount: parseFloat(request.amount),
      status: request.status || 'pending',
      reason: request.reason || null,
      createdAt: request.createdAt ? new Date(request.createdAt._seconds * 1000) : new Date(),
      approvedAt: request.approvedAt ? new Date(request.approvedAt._seconds * 1000) : null,
      approvedBy: request.approvedBy || null,
      executedAt: request.executedAt ? new Date(request.executedAt._seconds * 1000) : null,
      processedBy: request.processedBy || null,
      bankName: request.bankName || null,
      holderName: request.holderName || null,
      accountNumber: request.accountNumber || null,
      ifscCode: request.ifscCode || null
    })),
    transactionHistory: exportedData.transaction_history.map(tx => ({
      id: tx.id,
      userId: tx.userId,
      type: tx.type,
      amount: parseFloat(tx.amount),
      symbol: tx.symbol || null,
      quantity: tx.quantity ? parseFloat(tx.quantity) : null,
      price: tx.price ? parseFloat(tx.price) : null,
      description: tx.description,
      reason: tx.reason || null,
      status: tx.status || 'completed',
      balanceBefore: parseFloat(tx.balanceBefore),
      balanceAfter: parseFloat(tx.balanceAfter),
      createdAt: tx.createdAt ? new Date(tx.createdAt._seconds * 1000) : new Date()
    })),
    kycData: exportedData.kyc_data.map(kyc => ({
      id: kyc.id,
      userId: kyc.userId,
      fullName: kyc.fullName,
      dateOfBirth: kyc.dateOfBirth,
      phoneNumber: kyc.phoneNumber || null,
      nationality: kyc.nationality || null,
      idType: kyc.idType || null,
      idNumber: kyc.idNumber || null,
      address: kyc.address,
      city: kyc.city || null,
      postalCode: kyc.postalCode || null,
      country: kyc.country || null,
      status: kyc.status || 'unsubmitted',
      selfieUrl: kyc.selfieUrl,
      documentUrl: kyc.documentUrl,
      rejectionReason: kyc.rejectionReason || null,
      submittedAt: kyc.submittedAt ? new Date(kyc.submittedAt._seconds * 1000) : null,
      verifiedAt: kyc.verifiedAt ? new Date(kyc.verifiedAt._seconds * 1000) : null,
      verifiedBy: kyc.verifiedBy || null,
      createdAt: kyc.createdAt ? new Date(kyc.createdAt._seconds * 1000) : new Date(),
      adminNotes: kyc.adminNotes || null
    })),
    auditLogs: exportedData.audit_logs.map(audit => ({
      id: audit.id,
      userId: audit.userId || null,
      adminId: audit.adminId || null,
      action: audit.action,
      resourceType: audit.resourceType,
      resourceId: audit.resourceId,
      changes: audit.changes || {},
      ipAddress: audit.ipAddress || null,
      userAgent: audit.userAgent || null,
      status: audit.status || 'success',
      errorMessage: audit.errorMessage || null,
      createdAt: audit.createdAt ? new Date(audit.createdAt._seconds * 1000) : new Date()
    })),
    alerts: exportedData.alerts.map(alert => ({
      id: alert.id,
      userId: alert.userId,
      type: alert.type,
      title: alert.title,
      message: alert.message,
      read: alert.read || false,
      deleted: alert.deleted || false,
      actionUrl: alert.actionUrl || null,
      createdAt: alert.createdAt ? new Date(alert.createdAt._seconds * 1000) : new Date()
    })),
    scheduledOrders: exportedData.scheduled_orders.map(order => ({
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      type: order.type,
      quantity: parseFloat(order.quantity),
      price: order.price ? parseFloat(order.price) : null,
      orderType: order.orderType,
      scheduledTime: new Date(order.scheduledTime._seconds * 1000),
      triggerCondition: order.triggerCondition || null,
      status: order.status || 'pending',
      createdAt: order.createdAt ? new Date(order.createdAt._seconds * 1000) : new Date(),
      executedAt: order.executedAt ? new Date(order.executedAt._seconds * 1000) : null
    })),
    advancedOrders: exportedData.advanced_orders.map(order => ({
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      baseOrderType: order.baseOrderType,
      quantity: parseFloat(order.quantity),
      status: order.status || 'active',
      stopPrice: order.stopPrice ? parseFloat(order.stopPrice) : null,
      targetPrice: order.targetPrice ? parseFloat(order.targetPrice) : null,
      limitPrice: order.limitPrice ? parseFloat(order.limitPrice) : null,
      trailingPercent: order.trailingPercent ? parseFloat(order.trailingPercent) : null,
      linkedOrderIds: order.linkedOrderIds || [],
      createdAt: order.createdAt ? new Date(order.createdAt._seconds * 1000) : new Date(),
      triggeredAt: order.triggeredAt ? new Date(order.triggeredAt._seconds * 1000) : null,
      executedAt: order.executedAt ? new Date(order.executedAt._seconds * 1000) : null
    })),
    portfolioAnalytics: exportedData.portfolio_analytics.map(analytics => ({
      id: analytics.id,
      userId: analytics.userId,
      date: analytics.date,
      totalValue: parseFloat(analytics.totalValue),
      cash: parseFloat(analytics.cash),
      investedValue: parseFloat(analytics.investedValue),
      gainLoss: parseFloat(analytics.gainLoss),
      gainLossPercent: parseFloat(analytics.gainLossPercent),
      dayChange: parseFloat(analytics.dayChange),
      dayChangePercent: parseFloat(analytics.dayChangePercent),
      allTimeReturn: parseFloat(analytics.allTimeReturn),
      assetBreakdown: analytics.assetBreakdown || {},
      createdAt: analytics.createdAt ? new Date(analytics.createdAt._seconds * 1000) : new Date()
    })),
    tokenRevocations: exportedData.token_revocation.map(revocation => ({
      id: revocation.id,
      userId: revocation.userId,
      revokedAt: new Date(revocation.revokedAt._seconds * 1000),
      expiresAt: new Date(revocation.expiresAt._seconds * 1000)
    }))
  };

  const transformPath = path.join(__dirname, '../prisma-import-data.json');
  fs.writeFileSync(transformPath, JSON.stringify(transformedData, null, 2));
  console.log(`🔄 Transformed data saved to: ${transformPath}`);

  return transformedData;
}

async function importToPrisma(transformedData) {
  console.log('📥 Importing data to Prisma...');

  try {
    // Import in order of dependencies
    console.log('Importing users...');
    for (const user of transformedData.users) {
      await prisma.user.upsert({
        where: { id: user.id },
        update: user,
        create: user
      });
    }
    console.log(`✅ Imported ${transformedData.users.length} users`);

    console.log('Importing orders...');
    for (const order of transformedData.orders) {
      await prisma.order.upsert({
        where: { id: order.id },
        update: order,
        create: order
      });
    }
    console.log(`✅ Imported ${transformedData.orders.length} orders`);

    console.log('Importing assets...');
    for (const asset of transformedData.assets) {
      await prisma.asset.upsert({
        where: { id: asset.id },
        update: asset,
        create: asset
      });
    }
    console.log(`✅ Imported ${transformedData.assets.length} assets`);

    console.log('Importing transaction requests...');
    for (const request of transformedData.transactionRequests) {
      await prisma.transactionRequest.upsert({
        where: { id: request.id },
        update: request,
        create: request
      });
    }
    console.log(`✅ Imported ${transformedData.transactionRequests.length} transaction requests`);

    console.log('Importing transaction history...');
    for (const tx of transformedData.transactionHistory) {
      await prisma.transactionHistory.upsert({
        where: { id: tx.id },
        update: tx,
        create: tx
      });
    }
    console.log(`✅ Imported ${transformedData.transactionHistory.length} transaction history records`);

    console.log('Importing KYC data...');
    for (const kyc of transformedData.kycData) {
      await prisma.kYCData.upsert({
        where: { id: kyc.id },
        update: kyc,
        create: kyc
      });
    }
    console.log(`✅ Imported ${transformedData.kycData.length} KYC records`);

    console.log('Importing audit logs...');
    for (const audit of transformedData.auditLogs) {
      await prisma.auditLog.upsert({
        where: { id: audit.id },
        update: audit,
        create: audit
      });
    }
    console.log(`✅ Imported ${transformedData.auditLogs.length} audit logs`);

    console.log('Importing alerts...');
    for (const alert of transformedData.alerts) {
      await prisma.alert.upsert({
        where: { id: alert.id },
        update: alert,
        create: alert
      });
    }
    console.log(`✅ Imported ${transformedData.alerts.length} alerts`);

    console.log('Importing scheduled orders...');
    for (const order of transformedData.scheduledOrders) {
      await prisma.scheduledOrder.upsert({
        where: { id: order.id },
        update: order,
        create: order
      });
    }
    console.log(`✅ Imported ${transformedData.scheduledOrders.length} scheduled orders`);

    console.log('Importing advanced orders...');
    for (const order of transformedData.advancedOrders) {
      await prisma.advancedOrder.upsert({
        where: { id: order.id },
        update: order,
        create: order
      });
    }
    console.log(`✅ Imported ${transformedData.advancedOrders.length} advanced orders`);

    console.log('Importing portfolio analytics...');
    for (const analytics of transformedData.portfolioAnalytics) {
      await prisma.portfolioAnalytics.upsert({
        where: { id: analytics.id },
        update: analytics,
        create: analytics
      });
    }
    console.log(`✅ Imported ${transformedData.portfolioAnalytics.length} portfolio analytics`);

    console.log('Importing token revocations...');
    for (const revocation of transformedData.tokenRevocations) {
      await prisma.tokenRevocation.upsert({
        where: { id: revocation.id },
        update: revocation,
        create: revocation
      });
    }
    console.log(`✅ Imported ${transformedData.tokenRevocations.length} token revocations`);

  } catch (error) {
    console.error('❌ Error importing data:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔄 Starting Firestore to Prisma migration...\n');

    // Step 1: Export from Firestore
    const exportedData = await exportFirestoreData();

    // Step 2: Transform data
    const transformedData = await transformDataForPrisma(exportedData);

    // Step 3: Import to Prisma
    await importToPrisma(transformedData);

    console.log('\n🎉 Migration completed successfully!');

  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

// Run if called directly
if (require.main === module) {
  main();
}

module.exports = { main, exportFirestoreData, transformDataForPrisma, importToPrisma };