# Database Migrations

## Admin Table Setup

Run the SQL migration to create the Admin table:

```sql
-- Run this in your Supabase SQL editor or database client
\i migrations/create_admin_table.sql
```

Or copy and paste the contents of `create_admin_table.sql` into your database SQL editor.

## Creating Admin Users

After creating the Admin table, you can create admin users using the provided script:

### Regular Admin (scoped to a community)
```bash
npx ts-node scripts/createAdmin.ts admin@example.com password123 <community-uuid>
```

### Super Admin (can access all communities)
```bash
npx ts-node scripts/createAdmin.ts superadmin@example.com password123 null true
```

**Note:** Replace `<community-uuid>` with an actual Community ID from your database, or use `null` for super admins.

### Example:
```bash
# Create a regular admin for community with ID abc123-def456-ghi789
npx ts-node scripts/createAdmin.ts john@community.com mypassword123 abc123-def456-ghi789

# Create a super admin
npx ts-node scripts/createAdmin.ts admin@system.com adminpassword123 null true
```

## Admin Table Schema

- `id` (UUID): Primary key
- `email` (TEXT): Unique email address
- `communityId` (UUID): Foreign key to Community table (nullable for super admins)
- `password` (TEXT): Hashed password using bcrypt
- `isSuperAdmin` (BOOLEAN): Default false, set to true for super admins
- `createdAt` (TIMESTAMP): Auto-generated
- `updatedAt` (TIMESTAMP): Auto-generated
