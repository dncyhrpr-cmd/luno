# Backend Architecture & Data Flow

## System Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                      Frontend (Next.js/React)                    │
│  MarketPage, OrdersPage, PortfolioPage, AdminPage               │
└──────────────────────┬──────────────────────────────────────────┘
                       │ HTTP/JSON
                       ↓
┌─────────────────────────────────────────────────────────────────┐
│                     Next.js API Routes                           │
├──────────────────────────────────────────────────────────────────┤
│  ├─ /api/auth/login       → Generate JWT tokens                 │
│  ├─ /api/auth/signup      → Create new user                     │
│  ├─ /api/orders           → Create/Get orders (TRADING)         │
│  ├─ /api/portfolio        → Get balance & assets                │
│  ├─ /api/portfolio-transactions → Get full portfolio + history  │
│  ├─ /api/admin/*          → Admin actions (balance, assets)     │
│  ├─ /api/admin/requests   → Approve/reject deposits/withdrawals│
│  └─ /api/binance          → Real-time price feeds              │
└──────────────────┬───────────────────────────────────────────────┘
                   │ JWT Token Verification + Data Validation
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│                 Firestore Database Service                       │
│              (src/lib/firestore-db.ts)                          │
│  ├─ User Management                                              │
│  ├─ Order Management                                             │
│  ├─ Asset Management                                             │
│  ├─ Transaction History                                          │
│  ├─ Audit Logging                                                │
│  └─ Atomic Transactions                                          │
└──────────────────┬───────────────────────────────────────────────┘
                   │ Database Operations
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│            Firebase Firestore Collections                        │
├──────────────────────────────────────────────────────────────────┤
│  ├─ users/              → { id, email, balance, roles, ... }    │
│  ├─ orders/             → { id, userId, symbol, qty, price ... }│
│  ├─ assets/             → { id, userId, symbol, qty, avgPrice }│
│  ├─ requests/           → { id, userId, type, amount, status }  │
│  ├─ transaction_history → { id, userId, type, amount, ... }    │
│  ├─ audit_logs/         → { id, userId, action, changes, ... } │
│  ├─ alerts/             → { id, userId, type, message, ... }   │
│  ├─ kyc_data/           → { id, userId, status, docs, ... }    │
│  ├─ scheduled_orders/   → { id, userId, ... }                  │
│  ├─ advanced_orders/    → { id, userId, ... }                  │
│  └─ portfolio_analytics → { id, userId, gainLoss, ... }        │
└─────────────────────────────────────────────────────────────────┘
```

---

## Order Processing Flow

### BUY Order Execution

```
┌─────────────────────────────────────────────────────────────────┐
│  User clicks "BUY" - POST /api/orders                            │
│  { type: "BUY", symbol: "BTC", quantity: 1, price: 50000, ... }│
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  1. Verify JWT Token                                             │
│     └─ Extract userId from token payload                        │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  2. Validate Input                                               │
│     ├─ Check required fields (type, symbol, qty, price)         │
│     ├─ Validate quantity > 0, price > 0, leverage > 0          │
│     └─ Normalize values                                          │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  3. Fetch User & Balance Check                                   │
│     ├─ Get user from Firestore                                  │
│     ├─ Calculate: marginRequired = (quantity × price) / leverage│
│     ├─ Check: userBalance >= marginRequired                     │
│     └─ ❌ BUG: Deducts full value, not margin!                  │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  4. Create Order Record                                          │
│     ├─ Create order in Firestore (status: FILLED for MARKET)    │
│     └─ Get order ID                                             │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. Update User Balance (IMMEDIATE)                              │
│     ├─ newBalance = userBalance - (qty × price)                 │
│     └─ Update users/{userId} → balance                          │
│     ❌ BUG: Should deduct margin only, not full value            │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. Update/Create Asset                                          │
│     ├─ Check if user already owns this symbol                   │
│     ├─ If YES:                                                  │
│     │  └─ newAvgPrice = (oldQty × oldAvg + newQty × newPrice)  │
│     │                   ÷ totalQty                              │
│     │     Update assets/{assetId}                              │
│     └─ If NO:                                                   │
│        └─ Create new asset in assets/                           │
│           { symbol, qty, averagePrice }                        │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  7. Update Order Status to FILLED                                │
│     └─ Update orders/{orderId} → status: "FILLED"              │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  8. Create Transaction History (Audit Trail)                     │
│     └─ Add to transaction_history/{docId}:                      │
│        {                                                         │
│          userId, type: "buy", symbol, quantity, price,          │
│          amount: qty × price,                                  │
│          balanceBefore, balanceAfter                           │
│        }                                                         │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  9. Create Audit Log                                             │
│     └─ Add to audit_logs/{docId}:                               │
│        { userId, action: "market_order_executed", ... }        │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  10. Create User Alert Notification                              │
│      └─ Add to alerts/{docId}:                                  │
│         { userId, type: "order", title, message, read: false }  │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  11. Return Response                                             │
│      { success: true, order: {...}, message: "..." }            │
└─────────────────────────────────────────────────────────────────┘
```

### SELL Order Execution

```
┌─────────────────────────────────────────────────────────────────┐
│  User clicks "SELL" - POST /api/orders                           │
│  { type: "SELL", symbol: "BTC", quantity: 0.5, price: 51000 }  │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
   [Same as BUY: Token verification, validation, order creation]
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  5. Update User Balance (IMMEDIATE)                              │
│     ├─ newBalance = userBalance + (qty × price)                 │
│     └─ Update users/{userId} → balance                          │
│     ✅ CORRECT for balance, but doesn't calculate profit!       │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  6. Update Asset (REDUCE QUANTITY)                               │
│     ├─ remaining = currentQty - sellQty                          │
│     ├─ If remaining > 0:                                         │
│     │  └─ Update assets/{assetId} → quantity: remaining        │
│     │     ⚠️ Note: averagePrice NOT updated (correct)          │
│     └─ If remaining == 0:                                       │
│        └─ DELETE asset (fully sold)                             │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
   [Same as BUY: Update order status, create history, audit log]
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  ❌ MISSING: Calculate Profit/Loss                               │
│     ├─ sellProceeds = qty × sellPrice                            │
│     ├─ costBasis = qty × averagePrice                            │
│     ├─ realizedGain = sellProceeds - costBasis                  │
│     └─ Should create "trade" record with P&L                     │
└─────────────────────────────────────────────────────────────────┘
```

---

## Portfolio Value Calculation

### Current Implementation (INCORRECT)

```
GET /api/portfolio/transactions
│
├─ Fetch user (balance)
├─ Fetch assets (symbol, qty, averagePrice)
│
└─ Calculate:
   ├─ assetValue = Σ(qty × averagePrice)  ❌ WRONG - uses cost basis
   ├─ totalPortfolioValue = balance + assetValue
   └─ Return to frontend
```

### Correct Implementation (NEEDED)

```
GET /api/portfolio/transactions
│
├─ Fetch user (balance)
├─ Fetch assets (symbol, qty, averagePrice)
├─ Fetch CURRENT prices for each symbol (from Binance API)
│
└─ Calculate:
   ├─ assetValue = Σ(qty × CURRENT_PRICE)  ✅ CORRECT
   ├─ totalPortfolioValue = balance + assetValue
   ├─ gainLoss = assetValue - Σ(qty × averagePrice)
   └─ Return to frontend
```

---

## Win/Loss Calculation Flow

### Current Implementation (PARTIALLY WRONG)

```
GET /api/portfolio-analytics
│
├─ Fetch assets
│  └─ assetValue = Σ(qty × averagePrice)  ❌ Should be current price
│
├─ Fetch transaction history (all buy/sell transactions)
│
├─ Calculate:
│  ├─ buyTransactions = filter(type == "buy")
│  ├─ totalInvested = Σ(amount from buy transactions)
│  ├─ gainLoss = assetValue - totalInvested
│  │             ↑
│  │             ❌ BUG: assetValue uses averagePrice, not current!
│  │
│  └─ gainLossPercent = (gainLoss / totalInvested) × 100
│
└─ Response:
   {
     gainLoss: 1500,        ❌ Incorrect if using wrong prices
     gainLossPercent: 15%,  ❌ Incorrect
     assetBreakdown: {...}
   }
```

### What Should Be Done

```
┌─ For UNREALIZED P&L (open positions):
│  ├─ Current Assets = Σ(qty × CURRENT_PRICE)
│  ├─ Cost Basis = Σ(qty × averagePrice)
│  └─ Unrealized P&L = Current - Cost Basis
│
├─ For REALIZED P&L (closed positions):
│  ├─ Sell Proceeds = Σ(sellQty × sellPrice)
│  ├─ Cost of Sales = Σ(sellQty × averagePrice)
│  └─ Realized P&L = Sell Proceeds - Cost of Sales
│
├─ For TOTAL P&L:
│  └─ Total P&L = Realized P&L + Unrealized P&L
│
└─ Current System: ❌ Only calculates unrealized, and incorrectly!
```

---

## Asset Lifecycle

```
┌─────────────────────┐
│  User buys 1 BTC    │
│  at $50,000         │
└──────────┬──────────┘
           ↓
   ┌──────────────────────────────────┐
   │ Asset Record Created:            │
   │ {                                │
   │   symbol: "BTC",                │
   │   quantity: 1,                   │
   │   averagePrice: 50000,           │
   │   currentPrice: undefined ❌     │
   │ }                                │
   └──────────┬───────────────────────┘
              ↓
   ┌──────────────────────────────────┐
   │ User buys 0.5 BTC at $51,000    │
   │ → averagePrice recalculated     │
   │   = (1 × 50000 + 0.5 × 51000)/1.5│
   │   = 50,333                       │
   └──────────┬───────────────────────┘
              ↓
   ┌──────────────────────────────────┐
   │ Asset Updated:                   │
   │ {                                │
   │   quantity: 1.5,                 │
   │   averagePrice: 50333,           │
   │   currentPrice: still undefined! │
   │ }                                │
   └──────────┬───────────────────────┘
              ↓
   ┌──────────────────────────────────┐
   │ User sells 0.5 BTC at $52,000   │
   │ → Gain = 0.5 × (52000 - 50333)  │
   │   = $834 ✅                      │
   │ → But this gain is NOT recorded! │
   └──────────┬───────────────────────┘
              ↓
   ┌──────────────────────────────────┐
   │ Asset Updated:                   │
   │ {                                │
   │   quantity: 1,                   │
   │   averagePrice: 50333,           │
   │   currentPrice: still undefined! │
   │ }                                │
   │                                  │
   │ 💭 P&L information is LOST!      │
   └──────────────────────────────────┘
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│  User enters email & password                                    │
│  POST /api/auth/login                                            │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  ❌ BUG: No password verification!                               │
│                                                                  │
│  Current code:                                                   │
│  const userId = `user_${email.replace(...)}`;                   │
│  users.set(userId, user);  // Accepts ANY password!             │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  Should be:                                                      │
│  ├─ Fetch user by email from Firestore                          │
│  ├─ Hash incoming password with bcrypt                          │
│  ├─ Compare with stored hash                                    │
│  └─ Return error if mismatch                                    │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  Generate Tokens                                                 │
│  ├─ accessToken = sign(userId, roles) with 15m expiry          │
│  └─ refreshToken = sign(userId) with 7d expiry                 │
│                                                                  │
│  Tokens are JWT with structure:                                 │
│  header: { alg: "HS256", typ: "JWT", kid: "v1_access_key" }   │
│  payload: {                                                      │
│    userId: "user_xyz",                                          │
│    roles: ["trader"],                                           │
│    migrationStatus: "migrated",                                 │
│    iss: "luno-app",                                             │
│    aud: "luno-web",                                             │
│    exp: <timestamp>,                                            │
│    iat: <timestamp>,                                            │
│    sub: "user_xyz",                                             │
│    jti: "<uuid>"                                                │
│  }                                                              │
└──────────────────┬──────────────────────────────────────────────┘
                   ↓
┌─────────────────────────────────────────────────────────────────┐
│  Return Response                                                 │
│  {                                                               │
│    accessToken: "eyJhbGc...",                                   │
│    refreshToken: "eyJhbGc...",                                  │
│    user: { id, email, roles, ... }                              │
│  }                                                               │
└─────────────────────────────────────────────────────────────────┘
```

### Token Usage in Subsequent Requests

```
GET /api/orders
Headers: {
  Authorization: "Bearer <accessToken>"
}
│
├─ Extract token from "Bearer <token>"
├─ Verify signature with JWT_SECRET
├─ Check expiry (not expired)
├─ Check issuer, audience
└─ Extract payload
   └─ userId = payload.userId
      └─ Use to fetch user-specific data
```

---

## Data Consistency & Transactions

### Atomic Transaction Example: Process Withdrawal

```
User requests: Withdraw $1000
Admin approves
│
db.runTransaction(async (t) => {
  // 1. Get user (within transaction)
  userRef = db.collection("users").doc(userId)
  userDoc = await t.get(userRef)
  balanceBefore = userDoc.balance
  
  // 2. Validate
  if (balanceBefore < 1000) throw Error("Insufficient balance")
  
  // 3. Update balance
  newBalance = balanceBefore - 1000
  t.update(userRef, { balance: newBalance })
  
  // 4. Create history entry
  historyRef = db.collection("transaction_history").doc()
  t.set(historyRef, {
    userId, type: "withdraw", amount: 1000,
    balanceBefore, balanceAfter: newBalance
  })
  
  // 5. Update request status
  requestRef = db.collection("requests").doc(requestId)
  t.update(requestRef, { status: "executed" })
})
```

**Key Point**: Either ALL succeed or ALL fail (ACID guarantees)

---

## Summary of Data Flow Issues

| Issue | Severity | Impact |
|-------|----------|--------|
| Login accepts any password | CRITICAL | Security breach |
| Leverage not properly deducted | CRITICAL | Wrong balance calculations |
| Portfolio value uses cost basis | CRITICAL | Wrong P&L shown |
| No per-trade P&L tracking | CRITICAL | Can't determine profitable trades |
| Limit orders not executed | MAJOR | Feature broken |
| No realized vs unrealized P&L | MAJOR | Incomplete reporting |
| currentPrice never set | MAJOR | P&L calculations impossible |
| Profit not recorded on sell | MAJOR | Historical data lost |

