import { Request, Response } from 'express';
import { prisma } from '..';
import {
  DepositDTO, HandleRequestDTO,
  TransactionDTO,
} from '../../types/transactionTypes';
import { Category, Transaction } from '@prisma/client';
import { convertDepositDTOToCompostReportData, findUserIdByPhoneNumber } from '../utils';
import { standsNameToIdMap } from '../../constants/compostStands';
import { Decimal } from '@prisma/client/runtime/library';

type RequestBody<T> = Request<{}, {}, T>;

export const getAllTransactions = async (_req: Request, res: Response<Transaction[]>) => {
  const transactions = await prisma.transaction.findMany();
  res.json(transactions);
};

/**
 * @summary Saves a new transaction
 * @description Returns { Transaction, users: [User] }
 */
export const saveNewTransaction = async (
  req: RequestBody<TransactionDTO>,
  res: Response
) => {
  const transaction = req.body;
  try {
    const recipientId = await findUserIdByPhoneNumber(
      transaction.recipientPhoneNumber
    );
    const transactionWithUsers =
      await prisma.transaction.create({
        data: {
          category: transaction.category,
          amount: transaction.amount,
          purchaserId: transaction.purchaserId,
          reason: transaction.reason,
          recipientId,
          isRequest: transaction.isRequest,
          users: {
            connect: [{ id: recipientId }, { id: transaction.purchaserId }],
          },
        },
        include: {
          users: {
            where: {
              id: transaction.isRequest ? transaction.purchaserId : recipientId
            }
          },
        },
      });

    if (transaction.isRequest) {
      res.status(201).json(transactionWithUsers);
      return;
    }

    // TODO check balance is adequate for transaction
    await prisma.user.update({
      where: {
        id: recipientId,
      },
      data: { accountBalance: { increment: transaction.amount } },
    });

    await prisma.user.update({
      where: {
        id: transaction.purchaserId,
      },
      data: { accountBalance: { decrement: transaction.amount } },
    });

    res.status(201).json(transactionWithUsers);
  } catch (e: any) {
    console.log(e);
    res.status(400).json({ error: e.message });
  }
};

export const saveDeposit = async (
  { body }: RequestBody<DepositDTO>,
  res: Response
) => {
  // TODO ROUND TO 1dp
  const netGained = body.compostReport.depositWeight * 0.9;
  const tenPercent = body.compostReport.depositWeight * 0.1;
  const compostStandId = standsNameToIdMap[body.compostReport.compostStand];

  try {
    const orgId = process.env.LIRA_SHAPIRA_USER_ID;
    if (!orgId) {
      throw new Error('no lira shapira user id available');
    }

    // create main transaction for depositor (org as purchaser)
    const mainTransaction = await prisma.transaction.create({
      data: {
        amount: netGained,
        category: Category.DEPOSIT,
        purchaserId: orgId,
        recipientId: body.userId,
        reason: 'Deposit',
        users: {
          connect: [
            { id: orgId },
            { id: body.userId },
          ],
        },
      },
      include: {
        users: true
      },
    });

    const responseTransactions: Array<typeof mainTransaction & { amount: Decimal; users: Array<{ firstName: string; lastName: string }> }> = [];

    // helper to duplicate single user entry when purchaser === recipient
    const normalizeUsers = (tx: typeof mainTransaction) => {
      const list = [...tx.users];
      if (tx.purchaserId === tx.recipientId) {
        // duplicate so both slots appear
        list.push({ ...list[0] });
      }
      return list;
    };

    // push main txn (no self-tip here, purchaser always org)
    responseTransactions.push({
      ...mainTransaction,
      users: normalizeUsers(mainTransaction),
      amount: new Decimal(netGained),
    });

    // fetch stand admins
    const stand = await prisma.compostStand.findUnique({
      where: { compostStandId },
      select: { admins: true },
    });

    if (stand?.admins?.length) {
      const share = tenPercent / stand.admins.length;

      for (const admin of stand.admins) {
        // distribute bonus to admin balance
        await prisma.user.update({
          where: { id: admin.id },
          data: { accountBalance: { increment: share } },
        });

        // record admin transaction (user as purchaser)
        const adminTransaction = await prisma.transaction.create({
          data: {
            amount: share,
            category: Category.DEPOSIT,
            purchaserId: body.userId,
            recipientId: admin.id,
            reason: 'StandAdminPayment',
            users: {
              connect: [
                { id: body.userId },
                { id: admin.id },
              ],
            },
          },
          include: {
            users: true,
          },
        });

        responseTransactions.push({
          ...adminTransaction,
          users: normalizeUsers(adminTransaction),
          amount: new Decimal(share),
        });
      }
    }

    // finalize depositor balance update and report logging
    await prisma.user.update({
      where: { id: body.userId },
      data: { accountBalance: { increment: netGained } },
    });
    await prisma.compostReport.create({ data: convertDepositDTOToCompostReportData(body) });

    // respond with one or two txns
    res.status(201).send(responseTransactions);
  } catch (e) {
    console.error(e);
    res.status(400).send(e);
  }
};


