import type { Asset } from '../engine/decumulation';

/* ─── Column alias map: normalized CSV header → target field ─── */

const COLUMN_ALIASES: Record<string, string> = {
  // label
  name: 'label', 'asset name': 'label', asset: 'label', label: 'label',
  description: 'label', holding: 'label', 'fund name': 'label', fund: 'label',

  // current_value
  value: 'current_value', 'current value': 'current_value', 'market value': 'current_value',
  amount: 'current_value', balance: 'current_value', worth: 'current_value',
  'total value': 'current_value', 'portfolio value': 'current_value',

  // asset_class
  'asset class': 'asset_class', 'asset type': 'asset_class', type: 'asset_class',
  class: 'asset_class', category: 'asset_class',

  // wrapper_type
  wrapper: 'wrapper_type', 'wrapper type': 'wrapper_type', 'account type': 'wrapper_type',
  'tax wrapper': 'wrapper_type',

  // assumed_growth_rate
  growth: 'assumed_growth_rate', 'growth rate': 'assumed_growth_rate',
  return: 'assumed_growth_rate', 'expected return': 'assumed_growth_rate',
  'annual return': 'assumed_growth_rate',

  // income_generated
  income: 'income_generated', 'annual income': 'income_generated',
  yield: 'income_generated', 'income generated': 'income_generated',
  dividend: 'income_generated', dividends: 'income_generated', rent: 'income_generated',

  // acquisition_cost
  cost: 'acquisition_cost', 'acquisition cost': 'acquisition_cost',
  'purchase price': 'acquisition_cost', 'cost basis': 'acquisition_cost',
  'book cost': 'acquisition_cost', 'original cost': 'acquisition_cost',

  // acquisition_date
  date: 'acquisition_date', 'acquisition date': 'acquisition_date',
  'purchase date': 'acquisition_date', 'date acquired': 'acquisition_date',

  // mortgage_balance
  mortgage: 'mortgage_balance', 'mortgage balance': 'mortgage_balance',
  'outstanding mortgage': 'mortgage_balance',

  // reinvested_pct
  reinvested: 'reinvested_pct', 'reinvested pct': 'reinvested_pct',
  reinvestment: 'reinvested_pct', 'reinvestment %': 'reinvested_pct',
};

/* ─── Asset class alias map ─── */

const ASSET_CLASS_ALIASES: Record<string, string> = {
  cash: 'cash', savings: 'cash', 'current account': 'cash', 'savings account': 'cash',
  'ns&i': 'cash', 'nsi': 'cash',

  isa: 'isa', 'stocks and shares isa': 'isa', 'stocks & shares isa': 'isa',
  's&s isa': 'isa', 'cash isa': 'isa', 'lifetime isa': 'isa', 'lisa': 'isa',

  pension: 'pension', sipp: 'pension', ssas: 'pension', 'personal pension': 'pension',
  'defined contribution': 'pension', 'dc pension': 'pension', 'pension fund': 'pension',

  'property investment': 'property_investment', property_investment: 'property_investment',
  'buy to let': 'property_investment', 'buy-to-let': 'property_investment',
  btl: 'property_investment', 'commercial property': 'property_investment',
  rental: 'property_investment', 'rental property': 'property_investment',
  'investment property': 'property_investment',

  'property residential': 'property_residential', property_residential: 'property_residential',
  home: 'property_residential', residence: 'property_residential',
  'main residence': 'property_residential', house: 'property_residential',
  'primary residence': 'property_residential',

  vct: 'vct', 'venture capital trust': 'vct',

  eis: 'eis', 'enterprise investment scheme': 'eis',

  aim: 'aim_shares', 'aim shares': 'aim_shares', aim_shares: 'aim_shares',
  'aim listed': 'aim_shares',
};

const VALID_ASSET_CLASSES = [
  'cash', 'isa', 'pension', 'property_investment', 'property_residential',
  'vct', 'eis', 'aim_shares',
];

/* ─── Wrapper type inference ─── */

const WRAPPER_ALIASES: Record<string, string> = {
  unwrapped: 'unwrapped', none: 'unwrapped', taxable: 'unwrapped', general: 'unwrapped',
  isa: 'isa', pension: 'pension', sipp: 'pension', ssas: 'pension',
};

function inferWrapperType(assetClass: string): string {
  if (assetClass === 'pension') return 'pension';
  if (assetClass === 'isa') return 'isa';
  return 'unwrapped';
}

