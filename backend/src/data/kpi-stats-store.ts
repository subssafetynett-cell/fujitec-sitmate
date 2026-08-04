import { getPool, query } from "../db/pool.js";

export const MONTHS = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
] as const;

export const KPI_DISCIPLINES = [
  "health-safety",
  "environmental",
  "quality",
  "lift-regulations",
] as const;

export type KpiDiscipline = (typeof KPI_DISCIPLINES)[number];
export type MonthKey = (typeof MONTHS)[number];
export type MonthValues = Record<MonthKey, string>;

export type KpiStatRow = {
  id: string;
  indicator: string;
  months: MonthValues;
  target: string;
  unit: string;
  higherIsBetter: boolean;
};

export type KpiStatYearData = {
  discipline: KpiDiscipline;
  year: number;
  rows: KpiStatRow[];
  updatedAt: string;
};

type SeedDef = {
  key: string;
  indicator: string;
  target: string;
  unit: string;
  higherIsBetter: boolean;
  months?: Partial<MonthValues>;
};

const SEEDS: Record<KpiDiscipline, SeedDef[]> = {
  "health-safety": [
    { key: "lti", indicator: "Lost Time Injuries", target: "5", unit: "cases", higherIsBetter: false, months: { Jan: "1", Feb: "0", Mar: "1", Apr: "0", May: "1", Jun: "0" } },
    { key: "near", indicator: "Near Misses Reported", target: "50", unit: "reports", higherIsBetter: true, months: { Jan: "8", Feb: "10", Mar: "12", Apr: "9", May: "11", Jun: "14" } },
    { key: "first", indicator: "First Aid Cases", target: "10", unit: "cases", higherIsBetter: false, months: { Jan: "2", Feb: "1", Mar: "1", Apr: "2", May: "1", Jun: "1" } },
    { key: "obs", indicator: "Safety Observations", target: "350", unit: "obs", higherIsBetter: true, months: { Jan: "40", Feb: "45", Mar: "52", Apr: "48", May: "55", Jun: "60" } },
    { key: "train", indicator: "Training Hours Completed", target: "1200", unit: "hours", higherIsBetter: true, months: { Jan: "120", Feb: "140", Mar: "160", Apr: "150", May: "170", Jun: "180" } },
  ],
  environmental: [
    { key: "waste", indicator: "Waste Generated", target: "140", unit: "t", higherIsBetter: false, months: { Jan: "14", Feb: "12", Mar: "13", Apr: "11", May: "10", Jun: "9" } },
    { key: "recycle", indicator: "Waste Recycled", target: "70", unit: "%", higherIsBetter: true, months: { Jan: "62", Feb: "64", Mar: "66", Apr: "68", May: "70", Jun: "72" } },
    { key: "energy", indicator: "Energy Consumption", target: "430", unit: "MWh", higherIsBetter: false, months: { Jan: "40", Feb: "38", Mar: "37", Apr: "36", May: "35", Jun: "34" } },
    { key: "carbon", indicator: "Carbon Emissions", target: "200", unit: "tCO₂e", higherIsBetter: false, months: { Jan: "20", Feb: "18", Mar: "17", Apr: "16", May: "15", Jun: "14" } },
    { key: "incidents", indicator: "Environmental Incidents", target: "0", unit: "cases", higherIsBetter: false, months: { Jan: "1", Feb: "0", Mar: "0", Apr: "1", May: "0", Jun: "0" } },
  ],
  quality: [
    { key: "complaints", indicator: "Customer Complaints", target: "8", unit: "cases", higherIsBetter: false, months: { Jan: "1", Feb: "1", Mar: "0", Apr: "1", May: "1", Jun: "0" } },
    { key: "audit", indicator: "Internal Audit Score", target: "90", unit: "%", higherIsBetter: true, months: { Jan: "88", Feb: "89", Mar: "90", Apr: "91", May: "91", Jun: "92" } },
    { key: "defects", indicator: "Defects", target: "40", unit: "ppm", higherIsBetter: false, months: { Jan: "6", Feb: "5", Mar: "5", Apr: "4", May: "4", Jun: "3" } },
    { key: "otd", indicator: "On-Time Delivery", target: "95", unit: "%", higherIsBetter: true, months: { Jan: "93", Feb: "94", Mar: "95", Apr: "95", May: "96", Jun: "96" } },
    { key: "capa", indicator: "CAPA Completion", target: "92", unit: "%", higherIsBetter: true, months: { Jan: "86", Feb: "87", Mar: "88", Apr: "89", May: "90", Jun: "91" } },
  ],
  "lift-regulations": [
    { key: "inspections", indicator: "Lift Inspections", target: "120", unit: "count", higherIsBetter: true, months: { Jan: "18", Feb: "19", Mar: "20", Apr: "20", May: "21", Jun: "20" } },
    { key: "defects", indicator: "Lift Defects", target: "10", unit: "count", higherIsBetter: false, months: { Jan: "3", Feb: "2", Mar: "2", Apr: "2", May: "2", Jun: "2" } },
    { key: "service", indicator: "Service Compliance", target: "98", unit: "%", higherIsBetter: true, months: { Jan: "94", Feb: "95", Mar: "95", Apr: "96", May: "96", Jun: "96" } },
    { key: "breakdowns", indicator: "Breakdowns", target: "8", unit: "count", higherIsBetter: false, months: { Jan: "2", Feb: "1", Mar: "2", Apr: "1", May: "1", Jun: "2" } },
    { key: "compliance", indicator: "Overall Compliance", target: "96", unit: "%", higherIsBetter: true, months: { Jan: "91", Feb: "92", Mar: "92", Apr: "93", May: "94", Jun: "94" } },
  ],
};

