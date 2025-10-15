import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  DepositDTO, HandleRequestDTO,
  TransactionDTO,
} from '../../types/transactionTypes';
import { convertDepositDTOToCompostReportData, findUserIdByPhoneNumber } from '../utils';
import { standsNameToIdMap } from '../../constants/compostStands';
import { randomUUID } from 'crypto';

type RequestBody<T> = Request<{}, {}, T>;

export const getAllTransactions = async (_req: Request, res: Response) => {
  try {
    const { data: transactions, error } = await supabase
      .from('Transaction')
      .select('*');

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(transactions);
  } catch (e: any) {
    console.error('Error in getAllTransactions:', e);
    res.status(500).json({ error: e.message });
  }
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

    // Create the transaction
    const { data: newTransaction, error: transactionError } = await supabase
      .from('Transaction')
      .insert({
        id: randomUUID(),
        category: transaction.category,
        amount: transaction.amount,
        purchaserId: transaction.purchaserId,
        reason: transaction.reason,
        recipientId,
        isRequest: transaction.isRequest,
      })
      .select()
      .single();

    if (transactionError) {
      console.error('Supabase error creating transaction:', transactionError);
      return res.status(400).json({ error: transactionError.message });
    }

    // Get the user for the response
    const userId = transaction.isRequest ? transaction.purchaserId : recipientId;
    const { data: user, error: userError } = await supabase
      .from('User')
      .select('*')
      .eq('id', userId)
      .single();

    if (userError) {
      console.error('Supabase error fetching user:', userError);
      return res.status(400).json({ error: userError.message });
    }

    const transactionWithUsers = {
      ...newTransaction,
      users: [user]
    };

    if (transaction.isRequest) {
      res.status(201).json(transactionWithUsers);
      return;
    }

    // Update balances for non-request transactions
    // First get current balances
    const { data: recipientUser, error: recipientFetchError } = await supabase
      .from('User')
      .select('accountBalance')
      .eq('id', recipientId)
      .single();

    if (recipientFetchError) {
      console.error('Supabase error fetching recipient balance:', recipientFetchError);
      return res.status(400).json({ error: recipientFetchError.message });
    }

    const { data: purchaserUser, error: purchaserFetchError } = await supabase
      .from('User')
      .select('accountBalance')
      .eq('id', transaction.purchaserId)
      .single();

    if (purchaserFetchError) {
      console.error('Supabase error fetching purchaser balance:', purchaserFetchError);
      return res.status(400).json({ error: purchaserFetchError.message });
    }

    // Update recipient balance
    const { error: recipientUpdateError } = await supabase
      .from('User')
      .update({ 
        accountBalance: (parseFloat(recipientUser.accountBalance) + parseFloat(transaction.amount.toString())).toString()
      })
      .eq('id', recipientId);

    if (recipientUpdateError) {
      console.error('Supabase error updating recipient balance:', recipientUpdateError);
      return res.status(400).json({ error: recipientUpdateError.message });
    }

    // Update purchaser balance
    const { error: purchaserUpdateError } = await supabase
      .from('User')
      .update({ 
        accountBalance: (parseFloat(purchaserUser.accountBalance) - parseFloat(transaction.amount.toString())).toString()
      })
      .eq('id', transaction.purchaserId);

    if (purchaserUpdateError) {
      console.error('Supabase error updating purchaser balance:', purchaserUpdateError);
      return res.status(400).json({ error: purchaserUpdateError.message });
    }

    res.status(201).json(transactionWithUsers);
  } catch (e: any) {
    console.error('Error in saveNewTransaction:', e);
    res.status(400).json({ error: e.message });
  }
};