export const handleRequest = async (
  { body }: RequestBody<HandleRequestDTO>,
  res: Response
) => {
  const { transaction, isRequestAccepted } = body;
  const transactionId = body.transaction.id;
  let updatedTransaction: Transaction;
  try {
    if (isRequestAccepted) {
      updatedTransaction = await prisma.transaction.update({
        where: {
          id: transactionId
        },
        data: {
          isRequest: false
        }
      });

      await prisma.user.update({
        where: {
          id: transaction.recipientId,
        },
        data: { accountBalance: { increment: transaction.amount } },
      });

      await prisma.user.update({
        where: {
          id: transaction.purchaserId,
        },
        data: { accountBalance: { decrement: transaction.amount } },
      });
    } else {
      updatedTransaction = await prisma.transaction.delete({
        where: {
          id: transactionId
        }
      })
    }

    res.status(201).send({
      ...updatedTransaction,
      isRequest: false
    });
  } catch (e) {
    res.status(400).send(e)
  }
}

// export const monthlyTransactionsStats = async (req: Request, res: Response) => {
//   try {
//     const allReports = await prisma.compostReport.findMany();
//     const reportsByMonth: {
//       [key: string]: {
//         weight: Decimal;
//         count: number;
//         average?: number;
//       };
//     } = {};

//     for (let i = 0; i < allReports.length; i++) {
//       const report = allReports[i];
//       const reportMonth = months[report.date.getMonth()];
//       if (reportsByMonth[reportMonth]) {
//         reportsByMonth[reportMonth] = {
//           weight: reportsByMonth[reportMonth].weight.plus(report.depositWeight),
//           count: reportsByMonth[reportMonth].count + 1,
//         };
//       } else {
//         reportsByMonth[reportMonth] = {
//           weight: report.depositWeight,
//           count: 1,
//         };
//       }
//     }
//     Object.entries(reportsByMonth).forEach(([month, value] )=> {
//       reportsByMonth[month].average = value.weight.div(value.count).toDecimalPlaces(1).toNumber();
//     })

//     res.status(200).send({ reportsByMonth })
//   } catch (e: any) {
//     res.send(400).json({ error: e.message });
//   }
// }

export const transactionStats = async (req: Request, res: Response) => {
  let period = 30;
  if (req.query.period && typeof req.query.period === 'string') {
    period = parseInt(req.query.period);
  }

  const dateQuery = {
    lte: new Date(),
    // TODO make possible to set dynamically from query params
    gte: new Date(new Date().setDate(new Date().getDate() - period)),
  };

  try {
    // TODO amount per transaction spread
    // TODO average amount per transaction


    // TODO REMOVE
    const groupTransactions = await prisma.transaction.groupBy({
      by: ['category'],
      _sum: {
        amount: true,
      },
      where: {
        createdAt: dateQuery,
        isRequest: false
      }
    });

    const transactionAmountByCategory = groupTransactions.map(transaction => {
      return {
        category: transaction.category,
        amount: transaction._sum.amount
      }
    })

    res.status(200).send({ transactionAmountByCategory });
  } catch (e: any) {
    res.status(400).send({ error: e.message });
  }
};

export const deleteTransaction = async (
  req: Request<{ id: string }>,
  res: Response
) => {
  const transactionId = req.params.id;
  try {
    const transaction = await prisma.transaction.delete({
      where: {
        id: transactionId
      }
    });
    res.status(200).send(transaction);
  } catch (e) {
    res.status(400).send(e);
  }
}