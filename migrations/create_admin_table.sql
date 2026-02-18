-- Create Admin table for admin authentication
CREATE TABLE IF NOT EXISTS "Admin" (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT UNIQUE NOT NULL,
  "communityId" UUID REFERENCES "Community"(id),
  password TEXT NOT NULL,
  "isSuperAdmin" BOOLEAN DEFAULT FALSE NOT NULL,
  "createdAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  "updatedAt" TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_admin_email ON "Admin"(email);

-- Create index on communityId for faster filtering
CREATE INDEX IF NOT EXISTS idx_admin_community_id ON "Admin"("communityId");
