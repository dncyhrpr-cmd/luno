# Luno Crypto Trading Platform - Firebase Deployment Guide

## 🚀 Quick Deployment Setup

This guide will help you deploy your Luno crypto trading platform to Firebase Hosting for FREE.

### Prerequisites
1. Firebase account (free tier is sufficient)
2. Node.js and npm installed
3. Firebase CLI tools installed

### Step 1: Install Firebase CLI
```bash
npm install -g firebase-tools
```

### Step 2: Login to Firebase
```bash
firebase login
```

### Step 3: Initialize Firebase Project
```bash
firebase init tradepath-crypto
```
- Choose: **Hosting** (recommended for web apps)
- Configure as a **single-page web app**
- Set up automatic builds and deployments

### Step 4: Deploy to Firebase Hosting
```bash
npm run deploy:firebase
```

## 🎉 What's Been Set Up
 
✅ **Authentication System**: Login/Signup pages with Firestore integration
✅ **Firebase Hosting**: Configured for free deployment
✅ **Static Export**: Next.js configured for static build output
✅ **Security**: Firebase security rules configured
 
## 📱 How to Use

### Development
```bash
npm run dev
```

### Production Deployment
```bash
npm run build:static && npm run deploy:firebase
```

## 🔧 Firebase Features Enabled

- **Authentication**: Users stored in Firestore Auth
- **Database**: Firestore used for all persistent data
- **Hosting**: Static files served via Firebase Hosting
- **Realtime**: No server needed for basic functionality

## 🌐 Live Deployment

Your app will be live at: `https://tradepath-ecdc6.web.app`

## 📋 Next Steps

1. Test the authentication flow locally
2. Deploy to production using the command above
3. Your free Firebase hosting will handle the rest!

---

**Note**: Replace the placeholder values in `.env.local` with your actual Firebase project credentials.
