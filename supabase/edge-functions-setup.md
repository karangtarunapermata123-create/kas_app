# Edge Functions Setup Guide

## ✅ Deployment Status
Both Edge Functions have been successfully deployed:
- ✅ `create-user` - Deployed
- ✅ `delete-user` - Deployed

## 🔧 Environment Variables Setup

You need to set up environment variables in the Supabase Dashboard:

### 1. Go to Supabase Dashboard
Visit: https://supabase.com/dashboard/project/dtqilxwiezlrtneoaxdb/functions

### 2. Navigate to Edge Functions Settings
- Click on "Edge Functions" in the left sidebar
- Click on "Settings" tab
- Scroll down to "Environment Variables" section

### 3. Add Required Environment Variables

Add these two environment variables:

**SUPABASE_URL**
```
https://dtqilxwiezlrtneoaxdb.supabase.co
```

**SUPABASE_SERVICE_ROLE_KEY**
- Go to Settings > API in your Supabase Dashboard
- Copy the `service_role` key (NOT the `anon` key)
- This key has admin privileges and should be kept secret

## 🧪 Testing the Functions

### Test Create User Function
```bash
curl -X POST https://dtqilxwiezlrtneoaxdb.supabase.co/functions/v1/create-user \
  -H "Authorization: Bearer YOUR_USER_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "namaLengkap": "Test User"
  }'
```

### Test Delete User Function
```bash
curl -X POST https://dtqilxwiezlrtneoaxdb.supabase.co/functions/v1/delete-user \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "userId": "user-id-to-delete"
  }'
```

## 📱 App Integration

The functions are now available at:
- Create User: `https://dtqilxwiezlrtneoaxdb.supabase.co/functions/v1/create-user`
- Delete User: `https://dtqilxwiezlrtneoaxdb.supabase.co/functions/v1/delete-user`

Your app should already be configured to use these endpoints in `app/admin/kelola-anggota.tsx`.

## 🔒 Security Notes

1. **Service Role Key**: Keep this secret and never expose it in client-side code
2. **Admin Only**: Both functions verify that the caller has admin role
3. **CORS**: Functions are configured to allow cross-origin requests from your app
4. **Token Validation**: Functions validate the Authorization header

## 🐛 Troubleshooting

If you encounter issues:

1. **Check Environment Variables**: Make sure both `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set correctly
2. **Check Admin Role**: Ensure your user has `role = 'admin'` in the profiles table
3. **Check Token**: Make sure you're passing a valid Bearer token in the Authorization header
4. **Check Logs**: View function logs in the Supabase Dashboard > Edge Functions > Logs

## 📋 Next Steps

1. ✅ Functions deployed
2. ⏳ Set environment variables in Dashboard
3. ⏳ Test create account functionality in your app
4. ⏳ Test delete account functionality in your app