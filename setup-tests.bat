@echo off
REM Database Integration Test Setup Script for Windows
REM This script sets up the testing environment and runs the database integration tests

echo 🔧 Setting up Database Integration Tests...

REM Check if we're in the right directory
if not exist "package.json" (
    echo ❌ Error: Please run this script from the server directory
    pause
    exit /b 1
)

REM Install dependencies
echo 📦 Installing test dependencies...
call npm install
if errorlevel 1 (
    echo ❌ Error: Failed to install dependencies
    pause
    exit /b 1
)

REM Check if .env file exists
if not exist ".env" (
    echo ⚠️  Warning: .env file not found
    echo Please create a .env file with your Supabase configuration:
    echo   SUPABASE_URL=your_supabase_url
    echo   SUPABASE_ANON_KEY=your_supabase_anon_key
    echo   DATABASE_URL=your_database_url
    echo.
    echo You can use env.test.example as a template
    pause
    exit /b 1
)

echo ✅ Environment file found

REM Run the tests
echo 🧪 Running database integration tests...
echo.

REM Run the test runner script
if exist "tests\run-db-tests.ts" (
    call npx ts-node tests/run-db-tests.ts
) else (
    REM Fallback to npm test
    call npm run test:db
)

echo.
echo 🎉 Test setup and execution completed!
pause
