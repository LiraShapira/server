import { Request, Response } from 'express';
import { supabase } from '../config/supabase';

export interface CommunityRow {
  id: string;
  CommunityName?: string;
  CommunityLocation?: string;
  Coin?: string;
  communityName?: string;
  communityLocation?: string;
  coin?: string;
  orgUserId?: string;
}

function toCommunityResponse(row: CommunityRow) {
  return {
    id: row.id,
    CommunityName: row.CommunityName ?? row.communityName ?? '',
    CommunityLocation: row.CommunityLocation ?? row.communityLocation ?? '',
    Coin: row.Coin ?? row.coin ?? '',
    ...(row.orgUserId && { orgUserId: row.orgUserId }),
  };
}

export const getCommunities = async (_req: Request, res: Response) => {
  try {
    const { data: rows, error } = await supabase
      .from('Community')
      .select('*');

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({
        error: 'Failed to fetch communities',
        message: error.message,
      });
    }

    const communities = (rows || []).map((r: CommunityRow) => toCommunityResponse(r));
    res.json(communities);
  } catch (error: any) {
    console.error('Error in getCommunities:', error);
    res.status(500).json({
      error: 'Failed to fetch communities',
      message: error.message,
    });
  }
};

export const getCommunityById = async (req: Request<{ id: string }>, res: Response) => {
  try {
    const { id } = req.params;
    const { data: row, error } = await supabase
      .from('Community')
      .select('*')
      .eq('id', id)
      .single();

    if (error) {
      if (error.code === 'PGRST116') {
        return res.status(404).json({ error: 'Community not found' });
      }
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.json(toCommunityResponse(row as CommunityRow));
  } catch (error: any) {
    console.error('Error in getCommunityById:', error);
    res.status(500).json({
      error: 'Failed to fetch community',
      message: error.message,
    });
  }
};
