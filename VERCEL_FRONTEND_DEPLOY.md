# ✈️ VERCEL FRONTEND DEPLOYMENT GUIDE

**Project:** vainateya  
**Platform:** Vercel  
**Framework:** React 18 + TypeScript + Vite  

---

## ✅ WAIT FOR RAILWAY FIRST!

**Important:** Deploy backend to Railway FIRST, then get the URL.

You'll need: `https://vainateya-api.up.railway.app`

---

## 🎯 QUICK DEPLOYMENT (3 Minutes)

### **1. YOU ALREADY PUSHED CODE?**

✅ Yes? Continue to step 2.

❌ No? Run this first:
```bash
git add .
git commit -m "Frontend ready for production"
git push origin main
```

### **2. CONNECT VERCEL TO GITHUB**

1. Go to: https://vercel.com/new
2. Click: "Import Project"
3. Click: "Continue with GitHub"
4. Select your repository: `family-hub`
5. Click: "Import"

### **3. CONFIGURE PROJECT**

Vercel will auto-detect settings:
- ✅ Build Command: `npm install && npm run build`
- ✅ Output Directory: `dist`
- ✅ Framework: `Vite`

### **4. ADD ENVIRONMENT VARIABLE**

Before deploying, add:

```
VITE_API_URL
Value: https://vainateya-api.up.railway.app/api
```

(Replace with your actual Railway backend URL)

### **5. CLICK DEPLOY**

1. Click: "Deploy"
2. Wait: ~60 seconds
3. See: Green "Ready"
4. Get URL: https://vainateya.vercel.app

---

## 🔍 WHAT VERCEL DOES

```
1. ✅ Clone from GitHub
2. ✅ Install npm packages
3. ✅ Build: npm run build
4. ✅ Output: dist/ folder
5. ✅ Deploy to CDN
6. ✅ Assign SSL certificate
7. ✅ Live at vainateya.vercel.app
```

---

## 📊 VERCEL CONFIGURATION

**Auto-Build Settings:**
```
Build: npm install && npm run build
Output: dist/
Environment: Node 18.x
```

**vercel.json (already created):**
```json
{
  "buildCommand": "npm install && npm run build",
  "outputDirectory": "dist",
  "framework": "vite",
  "nodeVersion": "18.x"
}
```

---

## ✨ YOUR PRODUCTION URL

```
Frontend: https://vainateya.vercel.app
Backend:  https://vainateya-api.up.railway.app/api
```

---

## 🧪 TEST AFTER DEPLOYMENT

```bash
# 1. Open website
https://vainateya.vercel.app

# 2. See homepage with Marathi text ✓

# 3. Click "शिक्षक" (Teacher Login)

# 4. Try login with test account:
   Email: teacher@school.com
   Password: password123

# 5. If successful → Dashboard loads ✓
```

---

## 🔄 AUTO-REDEPLOY

Every time you push to GitHub:
```bash
git push origin main
```

Vercel automatically redeploys! No manual steps needed.

---

## 📈 MONITORING IN VERCEL

1. Go to your project homepage
2. Click: "Analytics"
3. See: Real-time traffic, response time, errors

---

## 🚨 COMMON ISSUES & FIXES

### Issue: Blank Page
```
Solution: Check browser console for errors
Verify VITE_API_URL is set
Check backend is running
```

### Issue: API Request Fails
```
Solution: Verify VITE_API_URL in Vercel settings
Should include /api at end
Example: https://vainateya-api.up.railway.app/api
```

### Issue: Build Failed
```
Solution: Check error log in Vercel
Usually means: npm install failed
Solution: npm install locally, push again
```

### Issue: Styles Not Loading
```
Solution: Check TailwindCSS generated
Verify: npm run build works locally
Verify: dist/index.html has <link> tags
```

---

## 💡 TIPS

- **Free tier:** 100GB bandwidth/month - enough for 1000+ users
- **Auto HTTPS:** Certificate provided automatically
- **Preview URLs:** Each push gets preview URL before production
- **Rollback:** One-click rollback to previous deployments
- **Analytics:** Track real-time user metrics

---

## 📋 DEPLOYMENT CHECKLIST

- ✅ Backend deployed to Railway + URL received
- ⬜ VITE_API_URL environment variable set in Vercel
- ⬜ Repository pushed to GitHub
- ⬜ Vercel project created and linked
- ⬜ Frontend deployed (build successful)
- ⬜ Homepage loads with Marathi text
- ⬜ Login page accessible
- ⬜ Backend API responding

---

## ✅ YOU'RE READY!

### Timeline:
1. **Railway Backend:** ~5 minutes
2. **Vercel Frontend:** ~3 minutes
3. **Total Setup:** ~10 minutes

**Your production app will be live immediately after!** 🚀

---

## 🎯 FINAL STEPS

1. **Deploy Railway backend first** (from previous guide)
2. **Get Railway URL**
3. **Update VITE_API_URL in Vercel settings**
4. **Deploy Vercel frontend**
5. **Test at https://vainateya.vercel.app**
