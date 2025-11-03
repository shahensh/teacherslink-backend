# Production Configuration Guide

This guide explains how to configure the backend for production use with both website and mobile app.

## 🔒 Production Checklist

### ✅ Current Backend Status

- ✅ **CORS configured** for both website and mobile app
- ✅ **Mobile app support** enabled (Capacitor/Ionic origins)
- ✅ **Push notifications** configured (Firebase)
- ✅ **Security middleware** (Helmet, rate limiting)
- ✅ **Error handling** implemented
- ✅ **Environment variables** ready

### ⚠️ Production Changes Needed

1. **Remove localhost from production CORS**
2. **Use production URLs** in environment variables
3. **Disable development-only features**
4. **Secure sensitive credentials**
5. **Configure proper rate limiting**

---

## 📝 Environment Variables for Production

### Production `.env` File

Create/update your production `.env` file:

```env
# ============================================
# PRODUCTION CONFIGURATION
# ============================================

# Environment
NODE_ENV=production
PORT=5001
HOST=0.0.0.0

# ============================================
# DATABASE
# ============================================
MONGODB_URI=mongodb+srv://username:password@cluster.mongodb.net/teacherslink?retryWrites=true&w=majority

# ============================================
# SECURITY
# ============================================
JWT_SECRET=your_very_strong_random_secret_key_minimum_32_characters_long
JWT_EXPIRE=7d

# ============================================
# CORS - WEBSITE & MOBILE APP URLS
# ============================================

# Website URL (Production)
FRONTEND_URL=https://your-website-domain.com

# Allowed Origins (Website + Mobile App)
# Format: comma-separated list
# Include: Website URL, Mobile app origins (capacitor://localhost is required for mobile)
ALLOWED_ORIGINS=https://your-website-domain.com,https://www.your-website-domain.com,capacitor://localhost,ionic://localhost

# ============================================
# EMAIL CONFIGURATION
# ============================================
EMAIL_HOST=smtp.gmail.com
EMAIL_PORT=587
EMAIL_USER=your-production-email@gmail.com
EMAIL_PASS=your_app_password

# ============================================
# FILE UPLOADS (Cloudinary)
# ============================================
CLOUDINARY_CLOUD_NAME=your_production_cloud_name
CLOUDINARY_API_KEY=your_production_api_key
CLOUDINARY_API_SECRET=your_production_api_secret

# ============================================
# PAYMENT GATEWAY (Razorpay)
# ============================================
# IMPORTANT: Use PRODUCTION keys, not test keys!
RAZORPAY_KEY_ID=rzp_live_your_production_key_id
RAZORPAY_KEY_SECRET=your_production_key_secret
RAZORPAY_WEBHOOK_SECRET=your_production_webhook_secret

# ============================================
# FIREBASE (Push Notifications)
# ============================================
FIREBASE_SERVICE_ACCOUNT={"type":"service_account","project_id":"teachershubb",...}

# ============================================
# ADMIN CONFIGURATION
# ============================================
ADMIN_EMAIL=admin@your-domain.com
ADMIN_PASSWORD=your_strong_admin_password_change_this

# ============================================
# OTHER CONFIGURATIONS
# ============================================
PLAN_SYSTEM_ENABLED=true
```

---

## 🌐 Where URLs Are Used

### 1. **CORS Configuration** (`server.js`)

**Location:** Lines 64-75

**What it does:** Controls which origins can access your API

**Production configuration:**
```javascript
// In .env file:
ALLOWED_ORIGINS=https://your-website.com,https://www.your-website.com,capacitor://localhost,ionic://localhost
```

**Why `capacitor://localhost` is needed:**
- Mobile apps (Capacitor/Ionic) use `capacitor://localhost` as their origin
- This is required for mobile app to work
- Keep this even in production

### 2. **Frontend URL** (`server.js`)

**Location:** Line 67, Line 213

**Used for:**
- Password reset redirects
- Email links
- CORS fallback

**Production configuration:**
```env
FRONTEND_URL=https://your-website-domain.com
```

### 3. **Mobile App API URL**

**Location:** Mobile app configuration (NOT in backend)

**What mobile app needs:**
```typescript
// In mobile app's environment/config
const API_URL = 'https://api.your-domain.com';  // Your backend URL
```

**Backend doesn't need mobile app URL** - it detects mobile apps automatically via origin.

---

## 🔧 Production-Specific Changes

### 1. Update CORS for Production

**Current code allows localhost (development only):**

The backend currently allows:
- `http://localhost:*` (all ports)
- Local network IPs (192.168.x.x, 10.x.x.x)

**For production, you should:**

**Option A: Use ALLOWED_ORIGINS (Recommended)**
```env
ALLOWED_ORIGINS=https://your-website.com,capacitor://localhost,ionic://localhost
```

This will ONLY allow:
- Your production website
- Mobile app origins (required)

**Option B: Modify server.js** (if you want stricter control)

Update `isOriginAllowed` function to disable localhost in production:

```javascript
// Allow localhost variations (for development)
if (process.env.NODE_ENV !== 'production') {
  if (origin.startsWith('http://localhost') || 
      origin.startsWith('https://localhost') ||
      origin.startsWith('http://127.0.0.1')) {
    return true;
  }
  
  // Allow local network IPs (for mobile app testing on same network)
  const localNetworkPattern = /^https?:\/\/(10\.|192\.168\.|172\.(1[6-9]|2[0-9]|3[01])\.)/;
  if (localNetworkPattern.test(origin)) {
    return true;
  }
}
```

