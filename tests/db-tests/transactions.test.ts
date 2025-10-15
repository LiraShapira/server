import request from 'supertest';
import app from '../../server/server/app';
import { DatabaseTestHelpers } from '../helpers/databaseHelpers';
import { testUsers, testTransactions, testDeposits } from '../helpers/testData';
import { Category } from '@prisma/client';

describe('Transactions API Database Integration', () => {
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

  describe('GET /transactions', () => {
    it('should fetch all transactions from database', async () => {
      const response = await request(app)
        .get('/transactions')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // If there are transactions, verify structure
      if (response.body.length > 0) {
        const transaction = response.body[0];
        expect(transaction).toHaveProperty('id');
        expect(transaction).toHaveProperty('amount');
        expect(transaction).toHaveProperty('category');
        expect(transaction).toHaveProperty('createdAt');
        expect(transaction).toHaveProperty('purchaserId');
        expect(transaction).toHaveProperty('recipientId');
        expect(transaction).toHaveProperty('reason');
        expect(transaction).toHaveProperty('isRequest');
      }
    });
  });

  describe('POST /saveTransaction', () => {
    it('should create a new transaction in database', async () => {
      const transactionData = {
        ...testTransactions.transaction1,
        purchaserId: testUserIds[0],
        recipientPhoneNumber: testUsers.user2.phoneNumber
      };

      const response = await request(app)
        .post('/saveTransaction')
        .send(transactionData)
        .expect(201);

      expect(response.body).toMatchObject({
        category: transactionData.category,
        amount: transactionData.amount.toString(),
        purchaserId: transactionData.purchaserId,
        reason: transactionData.reason,
        isRequest: transactionData.isRequest
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('createdAt');
      expect(response.body).toHaveProperty('users');
    });

    it('should handle request transaction', async () => {
      const requestTransaction = {
        ...testTransactions.transaction2,
        purchaserId: testUserIds[1],
        recipientPhoneNumber: testUsers.user3.phoneNumber,
        isRequest: true
      };

      const response = await request(app)
        .post('/saveTransaction')
        .send(requestTransaction)
        .expect(201);

      expect(response.body.isRequest).toBe(true);
      expect(response.body).toHaveProperty('id');
    });

    it('should handle non-existent recipient phone number', async () => {
      const invalidTransaction = {
        ...testTransactions.transaction1,
        purchaserId: testUserIds[0],
        recipientPhoneNumber: '+9999999999' // Non-existent
      };

      const response = await request(app)
        .post('/saveTransaction')
        .send(invalidTransaction)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('POST /deposit', () => {
    it('should create a deposit transaction and compost report', async () => {
      const depositData = {
        ...testDeposits.deposit1,
        userId: testUserIds[0]
      };

      const response = await request(app)
        .post('/deposit')
        .send(depositData)
        .expect(201);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const transaction = response.body[0];
      expect(transaction).toMatchObject({
        category: Category.DEPOSIT,
        amount: depositData.compostReport.depositWeight.toString(),
        reason: 'Deposit'
      });
      expect(transaction).toHaveProperty('id');
      expect(transaction).toHaveProperty('users');
    });

    it('should handle invalid user ID', async () => {
      const invalidDeposit = {
        ...testDeposits.deposit1,
        userId: 'non-existent-id'
      };

      const response = await request(app)
        .post('/deposit')
        .send(invalidDeposit)
        .expect(400);

      expect(response.body).toBeDefined();
    });
  });

  describe('PUT /handleRequest', () => {
    let requestTransactionId: string;

    beforeAll(async () => {
      // Create a request transaction for testing
      const requestData = {
        ...testTransactions.transaction1,
        purchaserId: testUserIds[0],
        recipientPhoneNumber: testUsers.user2.phoneNumber,
        isRequest: true
      };

      const response = await request(app)
        .post('/saveTransaction')
        .send(requestData);

      requestTransactionId = response.body.id;
    });

    it('should accept a request transaction', async () => {
      const handleRequestData = {
        transaction: {
          id: requestTransactionId,
          recipientId: testUserIds[1],
          purchaserId: testUserIds[0],
          amount: testTransactions.transaction1.amount
        },
        isRequestAccepted: true
      };

      const response = await request(app)
        .put('/handleRequest')
        .send(handleRequestData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: requestTransactionId,
        isRequest: false
      });
    });

    it('should reject a request transaction', async () => {
      // Create another request transaction
      const requestData = {
        ...testTransactions.transaction2,
        purchaserId: testUserIds[1],
        recipientPhoneNumber: testUsers.user3.phoneNumber,
        isRequest: true
      };

      const createResponse = await request(app)
        .post('/saveTransaction')
        .send(requestData);

      const handleRequestData = {
        transaction: {
          id: createResponse.body.id,
          recipientId: testUserIds[2],
          purchaserId: testUserIds[1],
          amount: testTransactions.transaction2.amount
        },
        isRequestAccepted: false
      };

      const response = await request(app)
        .put('/handleRequest')
        .send(handleRequestData)
        .expect(201);

      expect(response.body).toMatchObject({
        id: createResponse.body.id,
        isRequest: false
      });
    });
  });

  describe('GET /transactionStats', () => {
    it('should return transaction statistics', async () => {
      const response = await request(app)
        .get('/transactionStats')
        .expect(200);

      expect(response.body).toHaveProperty('transactionAmountByCategory');
      expect(Array.isArray(response.body.transactionAmountByCategory)).toBe(true);
    });

    it('should accept period query parameter', async () => {
      const response = await request(app)
        .get('/transactionStats?period=7')
        .expect(200);

      expect(response.body).toHaveProperty('transactionAmountByCategory');
    });
  });
});
