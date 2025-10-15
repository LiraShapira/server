import request from 'supertest';
import app from '../../server/server/app';
import { DatabaseTestHelpers } from '../helpers/databaseHelpers';
import { testCompostStands, testUsers } from '../helpers/testData';

describe('Compost Stands API Database Integration', () => {
  let testData: any;

  beforeAll(async () => {
    await DatabaseTestHelpers.cleanupDatabase();
    testData = await DatabaseTestHelpers.seedTestData();
  });

  afterAll(async () => {
    await DatabaseTestHelpers.cleanupDatabase();
  });

  describe('GET /compostStands', () => {
    it('should fetch all compost stands from database', async () => {
      const response = await request(app)
        .get('/compostStands')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThanOrEqual(2); // Our test stands
      
      // Verify compost stand structure
      const stand = response.body[0];
      expect(stand).toHaveProperty('compostStandId');
      expect(stand).toHaveProperty('name');
      expect(stand).toHaveProperty('reports');
      expect(stand).toHaveProperty('admins');
    });
  });

  describe('POST /compostStand', () => {
    it('should create a new compost stand in database', async () => {
      const newStand = {
        compostStandId: 999,
        name: 'New Test Stand'
      };

      const response = await request(app)
        .post('/compostStand')
        .send(newStand)
        .expect(200);

      expect(response.body).toMatchObject({
        compostStandId: newStand.compostStandId,
        name: newStand.name
      });
    });

    it('should handle duplicate compost stand ID error', async () => {
      const duplicateStand = {
        compostStandId: testCompostStands.stand1.compostStandId, // Already exists
        name: 'Duplicate Stand'
      };

      const response = await request(app)
        .post('/compostStand')
        .send(duplicateStand)
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('POST /setUsersLocalStand', () => {
    it('should update user local compost stand', async () => {
      const user = testData.users[0];
      const stand = testData.stands[0];

      const response = await request(app)
        .post('/setUsersLocalStand')
        .send({
          userId: user.id,
          compostStandId: stand.compostStandId
        })
        .expect(201);

      expect(response.body).toMatchObject({
        id: user.id,
        userLocalCompostStandId: stand.compostStandId
      });
    });

    it('should handle non-existent user error', async () => {
      const response = await request(app)
        .post('/setUsersLocalStand')
        .send({
          userId: 'non-existent-id',
          compostStandId: testCompostStands.stand1.compostStandId
        })
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('GET /getCompostReports', () => {
    it('should fetch compost reports from database', async () => {
      const response = await request(app)
        .get('/getCompostReports')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // If there are reports, verify structure
      if (response.body.length > 0) {
        const report = response.body[0];
        expect(report).toHaveProperty('compostReportId');
        expect(report).toHaveProperty('compostStandId');
        expect(report).toHaveProperty('depositWeight');
        expect(report).toHaveProperty('date');
        expect(report).toHaveProperty('compostStand');
        expect(report).toHaveProperty('user');
      }
    });
  });

  describe('GET /compostStandStats', () => {
    it('should return compost stand statistics', async () => {
      const response = await request(app)
        .get('/compostStandStats')
        .expect(200);

      expect(response.body).toHaveProperty('depositsWeightsByStands');
      expect(response.body).toHaveProperty('period');
      expect(response.body).toHaveProperty('totalDeposits');
      expect(Array.isArray(response.body.depositsWeightsByStands)).toBe(true);
    });

    it('should accept period query parameter', async () => {
      const response = await request(app)
        .get('/compostStandStats?period=7')
        .expect(200);

      expect(response.body.period).toBe(7);
    });
  });

  describe('GET /monthlyCompostStandStats', () => {
    it('should return monthly compost stand statistics', async () => {
      const response = await request(app)
        .get('/monthlyCompostStandStats')
        .expect(200);

      expect(response.body).toHaveProperty('reportsByMonth');
      expect(typeof response.body.reportsByMonth).toBe('object');
    });
  });

  describe('GET /compostReportStats', () => {
    it('should return compost report statistics', async () => {
      const response = await request(app)
        .get('/compostReportStats')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should accept period query parameter', async () => {
      const response = await request(app)
        .get('/compostReportStats?period=14')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });
  });
});
