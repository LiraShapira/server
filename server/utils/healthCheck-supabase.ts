import { supabase } from '../config/supabase';

export async function checkDatabaseHealth() {
  try {
    // Simple query to test connection
    const { error } = await supabase
      .from('User')
      .select('id')
      .limit(1);

    if (error) {
      console.error('Database health check failed:', error);
      return false;
    }

    return true;
  } catch (error) {
    console.error('Database health check failed:', error);
    return false;
  }
}
