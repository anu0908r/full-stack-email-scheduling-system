import { parseLeadFileContent } from '../utils/csvParser';

describe('CSV & TXT Lead File Parser Unit Tests', () => {
  it('should parse simple single-column emails and strip BOM', () => {
    const content = '\uFEFFjohn@example.com\nalice@example.com\ninvalid-email\njohn@example.com';
    const res = parseLeadFileContent(content);

    expect(res.validEmails).toEqual(['john@example.com', 'alice@example.com']);
    expect(res.invalidLines.length).toBe(1);
    expect(res.invalidLines[0].raw).toBe('invalid-email');
  });

  it('should parse multi-column CSV files with headers', () => {
    const csv = `Full Name, Email Address, Company
John Doe, john.doe@company.com, TechCorp
Alice Smith, alice.smith@startup.io, StartupInc
Bad Line, not-an-email, NoCompany`;

    const res = parseLeadFileContent(csv);

    expect(res.validEmails).toEqual(['john.doe@company.com', 'alice.smith@startup.io']);
    expect(res.invalidLines.length).toBe(1);
    expect(res.invalidLines[0].line).toBe(4);
  });

  it('should handle quoted CSV fields and alternate column orders', () => {
    const csv = `"Email","Name"
"test1@domain.org","Test User 1"
"test2@domain.org","Test User 2"`;

    const res = parseLeadFileContent(csv);

    expect(res.validEmails).toEqual(['test1@domain.org', 'test2@domain.org']);
    expect(res.invalidLines.length).toBe(0);
  });
});
