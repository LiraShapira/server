import { Request, Response } from 'express';
import { AddUsersLocalStandReqObject, CompostStandAdminsReq, CompostStandReqObject } from '../../types/compostStand';
import { supabase } from '../config/supabase';
import { standsIdToNameMap } from '../../constants/compostStands';
import { months } from '../utils';

type RequestBody<T> = Request<{}, {}, T>;

export const addMultipleCompostStands = async (
  req: RequestBody<(CompostStandReqObject & { communityId?: string })[]>,
  res: Response
) => {
  try {
    const stands = req.body.map(stand => ({
      compostStandId: stand.compostStandId,
      name: stand.name,
      ...(stand.communityId && { communityId: stand.communityId }),
    }));

    const { error } = await supabase
      .from('CompostStand')
      .insert(stands);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send('ok');
  } catch (e: any) {
    console.error('Error in addMultipleCompostStands:', e);
    res.status(400).json({ error: e.message });
  }
};

export const addCompostStand = async (
  req: RequestBody<{ name_en: string; name_he: string; compostStandId?: number; communityId: string }>,
  res: Response
) => {
  const { name_en, name_he, compostStandId, communityId } = req.body;

  if (!name_en || !name_he) {
    return res.status(400).json({ error: 'name_en and name_he are required' });
  }
  if (!communityId) {
    return res.status(400).json({ error: 'communityId is required' });
  }

  // Generate name from name_en: replace spaces with underscores and convert to lowercase
  const name = name_en.toLowerCase().replace(/\s+/g, '_');

  try {
    // If compostStandId is not provided, get the next available ID
    let standId = compostStandId;
    if (!standId) {
      const { data: existingStands, error: fetchError } = await supabase
        .from('CompostStand')
        .select('compostStandId')
        .order('compostStandId', { ascending: false })
        .limit(1);

      if (fetchError && fetchError.code !== 'PGRST116') { // PGRST116 is "no rows returned"
        console.error('Supabase error fetching max ID:', fetchError);
        return res.status(500).json({ error: fetchError.message });
      }

      standId = existingStands && existingStands.length > 0 
        ? existingStands[0].compostStandId + 1 
        : 1;
    }

    const { data: stand, error } = await supabase
      .from('CompostStand')
      .insert({
        compostStandId: standId,
        name,
        name_en,
        name_he,
        isActive: true, // New stands are active by default
        communityId,
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send(stand);
  } catch (e: any) {
    console.error('Error in addCompostStand:', e);
    res.status(400).json({ error: e.message });
  }
};

export const updateCompostStand = async (
  req: RequestBody<{ compostStandId: number; name_he?: string; name_en?: string; isActive?: boolean }>,
  res: Response
) => {
  const { compostStandId, name_he, name_en, isActive } = req.body;
  
  if (!compostStandId) {
    return res.status(400).json({ error: 'compostStandId is required' });
  }

  const updates: any = {};
  if (name_he !== undefined) updates.name_he = name_he;
  if (name_en !== undefined) {
    updates.name_en = name_en;
    // Update name if name_en changes
    updates.name = name_en.toLowerCase().replace(/\s+/g, '_');
  }
  if (isActive !== undefined) updates.isActive = isActive;

  if (Object.keys(updates).length === 0) {
    return res.status(400).json({ error: 'No fields to update' });
  }

  try {
    const { data: stand, error } = await supabase
      .from('CompostStand')
      .update(updates)
      .eq('compostStandId', compostStandId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send(stand);
  } catch (e: any) {
    console.error('Error in updateCompostStand:', e);
    res.status(400).json({ error: e.message });
  }
};

export const getCompostStands = async (req: Request, res: Response) => {
  try {
    const locale = (req.query.locale as string) || 'he'; // Default to Hebrew
    const includeInactive = req.query.includeInactive === 'true' || req.query.includeInactive === '1';
    const communityId = req.query.communityId as string | undefined;

    let query = supabase
      .from('CompostStand')
      .select(`
        compostStandId,
        name,
        name_he,
        name_en,
        isActive,
        reports:CompostReport(*),
        admins:User!User_adminCompostStandId_fkey(*)
      `);

    if (communityId) {
      query = query.eq('communityId', communityId);
    }
    // Filter by isActive unless includeInactive is true (for admin)
    if (!includeInactive) {
      query = query.eq('isActive', true);
    }

    const { data: stands, error } = await query.order('compostStandId', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Map stands to include localized display name
    const standsWithLocalizedNames = stands.map(stand => {
      // Handle locale: 'iw' is also Hebrew, 'en' is English
      const isEnglish = locale === 'en';
      const displayName = isEnglish 
        ? (stand.name_en || stand.name || 'Unknown')
        : (stand.name_he || stand.name_en || stand.name || 'Unknown');
      
      return {
        ...stand,
        displayName,
      };
    });

    res.status(200).send(standsWithLocalizedNames);
  } catch (e: any) {
    console.error('Error in getCompostStands:', e);
    res.status(500).json({ error: e.message });
  }
};


export async function setUsersLocalStand(
  req: RequestBody<AddUsersLocalStandReqObject>,
  res: Response
) {
  const { compostStandId, userId } = req.body;
  try {
    const { data: updatedUser, error } = await supabase
      .from('User')
      .update({
        userLocalCompostStandId: compostStandId,
      })
      .eq('id', userId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(201).send(updatedUser);
  } catch (e: any) {
    console.error('Error in setUsersLocalStand:', e);
    res.status(400).json({ error: e.message });
  }
}

export async function getCompostReports(req: Request, res: Response) {
  try {
    const communityId = req.query.communityId as string | undefined;
    let query = supabase
      .from('CompostReport')
      .select(`
        *,
        compostStand:CompostStand(*),
        user:User(*)
      `);
    if (communityId) {
      query = query.eq('communityId', communityId);
    }
    const { data: reports, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).send(reports);
  } catch (e: any) {
    console.error('Error in getCompostReports:', e);
    res.status(500).json({ error: e.message });
  }
}


// ____________________CLEANUP____________________CLEANUP____________________CLEANUP____________________

export async function deleteAllCompostStands(_req: Request, res: Response) {
  try {
    const { error } = await supabase
      .from('CompostStand')
      .delete()
      .neq('compostStandId', 0); // Delete all records

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send('All compost stands deleted');
  } catch (e: any) {
    console.error('Error in deleteAllCompostStands:', e);
    res.status(400).json({ error: e.message });
  }
}

export async function deleteAllCompostReports(_req: Request, res: Response) {
  try {
    const { error } = await supabase
      .from('CompostReport')
      .delete()
      .neq('compostReportId', ''); // Delete all records

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send('All compost reports deleted');
  } catch (e: any) {
    console.error('Error in deleteAllCompostReports:', e);
    res.status(400).json({ error: e.message });
  }
}

// ____________________STATS____________________STATS____________________STATS____________________
export const monthlyCompostStandStats = async (req: Request, res: Response) => {
  try {
    const { data: allReports, error } = await supabase
      .from('CompostReport')
      .select('depositWeight, date');

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    const reportsByMonth: {
      [key: string]: {
        weight: number;
        count: number;
        average?: number;
      };
    } = {};

    for (let i = 0; i < allReports.length; i++) {
      const report = allReports[i];
      const reportDate = new Date(report.date);
      const reportMonth = months[reportDate.getMonth()];
      const weight = parseFloat(report.depositWeight);
      
      if (reportsByMonth[reportMonth]) {
        reportsByMonth[reportMonth] = {
          weight: reportsByMonth[reportMonth].weight + weight,
          count: reportsByMonth[reportMonth].count + 1,
        };
      } else {
        reportsByMonth[reportMonth] = {
          weight: weight,
          count: 1,
        };
      }
    }
    
    Object.entries(reportsByMonth).forEach(([month, value]) => {
      reportsByMonth[month].average = Number((value.weight / value.count).toFixed(1));
    });

    res.status(200).send({ reportsByMonth });
  } catch (e: any) {
    console.error('Error in monthlyCompostStandStats:', e);
    res.status(400).json({ error: e.message });
  }
}

export const compostStandStats = async (req: Request, res: Response) => {
  let period = 30;
  if (req.query.period && typeof req.query.period === 'string') {
    period = parseInt(req.query.period);
  }
  const debug = req.query.debug === '1' || req.query.debug === 'true';
  const includeOrg = req.query.includeOrg === '1' || req.query.includeOrg === 'true';
  const communityId = req.query.communityId as string | undefined;

  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - period);
  startDate.setHours(0, 0, 0, 0);

  try {
    let query = supabase
      .from('CompostReport')
      .select('compostStandId, depositWeight, date, userId');

    if (communityId) {
      query = query.eq('communityId', communityId);
    }
    if (!debug && !includeOrg) {
      query = query.neq('userId', process.env.LIRA_SHAPIRA_USER_ID || '');
    }

    const { data: reports, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    if (debug) {
      const sample = (reports || []).slice(0, 5);
      return res.status(200).json({
        debug: true,
        received: { count: reports?.length || 0, sample },
        note: 'Debug mode bypasses userId exclusion and period filtering.'
      });
    }

    // Group by compostStandId and calculate stats
    const standStats: { [key: number]: { sum: number; count: number; weights: number[] } } = {};

    const filteredReports = (reports || []).filter((report: any) => {
      if (!report.date) return true; // include records without date
      const d = new Date(report.date);
      if (Number.isNaN(d.getTime())) return true;
      return d >= startDate && d <= endDate;
    });

    filteredReports.forEach(report => {
      const standId = report.compostStandId;
      const weight = parseFloat(report.depositWeight);
      
      if (!standStats[standId]) {
        standStats[standId] = { sum: 0, count: 0, weights: [] };
      }
      
      standStats[standId].sum += weight;
      standStats[standId].count += 1;
      standStats[standId].weights.push(weight);
    });

    // Fetch all stands to get names
    const { data: allStands, error: standsError } = await supabase
      .from('CompostStand')
      .select('compostStandId, name');
    
    const standIdToNameMap: Record<number, string> = {};
    if (!standsError && allStands) {
      allStands.forEach(stand => {
        standIdToNameMap[stand.compostStandId] = stand.name;
      });
    }

    const depositsWeightsByStands = Object.entries(standStats).map(([standId, stats]) => {
      const averageWeight = stats.count > 0 ? Number((stats.sum / stats.count).toFixed(2)) : 0;
      const standIdNum = parseInt(standId);
      
      return {
        id: standId,
        name: standIdToNameMap[standIdNum] || standsIdToNameMap[standIdNum] || `stand_${standId}`, // Fallback to hardcoded map, then generic name
        depositWeightSum: Number(stats.sum.toFixed(2)),
        averageDepositWeight: averageWeight,
        depositCount: stats.count
      };
    }).sort((a, b) => b.depositWeightSum - a.depositWeightSum);

    const totalDeposits = depositsWeightsByStands.reduce((acc, cur) => acc + cur.depositCount, 0);

    // max age of 12 hours
    res.header('Cache-Control', 'max-age=43200');
    res.status(200).send({ depositsWeightsByStands, period, totalDeposits });
  } catch (e: any) {
    console.error('Error in compostStandStats:', e);
    res.status(400).json({ error: e.message });
  }
};


export const getCompostReportsStats = async (req: Request, res: Response) => {
  let period = 30;
  if (req.query.period && typeof req.query.period === 'string') {
    period = parseInt(req.query.period, 10);
  }
  const communityId = req.query.communityId as string | undefined;

  const now = new Date();
  now.setHours(23, 59, 59, 999);
  const from = new Date(now);
  from.setDate(now.getDate() - period);
  from.setHours(0, 0, 0, 0);

  try {
    let query = supabase
      .from('CompostReport')
      .select(`
        *,
        compostStand:CompostStand(name)
      `)
      .gte('date', from.toISOString())
      .lte('date', now.toISOString());
    if (communityId) {
      query = query.eq('communityId', communityId);
    }
    const { data: reports, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Aggregate per stand
    const statsMap: Record<string, any> = {};
    for (const rpt of reports) {
      const sid = rpt.compostStandId;
      const standName = rpt.compostStand.name;
      if (!statsMap[sid]) {
        statsMap[sid] = {
          compostStandId: sid,
          standName,
          total: 0,
          compostSmell: { true: 0, false: 0, missing: 0 },
          cleanAndTidy: { true: 0, false: 0, missing: 0 },
          full: { true: 0, false: 0, missing: 0 },
          scalesProblem: { true: 0, false: 0, missing: 0 },
          bugs: { true: 0, false: 0, missing: 0 },
          notes: { with: 0, without: 0 },
          dryMatterPresent: { true: 0, false: 0, missing: 0 }
        };
      }
      const s = statsMap[sid];
      s.total++;

      if (rpt.dryMatterPresent === null || rpt.dryMatterPresent === undefined) {
        s.dryMatterPresent.missing++;
      } else if (rpt.dryMatterPresent == 'yes') {
        s.dryMatterPresent.true++;
      } else if (rpt.dryMatterPresent == 'no') {
        s.dryMatterPresent.false++;
      }

      // boolean fields
      for (const prop of ['cleanAndTidy', 'full', 'scalesProblem', 'bugs', 'compostSmell'] as const) {
        const val = (rpt as any)[prop];
        if (val === null || val === undefined) s[prop].missing++;
        else s[prop][String(val)]++;
      }

      // notes
      if (rpt.notes && rpt.notes.trim().length > 0) s.notes.with++;
      else s.notes.without++;
    }

    // Convert map to array
    const stats = Object.values(statsMap);
    res.status(200).json(stats);
  } catch (e: any) {
    console.error('Error in getCompostReportsStats:', e);
    res.status(500).json({ error: e.message });
  }
};
