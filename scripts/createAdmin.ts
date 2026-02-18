/**
 * Script to create an admin user
 * Usage: npx ts-node scripts/createAdmin.ts <email> <password> <communityId> [isSuperAdmin]
 *
 * Requires SUPABASE_URL and SUPABASE_ANON_KEY in server/.env
 *
 * Example:
 *   npx ts-node scripts/createAdmin.ts admin@example.com password123 123
 *   npx ts-node scripts/createAdmin.ts superadmin@example.com password123 null true
 *
 * Note: communityId is an int8 (number), use 'null' for super admins
 */

// Load .env from server directory before Supabase config is loaded
import path from 'path';
import { config } from 'dotenv';
config({ path: path.resolve(__dirname, '..', '.env') });

import bcrypt from 'bcrypt';

async function createAdmin() {
  // Import after dotenv so SUPABASE_URL and SUPABASE_ANON_KEY are set
  const { supabase } = await import('../server/config/supabase');

  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: npx ts-node scripts/createAdmin.ts <email> <password> <communityId> [isSuperAdmin]');
    console.error('Example: npx ts-node scripts/createAdmin.ts admin@example.com password123 123');
    console.error('Example: npx ts-node scripts/createAdmin.ts superadmin@example.com password123 null true');
    console.error('Note: communityId is an int8 (number), use "null" for super admins');
    process.exit(1);
  }

  const [email, password, communityIdArg, isSuperAdminArg] = args;
  const communityId = communityIdArg === 'null' ? null : parseInt(communityIdArg, 10);
  const isSuperAdmin = isSuperAdminArg === 'true';

  if (communityIdArg !== 'null' && isNaN(communityId as number)) {
    console.error('Error: communityId must be a number or "null"');
    process.exit(1);
  }

  try {
    // Hash the password
    const saltRounds = 10;
    const hashedPassword = await bcrypt.hash(password, saltRounds);

    // Insert admin
    const { data, error } = await supabase
      .from('Admin')
      .insert({
        email: email.toLowerCase().trim(),
        password: hashedPassword,
        communityId: communityId,
        isSuperAdmin: isSuperAdmin,
      })
      .select()
      .single();

    if (error) {
      console.error('Error creating admin:', error);
      process.exit(1);
    }

    console.log('Admin created successfully!');
    console.log('ID:', data.id);
    console.log('Email:', data.email);
    console.log('Community ID:', data.communityId || 'null');
    console.log('Is Super Admin:', data.isSuperAdmin);
  } catch (error: any) {
    console.error('Error:', error.message);
    process.exit(1);
  }
}

createAdmin();
