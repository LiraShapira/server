import request from 'supertest';
import app from '../../server/server/app';
import { DatabaseTestHelpers } from '../helpers/databaseHelpers';
import { testUsers, testCompostStands } from '../helpers/testData';

describe('Compost Stand Admins API Database Integration', () => {
  let testData: any;
  let testUserIds: string[] = [];

  beforeAll(async () => {
    await DatabaseTestHelpers.cleanupDatabase();
    testData = await DatabaseTestHelpers.seedTestData();
    testUserIds = testData.users.map((user: any) => user.id);
  });

  afterAll(async () => {
    await DatabaseTestHelpers.cleanupDatabase();
  });

  describe('GET /getAllCompostStandAdmins', () => {
    it('should fetch all compost stand admins from database', async () => {
      const response = await request(app)
        .get('/getAllCompostStandAdmins')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // If there are admins, verify structure
      if (response.body.length > 0) {
        const admin = response.body[0];
        expect(admin).toHaveProperty('id');
        expect(admin).toHaveProperty('firstName');
        expect(admin).toHaveProperty('lastName');
        expect(admin).toHaveProperty('phoneNumber');
      }
    });
  });

  describe('POST /addCompostStandAdmin', () => {
    it('should add a user as compost stand admin', async () => {
      const addAdminData = {
        userId: testUserIds[0],
        compostStandId: testCompostStands.stand1.compostStandId
      };

      const response = await request(app)
        .post('/addCompostStandAdmin')
        .send(addAdminData)
        .expect(201);

      expect(response.body).toHaveProperty('compostStandId', testCompostStands.stand1.compostStandId);
      expect(response.body).toHaveProperty('name', testCompostStands.stand1.name);
    });

    it('should handle non-existent compost stand', async () => {
      const invalidAddAdminData = {
        userId: testUserIds[0],
        compostStandId: 99999 // Non-existent
      };

      const response = await request(app)
        .post('/addCompostStandAdmin')
        .send(invalidAddAdminData)
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should handle non-existent user', async () => {
      const invalidAddAdminData = {
        userId: 'non-existent-user-id',
        compostStandId: testCompostStands.stand1.compostStandId
      };

      const response = await request(app)
        .post('/addCompostStandAdmin')
        .send(invalidAddAdminData)
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /removeCompostStandAdmin', () => {
    it('should remove a user from compost stand admins', async () => {
      // First add an admin
      const addAdminData = {
        userId: testUserIds[1],
        compostStandId: testCompostStands.stand2.compostStandId
      };

      await request(app)
        .post('/addCompostStandAdmin')
        .send(addAdminData);

      // Then remove the admin
      const removeAdminData = {
        userId: testUserIds[1],
        compostStandId: testCompostStands.stand2.compostStandId
      };

      const response = await request(app)
        .post('/removeCompostStandAdmin')
        .send(removeAdminData)
        .expect(201);

      expect(response.body).toHaveProperty('compostStandId', testCompostStands.stand2.compostStandId);
    });

    it('should handle removing non-admin user', async () => {
      const removeNonAdminData = {
        userId: testUserIds[2], // User who is not an admin
        compostStandId: testCompostStands.stand1.compostStandId
      };

      const response = await request(app)
        .post('/removeCompostStandAdmin')
        .send(removeNonAdminData)
        .expect(400);

      expect(response.body).toBeDefined();
    });

    it('should handle non-existent compost stand', async () => {
      const invalidRemoveAdminData = {
        userId: testUserIds[0],
        compostStandId: 99999 // Non-existent
      };

      const response = await request(app)
        .post('/removeCompostStandAdmin')
        .send(invalidRemoveAdminData)
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('Integration: Add and Remove Admin Flow', () => {
    it('should successfully add and then remove an admin', async () => {
      const testUserId = testUserIds[2];
      const testStandId = testCompostStands.stand2.compostStandId;

      // Add admin
      const addResponse = await request(app)
        .post('/addCompostStandAdmin')
        .send({
          userId: testUserId,
          compostStandId: testStandId
        })
        .expect(201);

      expect(addResponse.body).toHaveProperty('compostStandId', testStandId);

      // Verify admin was added by fetching all admins
      const adminsResponse = await request(app)
        .get('/getAllCompostStandAdmins')
        .expect(200);

      const addedAdmin = adminsResponse.body.find((admin: any) => admin.id === testUserId);
      expect(addedAdmin).toBeDefined();

      // Remove admin
      const removeResponse = await request(app)
        .post('/removeCompostStandAdmin')
        .send({
          userId: testUserId,
          compostStandId: testStandId
        })
        .expect(201);

      expect(removeResponse.body).toHaveProperty('compostStandId', testStandId);

      // Verify admin was removed
      const adminsAfterRemoveResponse = await request(app)
        .get('/getAllCompostStandAdmins')
        .expect(200);

      const removedAdmin = adminsAfterRemoveResponse.body.find((admin: any) => admin.id === testUserId);
      expect(removedAdmin).toBeUndefined();
    });
  });
});