type YearRow = {
  discipline: string;
  year: number;
  updated_at: Date | string;
};

type StatRow = {
  id: string;
  indicator: string;
  target: string;
  unit: string;
  higher_is_better: boolean;
  months: MonthValues | string;
  position: number;
};

function emptyMonths(): MonthValues {
  return {
    Jan: "",
    Feb: "",
    Mar: "",
    Apr: "",
    May: "",
    Jun: "",
    Jul: "",
    Aug: "",
    Sep: "",
    Oct: "",
    Nov: "",
    Dec: "",
  };
}

function createDefaultRows(discipline: KpiDiscipline, year: number): KpiStatRow[] {
  const seedCurrent = year === new Date().getFullYear();
  return SEEDS[discipline].map((seed) => ({
    id: `${discipline}-${year}-${seed.key}`,
    indicator: seed.indicator,
    months: { ...emptyMonths(), ...(seedCurrent ? seed.months ?? {} : {}) },
    target: seed.target,
    unit: seed.unit,
    higherIsBetter: seed.higherIsBetter,
  }));
}

function isDiscipline(value: string): value is KpiDiscipline {
  return (KPI_DISCIPLINES as readonly string[]).includes(value);
}

function normalizeDiscipline(value: string): KpiDiscipline {
  if (!isDiscipline(value)) {
    throw new Error(`Unknown KPI discipline: ${value}`);
  }
  return value;
}

function normalizeYear(year: number): number {
  if (!Number.isInteger(year) || year < 2000 || year > 2100) {
    throw new Error("Year must be an integer between 2000 and 2100");
  }
  return year;
}

function normalizeMonths(input: unknown): MonthValues {
  const months = { ...emptyMonths() };
  const source =
    typeof input === "string"
      ? (JSON.parse(input) as Partial<MonthValues>)
      : ((input ?? {}) as Partial<MonthValues>);
  for (const month of MONTHS) {
    const value = source[month];
    months[month] = typeof value === "string" ? value : value == null ? "" : String(value);
  }
  return months;
}

function normalizeRows(
  discipline: KpiDiscipline,
  year: number,
  rows: unknown,
): KpiStatRow[] {
  if (!Array.isArray(rows) || rows.length === 0) {
    return createDefaultRows(discipline, year);
  }

  return rows.map((row, index) => {
    const item = row as Partial<KpiStatRow>;
    return {
      id:
        typeof item.id === "string" && item.id
          ? item.id
          : `${discipline}-${year}-row-${index + 1}`,
      indicator: typeof item.indicator === "string" ? item.indicator : "",
      months: normalizeMonths(item.months),
      target:
        typeof item.target === "string"
          ? item.target
          : item.target == null
            ? ""
            : String(item.target),
      unit: typeof item.unit === "string" ? item.unit : "",
      higherIsBetter: Boolean(item.higherIsBetter),
    };
  });
}

function mapStatRow(row: StatRow): KpiStatRow {
  return {
    id: row.id,
    indicator: row.indicator,
    months: normalizeMonths(row.months),
    target: row.target,
    unit: row.unit,
    higherIsBetter: Boolean(row.higher_is_better),
  };
}

function toIso(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : new Date(value).toISOString();
}

