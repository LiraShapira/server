import { supabase } from '../config/supabase';

const PAGE_SIZE = 1000;

type CompostReportRow = Record<string, unknown>;

/** Postgrest filter builder after .select(); typed loosely to avoid Supabase generic mismatches. */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
type CompostReportSelectQuery = any;

/**
 * Fetches all matching CompostReport rows, paginating past Supabase's default 1000-row limit.
 */
export async function fetchAllCompostReportPages(
  applyFilters: (query: CompostReportSelectQuery) => CompostReportSelectQuery,
  select: string,
): Promise<CompostReportRow[]> {
  const all: CompostReportRow[] = [];
  let page = 0;

  while (true) {
    const from = page * PAGE_SIZE;
    const to = from + PAGE_SIZE - 1;

    let query: CompostReportSelectQuery = supabase.from('CompostReport').select(select);
    query = applyFilters(query);
    const { data, error } = await query
      .order('date', { ascending: false, nullsFirst: false })
      .range(from, to);

    if (error) {
      throw error;
    }

    if (!data?.length) {
      break;
    }

    all.push(...(data as CompostReportRow[]));
    if (data.length < PAGE_SIZE) {
      break;
    }
    page += 1;
  }

  return all;
}

export function getDateRangeFromQuery(query: {
  from?: string;
  to?: string;
  period?: string;
}): { startDate: Date; endDate: Date } | null {
  if (query.from && query.to) {
    const startDate = new Date(`${query.from}T00:00:00`);
    const endDate = new Date(`${query.to}T23:59:59.999`);
    return { startDate, endDate };
  }

  if (query.period) {
    const period = parseInt(query.period, 10);
    if (Number.isNaN(period) || period <= 0) {
      return null;
    }
    const endDate = new Date();
    endDate.setHours(23, 59, 59, 999);
    const startDate = new Date();
    startDate.setDate(endDate.getDate() - period);
    startDate.setHours(0, 0, 0, 0);
    return { startDate, endDate };
  }

  return null;
}
