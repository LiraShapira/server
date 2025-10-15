-- Fix Supabase schema for UUID compatibility
-- This script is designed for empty tables

-- Enable UUID extension
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Drop all tables in the correct order (respecting foreign key dependencies)
DROP TABLE IF EXISTS "Attendee" CASCADE;
DROP TABLE IF EXISTS "CompostReport" CASCADE;
DROP TABLE IF EXISTS "_TransactionToUser" CASCADE;
DROP TABLE IF EXISTS "Transaction" CASCADE;
DROP TABLE IF EXISTS "Event" CASCADE;
DROP TABLE IF EXISTS "Location" CASCADE;
DROP TABLE IF EXISTS "CompostStand" CASCADE;
DROP TABLE IF EXISTS "User" CASCADE;

-- Recreate User table with proper UUID
CREATE TABLE "User" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "firstName" text NOT NULL DEFAULT '',
    "lastName" text NOT NULL DEFAULT '',
    "role" "ROLE" NOT NULL DEFAULT 'BASIC',
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "accountBalance" decimal(65,30) NOT NULL DEFAULT 0,
    "email" text,
    "userLocalCompostStandId" integer,
    "phoneNumber" text NOT NULL,
    "adminCompostStandId" integer,
    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- Recreate CompostStand table
CREATE TABLE "CompostStand" (
    "compostStandId" integer NOT NULL,
    "name" text NOT NULL,
    CONSTRAINT "CompostStand_pkey" PRIMARY KEY ("compostStandId")
);

-- Recreate Transaction table with proper UUIDs
CREATE TABLE "Transaction" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "amount" decimal(65,30) NOT NULL,
    "createdAt" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "category" "Category" NOT NULL,
    "purchaserId" uuid NOT NULL,
    "recipientId" uuid NOT NULL,
    "reason" text NOT NULL,
    "isRequest" boolean NOT NULL DEFAULT false,
    CONSTRAINT "Transaction_pkey" PRIMARY KEY ("id")
);

-- Recreate the many-to-many junction table for Transaction-User
CREATE TABLE "_TransactionToUser" (
    "A" uuid NOT NULL,
    "B" uuid NOT NULL
);

-- Recreate CompostReport table with proper UUID
CREATE TABLE "CompostReport" (
    "compostReportId" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "compostStandId" integer NOT NULL,
    "depositWeight" decimal(65,30) NOT NULL,
    "compostSmell" boolean,
    "dryMatterPresent" "DRYMATTERPRESENT",
    "bugs" boolean,
    "scalesProblem" boolean,
    "notes" text,
    "full" boolean,
    "cleanAndTidy" boolean,
    "date" timestamp(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "userId" uuid NOT NULL,
    CONSTRAINT "CompostReport_pkey" PRIMARY KEY ("compostReportId")
);

-- Recreate Location table
CREATE TABLE "Location" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "name" text,
    "lat" double precision,
    "long" double precision,
    "address" text,
    "link" text,
    "eventId" text,
    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- Recreate Event table
CREATE TABLE "Event" (
    "id" uuid NOT NULL DEFAULT uuid_generate_v4(),
    "startDate" timestamp(3) NOT NULL,
    "endDate" timestamp(3) NOT NULL,
    "title" text NOT NULL,
    "description" text NOT NULL,
    "locationId" text NOT NULL,
    CONSTRAINT "Event_pkey" PRIMARY KEY ("id")
);

-- Recreate Attendee table with proper UUID
CREATE TABLE "Attendee" (
    "userId" uuid NOT NULL,
    "role" "AttendeeRole" NOT NULL,
    "eventId" text NOT NULL,
    "productsForSale" text[],
    CONSTRAINT "Attendee_pkey" PRIMARY KEY ("userId","eventId")
);

-- Create all the enums
CREATE TYPE "Category" AS ENUM ('GROCERIES', 'MISC', 'DEPOSIT', 'GARDEN', 'GIFT');
CREATE TYPE "ROLE" AS ENUM ('BASIC', 'ADMIN');
CREATE TYPE "DRYMATTERPRESENT" AS ENUM ('yes', 'some', 'no');
CREATE TYPE "AttendeeRole" AS ENUM ('seller', 'attendee', 'volunteer');

-- Add all foreign key constraints
ALTER TABLE "User" ADD CONSTRAINT "User_email_key" UNIQUE ("email");
ALTER TABLE "User" ADD CONSTRAINT "User_phoneNumber_key" UNIQUE ("phoneNumber");

ALTER TABLE "User" ADD CONSTRAINT "User_userLocalCompostStandId_fkey" 
    FOREIGN KEY ("userLocalCompostStandId") REFERENCES "CompostStand"("compostStandId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "User" ADD CONSTRAINT "User_adminCompostStandId_fkey" 
    FOREIGN KEY ("adminCompostStandId") REFERENCES "CompostStand"("compostStandId") ON DELETE SET NULL ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_purchaserId_fkey" 
    FOREIGN KEY ("purchaserId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Transaction" ADD CONSTRAINT "Transaction_recipientId_fkey" 
    FOREIGN KEY ("recipientId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "_TransactionToUser" ADD CONSTRAINT "_TransactionToUser_A_fkey" 
    FOREIGN KEY ("A") REFERENCES "Transaction"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "_TransactionToUser" ADD CONSTRAINT "_TransactionToUser_B_fkey" 
    FOREIGN KEY ("B") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

ALTER TABLE "CompostReport" ADD CONSTRAINT "CompostReport_compostStandId_fkey" 
    FOREIGN KEY ("compostStandId") REFERENCES "CompostStand"("compostStandId") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "CompostReport" ADD CONSTRAINT "CompostReport_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Event" ADD CONSTRAINT "Event_locationId_fkey" 
    FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_userId_fkey" 
    FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "Attendee" ADD CONSTRAINT "Attendee_eventId_fkey" 
    FOREIGN KEY ("eventId") REFERENCES "Event"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- Create indexes
CREATE INDEX "User_phoneNumber_idx" ON "User"("phoneNumber");
CREATE UNIQUE INDEX "_TransactionToUser_AB_unique" ON "_TransactionToUser"("A", "B");
CREATE INDEX "_TransactionToUser_B_index" ON "_TransactionToUser"("B");

-- Success message
SELECT 'Database schema successfully recreated with proper UUID types!' as message;
