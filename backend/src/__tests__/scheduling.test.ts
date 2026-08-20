import { EmailSchedulingService } from '../services/emailSchedulingService';

describe('EmailSchedulingService Recipient Parser', () => {
  it('should parse, sanitize and deduplicate valid email addresses', () => {
    const rawInputs = [
      '  JOHN@example.com ',
      'test@example.com',
      'invalid-email-address',
      'john@example.com', // Duplicate
      '  ALICE@DOMAIn.Org ',
      'bad.email@',
    ];

    const result = EmailSchedulingService.parseAndValidateRecipients(rawInputs);

    expect(result.valid).toEqual(['john@example.com', 'test@example.com', 'alice@domain.org']);
    expect(result.invalid).toEqual(['invalid-email-address', 'bad.email@']);
  });
});
