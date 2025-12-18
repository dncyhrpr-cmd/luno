# Luno - Crypto Trading Platform | Production Deployment Guide

## 🎯 Overview

This guide covers preparing and deploying the Luno crypto trading platform to production. The application is production-ready and all demo data has been removed.

---

## ✅ Cleanup Completed

The following demo/test data has been removed:

- ❌ **Hardcoded demo credentials** (dncyhrpr@gmail.com, demo@luno.io)
- ❌ **Mock chart data** (replaced with real Binance API data)
- ❌ **Hardcoded account balances** (now fetches from API)
- ❌ **Test user creation logic** (users signup normally)
- ✅ **All dependencies updated and optimized**

---

## 🚀 Pre-Deployment Checklist

### 1. **Environment Variables Setup**

Create a `.env.local` file with production values:

```env
# Firebase Configuration (REQUIRED)
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_firebase_domain
NEXT_PUBLIC_FIREBASE_DATABASE_URL=your_firebase_db_url
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_firebase_project_id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your_storage_bucket
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
NEXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id

# JWT Configuration (REQUIRED - CHANGE IN PRODUCTION)
JWT_SECRET=your_super_secure_jwt_secret_key_min_32_chars

# Optional: API Keys
# BINANCE_API_KEY=your_binance_api_key
# BINANCE_API_SECRET=your_binance_api_secret
```

### 2. **Firebase Security Rules**

Review and update `firestore.rules` for production:

```bash
# Current rule file location:
firestore.rules
```

**Recommended security rules:**
- Restrict access to user data (only owner can read/write)
- Implement role-based access control (admin vs trader)
- Add rate limiting rules
- Validate data structure on write

### 3. **Database Initialization (Optional)**

To initialize the Firestore database:

```bash
# Via API endpoint (POST request)
curl -X POST http://localhost:3000/api/init-firestore

# Or with data clearing:
curl -X POST http://localhost:3000/api/init-firestore \
  -H "Content-Type: application/json" \
  -d '{"clear": true}'

# Check connection:
curl http://localhost:3000/api/init-firestore
```

---

## 🔧 Build & Deployment

### 1. **Local Testing**

```bash
# Install dependencies
npm install

# Run development server
npm run dev
# App available at http://localhost:3000

# Build for production
npm run build

# Start production server
npm start
```

### 2. **Firebase Deployment**

```bash
# Install Firebase CLI
npm install -g firebase-tools

# Login to Firebase
firebase login

# Deploy to Firebase Hosting
npm run deploy:firebase

# Or use Firebase CLI directly
firebase deploy --only hosting
```

### 3. **Vercel Deployment (Alternative)**

```bash
# Install Vercel CLI
npm install -g vercel

# Deploy to Vercel
vercel --prod

# Or connect GitHub for automatic deployments
# https://vercel.com/new
```

### 4. **Docker Deployment**

```dockerfile
# Example Dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3000
CMD ["npm", "start"]
```

---

## 📋 Key Endpoints

### Authentication
- **POST** `/api/auth/login` - User login
- **POST** `/api/auth/signup` - User registration

### Trading
- **POST** `/api/orders` - Create new order
- **GET** `/api/orders` - Get user orders
- **GET** `/api/portfolio` - Get user portfolio
- **GET** `/api/binance` - Get market data

### Admin
- **GET** `/api/admin/analytics` - Admin dashboard analytics
- **GET** `/api/admin/users` - User management

### Database
- **POST** `/api/init-firestore` - Initialize database
- **GET** `/api/init-firestore` - Check Firestore connection

---

## 🔐 Security Best Practices

### 1. **API Security**
- ✅ All API routes use proper authentication
- ✅ JWT tokens with expiration
- ✅ Password hashing with bcrypt
- ✅ HTTPS only in production

### 2. **Data Protection**
- Store sensitive data in environment variables
- Never commit `.env.local` to version control
- Use Firebase security rules for database access
- Implement rate limiting on sensitive endpoints

### 3. **Frontend Security**
- ✅ CSRF protection enabled
- ✅ XSS prevention headers configured
- ✅ Security headers in firebase.json:
  - X-Content-Type-Options: nosniff
  - X-Frame-Options: DENY
  - X-XSS-Protection: 1; mode=block

---

## 📊 Performance Optimization

### Already Configured:
- ✅ Static page generation for fast load times
- ✅ Code splitting and lazy loading
- ✅ Image optimization
- ✅ CSS-in-JS for minimal bundle size
- ✅ React.memo for component optimization

### Recommendations:
- Enable CDN caching for static assets
- Use database indexes for frequently queried fields
- Monitor API response times
- Set up error tracking (Sentry, LogRocket)

---

## 🧪 Testing Endpoints

### Test User Signup
```bash
curl -X POST http://localhost:3000/api/auth/signup \
  -H "Content-Type: application/json" \
  -d '{
    "name": "John Doe",
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
```

### Test User Login
```bash
curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{
    "email": "user@example.com",
    "password": "SecurePassword123"
  }'
```

### Get Market Data
```bash
curl http://localhost:3000/api/binance
```

---

## 📈 Monitoring & Maintenance

### Performance Monitoring
1. Set up Google Analytics in Firebase
2. Monitor API response times
3. Track user engagement metrics
4. Set up alerts for errors

### Regular Maintenance Tasks
- Monitor Firestore quota usage
- Review Firebase security rules
- Update dependencies monthly
- Backup Firestore data regularly
- Review error logs and fix issues

---

## 🆘 Troubleshooting

### Issue: Firebase Connection Error
**Solution:**
1. Verify environment variables are correct
2. Check Firebase project settings
3. Ensure Firestore database is created
4. Check Firebase security rules

### Issue: Build Fails
**Solution:**
```bash
# Clear build cache
rm -rf .next node_modules

# Reinstall dependencies
npm install

# Rebuild
npm run build
```

### Issue: API Routes Not Working
**Solution:**
1. Check API route files exist in `src/app/api/`
2. Verify exports are default functions
3. Check Next.js configuration
4. Review server logs

---

## 📚 Additional Resources

- [Next.js Documentation](https://nextjs.org/docs)
- [Firebase Documentation](https://firebase.google.com/docs)
- [Firestore Best Practices](https://firebase.google.com/docs/firestore/best-practices)
- [React Documentation](https://react.dev)

---

## 🎉 Deployment Checklist

- [ ] All environment variables configured
- [ ] Firebase project created and configured
- [ ] Firestore database created
- [ ] Security rules reviewed and updated
- [ ] Build tested locally: `npm run build`
- [ ] Development server tested: `npm run dev`
- [ ] All features tested:
  - [ ] User signup
  - [ ] User login
  - [ ] Market data loading
  - [ ] Trading functionality
  - [ ] Portfolio management
- [ ] Performance optimized
- [ ] Error tracking set up
- [ ] Database backups configured
- [ ] Monitoring and alerts configured
- [ ] SSL certificate configured
- [ ] Custom domain set up (if applicable)
- [ ] Deployed to production
- [ ] Post-deployment verification completed

---

## 📞 Support

For issues or questions, refer to:
- Official Documentation files
- Error logs in Firebase Console
- Next.js CLI error messages

**Last Updated:** November 2025
**Version:** 1.0.0 - Production Ready
