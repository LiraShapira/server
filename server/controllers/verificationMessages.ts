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
        // No row found
        console.error('Verification message not found for community: lira_shapira');
        return res.status(404).json({ error: 'Verification message not found' });
      }
      console.error('Supabase error fetching verification message:', error);
      return res.status(500).json({ 
        error: 'Failed to fetch verification message',
        message: error.message 
      });
    }

    res.json({ message: verificationMessage.message });
  } catch (error: any) {
    console.error('Error in getVerificationMessage:', error);
    res.status(500).json({ 
      error: 'Failed to fetch verification message',
      message: error.message 
    });
  }
};