/* ─── Asset templates (mirrors AssetEditor) ─── */

interface TemplateDefaults {
  wrapper_type: string;
  assumed_growth_rate: number;
  is_iht_exempt: boolean;
  pension_type: string | null;
  relief_claimed_type: string;
  estimated_disposal_cost_pct: number;
}

const TEMPLATES: Record<string, TemplateDefaults> = {
  cash:                 { wrapper_type: 'unwrapped', assumed_growth_rate: 0.045, is_iht_exempt: false, pension_type: null, relief_claimed_type: 'none', estimated_disposal_cost_pct: 0 },
  isa:                  { wrapper_type: 'isa',       assumed_growth_rate: 0.06,  is_iht_exempt: false, pension_type: null, relief_claimed_type: 'none', estimated_disposal_cost_pct: 0 },
  pension:              { wrapper_type: 'pension',   assumed_growth_rate: 0.055, is_iht_exempt: false, pension_type: 'sipp', relief_claimed_type: 'none', estimated_disposal_cost_pct: 0 },
  property_investment:  { wrapper_type: 'unwrapped', assumed_growth_rate: 0.03,  is_iht_exempt: false, pension_type: null, relief_claimed_type: 'none', estimated_disposal_cost_pct: 0.025 },
  property_residential: { wrapper_type: 'unwrapped', assumed_growth_rate: 0.03,  is_iht_exempt: false, pension_type: null, relief_claimed_type: 'none', estimated_disposal_cost_pct: 0.025 },
  vct:                  { wrapper_type: 'unwrapped', assumed_growth_rate: 0.07,  is_iht_exempt: false, pension_type: null, relief_claimed_type: 'income_tax_relief', estimated_disposal_cost_pct: 0 },
  eis:                  { wrapper_type: 'unwrapped', assumed_growth_rate: 0.12,  is_iht_exempt: true,  pension_type: null, relief_claimed_type: 'both', estimated_disposal_cost_pct: 0 },
  aim_shares:           { wrapper_type: 'unwrapped', assumed_growth_rate: 0.065, is_iht_exempt: true,  pension_type: null, relief_claimed_type: 'none', estimated_disposal_cost_pct: 0.01 },
};

/* ─── Target fields the user can map ─── */

export interface TargetField {
  key: string;
  label: string;
  required: boolean;
  type: 'string' | 'number' | 'date' | 'asset_class' | 'wrapper_type';
}

export const TARGET_FIELDS: TargetField[] = [
  { key: 'label',               label: 'Asset Name',      required: true,  type: 'string' },
  { key: 'current_value',       label: 'Current Value',    required: true,  type: 'number' },
  { key: 'asset_class',         label: 'Asset Class',      required: true,  type: 'asset_class' },
  { key: 'wrapper_type',        label: 'Wrapper Type',     required: false, type: 'wrapper_type' },
  { key: 'assumed_growth_rate', label: 'Growth Rate',      required: false, type: 'number' },
  { key: 'income_generated',    label: 'Annual Income',    required: false, type: 'number' },
  { key: 'acquisition_cost',    label: 'Acquisition Cost', required: false, type: 'number' },
  { key: 'acquisition_date',    label: 'Acquisition Date', required: false, type: 'date' },
  { key: 'mortgage_balance',    label: 'Mortgage Balance', required: false, type: 'number' },
  { key: 'reinvested_pct',      label: 'Reinvested %',     required: false, type: 'number' },
];

/* ─── Public functions ─── */

/** Auto-detect column mappings from CSV headers */
export function autoDetectMapping(headers: string[]): Record<string, string> {
  const mapping: Record<string, string> = {};
  const usedHeaders = new Set<string>();

  for (const header of headers) {
    const normalized = header.toLowerCase().trim().replace(/[^a-z0-9 &%]/g, '');
    const targetField = COLUMN_ALIASES[normalized];
    if (targetField && !mapping[targetField] && !usedHeaders.has(header)) {
      mapping[targetField] = header;
      usedHeaders.add(header);
    }
  }

  return mapping;
}

/** Parse a number, stripping currency symbols and commas */
export function parseNumber(value: string): number | null {
  if (!value || !value.trim()) return null;
  const cleaned = value.replace(/[£$€,\s]/g, '').replace(/[()]/g, '');
  const num = parseFloat(cleaned);
  return isNaN(num) ? null : num;
}

