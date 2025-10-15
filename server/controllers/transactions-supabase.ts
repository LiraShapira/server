import { Request, Response } from 'express';
import { supabase } from '../config/supabase';
import {
  DepositDTO, HandleRequestDTO,
  TransactionDTO,
} from '../../types/transactionTypes';
import { Category } from '@prisma/client';
import { convertDepositDTOToCompostReportData, findUserIdByPhoneNumber } from '../utils';
import { standsNameToIdMap } from '../../constants/compostStands';

type RequestBody<T> = Request<{}, {}, T>;

export const getAllTransactions = async (_req: Request, res: Response) => {
  try {
    const { data: transactions, error } = await supabase
      .from('Transaction')
      .select(`
        *,
        users:User(*)
      `);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch transactions',
        message: error.message 
      });
    }

    res.json(transactions);
  } catch (error: any) {
    console.error('Error in getAllTransactions:', error);
    res.status(500).json({ 
      error: 'Failed to fetch transactions',
      message: error.message 
    });
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
        category: transaction.category,
        amount: transaction.amount,
        purchaserId: transaction.purchaserId,
        reason: transaction.reason,
        recipientId,
        isRequest: transaction.isRequest,
      })
      .select(`
        *,
        users:User(*)
      `)
      .single();

    if (transactionError) {
      console.error('Supabase error creating transaction:', transactionError);
      return res.status(400).json({ error: transactionError.message });
    }

    // Connect users to the transaction
    const { error: userConnectionError } = await supabase
      .from('_TransactionToUser')
      .insert([
        { A: newTransaction.id, B: recipientId },
        { A: newTransaction.id, B: transaction.purchaserId }
      ]);

    if (userConnectionError) {
      console.error('Supabase error connecting users:', userConnectionError);
      return res.status(400).json({ error: userConnectionError.message });
    }

    if (transaction.isRequest) {
      res.status(201).json(newTransaction);
      return;
    }

    // Update user balances for non-request transactions
    // First get current balances
    const { data: recipient, error: recipientFetchError } = await supabase
      .from('User')
      .select('accountBalance')
      .eq('id', recipientId)
      .single();

    if (recipientFetchError) {
      console.error('Supabase error fetching recipient:', recipientFetchError);
      return res.status(400).json({ error: recipientFetchError.message });
    }

    const { data: purchaser, error: purchaserFetchError } = await supabase
      .from('User')
      .select('accountBalance')
      .eq('id', transaction.purchaserId)
      .single();

    if (purchaserFetchError) {
      console.error('Supabase error fetching purchaser:', purchaserFetchError);
      return res.status(400).json({ error: purchaserFetchError.message });
    }

    // Update balances
    const newRecipientBalance = parseFloat(recipient.accountBalance) + parseFloat(transaction.amount.toString());
    const newPurchaserBalance = parseFloat(purchaser.accountBalance) - parseFloat(transaction.amount.toString());

    const { error: recipientUpdateError } = await supabase
      .from('User')
      .update({ accountBalance: newRecipientBalance.toString() })
      .eq('id', recipientId);

    if (recipientUpdateError) {
      console.error('Supabase error updating recipient balance:', recipientUpdateError);
      return res.status(400).json({ error: recipientUpdateError.message });
    }

    const { error: purchaserUpdateError } = await supabase
      .from('User')
      .update({ accountBalance: newPurchaserBalance.toString() })
      .eq('id', transaction.purchaserId);

    if (purchaserUpdateError) {
      console.error('Supabase error updating purchaser balance:', purchaserUpdateError);
      return res.status(400).json({ error: purchaserUpdateError.message });
    }

    res.status(201).json(newTransaction);
  } catch (e: any) {
    console.log(e);
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

    // Create main transaction for depositor (org as purchaser)
    const { data: mainTransaction, error: transactionError } = await supabase
      .from('Transaction')
      .insert({
        amount: netGained,
        category: Category.DEPOSIT,
        purchaserId: orgId,
        recipientId: body.userId,
        reason: 'Deposit',
      })
      .select(`
        *,
        users:User(*)
      `)
      .single();

    if (transactionError) {
      console.error('Supabase error creating main transaction:', transactionError);
      return res.status(400).json({ error: transactionError.message });
    }

    // Connect users to the transaction
    const { error: userConnectionError } = await supabase
      .from('_TransactionToUser')
      .insert([
        { A: mainTransaction.id, B: orgId },
        { A: mainTransaction.id, B: body.userId }
      ]);

    if (userConnectionError) {
      console.error('Supabase error connecting users:', userConnectionError);
      return res.status(400).json({ error: userConnectionError.message });
    }

    const responseTransactions: any[] = [];

    // Helper to normalize users for response
    const normalizeUsers = (tx: any) => {
      const list = [...tx.users];
      if (tx.purchaserId === tx.recipientId) {
        list.push({ ...list[0] });
      }
      return list;
    };

    // Add main transaction to response
    responseTransactions.push({
      ...mainTransaction,
      users: normalizeUsers(mainTransaction),
      amount: netGained,
    });

    // Fetch stand admins
    const { data: stand, error: standError } = await supabase
      .from('CompostStand')
      .select(`
        *,
        admins:User(*)
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

        // Update admin balance
        const { data: adminUser, error: adminFetchError } = await supabase
          .from('User')
          .select('accountBalance')
          .eq('id', admin.id)
          .single();

        if (adminFetchError) {
          console.error('Supabase error fetching admin:', adminFetchError);
          continue;
        }

        const newAdminBalance = parseFloat(adminUser.accountBalance) + share;
        const { error: adminUpdateError } = await supabase
          .from('User')
          .update({ accountBalance: newAdminBalance.toString() })
          .eq('id', admin.id);

        if (adminUpdateError) {
          console.error('Supabase error updating admin balance:', adminUpdateError);
          continue;
        }

        // Create admin transaction
        const { data: adminTransaction, error: adminTransactionError } = await supabase
          .from('Transaction')
          .insert({
            amount: share,
            category: Category.DEPOSIT,
            purchaserId: body.userId,
            recipientId: admin.id,
            reason: 'StandAdminPayment',
          })
          .select(`
            *,
            users:User(*)
          `)
          .single();

        if (adminTransactionError) {
          console.error('Supabase error creating admin transaction:', adminTransactionError);
          continue;
        }

        // Connect users to admin transaction
        await supabase
          .from('_TransactionToUser')
          .insert([
            { A: adminTransaction.id, B: body.userId },
            { A: adminTransaction.id, B: admin.id }
          ]);

        responseTransactions.push({
          ...adminTransaction,
          users: normalizeUsers(adminTransaction),
          amount: share,
        });
      }
    }

    // Update depositor balance
    const { data: depositorUser, error: depositorFetchError } = await supabase
      .from('User')
      .select('accountBalance')
      .eq('id', body.userId)
      .single();

    if (depositorFetchError) {
      console.error('Supabase error fetching depositor:', depositorFetchError);
      return res.status(400).json({ error: depositorFetchError.message });
    }

    const newDepositorBalance = parseFloat(depositorUser.accountBalance) + netGained;
    const { error: depositorUpdateError } = await supabase
      .from('User')
      .update({ accountBalance: newDepositorBalance.toString() })
      .eq('id', body.userId);

    if (depositorUpdateError) {
      console.error('Supabase error updating depositor balance:', depositorUpdateError);
      return res.status(400).json({ error: depositorUpdateError.message });
    }

    // Create compost report
    const compostReportData = convertDepositDTOToCompostReportData(body);
    const { error: reportError } = await supabase
      .from('CompostReport')
      .insert(compostReportData);

    if (reportError) {
      console.error('Supabase error creating compost report:', reportError);
      return res.status(400).json({ error: reportError.message });
    }

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
  
  try {
    if (isRequestAccepted) {
      // Update transaction to mark as accepted
      const { data: updatedTransaction, error: updateError } = await supabase
        .from('Transaction')
        .update({ isRequest: false })
        .eq('id', transactionId)
        .select()
        .single();

      if (updateError) {
        console.error('Supabase error updating transaction:', updateError);
        return res.status(400).json({ error: updateError.message });
      }

      // Update user balances
      const { data: recipient, error: recipientFetchError } = await supabase
        .from('User')
        .select('accountBalance')
        .eq('id', transaction.recipientId)
        .single();

      if (recipientFetchError) {
        console.error('Supabase error fetching recipient:', recipientFetchError);
        return res.status(400).json({ error: recipientFetchError.message });
      }

      const { data: purchaser, error: purchaserFetchError } = await supabase
        .from('User')
        .select('accountBalance')
        .eq('id', transaction.purchaserId)
        .single();

      if (purchaserFetchError) {
        console.error('Supabase error fetching purchaser:', purchaserFetchError);
        return res.status(400).json({ error: purchaserFetchError.message });
      }

      const newRecipientBalance = parseFloat(recipient.accountBalance) + parseFloat(transaction.amount.toString());
      const newPurchaserBalance = parseFloat(purchaser.accountBalance) - parseFloat(transaction.amount.toString());

      const { error: recipientUpdateError } = await supabase
        .from('User')
        .update({ accountBalance: newRecipientBalance.toString() })
        .eq('id', transaction.recipientId);

      if (recipientUpdateError) {
        console.error('Supabase error updating recipient balance:', recipientUpdateError);
        return res.status(400).json({ error: recipientUpdateError.message });
      }

      const { error: purchaserUpdateError } = await supabase
        .from('User')
        .update({ accountBalance: newPurchaserBalance.toString() })
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
  } catch (e) {
    console.error(e);
    res.status(400).send(e);
  }
};

export const transactionStats = async (req: Request, res: Response) => {
  let period = 30;
  if (req.query.period && typeof req.query.period === 'string') {
    period = parseInt(req.query.period);
  }

  const dateQuery = {
    lte: new Date().toISOString(),
    gte: new Date(new Date().setDate(new Date().getDate() - period)).toISOString(),
  };

  try {
    const { data: transactions, error } = await supabase
      .from('Transaction')
      .select('category, amount')
      .eq('isRequest', false)
      .gte('createdAt', dateQuery.gte)
      .lte('createdAt', dateQuery.lte);

    if (error) {
      console.error('Supabase error fetching transaction stats:', error);
      return res.status(400).json({ error: error.message });
    }

    // Group by category and sum amounts
    const categoryTotals: { [key: string]: number } = {};
    transactions?.forEach(transaction => {
      const category = transaction.category;
      if (!categoryTotals[category]) {
        categoryTotals[category] = 0;
      }
      categoryTotals[category] += parseFloat(transaction.amount);
    });

    const transactionAmountByCategory = Object.entries(categoryTotals).map(([category, amount]) => ({
      category,
      amount
    }));

    res.status(200).send({ transactionAmountByCategory });
  } catch (e: any) {
    console.error(e);
    res.status(400).send({ error: e.message });
  }
};

export const deleteTransaction = async (
  req: Request<{ id: string }>,
  res: Response
) => {
  const transactionId = req.params.id;
  try {
    const { error } = await supabase
      .from('Transaction')
      .delete()
      .eq('id', transactionId);

    if (error) {
      console.error('Supabase error deleting transaction:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send({ id: transactionId });
  } catch (e) {
    console.error(e);
    res.status(400).send(e);
  }
};
