# Google OAuth Setup Guide

To enable "Sign in with Google" in WorkForceHub:

## Step 1: Create Google OAuth Credentials

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select an existing one
3. Navigate to **APIs & Services** → **Credentials**
4. Click **Create Credentials** → **OAuth client ID**
5. If prompted, configure the OAuth consent screen:
   - User Type: **External** (for testing) or **Internal** (for organization only)
   - App name: **WorkForceHub**
   - Add your email as developer contact
   - Save and continue
6. Create OAuth client ID:
   - Application type: **Web application**
   - Name: **WorkForceHub**
   - Authorized redirect URIs: Add:
     - `http://127.0.0.1:8000/api/v1/auth/google/callback`
     - `http://localhost:8000/api/v1/auth/google/callback` (for local dev)
7. Click **Create** and copy the **Client ID** and **Client Secret**

## Step 2: Configure Backend

Add to your `backend/.env` file:

```
GOOGLE_CLIENT_ID=your-client-id.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://127.0.0.1:8000/api/v1/auth/google/callback
```

## Step 3: Restart Backend

```cmd
cd backend
venv\Scripts\activate
uvicorn main:app --reload
```

## Step 4: Test

1. Open http://localhost:3000
2. Click **Sign in with Google**
3. You will be redirected to Google to sign in
4. After approval, you'll be redirected back and logged in

## Production Setup

For production:
1. Update **Authorized redirect URIs** in Google Console with your production URL
2. Update `GOOGLE_REDIRECT_URI` in .env
3. Add your production frontend URL to CORS_ORIGINS
