# Backend Code Analysis & Trade System Review

## Executive Summary
The Luno webapp backend is built with **Next.js**, **Firebase Firestore**, and Firebase Authentication. The architecture uses RESTful APIs for client communication, Firestore for data persistence, and JWT tokens for authentication.

---

## 1. AUTHENTICATION SYSTEM

### Components
- **Location**: `src/lib/auth-utils.ts`, `src/app/api/auth/`
- **Token Strategy**: JWT-based with separate access and refresh tokens

### Key Issues & Findings

#### ✅ STRENGTHS:
1. **JWT Implementation** (auth-utils.ts:37-51)
   - Uses JOSE library for secure token creation
   - Implements proper JWT structure with claims (iss, aud, exp, sub, jti)
   - Separate access token (15m) and refresh token (7d) with different secrets
   - Key ID (kid) for future token rotation support

2. **Strong Password Policy** (auth-utils.ts:121-138)
   - Minimum 10 characters
   - Requires uppercase, lowercase, digits, and symbols
   - Prevents weak passwords

3. **Token Extraction** (auth-utils.ts:144-149)
   - Proper extraction from Authorization header (Bearer scheme)

#### ⚠️ ISSUES:

1. **CRITICAL: Insecure Login Flow** (src/app/api/auth/login/route.ts)
   - **Line 20-32**: Accepts ANY email/password combination
   - No actual password verification against stored hash
   - Creates user on the fly with hardcoded role mapping
   - **FIX NEEDED**: Implement proper Firebase Authentication or hash verification

2. **CRITICAL: Incomplete Signup** (src/app/api/auth/signup/route.ts)
   - Only generates userId, doesn't persist user to Firestore
   - **FIX NEEDED**: Actually create user in Firestore with hashed password

3. **Missing Refresh Token Revocation** (auth-utils.ts:113)
   - Tokens not checked against revocation list
   - Risk of using compromised tokens
   - **FIX NEEDED**: Implement revocation mechanism in Firestore

4. **Hardcoded Admin User** (login/route.ts:29)
   - `dncyhrpr@gmail.com` hardcoded as admin
   - **FIX NEEDED**: Use proper role management system

---

## 2. TRADE SYSTEM (ORDER MANAGEMENT)

### Location
- Main: `src/app/api/orders/route.ts`
- Backup: `src/api_backup/orders/route.ts`

### Order Flow Architecture

```
1. User creates order (POST /api/orders)
   ↓
2. Verify token + check user balance
   ↓
3. Calculate margin required (orderValue / leverage)
   ↓
4. If MARKET order:
   - Update user balance immediately
   - Update/create assets
   - Update order status to FILLED
   - Create transaction history
   - Create audit log
   - Send alert
```

### Order Processing Logic

#### BUY Order (orders/route.ts:89-111)
```typescript
// Line 94-95: Average price calculation
const totalQuantity = existingAsset.quantity + quantityNum;
const newAveragePrice = (existingAsset.quantity * existingAsset.averagePrice + 
                         quantityNum * priceNum) / totalQuantity;
```

**CORRECT**: Properly recalculates average cost basis

#### SELL Order (orders/route.ts:112-134)
```typescript
// Line 125: Remaining quantity
const remaining = existingAsset.quantity - quantityNum;

// Line 126-133: Delete asset if fully sold
if (remaining > 0) {
  await firestoreDB.updateAsset(existingAsset.id, { quantity: remaining });
} else {
  await firestoreDB.deleteAsset(existingAsset.id);
}
```

**CORRECT**: Properly handles partial and full sells

#### Balance Update (orders/route.ts:82-85)
```typescript
const newBalance = type === 'BUY'
  ? userData.balance - orderValue
  : userData.balance + orderValue;
```

**ISSUE**: 
- ⚠️ Doesn't account for leverage properly
- ✅ Correctly debits for BUY, credits for SELL
- ⚠️ No slippage calculation for market orders

### ✅ STRENGTHS:

1. **Atomic Transactions**: Each order execution updates multiple collections atomically
2. **Comprehensive Logging**: Creates transaction history, audit logs, and alerts
3. **Asset Management**: Correctly maintains average price and quantity

### ⚠️ ISSUES:

1. **CRITICAL: No Win/Loss Calculation**
   - Orders don't store entry/exit prices
   - No profit/loss field in Order or Asset models
   - **Impact**: Cannot determine if trade was profitable

