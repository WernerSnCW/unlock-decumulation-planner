/**
 * Unified file parser — handles CSV, Excel (.xlsx/.xls), and PDF files.
 * Converts all formats into { headers, rows } for the import wizard.
 */

export interface ParseResult {
  success: boolean;
  headers: string[];
  rows: Record<string, string>[];
  format: 'csv' | 'excel' | 'pdf';
  error?: string;
  warning?: string;
  /** For PDFs: raw extracted text for debugging */
  rawText?: string;
  /** Number of pages (PDF only) */
  pageCount?: number;
}

/* ─── CSV parsing (uses PapaParse) ─── */

export async function parseCsvFile(file: File): Promise<ParseResult> {
  const Papa = (await import('papaparse')).default;

  return new Promise((resolve) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (result) => {
        const headers = result.meta.fields ?? [];
        const rows = result.data as Record<string, string>[];

        if (headers.length === 0 || rows.length === 0) {
          resolve({ success: false, headers: [], rows: [], format: 'csv', error: 'The file appears to be empty or has no header row.' });
          return;
        }

        resolve({ success: true, headers, rows, format: 'csv' });
      },
      error: (err) => {
        resolve({ success: false, headers: [], rows: [], format: 'csv', error: `CSV parse error: ${err.message}` });
      },
    });
  });
}

/* ─── Excel parsing (uses SheetJS) ─── */

export async function parseExcelFile(file: File): Promise<ParseResult> {
  try {
    const XLSX = await import('xlsx');
    const buffer = await file.arrayBuffer();
    const workbook = XLSX.read(buffer, { type: 'array' });

    if (workbook.SheetNames.length === 0) {
      return { success: false, headers: [], rows: [], format: 'excel', error: 'The workbook contains no sheets.' };
    }

    // Use first sheet
    const sheetName = workbook.SheetNames[0];
    const sheet = workbook.Sheets[sheetName];

    // Convert to JSON with header detection
    const rawData = XLSX.utils.sheet_to_json<Record<string, any>>(sheet, { defval: '' });

    if (rawData.length === 0) {
      return { success: false, headers: [], rows: [], format: 'excel', error: 'The sheet appears to be empty.' };
    }

    // Try to detect header row — sometimes first rows are metadata
    // Look for a row that has multiple non-empty string values
    const headers = Object.keys(rawData[0]);

    // Convert all values to strings for consistency with CSV flow
    const rows = rawData.map(row => {
      const stringRow: Record<string, string> = {};
      for (const key of headers) {
        const val = row[key];
        stringRow[key] = val != null ? String(val) : '';
      }
      return stringRow;
    });

    const warning = workbook.SheetNames.length > 1
      ? `Workbook has ${workbook.SheetNames.length} sheets — only "${sheetName}" was imported.`
      : undefined;

    return { success: true, headers, rows, format: 'excel', warning };
  } catch (err: any) {
    return { success: false, headers: [], rows: [], format: 'excel', error: `Excel parse error: ${err.message ?? 'Unknown error'}` };
  }
}

/* ─── PDF parsing ─── */

