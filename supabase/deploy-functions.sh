#!/bin/bash

# =====================================================
# SCRIPT DEPLOY SUPABASE EDGE FUNCTIONS
# =====================================================
# Script untuk deploy Edge Functions ke Supabase
# =====================================================

echo "🚀 Deploying Supabase Edge Functions..."

# Check if supabase CLI is installed
if ! command -v supabase &> /dev/null; then
    echo "❌ Supabase CLI not found. Please install it first:"
    echo "   npm install -g supabase"
    echo "   Or visit: https://supabase.com/docs/guides/cli"
    exit 1
fi

# Check if user is logged in
if ! supabase projects list &> /dev/null; then
    echo "❌ Not logged in to Supabase CLI. Please run:"
    echo "   supabase login"
    exit 1
fi

# Get project reference
echo "📋 Available projects:"
supabase projects list

echo ""
read -p "Enter your project reference ID: " PROJECT_REF

if [ -z "$PROJECT_REF" ]; then
    echo "❌ Project reference is required"
    exit 1
fi

echo ""
echo "🔧 Deploying Edge Functions..."

# Deploy create-user function
echo "📤 Deploying create-user function..."
if supabase functions deploy create-user --project-ref $PROJECT_REF; then
    echo "✅ create-user function deployed successfully"
else
    echo "❌ Failed to deploy create-user function"
    exit 1
fi

# Deploy delete-user function
echo "📤 Deploying delete-user function..."
if supabase functions deploy delete-user --project-ref $PROJECT_REF; then
    echo "✅ delete-user function deployed successfully"
else
    echo "❌ Failed to deploy delete-user function"
    exit 1
fi

echo ""
echo "🎉 All Edge Functions deployed successfully!"
echo ""
echo "📝 Next steps:"
echo "1. Go to Supabase Dashboard > Edge Functions > Settings"
echo "2. Add environment variables:"
echo "   - SUPABASE_URL: https://your-project.supabase.co"
echo "   - SUPABASE_SERVICE_ROLE_KEY: (from Settings > API)"
echo "3. Test the functions in your app"
echo ""
echo "🔗 Dashboard URL: https://supabase.com/dashboard/project/$PROJECT_REF/functions"