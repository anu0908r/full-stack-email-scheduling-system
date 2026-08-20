import { parseLeadFileContent } from '../utils/csvParser';

describe('CSV & TXT Lead File Parser — Extended Tests', () => {
  it('should handle empty input', () => {
    const res = parseLeadFileContent('');
    expect(res.validEmails).toEqual([]);
    expect(res.invalidLines).toEqual([]);
    expect(res.totalLines).toBe(0);
  });

  it('should handle whitespace-only input', () => {
    const res = parseLeadFileContent('   \n  \n  ');
    expect(res.validEmails).toEqual([]);
    expect(res.totalLines).toBe(0);
  });

  it('should strip BOM and parse correctly', () => {
    const content = '\uFEFFjohn@example.com\nalice@example.com\ninvalid-email\njohn@example.com';
    const res = parseLeadFileContent(content);
    expect(res.validEmails).toEqual(['john@example.com', 'alice@example.com']);
    expect(res.invalidLines.length).toBe(1);
  });

  it('should parse CSV with email header column', () => {
    const csv = `Name,Email,Company
John Doe,john@corp.com,TechCorp
Alice,alice@startup.io,Startup`;
    const res = parseLeadFileContent(csv);
    expect(res.validEmails).toEqual(['john@corp.com', 'alice@startup.io']);
  });

  it('should handle quoted CSV fields', () => {
    const csv = `"email","name"
"test1@domain.org","User 1"
"test2@domain.org","User 2"`;
    const res = parseLeadFileContent(csv);
    expect(res.validEmails).toEqual(['test1@domain.org', 'test2@domain.org']);
  });

  it('should handle semicolon-separated values', () => {
    const content = 'a@test.com;b@test.com;c@test.com';
    const res = parseLeadFileContent(content);
    expect(res.validEmails).toEqual(['a@test.com', 'b@test.com', 'c@test.com']);
  });

  it('should deduplicate emails case-insensitively', () => {
    const content = 'John@Example.com\njohn@EXAMPLE.com\nJOHN@example.com';
    const res = parseLeadFileContent(content);
    expect(res.validEmails).toEqual(['john@example.com']);
    expect(res.validEmails.length).toBe(1);
  });

  it('should handle single email with no newline', () => {
    const res = parseLeadFileContent('solo@test.com');
    expect(res.validEmails).toEqual(['solo@test.com']);
    expect(res.totalLines).toBe(1);
  });

  it('should handle mixed valid and invalid lines', () => {
    const content = `valid@test.com
not-an-email
also@valid.org
bad@
another-ok@test.net
spaces in@email`;
    const res = parseLeadFileContent(content);
    expect(res.validEmails).toEqual(['valid@test.com', 'also@valid.org', 'another-ok@test.net']);
    expect(res.invalidLines.length).toBe(3);
  });

  it('should handle header-only file (no data rows)', () => {
    const csv = 'email,name,address';
    const res = parseLeadFileContent(csv);
    expect(res.validEmails).toEqual([]);
    expect(res.totalLines).toBe(1);
  });

  it('should handle large file content', () => {
    const emails = Array.from({ length: 100 }, (_, i) => `user${i}@test.com`);
    const content = emails.join('\n');
    const res = parseLeadFileContent(content);
    expect(res.validEmails.length).toBe(100);
  });
});