export async function parsePdfFile(file: File): Promise<ParseResult> {
  try {
    const pdfjsLib = await import('pdfjs-dist');

    // Set worker source
    pdfjsLib.GlobalWorkerOptions.workerSrc = `https://cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjsLib.version}/pdf.worker.min.mjs`;

    const buffer = await file.arrayBuffer();
    const pdf = await pdfjsLib.getDocument({ data: buffer }).promise;
    const pageCount = pdf.numPages;

    // Extract text from all pages
    const textParts: string[] = [];
    for (let i = 1; i <= pageCount; i++) {
      const page = await pdf.getPage(i);
      const content = await page.getTextContent();
      const pageText = content.items
        .map((item: any) => item.str)
        .join(' ');
      textParts.push(pageText);
    }

    const fullText = textParts.join('\n\n');

    if (!fullText.trim()) {
      return {
        success: false, headers: [], rows: [], format: 'pdf', pageCount,
        error: 'This PDF appears to be scanned or image-based — no readable text was found. Please use a CSV or Excel export instead.',
      };
    }

    // Attempt to extract tabular data from the text
    const result = extractAssetsFromText(fullText);

    if (result.rows.length === 0) {
      return {
        success: false, headers: [], rows: [], format: 'pdf', pageCount, rawText: fullText,
        error: 'We could read the PDF but couldn\'t identify asset data in a structured format. The text has been extracted — you may want to copy it into a spreadsheet and import as CSV.',
      };
    }

    return {
      success: true,
      headers: result.headers,
      rows: result.rows,
      format: 'pdf',
      pageCount,
      rawText: fullText,
      warning: `Extracted ${result.rows.length} potential assets from ${pageCount} page${pageCount > 1 ? 's' : ''}. Please review carefully — PDF extraction is best-effort.`,
    };
  } catch (err: any) {
    return {
      success: false, headers: [], rows: [], format: 'pdf',
      error: `PDF parse error: ${err.message ?? 'Unknown error'}. Try a CSV or Excel export instead.`,
    };
  }
}

/* ─── PDF text → structured data extraction ─── */

interface ExtractedData {
  headers: string[];
  rows: Record<string, string>[];
}

function extractAssetsFromText(text: string): ExtractedData {
  const lines = text.split('\n').map(l => l.trim()).filter(l => l.length > 0);

  // Strategy 1: Look for lines with currency values (£XX,XXX or XX,XXX.XX)
  const currencyPattern = /£?\s*[\d,]+\.?\d{0,2}/g;
  const assetLines: { name: string; value: string; line: string }[] = [];

  for (const line of lines) {
    const matches = line.match(currencyPattern);
    if (!matches || matches.length === 0) continue;

    // Find the largest currency value in the line (likely the market value)
    const values = matches.map(m => {
      const cleaned = m.replace(/[£,\s]/g, '');
      return { raw: m.trim(), num: parseFloat(cleaned) };
    }).filter(v => !isNaN(v.num) && v.num > 100); // ignore tiny values

    if (values.length === 0) continue;

    // The text before the first number is likely the asset name
    const firstNumIdx = line.indexOf(values[0].raw);
    const namePart = line.substring(0, firstNumIdx).trim();

    if (namePart.length < 3) continue; // Too short to be an asset name
    if (/^(total|subtotal|balance|date|page|account)/i.test(namePart)) continue; // Skip summary lines

    // Use the largest value as the market value
    const largestValue = values.reduce((a, b) => a.num > b.num ? a : b);

    assetLines.push({
      name: namePart.replace(/[\s·•\-–—]+$/, '').trim(),
      value: largestValue.num.toFixed(2),
      line,
    });
  }

  if (assetLines.length === 0) {
    return { headers: [], rows: [] };
  }

  // Build result with detected columns
  const headers = ['label', 'current_value'];
  const rows = assetLines.map(a => ({
    label: a.name,
    current_value: a.value,
  }));

  return { headers, rows };
}

/* ─── Unified file handler ─── */

export async function parseFile(file: File): Promise<ParseResult> {
  const name = file.name.toLowerCase();
  const type = file.type;

  if (name.endsWith('.csv') || name.endsWith('.tsv') || name.endsWith('.txt') || type === 'text/csv') {
    return parseCsvFile(file);
  }

  if (name.endsWith('.xlsx') || name.endsWith('.xls') || name.endsWith('.xlsm') ||
      type.includes('spreadsheet') || type.includes('excel')) {
    return parseExcelFile(file);
  }

  if (name.endsWith('.pdf') || type === 'application/pdf') {
    return parsePdfFile(file);
  }

  return {
    success: false,
    headers: [],
    rows: [],
    format: 'csv',
    error: `Unsupported file type: ${name.split('.').pop()?.toUpperCase() ?? 'unknown'}. Please use CSV, Excel (.xlsx), or PDF files.`,
  };
}
