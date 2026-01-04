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

async function exportPrismaData() {
  console.log('🚀 Starting Prisma data export...');

  const exportedData = {};

  try {
    // Export all data from Prisma
    exportedData.users = await prisma.user.findMany({ include: { orders: true, assets: true } });
    exportedData.orders = await prisma.order.findMany();
    exportedData.assets = await prisma.asset.findMany();
    exportedData.transactionRequests = await prisma.transactionRequest.findMany();
    exportedData.transactionHistory = await prisma.transactionHistory.findMany();
    exportedData.kycData = await prisma.kYCData.findMany();
    exportedData.auditLogs = await prisma.auditLog.findMany();
    exportedData.twoFactorAuth = await prisma.twoFactorAuth.findMany();
    exportedData.alerts = await prisma.alert.findMany();
    exportedData.scheduledOrders = await prisma.scheduledOrder.findMany();
    exportedData.advancedOrders = await prisma.advancedOrder.findMany();
    exportedData.portfolioAnalytics = await prisma.portfolioAnalytics.findMany();
    exportedData.tokenRevocations = await prisma.tokenRevocation.findMany();
    exportedData.chats = await prisma.chat.findMany({ include: { messages: true } });
    exportedData.messages = await prisma.message.findMany();

    console.log('✅ Exported data from Prisma');

    // Save to JSON file
    const exportPath = path.join(__dirname, '../prisma-export.json');
    fs.writeFileSync(exportPath, JSON.stringify(exportedData, null, 2));
    console.log(`💾 Exported data saved to: ${exportPath}`);

    return exportedData;
  } catch (error) {
    console.error('❌ Error exporting from Prisma:', error);
    throw error;
  }
}

