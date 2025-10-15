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
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e instanceof Error ? e.message : 'Unknown error' });
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
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
};

export const getCompostStands = async (_req: Request, res: Response) => {
  try {
    const { data: stands, error } = await supabase
      .from('CompostStand')
      .select(`
        *,
        reports:CompostReport(*),
        admins:User(*)
      `);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send(stands);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e instanceof Error ? e.message : 'Unknown error' });
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
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e instanceof Error ? e.message : 'Unknown error' });
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
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send(reports);
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
}

// ____________________CLEANUP____________________CLEANUP____________________CLEANUP____________________

export async function deleteAllCompostStands(_req: Request, res: Response) {
  try {
    const { error } = await supabase
      .from('CompostStand')
      .delete()
      .neq('compostStandId', 0);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send('All compost stands deleted');
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e instanceof Error ? e.message : 'Unknown error' });
  }
}

export async function deleteAllCompostReports(_req: Request, res: Response) {
  try {
    const { error } = await supabase
      .from('CompostReport')
      .delete()
      .neq('compostReportId', '');

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    res.status(200).send('All compost reports deleted');
  } catch (e) {
    console.error(e);
    res.status(400).json({ error: e instanceof Error ? e.message : 'Unknown error' });
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
      return res.status(400).json({ error: error.message });
    }

    const reportsByMonth: {
      [key: string]: {
        weight: number;
        count: number;
        average?: number;
      };
    } = {};

    allReports?.forEach(report => {
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
    });

    Object.entries(reportsByMonth).forEach(([month, value]) => {
      reportsByMonth[month].average = Number((value.weight / value.count).toFixed(1));
    });

    res.status(200).send({ reportsByMonth });
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
};

export const compostStandStats = async (req: Request, res: Response) => {
  let period = 30;
  if (req.query.period && typeof req.query.period === 'string') {
    period = parseInt(req.query.period);
  }
  
  const dateQuery = {
    lte: new Date().toISOString(),
    gte: new Date(new Date().setDate(new Date().getDate() - period)).toISOString(),
  };

  try {
    const { data: reports, error } = await supabase
      .from('CompostReport')
      .select('compostStandId, depositWeight')
      .neq('userId', process.env.LIRA_SHAPIRA_USER_ID || '')
      .gte('date', dateQuery.gte)
      .lte('date', dateQuery.lte);

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Group by compost stand
    const standStats: { [key: number]: { weight: number; count: number } } = {};
    
    reports?.forEach(report => {
      const standId = report.compostStandId;
      const weight = parseFloat(report.depositWeight);
      
      if (standStats[standId]) {
        standStats[standId].weight += weight;
        standStats[standId].count += 1;
      } else {
        standStats[standId] = { weight, count: 1 };
      }
    });

    const depositsWeightsByStands = Object.entries(standStats).map(([standId, stats]) => ({
      id: standId,
      name: standsIdToNameMap[parseInt(standId)],
      depositWeightSum: stats.weight,
      averageDepositWeight: Number((stats.weight / stats.count).toFixed(2)),
      depositCount: stats.count
    })).sort((a, b) => b.depositWeightSum - a.depositWeightSum);

    const totalDeposits = depositsWeightsByStands.reduce((acc, cur) => cur.depositCount + acc, 0);

    // max age of 12 hours
    res.header('Cache-Control', 'max-age=43200');
    res.status(200).send({ depositsWeightsByStands, period, totalDeposits });
  } catch (e: any) {
    console.error(e);
    res.status(400).send({ error: e.message });
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
    const { data: reports, error } = await supabase
      .from('CompostReport')
      .select(`
        *,
        compostStand:CompostStand(*)
      `)
      .gte('date', from.toISOString())
      .lte('date', now.toISOString());

    if (error) {
      console.error('Supabase error:', error);
      return res.status(400).json({ error: error.message });
    }

    // Aggregate per stand
    const statsMap: Record<string, any> = {};
    
    reports?.forEach(rpt => {
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
      } else if (rpt.dryMatterPresent === 'yes') {
        s.dryMatterPresent.true++;
      } else if (rpt.dryMatterPresent === 'no') {
        s.dryMatterPresent.false++;
      }

      // boolean fields
      const booleanFields = ['cleanAndTidy', 'full', 'scalesProblem', 'bugs', 'compostSmell'] as const;
      booleanFields.forEach(prop => {
        const val = rpt[prop];
        if (val === null || val === undefined) {
          s[prop].missing++;
        } else {
          s[prop][String(val)]++;
        }
      });

      // notes
      if (rpt.notes && rpt.notes.trim().length > 0) {
        s.notes.with++;
      } else {
        s.notes.without++;
      }
    });

    // Convert map to array
    const stats = Object.values(statsMap);
    res.status(200).json(stats);
  } catch (e: any) {
    console.error(e);
    res.status(400).json({ error: e.message });
  }
};
