import { supabase } from '../../server/config/supabase';
import { testUsers, testCompostStands, testLocations } from './testData';

export class DatabaseTestHelpers {
  static async cleanupDatabase() {
    try {
      // Delete in order to respect foreign key constraints
      await supabase.from('Attendee').delete().neq('userId', '');
      await supabase.from('Event').delete().neq('id', '');
      await supabase.from('Location').delete().neq('id', '');
      await supabase.from('CompostReport').delete().neq('compostReportId', '');
      await supabase.from('Transaction').delete().neq('id', '');
      await supabase.from('CompostStand').delete().neq('compostStandId', 0);
      await supabase.from('User').delete().neq('id', '');
    } catch (error) {
      console.warn('Database cleanup warning:', error);
    }
  }

  static async seedTestData() {
    try {
      // Create test users
      const { data: users } = await supabase
        .from('User')
        .insert([
          testUsers.user1,
          testUsers.user2,
          testUsers.user3
        ])
        .select();

      // Create test compost stands
      const { data: stands } = await supabase
        .from('CompostStand')
        .insert([
          testCompostStands.stand1,
          testCompostStands.stand2
        ])
        .select();

      // Create test location
      const { data: location } = await supabase
        .from('Location')
        .insert([testLocations.location1])
        .select()
        .single();

      return {
        users: users || [],
        stands: stands || [],
        location: location
      };
    } catch (error) {
      console.error('Error seeding test data:', error);
      throw error;
    }
  }

  static async getTestUser(phoneNumber: string) {
    const { data, error } = await supabase
      .from('User')
      .select('*')
      .eq('phoneNumber', phoneNumber)
      .single();

    if (error) {
      throw new Error(`Test user not found: ${error.message}`);
    }

    return data;
  }

  static async getTestCompostStand(compostStandId: number) {
    const { data, error } = await supabase
      .from('CompostStand')
      .select('*')
      .eq('compostStandId', compostStandId)
      .single();

    if (error) {
      throw new Error(`Test compost stand not found: ${error.message}`);
    }

    return data;
  }

  static async getTestLocation(id: string) {
    const { data, error } = await supabase
      .from('Location')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      throw new Error(`Test location not found: ${error.message}`);
    }

    return data;
  }

  static async createTestTransaction(transactionData: any) {
    const { data, error } = await supabase
      .from('Transaction')
      .insert(transactionData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test transaction: ${error.message}`);
    }

    return data;
  }

  static async createTestCompostReport(reportData: any) {
    const { data, error } = await supabase
      .from('CompostReport')
      .insert(reportData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test compost report: ${error.message}`);
    }

    return data;
  }

  static async createTestEvent(eventData: any) {
    const { data, error } = await supabase
      .from('Event')
      .insert(eventData)
      .select()
      .single();

    if (error) {
      throw new Error(`Failed to create test event: ${error.message}`);
    }

    return data;
  }
}