2. **CRITICAL: Leverage Not Properly Implemented**
   - Line 61: `marginRequired = orderValue / leverage`
   - Balance deduction still uses full orderValue (line 84)
   - **Expected**: Should only deduct margin, not full value
   - **Impact**: Balance calculations are incorrect

3. **MAJOR: Limit Orders Not Implemented**
   - Line 73: Status set to 'PENDING' but never executed
   - Line 183-187: Returns "Limit order placed successfully" but no execution logic
   - **Impact**: Users can place limit orders that will never execute

4. **MAJOR: No Stop Loss / Take Profit**
   - Advanced orders defined in DB schema but not used in order creation
   - **Impact**: Risk management features not functional

5. **MODERATE: Balance Validation Issue**
   - Line 62: Checks `userData.balance < marginRequired`
   - But line 84: Deducts full `orderValue` not `marginRequired`
   - **Impact**: Inconsistent balance tracking

---

## 3. WIN/LOSS CALCULATION SYSTEM

### Location
- Backup: `src/api_backup/portfolio-analytics/route.ts` (Lines 38-68)
- Schema: `src/lib/firestore-db.ts:208-222`

### Current Implementation

```typescript
// Line 52-55
const buyTransactions = history.filter((h: any) => h.type === 'buy');
const totalInvested = buyTransactions.reduce((sum: number, h: any) => sum + h.amount, 0);
const gainLoss = totalInvestedValue - totalInvested;
const gainLossPercent = totalInvested > 0 ? (gainLoss / totalInvested) * 100 : 0;
```

### ✅ WHAT WORKS:
1. **Tracks total invested amount** (sum of buy transactions)
2. **Calculates current portfolio value** (asset quantity × price)
3. **Basic gain/loss formula** (current - invested)

### ❌ CRITICAL FLAWS:

1. **CRITICAL: Incomplete Win/Loss Logic**
   - Only considers BUY transactions for total invested
   - Ignores SELL transaction proceeds
   - **Formula**: `gainLoss = totalInvestedValue - totalInvested`
   - **Problem**: This is "unrealized P&L" only, not total P&L
   - **Missing**: Realized gains from closed positions

2. **CRITICAL: No Per-Trade P&L**
   - No way to track individual trade outcomes
   - Cannot show "Trade 1: +$50, Trade 2: -$30"
   - **Impact**: Users can't see which trades were profitable

3. **CRITICAL: Asset currentPrice Not Set**
   - Line 44: `asset.currentPrice || asset.averagePrice`
   - `currentPrice` is never set anywhere in codebase
   - Always falls back to averagePrice
   - **Impact**: P&L calculations use cost basis, not market price

4. **MODERATE: No Realized vs Unrealized Split**
   - When user sells, the gain/loss should be "realized"
   - Current system treats all as unrealized
   - **Data Missing**: 
     - Sale proceeds not captured as gain
     - Tax implications not tracked

5. **MODERATE: Inaccurate Gain Calculation**
   - Example bug:
     ```
     Buy: 10 coins @ $100 = $1000 invested
     Sell: 10 coins @ $150 = $1500 proceeds
     Gain: Should be $500
     Current: gainLoss = 0 (no assets left, but profit is lost)
     ```

### Transaction History Model (firestore-db.ts:70-84)

```typescript
export interface TransactionHistory {
  type: 'deposit' | 'withdraw' | 'buy' | 'sell' | 'fee' | 'seizure' | 'restoration';
  amount: number;
  symbol?: string;
  quantity?: number;
  price?: number;
  // ... other fields
}
```

**Issue**: No field for `entryPrice`, `exitPrice`, or `gainLoss` on individual trades

---

## 4. PORTFOLIO MANAGEMENT

### Asset Model (firestore-db.ts:41-49)

```typescript
export interface Asset {
  id: string;
  userId: string;
  symbol: string;
  quantity: number;
  averagePrice: number;  // ← Cost basis, not current price
  currentPrice?: number; // ← Never set
  createdAt: any;
}
```

**Issues**:
- ⚠️ `currentPrice` is optional and never populated
- ⚠️ No tracking of purchase date (important for tax calculations)
- ⚠️ No tracking of original investment

### Portfolio Value Calculation (portfolio/route.ts:28-29)

