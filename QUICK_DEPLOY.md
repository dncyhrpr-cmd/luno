# 🚀 Deployment Instructions - TradePath Crypto

## Quick Deploy Checklist

### Before Deploying ✅

1. **Update Production Credentials**
   ```bash
   # Edit .env.local with production values
   NEXT_PUBLIC_FIREBASE_API_KEY=your_production_key
   NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your_production_domain
   NEXT_PUBLIC_FIREBASE_PROJECT_ID=your_production_project
   JWT_SECRET=your_strong_random_secret_32_chars_minimum
   ```

2. **Verify Build**
   ```bash
   npm run build
   # Should complete with "Compiled successfully"
   ```

3. **Test Locally (Optional)**
   ```bash
   npm run dev
   # Test at http://localhost:3000
   ```

---

## Deploy to Firebase Hosting

### Step 1: Login to Firebase CLI
```bash
firebase login
```

### Step 2: Deploy
```bash
# Deploy only hosting
firebase deploy --only hosting

# OR deploy everything (hosting + functions + firestore rules)
firebase deploy
```

### Step 3: Verify Deployment
- [ ] Navigate to Firebase Console
- [ ] Check Hosting tab for deployment status
- [ ] Click on the deployment to view production URL
- [ ] Test the live application

---

## Post-Deployment Testing

### Test Checklist
- [ ] **Landing Page** - Loads correctly
- [ ] **Signup** - Create new account
- [ ] **Login** - Sign in with test credentials
- [ ] **Dashboard** - Homepage displays properly
- [ ] **Market Data** - Real-time prices updating
- [ ] **Trading** - Can place test orders
- [ ] **Portfolio** - Displays user assets
- [ ] **Admin Panel** - Load if admin user
- [ ] **Mobile** - Test on mobile device
- [ ] **Dark Mode** - Toggle theme works

---

## Troubleshooting

### Build Fails
```bash
# Clear cache and rebuild
rm -rf .next node_modules
npm install
npm run build
```

### Firebase Deploy Fails
```bash
# Check Firebase project
firebase projects:list

# Verify configuration
firebase projects:describe

# Re-initialize if needed
firebase init hosting
```

### Environment Variables Not Loading
- Ensure `.env.local` is in project root
- Restart development server if using `npm run dev`
- For production, set environment variables in Firebase Console

### WebSocket Connection Issues
- Verify Binance API is accessible from your region
- Check browser console for CORS errors
- Binance URLs: `wss://stream.binance.com:9443`

---

## Production URLs

Your deployment will be available at:
```
https://luno-0.web.app
https://luno-0.firebaseapp.com
```

---

## Rollback Instructions

If needed to rollback to previous version:
```bash
firebase hosting:versions:list
firebase hosting:rollback  # Interactive
# or
firebase hosting:rollback [VERSION_ID]
```

---

## Monitoring

### Firebase Console Checks
1. **Hosting** - View deployments and performance
2. **Firestore** - Monitor database operations
3. **Authentication** - Check user signups
4. **Functions** - Monitor API performance (if using Cloud Functions)
5. **Analytics** - View user engagement

### Logs
```bash
firebase functions:log  # View function logs
```

---

## Security Checklist

- [ ] JWT_SECRET is strong and unique
- [ ] No credentials in source code
- [ ] Firestore security rules are enabled
- [ ] HTTPS is enforced (automatic with Firebase)
- [ ] Environment variables are configured
- [ ] API keys are restricted in Firebase Console

---

## Additional Resources

- [Firebase Hosting Docs](https://firebase.google.com/docs/hosting)
- [Next.js Deployment](https://nextjs.org/docs/deployment)
- [Firebase CLI Reference](https://firebase.google.com/docs/cli)

---

**Last Updated:** December 2, 2025  
**Status:** Ready for Production Deployment ✅
