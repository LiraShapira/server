import dotenv from 'dotenv';

// Load environment variables for testing
dotenv.config({ path: '.env.test' });

// Global test setup
beforeAll(async () => {
  // Any global setup can go here
  console.log('Setting up test environment...');
});

afterAll(async () => {
  // Any global cleanup can go here
  console.log('Cleaning up test environment...');
});

// Increase timeout for database operations
jest.setTimeout(30000);