```typescript
const totalAssetValue = assets.reduce((sum, asset) => 
  sum + (asset.quantity * asset.averagePrice), 0);
const totalPortfolioValue = user.balance + totalAssetValue;
```

**BUG**: Using `averagePrice` instead of current market price
- Shows cost basis, not current value
- Portfolio value shown to user is incorrect

---

## 5. ADMIN SYSTEM

### Admin Endpoints
- `POST /api/admin/balance` - Credit/debit user balance
- `POST /api/admin/assets` - Seize user assets  
- `PUT /api/admin/assets` - Restore user assets
- `GET /api/admin/users` - List all users
- `POST /api/admin/users` - Create user
- `PUT /api/admin/users` - Update user status/role
- `GET /api/admin/requests` - List deposit/withdraw requests
- `PUT /api/admin/requests` - Approve/reject requests

### ✅ STRENGTHS:
1. **Proper Role-Based Access Control** (balance/route.ts:8-27)
   - Verifies admin role in every endpoint
   - Returns 403 Forbidden for non-admins

2. **Audit Logging** 
   - Every admin action creates audit log entry
   - Tracks who did what and when

3. **Atomic Transactions**
   - Balance updates use transactions
   - Ensures consistency

### ⚠️ ISSUES:

1. **MODERATE: Asset Seizure/Restoration**
   - Uses cost basis (`averagePrice`), not current market value
   - Line 785: `amount: seizeQuantity * asset.averagePrice`
   - User might argue they lost more/less than recorded
   - **FIX**: Use current market price, create dispute log

2. **MINOR: No Approval Workflow for Admin Actions**
   - Admin balance updates are immediate
   - No confirmation or secondary approval
   - **FIX**: Add approval step for large amounts

---

## 6. TRANSACTION REQUEST SYSTEM

### Location: `src/app/api/admin/requests/route.ts`

### Flow:
1. User submits deposit/withdraw request
2. Admin approves (processTransactionRequest) or rejects
3. Atomic transaction updates:
   - User balance
   - Creates transaction history
   - Updates request status

### TransactionRequest Model (firestore-db.ts:51-68)

```typescript
export interface TransactionRequest {
  type: 'deposit' | 'withdraw';
  amount: number;
  status: 'pending' | 'approved' | 'rejected' | 'executed';
  // Bank details
  bankName?: string;
  holderName?: string;
  accountNumber?: string;
  ifscCode?: string;
}
```

### ✅ CORRECT:
- Proper state management (pending → executed/rejected)
- Atomic processing ensures consistency
- Validation for insufficient balance on withdrawal

### ⚠️ ISSUES:
1. **MODERATE: No Bank Account Verification**
   - Accepts any bank details without validation
   - **FIX**: Add bank account verification API

2. **MINOR: No Payment Status Tracking**
   - No field for actual bank transfer status
   - **FIX**: Add `paymentStatus`, `transactionId`, `bankReference`

---

## 7. DATABASE SCHEMA & STRUCTURE

### Collections:
```
users/              → User profiles, balances, settings
orders/             → Trading orders
assets/             → User asset holdings
requests/           → Deposit/withdraw requests
transaction_history → All transactions
kyc_data/           → KYC verification info
audit_logs/         → Admin action logs
alerts/             → User notifications
```

### ✅ GOOD:
- Proper normalization
- Audit trail enabled
- KYC tracking implemented

### ⚠️ ISSUES:
1. **MISSING**: No `trades` collection for individual trade tracking
   - Each trade should have its own record
   - Should track entry/exit prices, P&L, status

2. **MISSING**: No `current_prices` collection
   - Prices fetched real-time but not stored
   - No historical price data for P&L calculations

3. **MISSING**: No `user_statistics` collection
   - Win rate, profit factor not tracked
   - Portfolio metrics not stored

---

## 8. DATA INTEGRITY & VALIDATION

### Input Validation (request-validators.ts)

```typescript
export function normalizeOrderPayload(raw: any) {
  requireFields(raw, ['type', 'symbol', 'quantity', 'price', 'leverage']);
  
  const quantity = parsePositiveNumber(raw.quantity, 'quantity');
  const price = parsePositiveNumber(raw.price, 'price');
  const leverage = parsePositiveNumber(raw.leverage, 'leverage');
  
  return { type, symbol, quantity, price, orderType, leverage };
}
```

