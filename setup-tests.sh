#!/bin/bash

# Database Integration Test Setup Script
# This script sets up the testing environment and runs the database integration tests

set -e

echo "🔧 Setting up Database Integration Tests..."

# Check if we're in the right directory
if [ ! -f "package.json" ]; then
    echo "❌ Error: Please run this script from the server directory"
    exit 1
fi

# Install dependencies
echo "📦 Installing test dependencies..."
npm install

# Check if .env file exists
if [ ! -f ".env" ]; then
    echo "⚠️  Warning: .env file not found"
    echo "Please create a .env file with your Supabase configuration:"
    echo "  SUPABASE_URL=your_supabase_url"
    echo "  SUPABASE_ANON_KEY=your_supabase_anon_key"
    echo "  DATABASE_URL=your_database_url"
    echo ""
    echo "You can use env.test.example as a template"
    exit 1
fi

# Check required environment variables
echo "🔍 Checking environment variables..."
source .env

if [ -z "$SUPABASE_URL" ] || [ -z "$SUPABASE_ANON_KEY" ] || [ -z "$DATABASE_URL" ]; then
    echo "❌ Error: Missing required environment variables"
    echo "Please ensure your .env file contains:"
    echo "  SUPABASE_URL"
    echo "  SUPABASE_ANON_KEY"
    echo "  DATABASE_URL"
    exit 1
fi

echo "✅ Environment variables look good"

# Run the tests
echo "🧪 Running database integration tests..."
echo ""

# Run the test runner script
if [ -f "tests/run-db-tests.ts" ]; then
    npx ts-node tests/run-db-tests.ts
else
    # Fallback to npm test
    npm run test:db
fi

echo ""
echo "🎉 Test setup and execution completed!"
