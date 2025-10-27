import { Request, Response } from 'express';
import { phoneNumberReqObject, userReqObject } from '../../types/userTypes';
import { supabase } from '../config/supabase';
import { ErrorRes } from '../../types/commonTypes';
import {
  convertUserWithTransactionsCountToCountArray,
  findUserIdByPhoneNumber,
} from '../utils';
import { randomUUID } from 'crypto';

type RequestBody<T> = Request<{}, {}, T>;

export const getAllUsers = async (_req: Request, res: Response) => {
  try {
    const { data: users, error } = await supabase
      .from('User')
      .select(`
        *,
        transactions:Transaction(*)
      `);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch users',
        message: error.message 
      });
    }

    res.json(users);
  } catch (error: any) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({ 
      error: 'Failed to fetch users',
      message: error.message 
    });
  }
};

export const getUserByNumber = async (req: Request<{ phoneNumber: string }>, res: Response) => {
  try {
    const { data: user, error } = await supabase
      .from('User')
      .select('id')
      .eq('phoneNumber', req.body.phoneNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(400).json({ error: 'User not found' });
      }
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).send({ userId: user.id });
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
}

export const saveNewUser = async (
  req: RequestBody<userReqObject>,
  res: Response
) => {
  const { firstName, lastName, phoneNumber, email } = req.body;
  
  try {
    const { data: user, error } = await supabase
      .from('User')
      .insert({
        id: randomUUID(),
        firstName,
        lastName,
        phoneNumber,
        ...(email && { email }),
      })
      .select(`
        *,
        transactions:Transaction(*)
      `)
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send(user);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

export const getUser = async (
  req: RequestBody<userReqObject>,
  res: Response
) => {
  const { phoneNumber } = req.body;
  
  try {
    const { data: user, error } = await supabase
      .from('User')
      .select(`
        *,
        transactions:Transaction(
          *,
          users:User(*)
        )
      `)
      .eq('phoneNumber', phoneNumber)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(400).json({ error: 'User not found' });
      }
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).send(user);
  } catch (e: any) {
    res.status(400).json({ error: e.message });
  }
};

interface userStatsRes {
  userCount: number;
  newUserCount: number;
  transactionsPerUser: number[];
  averageTransactionsPerUser: number;
  depositsPerUser: number[];
  period: number;
  totalCoins: number;
  balanceCounts: any;
}

/*
 * returns
 * userCount: Count of all users currently registered
 * newUserCount: Count of all users who registered in given period
 * transactionsPerUser: array of numbers each representing the number of transactions by a user
 * balanceCounts: represents spread of balances in the user pool
 */
export const userStats = async (
  req: Request<{ period?: string }>,
  res: Response<userStatsRes | ErrorRes>
) => {
  try {
    let period = 30;
    if (req.query.period && typeof req.query.period === 'string') {
      period = parseInt(req.query.period);
    }

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - period);

    // Get all users
    const { data: users, error: usersError } = await supabase
      .from('User')
      .select('id, accountBalance, createdAt');

    if (usersError) {
      console.error('Supabase error fetching users:', usersError);
      return res.status(500).json({ error: usersError.message });
    }

    const userIds = users?.map(u => u.id) || [];
    const userCount = users?.length || 0;

    // Get new users in the period
    const newUserCount = users?.filter(user => 
      new Date(user.createdAt) >= startDate
    ).length || 0;

    // Get transactions within the period
    const { data: transactions, error: transactionsError } = await supabase
      .from('Transaction')
      .select('purchaserId, recipientId, createdAt')
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString());

    if (transactionsError) {
      console.error('Supabase error fetching transactions:', transactionsError);
      return res.status(500).json({ error: transactionsError.message });
    }

    // Calculate transactions per user
    const transactionCounts: { [key: string]: number } = {};
    userIds.forEach(userId => {
      transactionCounts[userId] = 0;
    });

    transactions?.forEach(transaction => {
      if (transaction.purchaserId) {
        transactionCounts[transaction.purchaserId] = (transactionCounts[transaction.purchaserId] || 0) + 1;
      }
      if (transaction.recipientId) {
        transactionCounts[transaction.recipientId] = (transactionCounts[transaction.recipientId] || 0) + 1;
      }
    });

    const transactionsPerUser = Object.values(transactionCounts).filter(count => count > 0);
    const averageTransactionsPerUser = transactionsPerUser.length > 0 
      ? transactionsPerUser.reduce((a, b) => a + b, 0) / transactionsPerUser.length 
      : 0;

    // Get deposits within the period
    const { data: deposits, error: depositsError } = await supabase
      .from('Transaction')
      .select('purchaserId, recipientId, createdAt')
      .eq('category', 'DEPOSIT')
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString());

    if (depositsError) {
      console.error('Supabase error fetching deposits:', depositsError);
      return res.status(500).json({ error: depositsError.message });
    }

    // Calculate deposits per user (count deposits where user is recipient)
    const depositCounts: { [key: string]: number } = {};
    userIds.forEach(userId => {
      depositCounts[userId] = 0;
    });

    deposits?.forEach(deposit => {
      if (deposit.recipientId) {
        depositCounts[deposit.recipientId] = (depositCounts[deposit.recipientId] || 0) + 1;
      }
    });

    const depositsPerUser = Object.values(depositCounts).filter(count => count > 0);

    // Get all transaction amounts for total coins
    const { data: allTransactions, error: allTransactionsError } = await supabase
      .from('Transaction')
      .select('amount')
      .eq('category', 'DEPOSIT');

    if (allTransactionsError) {
      console.error('Supabase error fetching all transactions:', allTransactionsError);
      return res.status(500).json({ error: allTransactionsError.message });
    }

    const totalCoins = allTransactions?.reduce((sum, t) => sum + Number(t.amount), 0) || 0;

    // Calculate balance counts (simple distribution)
    const balanceRanges = [
      { min: 0, max: 5, count: 0 },
      { min: 6, max: 10, count: 0 },
      { min: 11, max: 20, count: 0 },
      { min: 21, max: 50, count: 0 },
      { min: 51, max: Infinity, count: 0 }
    ];

    users?.forEach(user => {
      const balance = parseFloat(user.accountBalance) || 0;
      for (const range of balanceRanges) {
        if (balance >= range.min && balance <= range.max) {
          range.count++;
          break;
        }
      }
    });

    const balanceCounts = balanceRanges.map(({ min, max, count }) => ({
      balance: max === Infinity ? `${min}+` : `${min}-${max}`,
      count
    }));

    const response: userStatsRes = {
      userCount,
      newUserCount,
      transactionsPerUser,
      averageTransactionsPerUser,
      depositsPerUser,
      period,
      totalCoins,
      balanceCounts
    };

    res.status(200).json(response);
  } catch (e: any) {
    console.error('Error in userStats:', e);
    res.status(500).json({ error: e.message });
  }
};

// ___________________CLEANUP___________________CLEANUP___________________CLEANUP___________________
export const deleteAllusers = async (_req: Request, res: Response) => {
  // TODO: Implement deleteAllusers with Supabase client
  res.status(501).json({ error: 'deleteAllusers endpoint not yet migrated to Supabase client' });
};

export const deleteUserByPhoneNumber = async (
  req: Request,
  res: Response
) => {
  // TODO: Implement deleteUserByPhoneNumber with Supabase client
  res.status(501).json({ error: 'deleteUserByPhoneNumber endpoint not yet migrated to Supabase client' });
};
