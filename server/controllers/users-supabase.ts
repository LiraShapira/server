import { Request, Response } from 'express';
import { phoneNumberReqObject, userReqObject } from '../../types/userTypes';
import { supabase } from '../config/supabase';
import { ErrorRes } from '../../types/commonTypes';

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
};

export const saveNewUser = async (
  req: RequestBody<userReqObject>,
  res: Response
) => {
  const { firstName, lastName, phoneNumber, email } = req.body;
  
  try {
    const { data: user, error } = await supabase
      .from('User')
      .insert({
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
