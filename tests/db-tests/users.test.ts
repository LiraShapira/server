import request from 'supertest';
import app from '../../server/server/app';
import { DatabaseTestHelpers } from '../helpers/databaseHelpers';
import { testUsers } from '../helpers/testData';

describe('Users API Database Integration', () => {
  let testData: any;

  beforeAll(async () => {
    await DatabaseTestHelpers.cleanupDatabase();
    testData = await DatabaseTestHelpers.seedTestData();
  });

  afterAll(async () => {
    await DatabaseTestHelpers.cleanupDatabase();
  });

  describe('GET /users', () => {
    it('should fetch all users from database', async () => {
      const response = await request(app)
        .get('/users')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(3); // Our test users
      
      // Verify user structure
      const user = response.body[0];
      expect(user).toHaveProperty('id');
      expect(user).toHaveProperty('firstName');
      expect(user).toHaveProperty('lastName');
      expect(user).toHaveProperty('phoneNumber');
      expect(user).toHaveProperty('createdAt');
      expect(user).toHaveProperty('accountBalance');
    });
  });

  describe('POST /register', () => {
    it('should create a new user in database', async () => {
      const newUser = {
        firstName: 'Test',
        lastName: 'User',
        phoneNumber: '+1234567899',
        email: 'test.user@example.com'
      };

      const response = await request(app)
        .post('/register')
        .send(newUser)
        .expect(200);

      expect(response.body).toMatchObject({
        firstName: newUser.firstName,
        lastName: newUser.lastName,
        phoneNumber: newUser.phoneNumber,
        email: newUser.email
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('accountBalance');
    });

    it('should handle duplicate phone number error', async () => {
      const duplicateUser = {
        firstName: 'Duplicate',
        lastName: 'User',
        phoneNumber: testUsers.user1.phoneNumber, // Already exists
        email: 'duplicate@example.com'
      };

      const response = await request(app)
        .post('/register')
        .send(duplicateUser)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /user', () => {
    it('should fetch user by phone number from database', async () => {
      const response = await request(app)
        .post('/user')
        .send({ phoneNumber: testUsers.user1.phoneNumber })
        .expect(200);

      expect(response.body).toMatchObject({
        firstName: testUsers.user1.firstName,
        lastName: testUsers.user1.lastName,
        phoneNumber: testUsers.user1.phoneNumber
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('transactions');
    });

    it('should return 400 for non-existent user', async () => {
      const response = await request(app)
        .post('/user')
        .send({ phoneNumber: '+9999999999' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('POST /userIdByNumber', () => {
    it('should return user ID by phone number', async () => {
      const response = await request(app)
        .post('/userIdByNumber')
        .send({ phoneNumber: testUsers.user2.phoneNumber })
        .expect(200);

      expect(response.body).toHaveProperty('userId');
      expect(typeof response.body.userId).toBe('string');
    });

    it('should return 400 for non-existent user', async () => {
      const response = await request(app)
        .post('/userIdByNumber')
        .send({ phoneNumber: '+9999999999' })
        .expect(400);

      expect(response.body).toHaveProperty('error', 'User not found');
    });
  });

  describe('GET /userStats', () => {
    it('should return user statistics', async () => {
      const response = await request(app)
        .get('/userStats')
        .expect(501); // Currently not implemented

      expect(response.body).toHaveProperty('error');
    });
  });
});
