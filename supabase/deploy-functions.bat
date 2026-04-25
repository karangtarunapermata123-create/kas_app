@echo off
REM =====================================================
REM SCRIPT DEPLOY SUPABASE EDGE FUNCTIONS (WINDOWS)
REM =====================================================
REM Script untuk deploy Edge Functions ke Supabase di Windows
REM =====================================================

echo 🚀 Deploying Supabase Edge Functions...

REM Check if supabase CLI is installed
supabase --version >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Supabase CLI not found. Please install it first:
    echo    npm install -g supabase
    echo    Or visit: https://supabase.com/docs/guides/cli
    pause
    exit /b 1
)

REM Check if user is logged in
supabase projects list >nul 2>&1
if %errorlevel% neq 0 (
    echo ❌ Not logged in to Supabase CLI. Please run:
    echo    supabase login
    pause
    exit /b 1
)

REM Get project reference
echo 📋 Available projects:
supabase projects list

echo.
set /p PROJECT_REF=Enter your project reference ID: 

if "%PROJECT_REF%"=="" (
    echo ❌ Project reference is required
    pause
    exit /b 1
)

echo.
echo 🔧 Deploying Edge Functions...

REM Deploy create-user function
echo 📤 Deploying create-user function...
supabase functions deploy create-user --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy create-user function
    pause
    exit /b 1
)
echo ✅ create-user function deployed successfully

REM Deploy delete-user function
echo 📤 Deploying delete-user function...
supabase functions deploy delete-user --project-ref %PROJECT_REF%
if %errorlevel% neq 0 (
    echo ❌ Failed to deploy delete-user function
    pause
    exit /b 1
)
echo ✅ delete-user function deployed successfully

echo.
echo 🎉 All Edge Functions deployed successfully!
echo.
echo 📝 Next steps:
echo 1. Go to Supabase Dashboard ^> Edge Functions ^> Settings
echo 2. Add environment variables:
echo    - SUPABASE_URL: https://your-project.supabase.co
echo    - SUPABASE_SERVICE_ROLE_KEY: (from Settings ^> API)
echo 3. Test the functions in your app
echo.
echo 🔗 Dashboard URL: https://supabase.com/dashboard/project/%PROJECT_REF%/functions

pause