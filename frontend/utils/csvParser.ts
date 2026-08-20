export interface ParseResult {
  validEmails: string[];
  invalidLines: Array<{ line: number; raw: string; reason: string }>;
  totalLines: number;
}

export function parseLeadFileContent(content: string): ParseResult {
  if (!content || !content.trim()) {
    return { validEmails: [], invalidLines: [], totalLines: 0 };
  }

  // Strip Byte Order Mark (BOM) if present
  const cleanContent = content.replace(/^\uFEFF/, '');
  const rawLines = cleanContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validSet = new Set<string>();
  const invalidLines: Array<{ line: number; raw: string; reason: string }> = [];

  let emailColumnIndex: number | null = null;

  rawLines.forEach((lineText, index) => {
    const lineNum = index + 1;

    // Parse CSV line handling quotes and commas
    const cells = parseCsvLine(lineText);

    // If first line contains header keywords like "email", "mail", "e-mail"
    if (index === 0 && emailColumnIndex === null) {
      const headerIndex = cells.findIndex((c) => /^(email|e-mail|mail|email_address|mail_address)$/i.test(c.trim()));
      if (headerIndex !== -1) {
        emailColumnIndex = headerIndex;
        return; // Skip header row
      }
    }

    // Try finding email cell
    let extractedEmail = '';

    if (emailColumnIndex !== null && cells[emailColumnIndex]) {
      const candidate = cells[emailColumnIndex].trim().toLowerCase();
      if (emailRegex.test(candidate)) {
        extractedEmail = candidate;
      }
    }

    // Fallback search across all cells if specific column didn't yield an email
    if (!extractedEmail) {
      for (const cell of cells) {
        const cleanCell = cell.trim().toLowerCase().replace(/^["']|["']$/g, '');
        if (emailRegex.test(cleanCell)) {
          extractedEmail = cleanCell;
          break;
        }
      }
    }

    if (extractedEmail) {
      validSet.add(extractedEmail);
    } else {
      // Don't report header row as invalid if it was line 1
      if (index === 0 && /email/i.test(lineText)) return;
      invalidLines.push({
        line: lineNum,
        raw: lineText,
        reason: 'No valid RFC email format found',
      });
    }
  });

  return {
    validEmails: Array.from(validSet),
    invalidLines,
    totalLines: rawLines.length,
  };
}

/**
 * Basic RFC 4180 CSV line splitter supporting quoted strings
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"' || char === "'") {
      inQuotes = !inQuotes;
    } else if ((char === ',' || char === ';') && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