/** Parse a growth rate — handles "6", "6%", "0.06" */
export function parseGrowthRate(value: string): number | null {
  const stripped = value.replace(/%/g, '').trim();
  const num = parseNumber(stripped);
  if (num === null) return null;
  // If > 1, treat as percentage (e.g. 6 → 0.06)
  return num > 1 ? num / 100 : num;
}

/** Parse reinvested_pct — stored as 0-100 in the app */
export function parseReinvestedPct(value: string): number | null {
  const stripped = value.replace(/%/g, '').trim();
  const num = parseNumber(stripped);
  if (num === null) return null;
  // If <= 1 and looks like decimal (e.g. 0.5), multiply by 100
  return num <= 1 && num > 0 ? num * 100 : num;
}

/** Resolve an asset class string to a valid key */
export function resolveAssetClass(input: string): string | null {
  if (!input || !input.trim()) return null;
  const normalized = input.toLowerCase().trim().replace(/[_-]/g, ' ');

  // Direct match
  if (VALID_ASSET_CLASSES.includes(normalized.replace(/ /g, '_'))) {
    return normalized.replace(/ /g, '_');
  }

  // Alias match
  return ASSET_CLASS_ALIASES[normalized] ?? null;
}

/** Resolve wrapper type string */
export function resolveWrapperType(input: string | null, assetClass: string): string {
  if (input) {
    const normalized = input.toLowerCase().trim();
    const resolved = WRAPPER_ALIASES[normalized];
    if (resolved) return resolved;
  }
  return inferWrapperType(assetClass);
}

/** Parse a date string — ISO, DD/MM/YYYY, MM/DD/YYYY */
export function parseDate(value: string): string | null {
  if (!value || !value.trim()) return null;
  const v = value.trim();

  // ISO format
  if (/^\d{4}-\d{2}-\d{2}/.test(v)) {
    const d = new Date(v);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  // DD/MM/YYYY or DD-MM-YYYY (UK preference)
  const ukMatch = v.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/);
  if (ukMatch) {
    const [, day, month, year] = ukMatch;
    const d = new Date(`${year}-${month.padStart(2, '0')}-${day.padStart(2, '0')}`);
    return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10);
  }

  return null;
}

/* ─── Row validation ─── */

export interface RowError {
  field: string;
  message: string;
}

export interface ValidatedRow {
  rowIndex: number;
  rawData: Record<string, string>;
  parsed: Partial<Asset>;
  errors: RowError[];
  warnings: RowError[];
  skip: boolean;
  /** User-overridden asset_class (from dropdown fix) */
  overrideAssetClass?: string;
}

