import { DRYMATTERPRESENT, Transaction, User } from "@prisma/client";
import { CompostStandName } from "../constants/compostStands";

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
