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

export const getAllTransactions = async (req: Request, res: Response) => {
  try {
    const communityId = req.query.communityId as string | undefined;
    let query = supabase.from('Transaction').select('*');
    if (communityId) {
      query = query.eq('communityId', communityId);
    }
    const { data: transactions, error } = await query;

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

    const communityId = (transaction as any).communityId ?? null;

    // Create the transaction
    const insertPayload: Record<string, unknown> = {
      id: randomUUID(),
      category: transaction.category,
      amount: transaction.amount,
      purchaserId: transaction.purchaserId,
      reason: transaction.reason,
      recipientId,
      isRequest: transaction.isRequest,
    };
    if (communityId) {
      insertPayload.communityId = communityId;
    }
    const { data: newTransaction, error: transactionError } = await supabase
      .from('Transaction')
      .insert(insertPayload)
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
  const netGained = parseFloat(body.compostReport.depositWeight.toString());
  const tenPercent = netGained * 0.1;
  let depositorAmount = netGained - tenPercent; // User receives 90%; 10% goes to stand operator(s) (overridden to 100% if depositor is stand admin)

  // Fetch stand ID from database using the name
  let compostStandId: number | undefined;
  try {
    const { data: stand, error: standLookupError } = await supabase
      .from('CompostStand')
      .select('compostStandId')
      .eq('name', body.compostReport.compostStand)
      .single();

    if (standLookupError || !stand) {
      // Fallback to hardcoded map for backward compatibility
      compostStandId = standsNameToIdMap[body.compostReport.compostStand];
      if (!compostStandId) {
        return res.status(400).json({ error: `Compost stand "${body.compostReport.compostStand}" not found` });
      }
    } else {
      compostStandId = stand.compostStandId;
    }
  } catch (e: any) {
    // Fallback to hardcoded map for backward compatibility
    compostStandId = standsNameToIdMap[body.compostReport.compostStand];
    if (!compostStandId) {
      return res.status(400).json({ error: `Compost stand "${body.compostReport.compostStand}" not found` });
    }
  }

  try {
    const orgIdFallback = process.env.LIRA_SHAPIRA_USER_ID;

    // Check if the depositor user exists and get their communityId
    const { data: depositorUserCheck, error: depositorUserCheckError } = await supabase
      .from('User')
      .select('id, communityId')
      .eq('id', body.userId)
      .single();

    if (depositorUserCheckError || !depositorUserCheck) {
      console.error('Depositor user not found:', body.userId);
      return res.status(400).json({ error: 'Depositor user not found in database' });
    }

    const depositorCommunityId = depositorUserCheck.communityId ?? null;
    let orgIdToUse: string | null = orgIdFallback ?? null;
    if (depositorCommunityId) {
      const { data: community } = await supabase
        .from('Community')
        .select('orgUserId')
        .eq('id', depositorCommunityId)
        .single();
      const communityOrgId = (community as any)?.orgUserId ?? (community as any)?.orguserid;
      if (communityOrgId) {
        orgIdToUse = communityOrgId;
      }
    }
    if (!orgIdToUse) {
      return res.status(400).json({ error: 'No organization user configured for this community. Set Community.orgUserId or LIRA_SHAPIRA_USER_ID.' });
    }

    // Check if the organization user exists (use orgIdToUse)
    const { data: orgUserCheck, error: orgUserCheckError } = await supabase
      .from('User')
      .select('id')
      .eq('id', orgIdToUse)
      .single();

    if (orgUserCheckError || !orgUserCheck) {
      console.error('Organization user not found:', orgIdToUse);
      return res.status(400).json({ error: 'Organization user not found in database' });
    }

    // Fetch stand admins to check if depositor is admin (admin depositing to own stand gets 100%, no fee)
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

    const isDepositorStandAdmin = stand?.admins?.some((a: { id: string }) => a.id === body.userId) ?? false;
    const feeToDistribute = isDepositorStandAdmin ? 0 : tenPercent;
    depositorAmount = netGained - feeToDistribute;

    // create main transaction for depositor (org as purchaser) — amount is 90% (or 100% if depositor is stand admin)
    const mainTxnPayload: Record<string, unknown> = {
      id: randomUUID(),
      amount: depositorAmount,
      category: 'DEPOSIT',
      purchaserId: orgIdToUse,
      recipientId: body.userId,
      reason: 'Deposit',
    };
    if (depositorCommunityId) {
      mainTxnPayload.communityId = depositorCommunityId;
    }
    const { data: mainTransaction, error: mainTransactionError } = await supabase
      .from('Transaction')
      .insert(mainTxnPayload)
      .select()
      .single();

    if (mainTransactionError) {
      console.error('Supabase error creating main transaction:', mainTransactionError);
      return res.status(400).json({ error: mainTransactionError.message });
    }

    // Get users for the main transaction (include id so client can identify "other" user in list)
    const { data: orgUser, error: orgUserError } = await supabase
      .from('User')
      .select('id, firstName, lastName')
      .eq('id', orgIdToUse)
      .single();

    const { data: depositorUser, error: depositorUserError } = await supabase
      .from('User')
      .select('id, firstName, lastName')
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

    // push main txn (amount is what depositor receives, i.e. 90% or 100% if stand admin)
    responseTransactions.push({
      ...mainTransaction,
      users: normalizeUsers(orgUser, depositorUser),
      amount: Number(depositorAmount),
    });

    // distribute 10% fee to stand admins (skipped when depositor is stand admin — they already get 100%)
    if (stand?.admins?.length && feeToDistribute > 0) {
      const share = feeToDistribute / stand.admins.length;

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
            accountBalance: (parseFloat(adminUser.accountBalance) + Number(share)).toString()
          })
          .eq('id', admin.id);

        if (adminBalanceError) {
          console.error('Supabase error updating admin balance:', adminBalanceError);
          continue;
        }

        // record admin transaction (user as purchaser)
        const adminTxnPayload: Record<string, unknown> = {
          id: randomUUID(),
          amount: share,
          category: 'DEPOSIT',
          purchaserId: body.userId,
          recipientId: admin.id,
          reason: 'StandAdminPayment',
        };
        if (depositorCommunityId) {
          adminTxnPayload.communityId = depositorCommunityId;
        }
        const { data: adminTransaction, error: adminTransactionError } = await supabase
          .from('Transaction')
          .insert(adminTxnPayload)
          .select()
          .single();

        if (adminTransactionError) {
          console.error('Supabase error creating admin transaction:', adminTransactionError);
          continue;
        }

        responseTransactions.push({
          ...adminTransaction,
          users: normalizeUsers(depositorUser, admin),
          amount: Number(share),
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

    // finalize depositor balance update (depositor receives 90% or 100% if stand admin; 10% already distributed to stand admins when applicable)
    const newBalance = parseFloat(depositorBalance.accountBalance) + Number(depositorAmount);

    const { error: depositorUpdateError } = await supabase
      .from('User')
      .update({
        accountBalance: newBalance.toString()
      })
      .eq('id', body.userId);

    if (depositorUpdateError) {
      console.error('Supabase error updating depositor balance:', depositorUpdateError);
      return res.status(400).json({ error: depositorUpdateError.message });
    }

    // create compost report - pass the compostStandId and communityId we already have
    const reportData = convertDepositDTOToCompostReportData(body, compostStandId, depositorCommunityId);
    const { error: reportError } = await supabase
      .from('CompostReport')
      .insert(reportData);

    if (reportError) {
      console.error('Supabase error creating compost report:', reportError);
      return res.status(400).json({ error: reportError.message });
    }

    // respond with transactions
    console.log('Sending response transactions:', responseTransactions);
    console.log('Main transaction amount:', responseTransactions[0]?.amount, 'Type:', typeof responseTransactions[0]?.amount);
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
  const communityId = req.query.communityId as string | undefined;

  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - period);

  try {
    let query = supabase
      .from('Transaction')
      .select('id, recipientId, purchaserId, category, amount, createdAt, reason, isRequest')
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString())
      .eq('isRequest', false);
    if (communityId) {
      query = query.eq('communityId', communityId);
    }
    const { data: transactions, error: transactionsError } = await query;

    if (transactionsError) {
      console.error('Supabase error fetching transactions:', transactionsError);
      return res.status(500).json({ error: transactionsError.message });
    }

    const txns = transactions || [];

    // Collect unique user ids from purchaser and recipient
    const userIdsSet = new Set<string>();
    txns.forEach(t => {
      if (t.purchaserId) userIdsSet.add(t.purchaserId);
      if (t.recipientId) userIdsSet.add(t.recipientId);
    });
    const userIds = Array.from(userIdsSet);

    // Fetch user details for names
    let usersMap: Record<string, any> = {};
    if (userIds.length > 0) {
      const { data: users, error: usersError } = await supabase
        .from('User')
        .select('id, firstName, lastName')
        .in('id', userIds);

      if (usersError) {
        console.error('Supabase error fetching users:', usersError);
        return res.status(500).json({ error: usersError.message });
      }

      usersMap = (users || []).reduce((acc: Record<string, any>, u: any) => {
        acc[u.id] = u;
        return acc;
      }, {});
    }

    // Build response transactions with users array
    const responseTransactions = txns.map(t => ({
      ...t,
      amount: Number(t.amount),
      users: [
        t.purchaserId ? usersMap[t.purchaserId] : null,
        t.recipientId ? usersMap[t.recipientId] : null,
      ].filter(Boolean)
    }));

    res.status(200).send({
      count: responseTransactions.length,
      transactions: responseTransactions
    });
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
    // First, fetch the transaction to get its details
    const { data: transaction, error: fetchError } = await supabase
      .from('Transaction')
      .select('*')
      .eq('id', transactionId)
      .single();

    if (fetchError || !transaction) {
      console.error('Supabase error fetching transaction:', fetchError);
      return res.status(400).json({ error: fetchError?.message || 'Transaction not found' });
    }

    // Skip balance reversal for request transactions
    if (!transaction.isRequest) {
      const amount = parseFloat(transaction.amount.toString());
      
      if (transaction.category === 'DEPOSIT') {
        // For deposits: recipient (depositor) received the amount, so we deduct it
        const recipientId = transaction.recipientId;
        
        // Get current recipient balance
        const { data: recipientUser, error: recipientError } = await supabase
          .from('User')
          .select('accountBalance')
          .eq('id', recipientId)
          .single();

        if (recipientError) {
          console.error('Supabase error fetching recipient balance:', recipientError);
          return res.status(400).json({ error: recipientError.message });
        }

        // Deduct the amount from recipient (reversing the deposit)
        const { error: recipientUpdateError } = await supabase
          .from('User')
          .update({
            accountBalance: (parseFloat(recipientUser.accountBalance) - amount).toString()
          })
          .eq('id', recipientId);

        if (recipientUpdateError) {
          console.error('Supabase error updating recipient balance:', recipientUpdateError);
          return res.status(400).json({ error: recipientUpdateError.message });
        }
      } else {
        // For regular transactions: reverse the balance changes
        // Recipient received amount, so deduct it
        // Purchaser paid amount, so add it back
        
        // Get current balances
        const { data: recipientUser, error: recipientError } = await supabase
          .from('User')
          .select('accountBalance')
          .eq('id', transaction.recipientId)
          .single();

        const { data: purchaserUser, error: purchaserError } = await supabase
          .from('User')
          .select('accountBalance')
          .eq('id', transaction.purchaserId)
          .single();

        if (recipientError || purchaserError) {
          console.error('Supabase error fetching user balances:', recipientError || purchaserError);
          return res.status(400).json({ error: (recipientError || purchaserError)?.message });
        }

        // Reverse recipient balance (deduct what was added)
        const { error: recipientUpdateError } = await supabase
          .from('User')
          .update({
            accountBalance: (parseFloat(recipientUser.accountBalance) - amount).toString()
          })
          .eq('id', transaction.recipientId);

        if (recipientUpdateError) {
          console.error('Supabase error updating recipient balance:', recipientUpdateError);
          return res.status(400).json({ error: recipientUpdateError.message });
        }

        // Reverse purchaser balance (add back what was deducted)
        const { error: purchaserUpdateError } = await supabase
          .from('User')
          .update({
            accountBalance: (parseFloat(purchaserUser.accountBalance) + amount).toString()
          })
          .eq('id', transaction.purchaserId);

        if (purchaserUpdateError) {
          console.error('Supabase error updating purchaser balance:', purchaserUpdateError);
          return res.status(400).json({ error: purchaserUpdateError.message });
        }
      }
    }

    // Now delete the transaction
    const { data: deletedTransaction, error: deleteError } = await supabase
      .from('Transaction')
      .delete()
      .eq('id', transactionId)
      .select()
      .single();

    if (deleteError) {
      console.error('Supabase error deleting transaction:', deleteError);
      return res.status(400).json({ error: deleteError.message });
    }

    res.status(200).send(deletedTransaction);
  } catch (e: any) {
    console.error('Error in deleteTransaction:', e);
    res.status(400).json({ error: e.message });
  }
};

export const updateTransaction = async (
  req: RequestBody<{ id: string; amount: number; reason?: string }>,
  res: Response
) => {
  const { id, amount, reason } = req.body;
  
  try {
    // First, fetch the existing transaction
    const { data: existingTransaction, error: fetchError } = await supabase
      .from('Transaction')
      .select('*')
      .eq('id', id)
      .single();

    if (fetchError || !existingTransaction) {
      console.error('Supabase error fetching transaction:', fetchError);
      return res.status(400).json({ error: fetchError?.message || 'Transaction not found' });
    }

    const oldAmount = parseFloat(existingTransaction.amount.toString());
    const newAmount = parseFloat(amount.toString());
    const amountDifference = newAmount - oldAmount;

    // Skip balance updates for request transactions
    if (!existingTransaction.isRequest) {
      if (existingTransaction.category === 'DEPOSIT') {
        // For deposits: adjust recipient balance
        const recipientId = existingTransaction.recipientId;
        
        // Get current recipient balance
        const { data: recipientUser, error: recipientError } = await supabase
          .from('User')
          .select('accountBalance')
          .eq('id', recipientId)
          .single();

        if (recipientError) {
          console.error('Supabase error fetching recipient balance:', recipientError);
          return res.status(400).json({ error: recipientError.message });
        }

        // Adjust balance by the difference
        const { error: recipientUpdateError } = await supabase
          .from('User')
          .update({
            accountBalance: (parseFloat(recipientUser.accountBalance) + amountDifference).toString()
          })
          .eq('id', recipientId);

        if (recipientUpdateError) {
          console.error('Supabase error updating recipient balance:', recipientUpdateError);
          return res.status(400).json({ error: recipientUpdateError.message });
        }
      } else {
        // For regular transactions: adjust both recipient and purchaser balances
        const amountDiff = amountDifference;
        
        // Get current balances
        const { data: recipientUser, error: recipientError } = await supabase
          .from('User')
          .select('accountBalance')
          .eq('id', existingTransaction.recipientId)
          .single();

        const { data: purchaserUser, error: purchaserError } = await supabase
          .from('User')
          .select('accountBalance')
          .eq('id', existingTransaction.purchaserId)
          .single();

        if (recipientError || purchaserError) {
          console.error('Supabase error fetching user balances:', recipientError || purchaserError);
          return res.status(400).json({ error: (recipientError || purchaserError)?.message });
        }

        // Adjust recipient balance (add difference)
        const { error: recipientUpdateError } = await supabase
          .from('User')
          .update({
            accountBalance: (parseFloat(recipientUser.accountBalance) + amountDiff).toString()
          })
          .eq('id', existingTransaction.recipientId);

        if (recipientUpdateError) {
          console.error('Supabase error updating recipient balance:', recipientUpdateError);
          return res.status(400).json({ error: recipientUpdateError.message });
        }

        // Adjust purchaser balance (subtract difference - opposite of recipient)
        const { error: purchaserUpdateError } = await supabase
          .from('User')
          .update({
            accountBalance: (parseFloat(purchaserUser.accountBalance) - amountDiff).toString()
          })
          .eq('id', existingTransaction.purchaserId);

        if (purchaserUpdateError) {
          console.error('Supabase error updating purchaser balance:', purchaserUpdateError);
          return res.status(400).json({ error: purchaserUpdateError.message });
        }
      }
    }

    // Update the transaction
    const updateData: any = { amount: newAmount };
    if (reason !== undefined) {
      updateData.reason = reason;
    }

    const { data: updatedTransaction, error: updateError } = await supabase
      .from('Transaction')
      .update(updateData)
      .eq('id', id)
      .select()
      .single();

    if (updateError) {
      console.error('Supabase error updating transaction:', updateError);
      return res.status(400).json({ error: updateError.message });
    }

    res.status(200).send(updatedTransaction);
  } catch (e: any) {
    console.error('Error in updateTransaction:', e);
    res.status(400).json({ error: e.message });
  }
}