import { Request, Response } from 'express';
import { AddUsersLocalStandReqObject, CompostStandAdminsReq, CompostStandReqObject } from '../../types/compostStand';
import { prisma } from '..';
import { standsIdToNameMap } from '../../constants/compostStands';
import { months } from '../utils';
import { Decimal } from '@prisma/client/runtime/library';

type RequestBody<T> = Request<{}, {}, T>;

export const addMultipleCompostStands = async (
  req: RequestBody<CompostStandReqObject[]>,
  res: Response
) => {
  try {
    req.body.forEach(async (stand) => {
      await prisma.compostStand.create({
        data: {
          compostStandId: stand.compostStandId,
          name: stand.name,
        },
      });
    });
    res.status(200).send('ok');
  } catch (e) {
    res.status(400);
    console.log(e);
  }
};

export const addCompostStand = async (
  req: RequestBody<CompostStandReqObject>,
  res: Response
) => {
  const { compostStandId, name } = req.body;
  try {
    const stand = await prisma.compostStand.create({
      data: {
        compostStandId: compostStandId,
        name,
      },
    });
    res.status(200).send(stand);
  } catch (e) {
    res.status(400);
    console.log(e);
  }
};

export const getCompostStands = async (_req: Request, res: Response) => {
  try {
    const stands = await prisma.compostStand.findMany({
      include: {
        reports: true,
        admins: true,
      },
    });
    res.status(200).send(stands);
  } catch (e) {
    console.log(e);
    res.send(400);
  }
};


export async function setUsersLocalStand(
  req: RequestBody<AddUsersLocalStandReqObject>,
  res: Response
) {
  const { compostStandId, userId } = req.body;
  try {
    const updatedUser = await prisma.user.update({
      where: {
        id: userId,
      },
      data: {
        userLocalCompostStandId: compostStandId,
      },
    });
    res.status(201).send(updatedUser);
  } catch (e) {
    console.log(e);
    res.send(400);
  }
}

export async function getCompostReports(req: Request, res: Response) {


  try {
    const reports = await prisma.compostReport.findMany({
      include: {
        compostStand: true,
        user: true,
      },
    });
    res.status(200).send(reports);
  } catch (e) {
    console.log(e);
    res.send(400);
  }
}


// ____________________CLEANUP____________________CLEANUP____________________CLEANUP____________________

export async function deleteAllCompostStands(_req: Request, res: Response) {
  try {
    await prisma.compostStand.deleteMany();
    res.status(200).send('All compost stands deleted');
  } catch (e) {
    console.log(e);
    res.send(400);
  }
}

export async function deleteAllCompostReports(_req: Request, res: Response) {
  try {
    await prisma.compostReport.deleteMany();
    res.status(200).send('All compost reports deleted');
  } catch (e) {
    console.log(e);
    res.send(400);
  }
}

// ____________________STATS____________________STATS____________________STATS____________________
export const monthlyCompostStandStats = async (req: Request, res: Response) => {
  try {
    const allReports = await prisma.compostReport.findMany();
    const reportsByMonth: {
      [key: string]: {
        weight: Decimal;
        count: number;
        average?: number;
      };
    } = {};

    for (let i = 0; i < allReports.length; i++) {
      const report = allReports[i];
      const reportMonth = months[report.date.getMonth()];
      if (reportsByMonth[reportMonth]) {
        reportsByMonth[reportMonth] = {
          weight: reportsByMonth[reportMonth].weight.plus(report.depositWeight),
          count: reportsByMonth[reportMonth].count + 1,
        };
      } else {
        reportsByMonth[reportMonth] = {
          weight: report.depositWeight,
          count: 1,
        };
      }
    }
    Object.entries(reportsByMonth).forEach(([month, value]) => {
      reportsByMonth[month].average = value.weight.div(value.count).toDecimalPlaces(1).toNumber();
    })

    res.status(200).send({ reportsByMonth })
  } catch (e: any) {
    res.send(400).json({ error: e.message });
  }
}

export const compostStandStats = async (req: Request, res: Response) => {
  let period = 30;
  if (req.query.period && typeof req.query.period === 'string') {
    period = parseInt(req.query.period);
  }
  const dateQuery = {
    lte: new Date(),
    gte: new Date(new Date().setDate(new Date().getDate() - period)),
  };

  try {
    const groupStandsDepositWeights = await prisma.compostReport.groupBy({
      by: ['compostStandId'],
      _sum: {
        depositWeight: true,
      },
      _avg: {
        depositWeight: true
      },
      _count: {
        depositWeight: true
      },
      where: {
        NOT: {
          userId: process.env.LIRA_SHAPIRA_USER_ID,
        },
        date: dateQuery,
      },
    });


    const depositsWeightsByStands = groupStandsDepositWeights.map((stand) => {
      return {
        id: stand.compostStandId.toString(),
        name: standsIdToNameMap[stand.compostStandId],
        depositWeightSum: stand._sum.depositWeight ? stand._sum.depositWeight.toNumber() : 0,
        averageDepositWeight: stand._avg.depositWeight ? stand._avg.depositWeight.toDP(2).toNumber() : 0,
        depositCount: stand._count.depositWeight ? stand._count.depositWeight : 0
      };
    })
      .sort((compostStandA, compostStandB) => compostStandA.depositWeightSum < compostStandB.depositWeightSum ? 1 : -1)

    const totalDeposits = depositsWeightsByStands.reduce((acc, cur) => cur.depositCount + acc, 0);

    // max age of 12 hours
    res.header('Cache-Control', 'max-age=43200');
    res.status(200).send({ depositsWeightsByStands, period, totalDeposits });
  } catch (e: any) {
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

  // Fetch all reports in period, including stand info
  const reports = await prisma.compostReport.findMany({
    where: { date: { gte: from, lte: now } },
    include: { compostStand: true },
  });

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
        compostSmell: { yes: 0, some: 0, no: 0, missing: 0 },
        dryMatterPresent: { yes: 0, some: 0, no: 0, missing: 0 },
        cleanAndTidy: { true: 0, false: 0, missing: 0 },
        full: { true: 0, false: 0, missing: 0 },
        scalesProblem: { true: 0, false: 0, missing: 0 },
        bugs: { true: 0, false: 0, missing: 0 },
        notes: { with: 0, without: 0 },
      };
    }
    const s = statsMap[sid];
    s.total++;

    // dryMatterPresent (enum)
    if (!rpt.dryMatterPresent) s.dryMatterPresent.missing++;
    else s.dryMatterPresent[rpt.dryMatterPresent]++;

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
};
