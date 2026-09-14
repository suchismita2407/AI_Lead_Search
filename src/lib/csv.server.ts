/**
 * DealFlow AI — CSV parsing + lead-row normalization (SERVER-ONLY).
 *
 * Hand-written CSV parser (no npm dependency): handles RFC-4180-style quoted
 * fields, commas/newlines inside quotes, escaped quotes (""), CRLF and bare CR
 * line endings, a header row, and empty lines. Header names are matched
 * flexibly (case-insensitive, punctuation-insensitive) so the owner's exact
 * example format (`owner_name,address,city,state,zip`) and the extended
 * signal columns both work.
 *
 * Never statically imported by client-visible code.
 */

export interface ParsedLeadRow {
  owner_name: string | null;
  property_address: string | null;
  city: string | null;
  state: string | null;
  zip: string | null;
  property_type: string | null;
  estimated_value: number | null;
  estimated_equity: number | null;
  ownership_duration_years: number | null;
  vacancy_signal: 0 | 1;
  needs_work_signal: 0 | 1;
  distress_signal: 0 | 1;
  absentee_owner_signal: 0 | 1;
  recent_listing_withdrawal_signal: 0 | 1;
}

export interface ParseLeadsCsvResult {
  rows: ParsedLeadRow[];
  /** Rows dropped because they had neither an owner name nor an address. */
  skipped: number;
}

const normalizeHeader = (h: string): string =>
  h.trim().toLowerCase().replace(/[\s_\-./]+/g, "");

/** Header (normalized) → canonical field name. */
const HEADER_MAP: Record<string, string> = {
  ownername: "owner_name",
  name: "owner_name",
  owner: "owner_name",
  address: "property_address",
  propertyaddress: "property_address",
  street: "property_address",
  city: "city",
  state: "state",
  zip: "zip",
  zipcode: "zip",
  postalcode: "zip",
  postal: "zip",
  propertytype: "property_type",
  type: "property_type",
  estimatedvalue: "estimated_value",
  value: "estimated_value",
  estimatedequity: "estimated_equity",
  equity: "estimated_equity",
  ownershipdurationyears: "ownership_duration_years",
  ownershipyears: "ownership_duration_years",
  ownedsince: "owned_since",
  vacancysignal: "vacancy_signal",
  needs_worksignal: "needs_work_signal",
  needsworksignal: "needs_work_signal",
  distresssignal: "distress_signal",
  absenteeownersignal: "absentee_owner_signal",
  absentee_ownersignal: "absentee_owner_signal",
  listingwithdrawalsignal: "listing_withdrawal_signal",
  recentlistingwithdrawalsignal: "listing_withdrawal_signal",
  listing_withdrawalsignal: "listing_withdrawal_signal",
};

/**
 * RFC-4180-ish CSV tokenizer. Returns rows as arrays of raw field strings;
 * no header handling here (callers use the first non-empty row as header).
 */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  let i = 0;
  const n = text.length;

  while (i < n) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          // escaped quote ("") inside a quoted field
          field += '"';
          i += 2;
          continue;
        }
        inQuotes = false;
        i++;
        continue;
      }
      field += ch;
      i++;
      continue;
    }
    if (ch === '"') {
      // A quote opens a quoted field only at the start of a field. Mid-field
      // quotes are treated literally (be forgiving of hand-made CSVs).
      inQuotes = true;
      i++;
      continue;
    }
    if (ch === ",") {
      row.push(field);
      field = "";
      i++;
      continue;
    }
    if (ch === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    if (ch === "\r") {
      // CRLF or bare CR — both end the record.
      if (text[i + 1] === "\n") i++;
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
      i++;
      continue;
    }
    field += ch;
    i++;
  }
  // Last record (no trailing newline)
  if (field.length > 0 || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

const cleanText = (v: string): string | null => {
  const t = v.trim();
  return t === "" ? null : t;
};

/** "$185,000" / "185 000" / "185000" → 185000. */
function parseNumber(v: string): number | null {
  const t = v.trim();
  if (!t) return null;
  const cleaned = t.replace(/[$,€£\s]/g, "");
  const n = Number(cleaned);
  return Number.isNaN(n) ? null : n;
}

/** True/yes/y/1 → 1; false/no/n/0/empty → 0; anything else → 0. */
function parseFlag(v: string): 0 | 1 {
  const t = v.trim().toLowerCase();
  if (["1", "true", "yes", "y", "t"].includes(t)) return 1;
  return 0;
}

/**
 * Tokenize + normalize a leads CSV into typed rows.
 * Rows lacking BOTH owner_name and property_address are skipped (counted).
 */
export function parseLeadsCsv(text: string): ParseLeadsCsvResult {
  const raw = parseCsv(text).filter((r) =>
    r.some((cell) => cell.trim() !== ""),
  );
  if (raw.length === 0) return { rows: [], skipped: 0 };

  // Map normalized header -> column index.
  const header = raw[0].map(normalizeHeader);
  const colIdx = new Map<string, number>();
  header.forEach((h, idx) => {
    const canonical = HEADER_MAP[h] ?? h;
    if (!colIdx.has(canonical)) colIdx.set(canonical, idx);
  });

  const cell = (row: string[], name: string): string | null => {
    const idx = colIdx.get(name);
    if (idx == null || idx >= row.length) return null;
    return row[idx];
  };

  const rows: ParsedLeadRow[] = [];
  let skipped = 0;
  const currentYear = new Date().getFullYear();

  for (let r = 1; r < raw.length; r++) {
    const line = raw[r];
    const owner_name = cleanText(cell(line, "owner_name") ?? "");
    const property_address = cleanText(cell(line, "property_address") ?? "");
    // Skip rows without at least an owner OR an address.
    if (!owner_name && !property_address) {
      skipped++;
      continue;
    }

    const ownedSinceRaw = cell(line, "owned_since");
    let ownership_duration_years = parseNumber(
      cell(line, "ownership_duration_years") ?? "",
    );
    if (ownership_duration_years == null && ownedSinceRaw) {
      const year = parseNumber(ownedSinceRaw);
      if (year != null && year >= 1900 && year <= currentYear) {
        ownership_duration_years = currentYear - year;
      }
    }

    rows.push({
      owner_name,
      property_address,
      city: cleanText(cell(line, "city") ?? ""),
      state: cleanText(cell(line, "state") ?? ""),
      zip: cleanText(cell(line, "zip") ?? ""),
      property_type: cleanText(cell(line, "property_type") ?? ""),
      estimated_value: parseNumber(cell(line, "estimated_value") ?? ""),
      estimated_equity: parseNumber(cell(line, "estimated_equity") ?? ""),
      ownership_duration_years,
      vacancy_signal: parseFlag(cell(line, "vacancy_signal") ?? ""),
      needs_work_signal: parseFlag(cell(line, "needs_work_signal") ?? ""),
      distress_signal: parseFlag(cell(line, "distress_signal") ?? ""),
      absentee_owner_signal: parseFlag(cell(line, "absentee_owner_signal") ?? ""),
      recent_listing_withdrawal_signal: parseFlag(
        cell(line, "listing_withdrawal_signal") ?? "",
      ),
    });
  }

  return { rows, skipped };
}