export const saveDeposit = async (
  { body }: RequestBody<DepositDTO>,
  res: Response
) => {
  const netGained = body.compostReport.depositWeight;
  const tenPercent = body.compostReport.depositWeight * 0.1;
  const compostStandId = standsNameToIdMap[body.compostReport.compostStand];

  try {
    const orgId = process.env.LIRA_SHAPIRA_USER_ID;
    if (!orgId) {
      throw new Error('no lira shapira user id available');
    }

    // Check if the organization user exists
    const { data: orgUserCheck, error: orgUserCheckError } = await supabase
      .from('User')
      .select('id')
      .eq('id', orgId)
      .single();

    if (orgUserCheckError || !orgUserCheck) {
      console.error('Organization user not found:', orgId);
      return res.status(400).json({ error: 'Organization user not found in database' });
    }

    // Check if the depositor user exists
    const { data: depositorUserCheck, error: depositorUserCheckError } = await supabase
      .from('User')
      .select('id')
      .eq('id', body.userId)
      .single();

    if (depositorUserCheckError || !depositorUserCheck) {
      console.error('Depositor user not found:', body.userId);
      return res.status(400).json({ error: 'Depositor user not found in database' });
    }

    // create main transaction for depositor (org as purchaser)
    const { data: mainTransaction, error: mainTransactionError } = await supabase
      .from('Transaction')
      .insert({
        id: randomUUID(),
        amount: netGained,
        category: 'DEPOSIT',
        purchaserId: orgId,
        recipientId: body.userId,
        reason: 'Deposit',
      })
      .select()
      .single();

    if (mainTransactionError) {
      console.error('Supabase error creating main transaction:', mainTransactionError);
      return res.status(400).json({ error: mainTransactionError.message });
    }

    // Get users for the main transaction
    const { data: orgUser, error: orgUserError } = await supabase
      .from('User')
      .select('firstName, lastName')
      .eq('id', orgId)
      .single();

    const { data: depositorUser, error: depositorUserError } = await supabase
      .from('User')
      .select('firstName, lastName')
      .eq('id', body.userId)
      .single();

    if (orgUserError || depositorUserError) {
      console.error('Supabase error fetching users:', orgUserError || depositorUserError);
      return res.status(400).json({ error: (orgUserError || depositorUserError)?.message });
    }

    const responseTransactions: Array<any> = [];

    // helper to normalize users array
    const normalizeUsers = (purchaser: any, recipient: any) => {
      return [purchaser, recipient];
    };

    // push main txn
    responseTransactions.push({
      ...mainTransaction,
      users: normalizeUsers(orgUser, depositorUser),
      amount: netGained,
    });

    // fetch stand admins
    const { data: stand, error: standError } = await supabase
      .from('CompostStand')
      .select(`
        admins:User!User_adminCompostStandId_fkey(id, firstName, lastName)
      `)
      .eq('compostStandId', compostStandId)
      .single();

    if (standError) {
      console.error('Supabase error fetching stand:', standError);
      return res.status(400).json({ error: standError.message });
    }

    if (stand?.admins?.length) {
      const share = tenPercent / stand.admins.length;

      for (const admin of stand.admins) {
        if (admin.id === body.userId) {
          continue;
        }

        // Get current admin balance
        const { data: adminUser, error: adminUserError } = await supabase
          .from('User')
          .select('accountBalance')
          .eq('id', admin.id)
          .single();

        if (adminUserError) {
          console.error('Supabase error fetching admin balance:', adminUserError);
          continue;
        }

        // distribute bonus to admin balance
        const { error: adminBalanceError } = await supabase
          .from('User')
          .update({
            accountBalance: (parseFloat(adminUser.accountBalance) + share).toString()
          })
          .eq('id', admin.id);

        if (adminBalanceError) {
          console.error('Supabase error updating admin balance:', adminBalanceError);
          continue;
        }

        // record admin transaction (user as purchaser)
        const { data: adminTransaction, error: adminTransactionError } = await supabase
          .from('Transaction')
          .insert({
            id: randomUUID(),
            amount: share,
            category: 'DEPOSIT',
            purchaserId: body.userId,
            recipientId: admin.id,
            reason: 'StandAdminPayment',
          })
          .select()
          .single();

        if (adminTransactionError) {
          console.error('Supabase error creating admin transaction:', adminTransactionError);
          continue;
        }

        responseTransactions.push({
          ...adminTransaction,
          users: normalizeUsers(depositorUser, admin),
          amount: share,
        });
      }
    }

    // Get current depositor balance
    const { data: depositorBalance, error: depositorBalanceError } = await supabase
      .from('User')
      .select('accountBalance')
      .eq('id', body.userId)
      .single();

    if (depositorBalanceError) {
      console.error('Supabase error fetching depositor balance:', depositorBalanceError);
      return res.status(400).json({ error: depositorBalanceError.message });
    }

    // finalize depositor balance update
    const { error: depositorUpdateError } = await supabase
      .from('User')
      .update({
        accountBalance: (parseFloat(depositorBalance.accountBalance) + netGained).toString()
      })
      .eq('id', body.userId);

    if (depositorUpdateError) {
      console.error('Supabase error updating depositor balance:', depositorUpdateError);
      return res.status(400).json({ error: depositorUpdateError.message });
    }

    // create compost report
    const { error: reportError } = await supabase
      .from('CompostReport')
      .insert(convertDepositDTOToCompostReportData(body));

    if (reportError) {
      console.error('Supabase error creating compost report:', reportError);
      return res.status(400).json({ error: reportError.message });
    }

    // respond with transactions
    res.status(201).send(responseTransactions);
  } catch (e: any) {
    console.error('Error in saveDeposit:', e);
    res.status(400).json({ error: e.message });
  }
};


