# Family Hub - Complete Deployment Instructions

**Version:** 1.0.0  
**Last Updated:** April 7, 2026  
**Status:** ✅ Ready for Production

---

## 📋 Table of Contents
1. [Pre-Deployment Checklist](#pre-deployment-checklist)
2. [Local Testing](#local-testing)
3. [Deployment Options](#deployment-options)
4. [Step-by-Step Guide](#step-by-step-guide)
5. [Post-Deployment](#post-deployment)
6. [Troubleshooting](#troubleshooting)

---

## ✅ Pre-Deployment Checklist

### Code Ready
- [x] Removed Lovable branding
- [x] Updated website icon
- [x] Fixed backend database issues
- [x] Fixed duplicate schema indexes
- [x] Frontend builds successfully
- [x] Backend builds successfully
- [x] Both servers run without errors

### Testing Complete
- [x] Backend API responding (`/api/health`)
- [x] Frontend connecting to backend
- [x] Login page displays correctly
- [x] CORS properly configured

### Environment Configuration
- [x] Created `.env.production` files
- [x] Documented all required variables
- [x] Security configurations in place

---

## 🧪 Local Testing Before Deployment

### Test Login Flow
1. Start both servers locally:
   ```bash
   # Terminal 1: Backend
   cd backend
   npm run dev
   
   # Terminal 2: Frontend
   npm run dev
   ```

2. Visit: http://localhost:5173/login

3. Test with sample credentials:
   - Email: `.01@vainateya.edu`
   - Password: (from database)
   - Role: Teacher

4. Verify:
   - [ ] Login succeeds
   - [ ] Redirected to dashboard
   - [ ] No console errors
   - [ ] API calls work

### Test All Features
- [ ] Teacher dashboard loads
- [ ] Parent dashboard loads
- [ ] Student dashboard loads
- [ ] Admin panel loads
- [ ] All pages load without 404 errors

---

## 🚀 Deployment Options

### Option 1: Railway (Recommended - Easiest)
**Pros:** Simple, auto-deploys from Git, free tier available  
**Cons:** Limited free resources  
**Cost:** Free tier or $5+/month

### Option 2: Heroku
**Pros:** Battle-tested, good documentation  
**Cons:** Paid service, no completely free tier  
**Cost:** Starting at $7/month

### Option 3: Vercel (Frontend) + Railway (Backend)
**Pros:** Best in class for each  
**Cons:** Multiple platforms to manage  
**Cost:** Free tier available

### Option 4: AWS EC2
**Pros:** Full control, scalable  
**Cons:** Complex setup, requires Linux knowledge  
**Cost:** $3-10+/month depending on instance

### Option 5: DigitalOcean
**Pros:** Good balance, affordable  
**Cons:** Requires SSH/Linux knowledge  
**Cost:** $4-6/month for app platform

---

## 📝 Step-by-Step Guide

### STEP 1: Choose Platform

Choose one of the options above. We'll provide Railway instructions (recommended).

### STEP 2: Create Production Environment

**Backend MongoDB Setup:**
1. Go to: https://www.mongodb.com/cloud/atlas
2. Create free account
3. Create cluster
4. Get connection string: `mongodb+srv://user:pass@cluster.mongodb.net/family_hub`

**Generate JWT Secret:**
```bash
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```
Save this - you'll need it for `.env`

### STEP 3: Create Git Repository

```bash
# Initialize git (if not already done)
git init
git add .
git commit -m "Initial commit - Family Hub ready for deployment"

# Push to GitHub
git remote add origin https://github.com/YOUR_USERNAME/family-hub.git
git push -u origin main
```

### STEP 4A: Deploy with Railway.app

1. **Create Railway Account**
   - Visit: https://railway.app
   - Sign up with GitHub

2. **Create Backend Service**
   - Click "New Project"
   - Select "Deploy from GitHub repo"
   - Choose your `family-hub` repository
   - Select the `/backend` directory
   - Wait for deployment

3. **Configure Backend Environment**
   - Go to Variables tab
   - Add these variables:
     ```
     NODE_ENV=production
     PORT=9000
     MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/family_hub
     MONGODB_DB_NAME=family_hub
     JWT_SECRET=<from Step 2>
     FRONTEND_URL=https://your-frontend-url.com
     ```
   - Railway will generate backend URL automatically

4. **Create Frontend Service**
   - Add new service from same repo
   - Select root directory (frontend)
   - Set build command: `npm run build`
   - Set start command: `npm run preview` or point to `dist/`

5. **Configure Frontend Environment**
   - Add variables:
     ```
     VITE_API_URL=https://[railway-backend-url]/api
     ```

6. **Deploy**
   - Railway auto-deploys when you push to main

### STEP 4B: Deploy with Heroku

1. **Create Heroku Account**
   - Visit: https://www.heroku.com
   - Sign up

2. **Install Heroku CLI**
   ```bash
   # Windows with npm
   npm install -g heroku
   
   # Login
   heroku login
   ```

3. **Create Backend App**
   ```bash
   cd backend
   heroku create family-hub-api
   
   # Set environment variables
   heroku config:set NODE_ENV=production
   heroku config:set MONGODB_URI="mongodb+srv://user:pass@cluster.mongodb.net/family_hub"
   heroku config:set JWT_SECRET="<from Step 2>"
   heroku config:set MONGODB_DB_NAME=family_hub
   
   # Deploy
   git push heroku main
   ```

4. **Create Frontend App**
   ```bash
   cd ..
   heroku create family-hub-frontend
   
   # Set API URL
   heroku config:set VITE_API_URL="https://family-hub-api.herokuapp.com/api"
   
   # Add Procfile for frontend
   echo "web: npm run preview" > Procfile
   
   # Deploy
   git push heroku main
   ```

### STEP 5: Verify Deployment

1. **Test Backend**
   ```bash
   curl https://[your-backend-domain]/api/health
   # Should return: {"status":"ok","timestamp":"..."}
   ```

2. **Test Frontend**
   - Open: https://[your-frontend-domain]
   - Should see landing page with school logo
   - Click login and verify connection

3. **Test Login**
   - Go to: https://[your-frontend-domain]/login
   - Try logging in
   - Should redirect to dashboard

---

## 📊 Post-Deployment

### Monitor Your Application

1. **Check Logs**
   - Railway: Dashboard > Logs
   - Heroku: `heroku logs --tail`

2. **Monitor Performance**
   - Backend response times
   - Database query times
   - Frontend load times

3. **Set Up Alerts**
   - Error notifications
   - Uptime monitoring
   - Database backup alerts

### Database Backup

```bash
# Manual backup
mongodump --uri "mongodb+srv://user:pass@cluster.mongodb.net/family_hub"

# Restore if needed
mongorestore --uri "mongodb+srv://user:pass@cluster.mongodb.net/family_hub" dump/family_hub/
```

### Scaling

- Monitor resource usage
- Upgrade database plan if needed
- Optimize slow queries
- Add caching if needed

---

## 🔒 Security Checklist

- [x] JWT_SECRET is strong (32+ characters)
- [x] HTTPS/SSL enabled
- [x] CORS properly configured
- [x] Environment variables not in git
- [x] Database credentials secure
- [ ] Enable 2FA on deployment platform
- [ ] Regular backups configured
- [ ] Error monitoring set up
- [ ] Rate limiting configured (optional)
- [ ] Input validation in place

---

## 🆘 Troubleshooting

### Frontend Shows Connection Timeout
```
Issue: VITE_API_URL pointing to localhost
Fix: Update to production backend URL

1. Check .env or .env.production
2. Verify VITE_API_URL=https://your-api-domain/api
3. Rebuild and redeploy
```

### Login Failing
```
Issue: JWT_SECRET mismatch or database issue
Fix:
1. Verify JWT_SECRET matches in backend
2. Test database connection
3. Check user credentials in database
4. Review error logs
```

### Database Connection Error
```
Issue: MongoDB Atlas connection string invalid
Fix:
1. Verify MONGODB_URI format
2. Check IP whitelist in MongoDB Atlas
3. Verify username/password
4. Test connection locally first
```

### Build Failures
```
Fix:
1. Clear cache: npm cache clean --force
2. Reinstall: rm -rf node_modules && npm install
3. Check Node version: node --version (need 16+)
4. Check for syntax errors: npm run lint
```

### Page Not Found (404)
```
Issue: Frontend routing not configured for SPA
Fix: Configure web server to serve index.html
- Railway: Automatic for Node apps
- Vercel: Automatic for Next.js
- Standard Node: Ensure express serves static files
```

---

## 📞 Support

- **Railway Docs:** https://docs.railway.app
- **Heroku Docs:** https://devcenter.heroku.com
- **MongoDB Atlas:** https://docs.atlas.mongodb.com
- **Vite Docs:** https://vite.dev
- **Express Docs:** https://expressjs.com

---

## ✨ Deployment Complete!

After deployment, your Family Hub application will be live and accessible to:
- Teachers: Can manage classes, attendance, homework
- Parents: Can monitor student progress
- Students: Can submit assignments, view grades
- Admins: Can manage all system settings

**Congratulations! 🎉**

---

**Version History:**
- v1.0.0 (Apr 7, 2026) - Initial release, ready for production