async function loadYearData(
  discipline: KpiDiscipline,
  year: number,
): Promise<KpiStatYearData | null> {
  const yearResult = await query<YearRow>(
    `SELECT discipline, year, updated_at
     FROM kpi_stat_years
     WHERE discipline = $1 AND year = $2`,
    [discipline, year],
  );
  const yearRow = yearResult.rows[0];
  if (!yearRow) return null;

  const rowsResult = await query<StatRow>(
    `SELECT id, indicator, target, unit, higher_is_better, months, position
     FROM kpi_stat_rows
     WHERE discipline = $1 AND year = $2
     ORDER BY position ASC, id ASC`,
    [discipline, year],
  );

  return {
    discipline,
    year,
    rows: rowsResult.rows.map(mapStatRow),
    updatedAt: toIso(yearRow.updated_at),
  };
}

async function persistYearData(data: KpiStatYearData): Promise<KpiStatYearData> {
  const client = await getPool().connect();
  try {
    await client.query("BEGIN");
    await client.query(
      `INSERT INTO kpi_stat_years(discipline, year, updated_at)
       VALUES ($1, $2, $3::timestamptz)
       ON CONFLICT (discipline, year)
       DO UPDATE SET updated_at = EXCLUDED.updated_at`,
      [data.discipline, data.year, data.updatedAt],
    );
    await client.query(
      `DELETE FROM kpi_stat_rows WHERE discipline = $1 AND year = $2`,
      [data.discipline, data.year],
    );
    for (let i = 0; i < data.rows.length; i += 1) {
      const row = data.rows[i]!;
      await client.query(
        `INSERT INTO kpi_stat_rows(
           id, discipline, year, position, indicator, target, unit, higher_is_better, months
         ) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9::jsonb)`,
        [
          row.id,
          data.discipline,
          data.year,
          i,
          row.indicator,
          row.target,
          row.unit,
          row.higherIsBetter,
          JSON.stringify(row.months),
        ],
      );
    }
    await client.query("COMMIT");
  } catch (err) {
    await client.query("ROLLBACK");
    throw err;
  } finally {
    client.release();
  }
  return data;
}

export async function listKpiStatYears(disciplineInput: string): Promise<number[]> {
  const discipline = normalizeDiscipline(disciplineInput);
  const result = await query<{ year: number }>(
    `SELECT year FROM kpi_stat_years WHERE discipline = $1 ORDER BY year DESC`,
    [discipline],
  );
  const years = result.rows.map((r) => Number(r.year)).filter((y) => Number.isInteger(y));
  const currentYear = new Date().getFullYear();
  if (!years.includes(currentYear)) years.unshift(currentYear);
  return [...new Set(years)].sort((a, b) => b - a);
}

export async function getKpiStatYear(
  disciplineInput: string,
  yearInput: number,
): Promise<KpiStatYearData> {
  const discipline = normalizeDiscipline(disciplineInput);
  const year = normalizeYear(yearInput);
  const existing = await loadYearData(discipline, year);
  if (existing && existing.rows.length > 0) return existing;

  const next: KpiStatYearData = {
    discipline,
    year,
    rows: createDefaultRows(discipline, year),
    updatedAt: new Date().toISOString(),
  };
  return persistYearData(next);
}

export async function saveKpiStatYear(
  disciplineInput: string,
  yearInput: number,
  rows: unknown,
): Promise<KpiStatYearData> {
  const discipline = normalizeDiscipline(disciplineInput);
  const year = normalizeYear(yearInput);
  const next: KpiStatYearData = {
    discipline,
    year,
    rows: normalizeRows(discipline, year, rows),
    updatedAt: new Date().toISOString(),
  };
  return persistYearData(next);
}

/** Used by migrate to seed relational tables from legacy blob/JSON shapes. */
export async function importKpiYearFromLegacy(
  disciplineInput: string,
  yearInput: number,
  rows: unknown,
  updatedAt?: string,
): Promise<void> {
  const discipline = normalizeDiscipline(disciplineInput);
  const year = normalizeYear(yearInput);
  await persistYearData({
    discipline,
    year,
    rows: normalizeRows(discipline, year, rows),
    updatedAt: updatedAt && !Number.isNaN(Date.parse(updatedAt))
      ? new Date(updatedAt).toISOString()
      : new Date().toISOString(),
  });
}

// Backward-compatible OHS helpers
export const listOhsYears = () => listKpiStatYears("health-safety");
export const getOhsYear = (year: number) => getKpiStatYear("health-safety", year);
export const saveOhsYear = (year: number, rows: unknown) =>
  saveKpiStatYear("health-safety", year, rows);
