export interface ParseResult {
  validEmails: string[];
  invalidLines: Array<{ line: number; raw: string; reason: string }>;
  totalLines: number;
}

export function parseLeadFileContent(content: string): ParseResult {
  if (!content || !content.trim()) {
    return { validEmails: [], invalidLines: [], totalLines: 0 };
  }

  const cleanContent = content.replace(/^\uFEFF/, '');
  const rawLines = cleanContent.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const validSet = new Set<string>();
  const invalidLines: Array<{ line: number; raw: string; reason: string }> = [];

  let emailColumnIndex: number | null = null;

  rawLines.forEach((lineText, index) => {
    const lineNum = index + 1;
    const cells = parseCsvLine(lineText);

    if (index === 0 && emailColumnIndex === null) {
      const headerIndex = cells.findIndex((c) => /^(email|e-mail|mail|email_address|mail_address)$/i.test(c.trim()));
      if (headerIndex !== -1) {
        emailColumnIndex = headerIndex;
        return;
      }
    }

    let extractedEmail = '';

    if (emailColumnIndex !== null && cells[emailColumnIndex]) {
      const candidate = cells[emailColumnIndex].trim().toLowerCase();
      if (emailRegex.test(candidate)) {
        extractedEmail = candidate;
      }
    }

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
