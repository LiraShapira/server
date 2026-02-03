import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export const getVerificationMessage = async (req: Request, res: Response) => {
  try {
    const communityId = req.query.communityId as string | undefined;
    let query = supabase.from('verification_messages').select('message');
    if (communityId) {
      query = query.eq('communityId', communityId);
    } else {
      // Fallback for backward compatibility when table has community_name
      query = query.eq('community_name', 'lira_shapira');
    }
    const { data: verificationMessage, error } = await query.single();

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

