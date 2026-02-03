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

export const getAllUsers = async (req: Request, res: Response) => {
  try {
    const communityId = req.query.communityId as string | undefined;
    let query = supabase
      .from('User')
      .select(`
        *,
        transactions:Transaction(*)
      `);
    if (communityId) {
      query = query.eq('communityId', communityId);
    }
    const { data: users, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        error: 'Failed to fetch users',
        message: error.message,
      });
    }

    res.json(users);
  } catch (error: any) {
    console.error('Error in getAllUsers:', error);
    res.status(500).json({
      error: 'Failed to fetch users',
      message: error.message,
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
  const { firstName, lastName, phoneNumber, email, communityId } = req.body;

  if (!firstName || !lastName) {
    return res.status(400).json({ error: 'firstName and lastName are required for registration' });
  }
  if (!communityId) {
    return res.status(400).json({ error: 'communityId is required for registration' });
  }

  try {
    const { data: user, error } = await supabase
      .from('User')
      .insert({
        id: randomUUID(),
        firstName,
        lastName,
        phoneNumber,
        communityId,
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

    let communityCoin: string | null = null;
    if (communityId) {
      const { data: community } = await supabase
        .from('Community')
        .select('Coin, coin')
        .eq('id', communityId)
        .single();
      communityCoin = (community as any)?.Coin ?? (community as any)?.coin ?? null;
    }
    res.status(200).send({ ...user, communityCoin });
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
    // 1) Fetch the user by phone number
    const { data: baseUser, error: userError } = await supabase
      .from('User')
      .select('*')
      .eq('phoneNumber', phoneNumber)
      .single();

    if (userError) {
      if (userError.code === 'PGRST116') {
        return res.status(400).json({ error: 'User not found' });
      }
      console.error('Supabase error (getUser user fetch):', userError);
      return res.status(500).json({ error: userError.message });
    }

    // 2) Fetch all transactions where the user is purchaser or recipient
    const { data: transactions, error: txError } = await supabase
      .from('Transaction')
      .select('*')
      .or(`purchaserId.eq.${baseUser.id},recipientId.eq.${baseUser.id}`)
      .order('createdAt', { ascending: false });

    if (txError) {
      console.error('Supabase error (getUser transactions fetch):', txError);
      return res.status(500).json({ error: txError.message });
    }

    // 3) Collect all related userIds from transactions and fetch those users once
    const relatedUserIds = Array.from(
      new Set(
        (transactions || [])
          .flatMap(t => [t.purchaserId, t.recipientId])
          .filter((id): id is string => Boolean(id))
      )
    );

    let usersById: Record<string, any> = {};
    if (relatedUserIds.length > 0) {
      const { data: relatedUsers, error: usersError } = await supabase
        .from('User')
        .select('*')
        .in('id', relatedUserIds);

      if (usersError) {
        console.error('Supabase error (getUser related users fetch):', usersError);
        return res.status(500).json({ error: usersError.message });
      }

      usersById = (relatedUsers || []).reduce((acc: Record<string, any>, u: any) => {
        acc[u.id] = u;
        return acc;
      }, {});
    }

    // 4) Attach users array to each transaction to match app expectations
    const transactionsWithUsers = (transactions || []).map(t => {
      const purchaser = t.purchaserId ? usersById[t.purchaserId] : null;
      const recipient = t.recipientId ? usersById[t.recipientId] : null;
      const users = [purchaser, recipient].filter(Boolean);
      return { ...t, users };
    });

    // 5) Optionally fetch community for coin name
    let communityCoin: string | null = null;
    if (baseUser.communityId) {
      const { data: community } = await supabase
        .from('Community')
        .select('Coin, coin')
        .eq('id', baseUser.communityId)
        .single();
      communityCoin = (community as any)?.Coin ?? (community as any)?.coin ?? null;
    }

    // 6) Return the user merged with transactions and communityCoin
    const responseUser = {
      ...baseUser,
      transactions: transactionsWithUsers,
      ...(communityCoin != null && { communityCoin }),
    };

    res.status(200).send(responseUser);
  } catch (e: any) {
    console.error('Error in getUser:', e);
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
  req: Request<{ period?: string; communityId?: string }>,
  res: Response<userStatsRes | ErrorRes>
) => {
  try {
    let period = 30;
    if (req.query.period && typeof req.query.period === 'string') {
      period = parseInt(req.query.period);
    }
    const communityId = req.query.communityId as string | undefined;

    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - period);

    // Get users (optionally filtered by community)
    let usersQuery = supabase
      .from('User')
      .select('id, accountBalance, createdAt');
    if (communityId) {
      usersQuery = usersQuery.eq('communityId', communityId);
    }
    const { data: users, error: usersError } = await usersQuery;

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

    // Get transactions within the period (optionally by community)
    let transactionsQuery = supabase
      .from('Transaction')
      .select('purchaserId, recipientId, createdAt')
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString());
    if (communityId) {
      transactionsQuery = transactionsQuery.eq('communityId', communityId);
    }
    const { data: transactions, error: transactionsError } = await transactionsQuery;

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

    // Get deposits within the period (optionally by community)
    let depositsQuery = supabase
      .from('Transaction')
      .select('purchaserId, recipientId, createdAt')
      .eq('category', 'DEPOSIT')
      .gte('createdAt', startDate.toISOString())
      .lte('createdAt', endDate.toISOString());
    if (communityId) {
      depositsQuery = depositsQuery.eq('communityId', communityId);
    }
    const { data: deposits, error: depositsError } = await depositsQuery;

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

    // Get all transaction amounts for total coins (optionally by community)
    let allTxQuery = supabase
      .from('Transaction')
      .select('amount')
      .eq('category', 'DEPOSIT');
    if (communityId) {
      allTxQuery = allTxQuery.eq('communityId', communityId);
    }
    const { data: allTransactions, error: allTransactionsError } = await allTxQuery;

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

export const verifyUser = async (
  req: RequestBody<{ userId: string }>,
  res: Response
) => {
  const { userId } = req.body;
  
  try {
    const { data: user, error } = await supabase
      .from('User')
      .update({ isVerified: true })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error verifying user:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send(user);
  } catch (e: any) {
    console.error('Error in verifyUser:', e);
    res.status(400).json({ error: e.message });
  }
};

export const toggleBanUser = async (
  req: RequestBody<{ userId: string }>,
  res: Response
) => {
  const { userId } = req.body;
  
  try {
    // First, get the current ban status
    const { data: currentUser, error: fetchError } = await supabase
      .from('User')
      .select('isBanned')
      .eq('id', userId)
      .single();

    if (fetchError) {
      console.error('Supabase error fetching user:', fetchError);
      return res.status(400).json({ error: fetchError.message });
    }

    // Toggle the ban status (treat null/undefined as false)
    const newBanStatus = !(currentUser.isBanned === true);

    const { data: user, error } = await supabase
      .from('User')
      .update({ isBanned: newBanStatus })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error toggling ban:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send(user);
  } catch (e: any) {
    console.error('Error in toggleBanUser:', e);
    res.status(400).json({ error: e.message });
  }
};
