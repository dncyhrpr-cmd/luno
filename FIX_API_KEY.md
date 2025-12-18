# 🔧 Firebase API Key Fix - Step by Step

## Problem
Your Firebase API key `AIzaSyB6VZGyh3S4IkOv1Wz81F1jd7oa-OlC1i0` has restrictions that are blocking authentication requests from your deployed app.

**Error:** `auth/api-key-not-valid.-please-pass-a-valid-api-key.`

---

## ✅ Solution - Update API Key Restrictions

### Step 1: Go to Firebase Console
1. Open: https://console.firebase.google.com/
2. Select project: **luno-0**
3. Click **⚙️ Settings** (gear icon) → **Project settings**

### Step 2: Find API Keys
1. Go to the **API keys** tab (or Settings → API keys)
2. Look for the key starting with `AIzaSyB6VZGyh3S4IkOv1Wz81F1jd7oa-OlC1i0`

### Step 3: Edit the API Key Restrictions
1. Click on your API key to edit it
2. Under **"API restrictions"**, you should see one of these:
   - **"None (API unrestricted)"** - GOOD ✅
   - **"HTTP referrers"** - NEEDS UPDATE ⚠️
   - **"IP addresses"** - NEEDS CHANGE ⚠️
   - **"Android apps"** - NEEDS CHANGE ⚠️

### Step 4: Configure for Web App
**If "HTTP referrers" is selected:**
1. Click **"HTTP referrers"** dropdown
2. Make sure these are included in the list:
   ```
   https://luno-0.web.app/*
   https://luno-0.firebaseapp.com/*
   http://localhost:3000/*
   ```
3. Click **"Save"**

**If restricted to something else:**
1. Click the restriction type dropdown
2. Select **"HTTP referrers"**
3. Add the URLs above
4. Click **"Save"**

**Alternative (for testing):**
1. Select **"None (API unrestricted)"**
2. Click **"Save"**
3. This is less secure but good for debugging

### Step 5: Enable Required APIs
1. In Firebase Console, go to **APIs and services** (or click the link)
2. Search for and enable these APIs:
   - ✅ **Identity Toolkit API**
   - ✅ **Cloud Identity-Aware Proxy API**
3. Wait 2-3 minutes for changes to propagate

### Step 6: Verify in Your Code
Your `.env.local` should have (it already does):
```
NEXT_PUBLIC_FIREBASE_API_KEY="AIzaSyB6VZGyh3S4IkOv1Wz81F1jd7oa-OlC1i0"
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN="luno-0.firebaseapp.com"
NEXT_PUBLIC_FIREBASE_PROJECT_ID="luno-0"
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET="luno-0.firebasestorage.app"
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID="368484485180"
NEXT_PUBLIC_FIREBASE_APP_ID="1:368484485180:web:3bd9361d2e566e4e045b39"
```

### Step 7: Rebuild and Redeploy (Optional)
If you want to ensure the latest build:
```bash
npm run build
firebase deploy --only hosting
```

### Step 8: Test
1. Clear your browser cache (Ctrl+Shift+Delete)
2. Go to: https://luno-0.web.app
3. Try to sign up
4. You should see: ✅ **Success!**

---

## 🎯 Expected Result
After fixing the API key restrictions:
- ✅ Signup will work
- ✅ Login will work
- ✅ Market data will load
- ✅ WebSocket updates will flow
- ✅ Orders can be placed
- ✅ Portfolio will display

---

## 🔍 Troubleshooting

**Still getting auth/api-key-not-valid error?**
1. Clear browser cache completely
2. Try incognito/private window
3. Wait 5 more minutes (Firebase can take time to propagate)
4. Check that Identity Toolkit API is enabled

**Getting 400 error?**
1. This is often an API key restriction issue
2. Try unrestricting the key temporarily for testing
3. Then set proper HTTP referrer restrictions

**Getting different error?**
1. Check Firebase Console for errors in logs
2. Go to: https://console.firebase.google.com/project/luno-0/functions
3. Look for any function errors

---

## 📋 Your Firebase Configuration (Already Correct)

```javascript
{
  apiKey: "AIzaSyB6VZGyh3S4IkOv1Wz81F1jd7oa-OlC1i0",
  authDomain: "luno-0.firebaseapp.com",
  projectId: "luno-0",
  storageBucket: "luno-0.firebasestorage.app",
  messagingSenderId: "368484485180",
  appId: "1:368484485180:web:3bd9361d2e566e4e045b39",
  measurementId: "G-FB4B8R78JY"
}
```

**Status:** ✅ Configuration is correct, just need to update API key restrictions

---

## ⏱️ Timeline
- **Right Now:** Update API key restrictions in Firebase Console
- **2-5 minutes:** Firebase propagates changes
- **After that:** Your app will work!

---

**Once you update the API key restrictions, your app should work perfectly!** 🚀
