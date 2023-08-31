import { Transaction } from "@prisma/client";

export type TransactionDTO = Pick<Transaction, 'category' | 'amount' | 'purchaserId' | 'recipientId' | 'reason'>
