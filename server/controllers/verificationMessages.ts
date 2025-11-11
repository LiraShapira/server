import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const getVerificationMessage = async (_req: Request, res: Response) => {
  try {
    const { data: verificationMessage, error } = await supabase
      .from('verification_messages')
      .select('message')
      .eq('community_name', 'lira_shapira')
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Verification message not found' });
      }
      return res.status(500).json({ 
        error: 'Failed to fetch verification message',
        message: error.message 
      });
    }

    if (!verificationMessage || !verificationMessage.message) {
      return res.status(404).json({ error: 'Verification message not found or message field is empty' });
    }

    res.json({ message: verificationMessage.message });
  } catch (error: any) {
    return res.status(500).json({ 
      error: 'Failed to fetch verification message',
      message: error.message 
    });
  }
};