export function validateRows(
  rawRows: Record<string, string>[],
  mapping: Record<string, string>,
): ValidatedRow[] {
  return rawRows.map((row, rowIndex) => {
    const errors: RowError[] = [];
    const warnings: RowError[] = [];
    const parsed: Partial<Asset> = {};

    // Helper: get mapped value
    const get = (field: string): string => {
      const csvCol = mapping[field];
      return csvCol ? (row[csvCol] ?? '').trim() : '';
    };

    // label (required)
    const label = get('label');
    if (!label) {
      errors.push({ field: 'label', message: 'Name is required' });
    } else {
      parsed.label = label;
    }

    // current_value (required)
    const valueStr = get('current_value');
    if (!valueStr) {
      errors.push({ field: 'current_value', message: 'Value is required' });
    } else {
      const num = parseNumber(valueStr);
      if (num === null) {
        errors.push({ field: 'current_value', message: `"${valueStr}" is not a valid number` });
      } else {
        parsed.current_value = num;
      }
    }

    // asset_class (required)
    const classStr = get('asset_class');
    if (!classStr) {
      errors.push({ field: 'asset_class', message: 'Asset class is required' });
    } else {
      const resolved = resolveAssetClass(classStr);
      if (!resolved) {
        errors.push({ field: 'asset_class', message: `"${classStr}" — unrecognised asset class` });
      } else {
        parsed.asset_class = resolved;
      }
    }

    // wrapper_type (optional — inferred if missing)
    const wrapperStr = get('wrapper_type');
    if (parsed.asset_class) {
      parsed.wrapper_type = resolveWrapperType(wrapperStr || null, parsed.asset_class);
    }

    // assumed_growth_rate (optional)
    const growthStr = get('assumed_growth_rate');
    if (growthStr) {
      const rate = parseGrowthRate(growthStr);
      if (rate === null) {
        warnings.push({ field: 'assumed_growth_rate', message: `"${growthStr}" — couldn't parse growth rate` });
      } else {
        parsed.assumed_growth_rate = rate;
      }
    }

    // income_generated (optional)
    const incomeStr = get('income_generated');
    if (incomeStr) {
      const num = parseNumber(incomeStr);
      if (num === null) {
        warnings.push({ field: 'income_generated', message: `"${incomeStr}" — couldn't parse income` });
      } else {
        parsed.income_generated = num;
      }
    }

    // acquisition_cost (optional)
    const costStr = get('acquisition_cost');
    if (costStr) {
      const num = parseNumber(costStr);
      if (num === null) {
        warnings.push({ field: 'acquisition_cost', message: `"${costStr}" — couldn't parse cost` });
      } else {
        parsed.acquisition_cost = num;
      }
    }

    // acquisition_date (optional)
    const dateStr = get('acquisition_date');
    if (dateStr) {
      const d = parseDate(dateStr);
      if (!d) {
        warnings.push({ field: 'acquisition_date', message: `"${dateStr}" — couldn't parse date` });
      } else {
        parsed.acquisition_date = d;
      }
    }

    // mortgage_balance (optional)
    const mortStr = get('mortgage_balance');
    if (mortStr) {
      const num = parseNumber(mortStr);
      if (num === null) {
        warnings.push({ field: 'mortgage_balance', message: `"${mortStr}" — couldn't parse mortgage` });
      } else {
        parsed.mortgage_balance = num;
      }
    }

    // reinvested_pct (optional)
    const reinvStr = get('reinvested_pct');
    if (reinvStr) {
      const num = parseReinvestedPct(reinvStr);
      if (num === null) {
        warnings.push({ field: 'reinvested_pct', message: `"${reinvStr}" — couldn't parse reinvestment %` });
      } else {
        parsed.reinvested_pct = num;
      }
    }

    return {
      rowIndex,
      rawData: row,
      parsed,
      errors,
      warnings,
      skip: errors.length > 0,
    };
  });
}

/** Build final Asset[] from validated rows */
export function buildAssets(
  rows: ValidatedRow[],
  mode: 'replace' | 'append',
  existingAssets: Asset[],
): Asset[] {
  const now = Date.now();
  const newAssets: Asset[] = rows
    .filter(r => !r.skip)
    .map((r, idx) => {
      const assetClass = r.overrideAssetClass ?? r.parsed.asset_class ?? 'cash';
      const template = TEMPLATES[assetClass] ?? TEMPLATES.cash;

      const asset: Asset = {
        asset_id: `${assetClass}-import-${now}-${idx}`,
        wrapper_type: r.parsed.wrapper_type ?? template.wrapper_type,
        asset_class: assetClass,
        label: r.parsed.label ?? `Import ${idx + 1}`,
        current_value: r.parsed.current_value ?? 0,
        acquisition_date: r.parsed.acquisition_date ?? null,
        acquisition_cost: r.parsed.acquisition_cost ?? null,
        original_subscription_amount: null,
        tax_relief_claimed: 0,
        assumed_growth_rate: r.parsed.assumed_growth_rate ?? template.assumed_growth_rate,
        income_generated: r.parsed.income_generated ?? 0,
        reinvested_pct: r.parsed.reinvested_pct ?? 0,
        is_iht_exempt: template.is_iht_exempt,
        bpr_qualifying_date: null,
        bpr_last_reviewed: null,
        cgt_exempt_date: null,
        mortgage_balance: r.parsed.mortgage_balance ?? 0,
        pension_type: template.pension_type,
        tfls_used_amount: 0,
        mpaa_triggered: false,
        in_drawdown: false,
        flexible_isa: false,
        deferred_gain_amount: null,
        relief_claimed_type: template.relief_claimed_type,
        allowable_improvement_costs: 0,
        estimated_disposal_cost_pct: template.estimated_disposal_cost_pct,
        estimated_disposal_cost_amount: null,
        disposal_type: 'none',
        transfer_year: null,
      };

      return asset;
    });

  return mode === 'replace' ? newAssets : [...existingAssets, ...newAssets];
}

export { VALID_ASSET_CLASSES };
