# Database Integration Tests

This directory contains comprehensive tests to verify that your new Supabase database is working properly with all API endpoints.

## Overview

The test suite covers all major database interactions across your server:

- **Health Check Tests** - Verify database connectivity
- **Users API Tests** - Test user CRUD operations
- **Compost Stands API Tests** - Test compost stand management
- **Transactions API Tests** - Test transaction processing and deposits
- **Events API Tests** - Test event management and attendee handling
- **Compost Stand Admins API Tests** - Test admin role management
- **Twilio API Tests** - Test Twilio integration (non-database)

## Prerequisites

1. **Environment Variables**: Ensure your `.env` file contains:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_supabase_anon_key
   DATABASE_URL=your_database_url
   ```

2. **Dependencies**: Install test dependencies:
   ```bash
   npm install
   ```

## Running Tests

### Run All Database Tests
```bash
npm run test:db
```

### Run Individual Test Suites
```bash
# Health check tests
npm run test -- --testPathPattern=health-check.test.ts

# Users API tests
npm run test -- --testPathPattern=users.test.ts

# Compost stands tests
npm run test -- --testPathPattern=compost-stands.test.ts

# Transactions tests
npm run test -- --testPathPattern=transactions.test.ts

# Events tests
npm run test -- --testPathPattern=events.test.ts

# Compost stand admins tests
npm run test -- --testPathPattern=compost-stand-admins.test.ts

# Twilio tests
npm run test -- --testPathPattern=twilio.test.ts
```

### Run with Coverage
```bash
npm run test:coverage
```

### Run in Watch Mode
```bash
npm run test:watch
```

## Test Structure

### Test Files
- `db-tests/health-check.test.ts` - Database connectivity tests
- `db-tests/users.test.ts` - User management tests
- `db-tests/compost-stands.test.ts` - Compost stand tests
- `db-tests/transactions.test.ts` - Transaction and deposit tests
- `db-tests/events.test.ts` - Event management tests
- `db-tests/compost-stand-admins.test.ts` - Admin role tests
- `db-tests/twilio.test.ts` - Twilio integration tests

### Helper Files
- `helpers/testData.ts` - Test data fixtures
- `helpers/databaseHelpers.ts` - Database utility functions
- `setup.ts` - Global test setup
- `run-db-tests.ts` - Test runner script

## What the Tests Verify

### Database Connectivity
- ✅ Health check endpoint responds correctly
- ✅ Database connection is established
- ✅ Basic queries execute successfully

### User Management
- ✅ Create new users
- ✅ Fetch users by phone number
- ✅ Handle duplicate phone numbers
- ✅ User ID lookup by phone number

### Compost Stand Management
- ✅ Create and fetch compost stands
- ✅ Set user local compost stands
- ✅ Fetch compost reports
- ✅ Generate statistics

### Transaction Processing
- ✅ Create transactions
- ✅ Handle request/response flow
- ✅ Process deposits with compost reports
- ✅ Update user balances
- ✅ Generate transaction statistics

### Event Management
- ✅ Create and manage events
- ✅ Add/remove attendees
- ✅ Update event details
- ✅ Fetch upcoming events
- ✅ Location management

### Admin Role Management
- ✅ Add/remove compost stand admins
- ✅ Verify admin permissions
- ✅ Handle role conflicts

## Test Data Management

The tests use a clean database approach:
- Each test suite cleans up before and after running
- Test data is seeded for each test run
- Foreign key constraints are respected during cleanup

## Troubleshooting

### Common Issues

1. **Environment Variables Missing**
   ```
   Error: Missing required environment variables
   ```
   - Ensure your `.env` file contains all required variables
   - Check that variable names match exactly

2. **Database Connection Failed**
   ```
   Database health check failed
   ```
   - Verify your Supabase URL and keys are correct
   - Check that your database is accessible
   - Ensure your IP is whitelisted in Supabase

3. **Test Timeouts**
   ```
   Timeout - Async callback was not invoked
   ```
   - Increase timeout in `jest.config.js` if needed
   - Check database performance
   - Verify network connectivity

4. **Foreign Key Constraint Errors**
   ```
   Foreign key constraint failed
   ```
   - Tests should handle this automatically
   - Check that cleanup order is correct
   - Verify test data relationships

### Debug Mode

Run tests with verbose output:
```bash
npm run test -- --verbose
```

### Database State

If tests fail due to database state:
1. Check the cleanup functions in `databaseHelpers.ts`
2. Manually clean the database if needed
3. Verify test data doesn't conflict with existing data

## Contributing

When adding new tests:
1. Follow the existing test structure
2. Use the helper functions in `databaseHelpers.ts`
3. Add test data to `testData.ts`
4. Ensure proper cleanup in `beforeAll`/`afterAll`
5. Test both success and error cases

## Notes

- Tests are designed to run against your actual Supabase database
- Each test run cleans up after itself
- Tests verify both API responses and database state
- Some endpoints return 501 (not implemented) - this is expected for unmigrated endpoints
