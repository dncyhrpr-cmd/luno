# Luno - Quick Start Guide

## 🚀 Get Started in 5 Minutes

### Prerequisites
- Node.js 18+ installed
- npm or yarn
- Firebase account with Firestore setup

### 1. Setup Environment

```bash
# Clone the repository (if not already cloned)
cd tradepath-crypto

# Install dependencies
npm install
```

### 2. Configure Environment Variables

Create `.env.local` in the root directory:

```env
# Firebase Configuration
NEXT_PUBLIC_FIREBASE_API_KEY=AIzaSy...
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-domain.firebaseapp.com
NEXT_PUBLIC_FIREBASE_DATABASE_URL=https://your-database.firebasedatabase.app
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-bucket.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=123456789
NEXT_PUBLIC_FIREBASE_APP_ID=1:123456789:web:abcdef123456
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=G-XXXXXXXXXX

# JWT Secret (Change this to a strong random string)
JWT_SECRET=your_super_secure_jwt_secret_key_change_in_production_min_32_chars
```

### 3. Run Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

### 4. Create Your First Account

1. Click "Sign Up Now" on the login page
2. Enter your details:
   - Full Name
   - Email
   - Password (min 8 characters)
3. Click "Create Your Account"
4. You'll be redirected to login page
5. Login with your new credentials

### 5. Explore the App

- **Home**: View market overview and recent trades
- **Market**: Real-time cryptocurrency prices and charts
- **Orders**: Track your buy/sell orders
- **Assets**: View your cryptocurrency holdings
- **Profile**: Manage your account settings
- **Admin** (if admin role): View platform analytics

---

## 📁 Project Structure

```
tradepath-crypto/
├── src/
│   ├── app/                    # Next.js app router
│   │   ├── api/                # API endpoints
│   │   ├── login/              # Login page
│   │   ├── signup/             # Signup page
│   │   ├── page.tsx            # Main app page
│   │   └── layout.tsx          # Root layout
│   ├── components/
│   │   ├── pages/              # Page components
│   │   ├── ClientProviders.tsx # Context providers
│   │   └── Sidebar.tsx         # Navigation
│   ├── context/                # React contexts
│   ├── lib/                    # Utility functions
│   ├── hooks/                  # Custom React hooks
│   └── types.d.ts              # TypeScript definitions
├── public/                     # Static assets
├── firebase.json               # Firebase config
├── firestore.rules             # Security rules
└── package.json
```

---

## 🔑 Key Commands

```bash
# Development
npm run dev              # Start dev server

# Production
npm run build           # Build for production
npm start              # Start production server

# Linting & Type Checking
npm run lint           # Run ESLint

# Firebase
npm run deploy:firebase # Deploy to Firebase Hosting
```

---

## 🌐 API Endpoints

All endpoints are relative to your app URL (e.g., `http://localhost:3000`).

### Authentication
- `POST /api/auth/login` - Login user
- `POST /api/auth/signup` - Register new user

### Trading
- `GET /api/binance` - Get cryptocurrency prices
- `POST /api/orders` - Create new order
- `GET /api/orders` - Get user orders
- `GET /api/portfolio` - Get user portfolio/assets

### Admin
- `GET /api/admin/analytics` - Get analytics data
- `GET /api/admin/users` - Get all users (admin only)

### Database
- `POST /api/init-firestore` - Initialize Firestore database
- `GET /api/init-firestore` - Check Firestore status

---

## 🎨 Features

### Authentication
✅ User signup with email/password
✅ Secure login with JWT tokens
✅ Password hashing with bcrypt
✅ Session management

### Trading
✅ Real-time market data from Binance
✅ Interactive price charts with indicators
✅ Buy/Sell orders
✅ Market and Limit orders
✅ Leverage trading (up to 10x)

### Portfolio
✅ View your crypto holdings
✅ Track asset performance
✅ View profit/loss

### Dashboard
✅ Market overview
✅ Trading history
✅ Account statistics
✅ Dark mode support

---

## 🔒 Security

- **Passwords**: Hashed with bcrypt (12 rounds)
- **API Auth**: JWT tokens with 24-hour expiration
- **Database**: Firestore security rules
- **HTTPS**: Enforced in production
- **Headers**: Security headers configured

---

## 🐛 Troubleshooting

### Can't Start Dev Server
```bash
# Clear cache and reinstall
rm -rf node_modules .next
npm install
npm run dev
```

### Build Fails
```bash
# Check for TypeScript errors
npm run build

# Clear Next.js cache
rm -rf .next

# Rebuild
npm run build
```

### Firebase Connection Error
1. Check `.env.local` has correct Firebase credentials
2. Verify Firestore database exists
3. Check internet connection
4. Restart dev server

### Can't Create Account
1. Check email format is valid
2. Ensure password is at least 8 characters
3. Check browser console for errors
4. Verify Firebase is running

---

## 📊 Database Schema

### Users Collection
```javascript
{
  id: string,
  username: string,
  email: string,
  password: string (hashed),
  role: "admin" | "trader",
  balance: number,
  twoFactorEnabled: boolean,
  createdAt: timestamp
}
```

### Orders Collection
```javascript
{
  id: string,
  userId: string,
  type: "BUY" | "SELL",
  symbol: string,
  quantity: number,
  price: number,
  status: "PENDING" | "FILLED" | "CANCELLED",
  createdAt: timestamp
}
```

### Assets Collection
```javascript
{
  id: string,
  userId: string,
  symbol: string,
  quantity: number,
  averagePrice: number,
  currentPrice: number (optional),
  createdAt: timestamp
}
```

---

## 🚀 Next Steps

1. **Customize Branding**
   - Update app name in `src/app/layout.tsx`
   - Add your logo in `public/`
   - Update colors in Tailwind config

2. **Add More Features**
   - Two-factor authentication
   - API key management
   - Advanced order types
   - Webhook notifications

3. **Deploy**
   - Follow [PRODUCTION_GUIDE.md](./PRODUCTION_GUIDE.md)
   - Use Firebase Hosting or Vercel
   - Configure custom domain

4. **Monitor**
   - Set up error tracking
   - Monitor API performance
   - Track user analytics

---

## 📚 Resources

- [Next.js Docs](https://nextjs.org/docs)
- [Firebase Docs](https://firebase.google.com/docs)
- [Firestore Guide](https://firebase.google.com/docs/firestore)
- [React Docs](https://react.dev)
- [Tailwind CSS](https://tailwindcss.com)

---

## 💬 Support

For issues, check:
1. Project documentation files
2. Error messages in console
3. Firebase console for database issues
4. Next.js documentation

---

**Version**: 1.0.0
**Last Updated**: November 2025
**Status**: Production Ready ✅