### ✅ STRENGTHS:
- Validates required fields
- Ensures positive numbers
- Normalizes order types

### ⚠️ ISSUES:
1. **MODERATE: No Leverage Limits**
   - No check for maximum leverage
   - User could request 1000x leverage
   - **FIX**: `if (leverage > MAX_LEVERAGE) throw error;`

2. **MODERATE: No Price Validation**
   - No check for price reasonableness
   - No protection against extreme prices
   - **FIX**: Check against current market price with tolerance

3. **MODERATE: No Symbol Validation**
   - Accepts any symbol string
   - **FIX**: Validate against supported symbols list

---

## 9. CRITICAL ISSUES SUMMARY

### MUST FIX (Production Breaking):

1. **❌ LOGIN NOT VERIFYING PASSWORDS**
   - Accepts any email/password
   - Major security issue
   - **Fix**: Use Firebase Auth or verify password hash

2. **❌ LEVERAGE NOT PROPERLY IMPLEMENTED**
   - Balance calculations wrong
   - Users could go negative
   - **Fix**: Implement proper margin calculation

3. **❌ WIN/LOSS CALCULATIONS INCORRECT**
   - Missing realized gains
   - No per-trade P&L
   - `currentPrice` never set
   - **Fix**: Add comprehensive P&L tracking

4. **❌ LIMIT ORDERS NOT FUNCTIONAL**
   - Created but never executed
   - **Fix**: Implement order matching engine

5. **❌ ASSET PORTFOLIO VALUE WRONG**
   - Uses cost basis instead of market price
   - Users see wrong portfolio value
   - **Fix**: Update assets with current prices regularly

### SHOULD FIX (High Priority):

1. **⚠️ No Realized vs Unrealized P&L**
   - Cannot accurately report trading performance
   - **Fix**: Track realized gains separately

2. **⚠️ No Per-Trade Statistics**
   - Users can't see individual trade performance
   - **Fix**: Create trades collection with full details

3. **⚠️ Missing Refresh Token Revocation**
   - Compromised tokens can be used indefinitely
   - **Fix**: Implement revocation list in Firestore

4. **⚠️ Slippage Not Calculated**
   - Market order execution doesn't account for slippage
   - **Fix**: Add realistic slippage simulation

### NICE TO HAVE (Medium Priority):

1. **Stop Loss / Take Profit** - Partially defined, not implemented
2. **Portfolio Analytics** - Missing proper metrics
3. **Risk Warnings** - No validation of extreme leverage
4. **Price History** - Not tracked for P&L calculations

---

## 10. CODE QUALITY ASSESSMENT

### Structure: ⭐⭐⭐⭐ (Good)
- Clear separation of concerns
- Proper use of Firestore transactions
- Audit logging implemented

### Security: ⭐⭐ (Poor)
- No password verification
- Missing input validation
- Hardcoded admin email

### Correctness: ⭐⭐ (Poor)  
- Critical leverage bug
- Win/loss calculations wrong
- Average price calculations only partially correct

### Maintainability: ⭐⭐⭐ (Fair)
- Good logging
- Structured error handling
- Could use more comments

---

## RECOMMENDATIONS

### Phase 1: Critical Fixes (Week 1)
1. [ ] Implement password verification in login
2. [ ] Fix leverage margin calculations
3. [ ] Add current price tracking for assets
4. [ ] Fix portfolio value calculations

### Phase 2: Core Features (Week 2-3)
1. [ ] Implement limit order execution
2. [ ] Create comprehensive P&L tracking
3. [ ] Add per-trade statistics
4. [ ] Implement token revocation

### Phase 3: Advanced Features (Week 4)
1. [ ] Add stop loss / take profit functionality
2. [ ] Implement risk warnings
3. [ ] Add portfolio analytics
4. [ ] Create performance reports

---

## TEST CASES TO ADD

```typescript
// 1. Order execution with leverage
test('Order with 2x leverage debits only 50% of order value')

// 2. Win/Loss calculation
test('Selling at profit correctly calculates realized gain')

// 3. Asset average price
test('Multiple buys correctly average cost basis')

// 4. Insufficient balance
test('Cannot place order without sufficient margin')

// 5. Portfolio value
test('Portfolio value uses current price, not cost basis')

// 6. Limit order execution
test('Limit orders execute at specified price')
```
