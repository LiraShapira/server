import request from 'supertest';
import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

// Import the router directly
import router from '../../server/router';

// Create a simple app for testing
const app = express();
app.use(cors());
app.use(express.json());
app.use(router);

describe('Simple Deposit Test', () => {
  it('should test deposit endpoint structure', async () => {
    // Test with minimal data to see what error we get
    const depositData = {
      userId: 'test-user-id',
      compostReport: {
        depositWeight: 2.5,
        compostStand: 'Test Stand 1'
      }
    };

    const response = await request(app)
      .post('/deposit')
      .send(depositData);

    console.log('Deposit test response status:', response.status);
    console.log('Deposit test response body:', response.body);
    
    // We expect this to fail, but we want to see the error
    expect(response.status).toBeGreaterThanOrEqual(400);
  });

  it('should test health endpoint', async () => {
    const response = await request(app)
      .get('/health');

    console.log('Health check response status:', response.status);
    console.log('Health check response body:', response.body);
    
    expect([200, 503]).toContain(response.status);
  });
});