export const handleRequest = async (
  { body }: RequestBody<HandleRequestDTO>,
  res: Response
) => {
  const { transaction, isRequestAccepted } = body;
  const transactionId = body.transaction.id;
  
  try {
    if (isRequestAccepted) {
      // Update transaction to mark as accepted
      const { data: updatedTransaction, error: updateError } = await supabase
        .from('Transaction')
        .update({
          isRequest: false
        })
        .eq('id', transactionId)
        .select()
        .single();

      if (updateError) {
        console.error('Supabase error updating transaction:', updateError);
        return res.status(400).json({ error: updateError.message });
      }

      // Get current balances
      const { data: recipientUser, error: recipientFetchError } = await supabase
        .from('User')
        .select('accountBalance')
        .eq('id', transaction.recipientId)
        .single();

      const { data: purchaserUser, error: purchaserFetchError } = await supabase
        .from('User')
        .select('accountBalance')
        .eq('id', transaction.purchaserId)
        .single();

      if (recipientFetchError || purchaserFetchError) {
        console.error('Supabase error fetching user balances:', recipientFetchError || purchaserFetchError);
        return res.status(400).json({ error: (recipientFetchError || purchaserFetchError)?.message });
      }

      // Update recipient balance
      const { error: recipientUpdateError } = await supabase
        .from('User')
        .update({
          accountBalance: (parseFloat(recipientUser.accountBalance) + parseFloat(transaction.amount.toString())).toString()
        })
        .eq('id', transaction.recipientId);

      if (recipientUpdateError) {
        console.error('Supabase error updating recipient balance:', recipientUpdateError);
        return res.status(400).json({ error: recipientUpdateError.message });
      }

      // Update purchaser balance
      const { error: purchaserUpdateError } = await supabase
        .from('User')
        .update({
          accountBalance: (parseFloat(purchaserUser.accountBalance) - parseFloat(transaction.amount.toString())).toString()
        })
        .eq('id', transaction.purchaserId);

      if (purchaserUpdateError) {
        console.error('Supabase error updating purchaser balance:', purchaserUpdateError);
        return res.status(400).json({ error: purchaserUpdateError.message });
      }

      res.status(201).send({
        ...updatedTransaction,
        isRequest: false
      });
    } else {
      // Delete the transaction
      const { error: deleteError } = await supabase
        .from('Transaction')
        .delete()
        .eq('id', transactionId);

      if (deleteError) {
        console.error('Supabase error deleting transaction:', deleteError);
        return res.status(400).json({ error: deleteError.message });
      }

      res.status(201).send({
        id: transactionId,
        isRequest: false
      });
    }
  } catch (e: any) {
    console.error('Error in handleRequest:', e);
    res.status(400).json({ error: e.message });
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

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - period);

  try {
    // Get all transactions in the period
    const { data: transactions, error } = await supabase
      .from('Transaction')
      .select('category, amount')
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString())
      .eq('isRequest', false);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Group by category and sum amounts
    const categoryStats: { [key: string]: number } = {};
    
    transactions.forEach(transaction => {
      const category = transaction.category;
      const amount = parseFloat(transaction.amount);
      
      if (!categoryStats[category]) {
        categoryStats[category] = 0;
      }
      
      categoryStats[category] += amount;
    });

    const transactionAmountByCategory = Object.entries(categoryStats).map(([category, amount]) => ({
      category,
      amount: Number(amount.toFixed(2))
    }));

    res.status(200).send({ transactionAmountByCategory });
  } catch (e: any) {
    console.error('Error in transactionStats:', e);
    res.status(400).json({ error: e.message });
  }
};

export const deleteTransaction = async (
  req: Request<{ id: string }>,
  res: Response
) => {
  const transactionId = req.params.id;
  try {
    const { data: transaction, error } = await supabase
      .from('Transaction')
      .delete()
      .eq('id', transactionId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send(transaction);
  } catch (e: any) {
    console.error('Error in deleteTransaction:', e);
    res.status(400).json({ error: e.message });
  }
}