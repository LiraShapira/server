import { CompostStandName } from "../constants/compostStands";

// Define our own types instead of using Prisma types
export type Category = 'GROCERIES' | 'MISC' | 'DEPOSIT' | 'GARDEN' | 'GIFT';
export type DRYMATTERPRESENT = 'yes' | 'some' | 'no';

export interface Transaction {
  id: string;
  amount: number;
  createdAt: string;
  category: Category;
  purchaserId: string;
  recipientId: string;
  reason: string;
  isRequest: boolean;
}

export interface User {
  id: string;
  firstName: string;
  lastName: string;
  role: 'BASIC' | 'ADMIN';
  createdAt: string;
  accountBalance: string;
  email?: string;
  userLocalCompostStandId?: number;
  phoneNumber: string;
  adminCompostStandId?: number;
}

export type TransactionDTO = Pick<Transaction, 'category' | 'amount' | 'purchaserId' | 'reason' | 'isRequest'> & {
  recipientPhoneNumber: string;
};

export interface DepositDTO {
  userId: string;
  compostReport: {
    depositWeight: number;
    dryMatter?: boolean,
    notes?: string;
    compostStand: CompostStandName
    bugs?: boolean;
    scalesProblem?: boolean;
    full?: boolean;
    cleanAndTidy?: boolean;
    compostSmell?: boolean;
  }
}

export interface TransactionWithUsers extends Transaction {
  users: User[]
}

export interface HandleRequestDTO {
  transaction: Transaction;
  isRequestAccepted: boolean;
}
