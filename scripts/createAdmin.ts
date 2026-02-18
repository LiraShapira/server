/**
 * Script to create an admin user
 * Usage: npx ts-node scripts/createAdmin.ts <email> <password> <communityId> [isSuperAdmin]
 * 
 * Example:
 *   npx ts-node scripts/createAdmin.ts admin@example.com password123 <community-uuid>
 *   npx ts-node scripts/createAdmin.ts superadmin@example.com password123 null true
 */

import bcrypt from 'bcrypt';
import { supabase } from '../server/config/supabase';
import * as dotenv from 'dotenv';

dotenv.config();

async function createAdmin() {
  const args = process.argv.slice(2);
  
  if (args.length < 3) {
    console.error('Usage: npx ts-node scripts/createAdmin.ts <email> <password> <communityId> [isSuperAdmin]');
    console.error('Example: npx ts-node scripts/createAdmin.ts admin@example.com password123 <community-uuid>');
    console.error('Example: npx ts-node scripts/createAdmin.ts superadmin@example.com password123 null true');
    process.exit(1);
  }

  const [email, password, communityIdArg, isSuperAdminArg] = args;
  const communityId = communityIdArg === 'null' ? null : communityIdArg;
  const isSuperAdmin = isSuperAdminArg === 'true';

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
