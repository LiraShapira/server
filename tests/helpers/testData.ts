import { Category, AttendeeRole, DRYMATTERPRESENT } from '@prisma/client';

export const testUsers = {
  user1: {
    firstName: 'John',
    lastName: 'Doe',
    phoneNumber: '+1234567890',
    email: 'john.doe@test.com'
  },
  user2: {
    firstName: 'Jane',
    lastName: 'Smith',
    phoneNumber: '+1234567891',
    email: 'jane.smith@test.com'
  },
  user3: {
    firstName: 'Bob',
    lastName: 'Johnson',
    phoneNumber: '+1234567892',
    email: 'bob.johnson@test.com'
  }
};

export const testCompostStands = {
  stand1: {
    compostStandId: 1,
    name: 'Test Stand 1'
  },
  stand2: {
    compostStandId: 2,
    name: 'Test Stand 2'
  }
};

export const testTransactions = {
  transaction1: {
    category: Category.GROCERIES,
    amount: 10.50,
    purchaserId: 'test-purchaser-id',
    recipientPhoneNumber: '+1234567891',
    reason: 'Test transaction',
    isRequest: false
  },
  transaction2: {
    category: Category.DEPOSIT,
    amount: 5.25,
    purchaserId: 'test-purchaser-id',
    recipientPhoneNumber: '+1234567892',
    reason: 'Test deposit',
    isRequest: false
  }
};

export const testDeposits = {
  deposit1: {
    userId: 'test-user-id',
    compostReport: {
      depositWeight: 2.5,
      dryMatter: true,
      notes: 'Test deposit notes',
      compostStand: 'Test Stand 1' as any,
      bugs: false,
      scalesProblem: false,
      full: false,
      cleanAndTidy: true,
      compostSmell: false
    }
  }
};

export const testEvents = {
  event1: {
    startDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(), // Tomorrow
    endDate: new Date(Date.now() + 25 * 60 * 60 * 1000).toISOString(), // Tomorrow + 1 hour
    title: 'Test Event',
    description: 'Test event description',
    location: { id: 'test-location-id' }
  }
};

export const testLocations = {
  location1: {
    name: 'Test Location',
    lat: 40.7128,
    long: -74.0060,
    address: '123 Test St, Test City',
    link: 'https://test.com'
  }
};

export const testAttendees = {
  attendee1: {
    userId: 'test-user-id',
    role: AttendeeRole.attendee,
    productsForSale: ['Apples', 'Bananas']
  }
};

export const testCompostReports = {
  report1: {
    compostStandId: 1,
    depositWeight: 3.2,
    compostSmell: true,
    dryMatterPresent: DRYMATTERPRESENT.yes,
    bugs: false,
    scalesProblem: false,
    notes: 'Test compost report',
    full: false,
    cleanAndTidy: true,
    userId: 'test-user-id'
  }
};
