import { Request, Response } from 'express';
import { AddUsersLocalStandReqObject, CompostStandAdminsReq, CompostStandReqObject } from '../../types/compostStand';
import { supabase } from '../config/supabase';
import { standsIdToNameMap } from '../../constants/compostStands';
import { months } from '../utils';

type RequestBody<T> = Request<{}, {}, T>;

export const addMultipleCompostStands = async (
  req: RequestBody<CompostStandReqObject[]>,
  res: Response
) => {
  try {
    const stands = req.body.map(stand => ({
      compostStandId: stand.compostStandId,
      name: stand.name,
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
  req: RequestBody<CompostStandReqObject>,
  res: Response
) => {
  const { compostStandId, name } = req.body;
  try {
    const { data: stand, error } = await supabase
      .from('CompostStand')
      .insert({
        compostStandId: compostStandId,
        name,
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

export const getCompostStands = async (_req: Request, res: Response) => {
  try {
    const { data: stands, error } = await supabase
      .from('CompostStand')
      .select(`
        *,
        reports:CompostReport(*),
        admins:User!User_adminCompostStandId_fkey(*)
      `);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    res.status(200).send(stands);
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
    const { data: reports, error } = await supabase
      .from('CompostReport')
      .select(`
        *,
        compostStand:CompostStand(*),
        user:User(*)
      `);

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
  
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(endDate.getDate() - period);

  try {
    const { data: reports, error } = await supabase
      .from('CompostReport')
      .select('compostStandId, depositWeight')
      .neq('userId', process.env.LIRA_SHAPIRA_USER_ID || '')
      .gte('date', startDate.toISOString())
      .lte('date', endDate.toISOString());

    if (error) {
      console.error('Supabase error:', error);
      return res.status(500).json({ error: error.message });
    }

    // Group by compostStandId and calculate stats
    const standStats: { [key: number]: { sum: number; count: number; weights: number[] } } = {};
    
    reports.forEach(report => {
      const standId = report.compostStandId;
      const weight = parseFloat(report.depositWeight);
      
      if (!standStats[standId]) {
        standStats[standId] = { sum: 0, count: 0, weights: [] };
      }
      
      standStats[standId].sum += weight;
      standStats[standId].count += 1;
      standStats[standId].weights.push(weight);
    });

    const depositsWeightsByStands = Object.entries(standStats).map(([standId, stats]) => {
      const averageWeight = stats.count > 0 ? Number((stats.sum / stats.count).toFixed(2)) : 0;
      
      return {
        id: standId,
        name: standsIdToNameMap[parseInt(standId)],
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

  const now = new Date();
  const from = new Date(now);
  from.setDate(now.getDate() - period);

  try {
    // Fetch all reports in period, including stand info
    const { data: reports, error } = await supabase
      .from('CompostReport')
      .select(`
        *,
        compostStand:CompostStand(name)
      `)
      .gte('date', from.toISOString())
      .lte('date', now.toISOString());

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