### 2. Rate Limiting

**Current:** 1000 requests per 15 minutes

**For production, consider:**
- Reduce to 100-200 requests per 15 minutes per IP
- Implement user-based rate limiting
- Use Redis for distributed rate limiting

### 3. Security Headers

**Already configured:** Helmet is enabled

**Verify:**
- Content Security Policy
- X-Frame-Options
- X-Content-Type-Options

---

## 📱 Mobile App Configuration

### Mobile App Needs to Know Backend URL

**In your mobile app (React/TypeScript):**

```typescript
// config/environment.ts

// Development
const DEV_API_URL = 'http://10.123.14.134:5001';  // Your local IP

// Production
const PROD_API_URL = 'https://api.your-domain.com';  // Your production backend

export const API_URL = __DEV__ ? DEV_API_URL : PROD_API_URL;
```

**Or use environment variables:**

```typescript
// .env file in mobile app
REACT_APP_API_URL=https://api.your-domain.com
```

**Then in code:**
```typescript
const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5001';
```

---

## 🚀 Deployment Steps

### 1. Update Environment Variables

```bash
# On your production server
nano .env
# Update all URLs and credentials
```

### 2. Update CORS Origins

```env
ALLOWED_ORIGINS=https://your-website.com,capacitor://localhost,ionic://localhost
```

### 3. Update Frontend URL

```env
FRONTEND_URL=https://your-website.com
```

### 4. Secure Sensitive Data

- ✅ Use strong JWT_SECRET (32+ characters)
- ✅ Use production Razorpay keys
- ✅ Use production Cloudinary credentials
- ✅ Use production MongoDB URI
- ✅ Use production Firebase credentials

### 5. Restart Server

```bash
pm2 restart teacherslink-backend
# or
npm run pm2:restart
```

---

## 🧪 Testing Production Setup

### Test Website Access

1. **From website:** `https://your-website.com`
   - Should connect to backend successfully
   - API calls should work
   - CORS should allow requests

### Test Mobile App Access

1. **From mobile app:**
   - Should connect to backend
   - API calls should work
   - Push notifications should work

### Verify CORS

```bash
# Test from website
curl -H "Origin: https://your-website.com" \
     -H "Access-Control-Request-Method: POST" \
     -H "Access-Control-Request-Headers: Content-Type,Authorization" \
     -X OPTIONS \
     https://api.your-domain.com/api/auth/login
```

Should return: `Access-Control-Allow-Origin: https://your-website.com`

---

## 📋 URL Configuration Summary

### Backend Configuration (`.env`)

| Variable | Purpose | Example |
|----------|---------|---------|
| `FRONTEND_URL` | Website URL for redirects/emails | `https://your-website.com` |
| `ALLOWED_ORIGINS` | CORS allowed origins | `https://your-website.com,capacitor://localhost` |
| `NODE_ENV` | Environment mode | `production` |

### Mobile App Configuration

| Variable | Purpose | Example |
|----------|---------|---------|
| `API_URL` | Backend API URL | `https://api.your-domain.com` |

### Key Points

1. **Backend doesn't need mobile app URL** - it detects via origin
2. **Mobile app needs backend URL** - configure in mobile app
3. **Keep `capacitor://localhost`** in ALLOWED_ORIGINS (required for mobile)
4. **Remove localhost** from production (except mobile app origins)

---

## ⚠️ Important Notes

### Mobile App Origins

- **ALWAYS include** `capacitor://localhost` and `ionic://localhost` in `ALLOWED_ORIGINS`
- These are NOT actual URLs - they're identifiers for mobile apps
- Mobile apps use these automatically - you don't configure them

### Website URLs

- Use **HTTPS** in production
- Include **www** and **non-www** versions if both are used
- Example: `https://your-site.com,https://www.your-site.com`

### Backend URL

- Backend URL is configured in **mobile app**, not backend
- Mobile app makes requests to backend URL
- Backend validates origin (CORS)

---

## 🔍 Verification Checklist

- [ ] `.env` file updated with production values
- [ ] `ALLOWED_ORIGINS` includes website URL(s)
- [ ] `ALLOWED_ORIGINS` includes `capacitor://localhost`
- [ ] `FRONTEND_URL` set to production website
- [ ] `NODE_ENV=production`
- [ ] Production Razorpay keys configured
- [ ] Production MongoDB URI configured
- [ ] Production Firebase credentials configured
- [ ] Mobile app configured with production backend URL
- [ ] Website can connect to backend
- [ ] Mobile app can connect to backend
- [ ] CORS working correctly
- [ ] Rate limiting appropriate for production

---

## 🆘 Troubleshooting

### CORS Errors

**Problem:** Website/mobile app getting CORS errors

**Solution:**
1. Check `ALLOWED_ORIGINS` includes correct URLs
2. Verify website is using HTTPS (if backend is HTTPS)
3. Check backend logs for origin being rejected

### Mobile App Can't Connect

**Problem:** Mobile app can't reach backend

**Solution:**
1. Verify mobile app has correct `API_URL`
2. Check backend is accessible (test with curl)
3. Verify `capacitor://localhost` is in `ALLOWED_ORIGINS`
4. Check firewall/security groups allow connections

### Website Works but Mobile App Doesn't

**Problem:** Website works, mobile app fails

**Solution:**
1. Ensure `capacitor://localhost` is in `ALLOWED_ORIGINS`
2. Check mobile app API_URL is correct
3. Verify mobile app sends proper headers
4. Check backend logs for mobile app requests