async function transformDataForFirestore(exportedData) {
  console.log('🔄 Transforming data for Firestore...');

  const transformedData = {
    users: exportedData.users.map(user => ({
      id: user.id,
      username: user.username,
      email: user.email,
      password: user.password,
      role: user.role,
      balance: user.balance,
      twoFactorEnabled: user.twoFactorEnabled,
      twoFactorSecret: user.twoFactorSecret,
      backupCodes: user.backupCodes,
      roles: user.roles,
      migrationStatus: user.migrationStatus,
      status: user.status,
      lastLogin: user.lastLogin ? admin.firestore.Timestamp.fromDate(user.lastLogin) : null,
      createdAt: admin.firestore.Timestamp.fromDate(user.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(user.updatedAt)
    })),
    orders: exportedData.orders.map(order => ({
      id: order.id,
      userId: order.userId,
      type: order.type,
      symbol: order.symbol,
      quantity: order.quantity,
      price: order.price,
      status: order.status,
      executedQuantity: order.executedQuantity,
      leverage: order.leverage,
      marginUsed: order.marginUsed,
      pnl: order.pnl,
      orderType: order.orderType,
      exitPrice: order.exitPrice,
      resolvedAt: order.resolvedAt ? admin.firestore.Timestamp.fromDate(order.resolvedAt) : null,
      createdAt: admin.firestore.Timestamp.fromDate(order.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(order.updatedAt),
      direction: order.direction,
      entryPrice: order.entryPrice,
      amount: order.amount,
      profitPercent: order.profitPercent
    })),
    assets: exportedData.assets.map(asset => ({
      id: asset.id,
      userId: asset.userId,
      symbol: asset.symbol,
      quantity: asset.quantity,
      averagePrice: asset.averagePrice,
      currentPrice: asset.currentPrice,
      locked: asset.locked,
      createdAt: admin.firestore.Timestamp.fromDate(asset.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(asset.updatedAt)
    })),
    requests: exportedData.transactionRequests.map(request => ({
      id: request.id,
      userId: request.userId,
      type: request.type,
      amount: request.amount,
      status: request.status,
      reason: request.reason,
      createdAt: admin.firestore.Timestamp.fromDate(request.createdAt),
      approvedAt: request.approvedAt ? admin.firestore.Timestamp.fromDate(request.approvedAt) : null,
      approvedBy: request.approvedBy,
      executedAt: request.executedAt ? admin.firestore.Timestamp.fromDate(request.executedAt) : null,
      processedBy: request.processedBy,
      bankName: request.bankName,
      holderName: request.holderName,
      accountNumber: request.accountNumber,
      ifscCode: request.ifscCode
    })),
    transaction_history: exportedData.transactionHistory.map(tx => ({
      id: tx.id,
      userId: tx.userId,
      type: tx.type,
      amount: tx.amount,
      symbol: tx.symbol,
      quantity: tx.quantity,
      price: tx.price,
      description: tx.description,
      reason: tx.reason,
      status: tx.status,
      balanceBefore: tx.balanceBefore,
      balanceAfter: tx.balanceAfter,
      createdAt: admin.firestore.Timestamp.fromDate(tx.createdAt)
    })),
    kyc_data: exportedData.kycData.map(kyc => ({
      id: kyc.id,
      userId: kyc.userId,
      fullName: kyc.fullName,
      dateOfBirth: kyc.dateOfBirth,
      phoneNumber: kyc.phoneNumber,
      nationality: kyc.nationality,
      idType: kyc.idType,
      idNumber: kyc.idNumber,
      address: kyc.address,
      city: kyc.city,
      postalCode: kyc.postalCode,
      country: kyc.country,
      status: kyc.status,
      selfieUrl: kyc.selfieUrl,
      documentUrl: kyc.documentUrl,
      rejectionReason: kyc.rejectionReason,
      submittedAt: kyc.submittedAt ? admin.firestore.Timestamp.fromDate(kyc.submittedAt) : null,
      verifiedAt: kyc.verifiedAt ? admin.firestore.Timestamp.fromDate(kyc.verifiedAt) : null,
      verifiedBy: kyc.verifiedBy,
      createdAt: admin.firestore.Timestamp.fromDate(kyc.createdAt),
      adminNotes: kyc.adminNotes
    })),
    audit_logs: exportedData.auditLogs.map(audit => ({
      id: audit.id,
      userId: audit.userId,
      adminId: audit.adminId,
      action: audit.action,
      resourceType: audit.resourceType,
      resourceId: audit.resourceId,
      changes: audit.changes,
      ipAddress: audit.ipAddress,
      userAgent: audit.userAgent,
      status: audit.status,
      errorMessage: audit.errorMessage,
      createdAt: admin.firestore.Timestamp.fromDate(audit.createdAt)
    })),
    two_factor_auth: exportedData.twoFactorAuth.map(tfa => ({
      id: tfa.id,
      userId: tfa.userId,
      enabled: tfa.enabled,
      secret: tfa.secret,
      backupCodes: tfa.backupCodes,
      lastUsedAt: tfa.lastUsedAt ? admin.firestore.Timestamp.fromDate(tfa.lastUsedAt) : null,
      createdAt: admin.firestore.Timestamp.fromDate(tfa.createdAt)
    })),
    alerts: exportedData.alerts.map(alert => ({
      id: alert.id,
      userId: alert.userId,
      type: alert.type,
      title: alert.title,
      message: alert.message,
      read: alert.read,
      deleted: alert.deleted,
      actionUrl: alert.actionUrl,
      createdAt: admin.firestore.Timestamp.fromDate(alert.createdAt)
    })),
    scheduled_orders: exportedData.scheduledOrders.map(order => ({
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      type: order.type,
      quantity: order.quantity,
      price: order.price,
      orderType: order.orderType,
      scheduledTime: admin.firestore.Timestamp.fromDate(order.scheduledTime),
      triggerCondition: order.triggerCondition,
      status: order.status,
      createdAt: admin.firestore.Timestamp.fromDate(order.createdAt),
      executedAt: order.executedAt ? admin.firestore.Timestamp.fromDate(order.executedAt) : null
    })),
    advanced_orders: exportedData.advancedOrders.map(order => ({
      id: order.id,
      userId: order.userId,
      symbol: order.symbol,
      baseOrderType: order.baseOrderType,
      quantity: order.quantity,
      status: order.status,
      stopPrice: order.stopPrice,
      targetPrice: order.targetPrice,
      limitPrice: order.limitPrice,
      trailingPercent: order.trailingPercent,
      linkedOrderIds: order.linkedOrderIds,
      createdAt: admin.firestore.Timestamp.fromDate(order.createdAt),
      triggeredAt: order.triggeredAt ? admin.firestore.Timestamp.fromDate(order.triggeredAt) : null,
      executedAt: order.executedAt ? admin.firestore.Timestamp.fromDate(order.executedAt) : null
    })),
    portfolio_analytics: exportedData.portfolioAnalytics.map(analytics => ({
      id: analytics.id,
      userId: analytics.userId,
      date: analytics.date,
      totalValue: analytics.totalValue,
      cash: analytics.cash,
      investedValue: analytics.investedValue,
      gainLoss: analytics.gainLoss,
      gainLossPercent: analytics.gainLossPercent,
      dayChange: analytics.dayChange,
      dayChangePercent: analytics.dayChangePercent,
      allTimeReturn: analytics.allTimeReturn,
      assetBreakdown: analytics.assetBreakdown,
      createdAt: admin.firestore.Timestamp.fromDate(analytics.createdAt)
    })),
    token_revocation: exportedData.tokenRevocations.map(revocation => ({
      id: revocation.id,
      userId: revocation.userId,
      revokedAt: admin.firestore.Timestamp.fromDate(revocation.revokedAt),
      expiresAt: admin.firestore.Timestamp.fromDate(revocation.expiresAt)
    })),
    chats: exportedData.chats.map(chat => ({
      id: chat.id,
      userId: chat.userId,
      subject: chat.subject,
      status: chat.status,
      createdAt: admin.firestore.Timestamp.fromDate(chat.createdAt),
      updatedAt: admin.firestore.Timestamp.fromDate(chat.updatedAt)
    })),
    messages: exportedData.messages.map(message => ({
      id: message.id,
      chatId: message.chatId,
      sender: message.sender,
      text: message.text,
      createdAt: admin.firestore.Timestamp.fromDate(message.createdAt)
    }))
  };

  const transformPath = path.join(__dirname, '../firestore-import-data.json');
  fs.writeFileSync(transformPath, JSON.stringify(transformedData, null, 2));
  console.log(`🔄 Transformed data saved to: ${transformPath}`);

  return transformedData;
}

async function importToFirestore(transformedData) {
  console.log('📥 Importing data to Firestore...');

  const batch = firestoreDb.batch();
  let operationCount = 0;
  const maxBatchSize = 500; // Firestore batch limit

  const addToBatch = (ref, data) => {
    batch.set(ref, data);
    operationCount++;
    if (operationCount >= maxBatchSize) {
      batch.commit();
      batch = firestoreDb.batch();
      operationCount = 0;
    }
  };

  try {
    // Import in order
    console.log('Importing users...');
    for (const user of transformedData.users) {
      const ref = firestoreDb.collection('users').doc(user.id);
      addToBatch(ref, user);
    }

    console.log('Importing orders...');
    for (const order of transformedData.orders) {
      const ref = firestoreDb.collection('orders').doc(order.id);
      addToBatch(ref, order);
    }

    console.log('Importing assets...');
    for (const asset of transformedData.assets) {
      const ref = firestoreDb.collection('assets').doc(asset.id);
      addToBatch(ref, asset);
    }

    console.log('Importing transaction requests...');
    for (const request of transformedData.requests) {
      const ref = firestoreDb.collection('requests').doc(request.id);
      addToBatch(ref, request);
    }

    console.log('Importing transaction history...');
    for (const tx of transformedData.transaction_history) {
      const ref = firestoreDb.collection('transaction_history').doc(tx.id);
      addToBatch(ref, tx);
    }

    console.log('Importing KYC data...');
    for (const kyc of transformedData.kyc_data) {
      const ref = firestoreDb.collection('kyc_data').doc(kyc.id);
      addToBatch(ref, kyc);
    }

    console.log('Importing audit logs...');
    for (const audit of transformedData.audit_logs) {
      const ref = firestoreDb.collection('audit_logs').doc(audit.id);
      addToBatch(ref, audit);
    }

    console.log('Importing 2FA data...');
    for (const tfa of transformedData.two_factor_auth) {
      const ref = firestoreDb.collection('two_factor_auth').doc(tfa.id);
      addToBatch(ref, tfa);
    }

    console.log('Importing alerts...');
    for (const alert of transformedData.alerts) {
      const ref = firestoreDb.collection('alerts').doc(alert.id);
      addToBatch(ref, alert);
    }

    console.log('Importing scheduled orders...');
    for (const order of transformedData.scheduled_orders) {
      const ref = firestoreDb.collection('scheduled_orders').doc(order.id);
      addToBatch(ref, order);
    }

    console.log('Importing advanced orders...');
    for (const order of transformedData.advanced_orders) {
      const ref = firestoreDb.collection('advanced_orders').doc(order.id);
      addToBatch(ref, order);
    }

    console.log('Importing portfolio analytics...');
    for (const analytics of transformedData.portfolio_analytics) {
      const ref = firestoreDb.collection('portfolio_analytics').doc(analytics.id);
      addToBatch(ref, analytics);
    }

    console.log('Importing token revocations...');
    for (const revocation of transformedData.token_revocation) {
      const ref = firestoreDb.collection('token_revocation').doc(revocation.id);
      addToBatch(ref, revocation);
    }

    console.log('Importing chats...');
    for (const chat of transformedData.chats) {
      const ref = firestoreDb.collection('chats').doc(chat.id);
      addToBatch(ref, chat);
    }

    console.log('Importing messages...');
    for (const message of transformedData.messages) {
      const ref = firestoreDb.collection('messages').doc(message.id);
      addToBatch(ref, message);
    }

    // Commit final batch
    if (operationCount > 0) {
      await batch.commit();
    }

    console.log('✅ Data imported to Firestore');

  } catch (error) {
    console.error('❌ Error importing to Firestore:', error);
    throw error;
  }
}

async function main() {
  try {
    console.log('🔄 Starting Prisma to Firestore migration...\n');

    // Step 1: Export from Prisma
    const exportedData = await exportPrismaData();

    // Step 2: Transform data
    const transformedData = await transformDataForFirestore(exportedData);

    // Step 3: Import to Firestore
    await importToFirestore(transformedData);

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

module.exports = { main, exportPrismaData, transformDataForFirestore, importToFirestore };