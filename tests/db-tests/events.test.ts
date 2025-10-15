import request from 'supertest';
import app from '../../server/server/app';
import { DatabaseTestHelpers } from '../helpers/databaseHelpers';
import { testUsers, testEvents, testLocations, testAttendees } from '../helpers/testData';
import { AttendeeRole } from '@prisma/client';

describe('Events API Database Integration', () => {
  let testData: any;
  let testUserIds: string[] = [];
  let testLocationId: string;
  let testEventId: string;

  beforeAll(async () => {
    await DatabaseTestHelpers.cleanupDatabase();
    testData = await DatabaseTestHelpers.seedTestData();
    testUserIds = testData.users.map((user: any) => user.id);
    testLocationId = testData.location.id;
  });

  afterAll(async () => {
    await DatabaseTestHelpers.cleanupDatabase();
  });

  describe('GET /locations', () => {
    it('should fetch all locations from database', async () => {
      const response = await request(app)
        .get('/locations')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      expect(response.body.length).toBeGreaterThan(0);
      
      const location = response.body[0];
      expect(location).toHaveProperty('id');
      expect(location).toHaveProperty('name');
      expect(location).toHaveProperty('lat');
      expect(location).toHaveProperty('long');
      expect(location).toHaveProperty('address');
    });
  });

  describe('POST /addEvent', () => {
    it('should create a new event in database', async () => {
      const eventData = {
        ...testEvents.event1,
        location: { id: testLocationId }
      };

      const response = await request(app)
        .post('/addEvent')
        .send(eventData)
        .expect(201);

      expect(response.body).toMatchObject({
        title: eventData.title,
        description: eventData.description
      });
      expect(response.body).toHaveProperty('id');
      expect(response.body).toHaveProperty('startDate');
      expect(response.body).toHaveProperty('endDate');
      expect(response.body).toHaveProperty('location');
      expect(response.body).toHaveProperty('attendees');

      testEventId = response.body.id;
    });

    it('should handle invalid location ID', async () => {
      const invalidEventData = {
        ...testEvents.event1,
        location: { id: 'non-existent-location-id' }
      };

      const response = await request(app)
        .post('/addEvent')
        .send(invalidEventData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('GET /allEvents', () => {
    it('should fetch all events from database', async () => {
      const response = await request(app)
        .get('/allEvents')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      if (response.body.length > 0) {
        const event = response.body[0];
        expect(event).toHaveProperty('id');
        expect(event).toHaveProperty('title');
        expect(event).toHaveProperty('description');
        expect(event).toHaveProperty('startDate');
        expect(event).toHaveProperty('endDate');
        expect(event).toHaveProperty('location');
        expect(event).toHaveProperty('attendees');
      }
    });
  });

  describe('GET /events', () => {
    it('should fetch upcoming events from database', async () => {
      const response = await request(app)
        .get('/events')
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // All returned events should be upcoming (endDate >= now)
      response.body.forEach((event: any) => {
        const endDate = new Date(event.endDate);
        const now = new Date();
        expect(endDate.getTime()).toBeGreaterThanOrEqual(now.getTime());
      });
    });
  });

  describe('POST /addAttendee', () => {
    it('should add an attendee to an event', async () => {
      const attendeeData = {
        attendee: {
          ...testAttendees.attendee1,
          userId: testUserIds[0]
        },
        eventId: testEventId
      };

      const response = await request(app)
        .post('/addAttendee')
        .send(attendeeData)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify the attendee was added by checking the event
      const event = response.body.find((e: any) => e.id === testEventId);
      expect(event).toBeDefined();
      expect(event.attendees).toBeDefined();
      expect(event.attendees.length).toBeGreaterThan(0);
    });

    it('should update existing attendee role', async () => {
      const updateAttendeeData = {
        attendee: {
          ...testAttendees.attendee1,
          userId: testUserIds[0],
          role: AttendeeRole.seller
        },
        eventId: testEventId
      };

      const response = await request(app)
        .post('/addAttendee')
        .send(updateAttendeeData)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle non-existent event ID', async () => {
      const invalidAttendeeData = {
        attendee: {
          ...testAttendees.attendee1,
          userId: testUserIds[0]
        },
        eventId: 'non-existent-event-id'
      };

      const response = await request(app)
        .post('/addAttendee')
        .send(invalidAttendeeData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /removeAttendee', () => {
    it('should remove an attendee from an event', async () => {
      const removeAttendeeData = {
        userId: testUserIds[0],
        eventId: testEventId
      };

      const response = await request(app)
        .delete('/removeAttendee')
        .send(removeAttendeeData)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
    });

    it('should handle non-existent attendee', async () => {
      const removeAttendeeData = {
        userId: 'non-existent-user-id',
        eventId: testEventId
      };

      const response = await request(app)
        .delete('/removeAttendee')
        .send(removeAttendeeData)
        .expect(404);

      expect(response.body).toHaveProperty('error', 'Attendee not found');
    });
  });

  describe('POST /updateEvent', () => {
    it('should update an existing event', async () => {
      const updateEventData = {
        id: testEventId,
        title: 'Updated Test Event',
        description: 'Updated test event description',
        startDate: testEvents.event1.startDate,
        endDate: testEvents.event1.endDate,
        location: { id: testLocationId }
      };

      const response = await request(app)
        .post('/updateEvent')
        .send(updateEventData)
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      const updatedEvent = response.body.find((e: any) => e.id === testEventId);
      expect(updatedEvent).toBeDefined();
      expect(updatedEvent.title).toBe(updateEventData.title);
    });

    it('should handle non-existent event ID', async () => {
      const invalidUpdateData = {
        id: 'non-existent-event-id',
        title: 'Updated Test Event',
        description: 'Updated test event description',
        startDate: testEvents.event1.startDate,
        endDate: testEvents.event1.endDate,
        location: { id: testLocationId }
      };

      const response = await request(app)
        .post('/updateEvent')
        .send(invalidUpdateData)
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });

  describe('DELETE /deleteEvent', () => {
    it('should delete an event', async () => {
      // First create an event to delete
      const eventToDelete = {
        ...testEvents.event1,
        title: 'Event to Delete',
        location: { id: testLocationId }
      };

      const createResponse = await request(app)
        .post('/addEvent')
        .send(eventToDelete);

      const eventIdToDelete = createResponse.body.id;

      const response = await request(app)
        .delete('/deleteEvent')
        .send({ id: eventIdToDelete })
        .expect(200);

      expect(Array.isArray(response.body)).toBe(true);
      
      // Verify the event was deleted
      const deletedEvent = response.body.find((e: any) => e.id === eventIdToDelete);
      expect(deletedEvent).toBeUndefined();
    });

    it('should handle non-existent event ID', async () => {
      const response = await request(app)
        .delete('/deleteEvent')
        .send({ id: 'non-existent-event-id' })
        .expect(400);

      expect(response.body).toHaveProperty('error');
    });
  });
});
