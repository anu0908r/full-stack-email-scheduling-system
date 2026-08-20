const http = require('http');

function request(url, options, body) {
  return new Promise((resolve, reject) => {
    const req = http.request(url, options, (res) => {
      let data = '';
      res.on('data', (chunk) => (data += chunk));
      res.on('end', () => resolve({ status: res.statusCode, data: JSON.parse(data) }));
    });
    req.on('error', reject);
    if (body) req.write(JSON.stringify(body));
    req.end();
  });
}

async function runRateLimitTest() {
  console.log('=== STARTING RATE LIMIT TEST ===');

  // 1. Login
  const login = await request('http://localhost:5001/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'ratelimit.tester@reachinbox.ai', name: 'RateLimit Tester' });

  const token = login.data.token;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 2. Create a dedicated Sender with a small hourly limit = 3
  const senderRes = await request('http://localhost:5001/api/senders', {
    method: 'POST',
    headers: authHeaders,
  }, {
    email: `lowlimit.sender.${Date.now()}@reachinbox.ai`,
    displayName: 'Low Limit Sender (3/hr)',
    hourlyLimit: 3,
  });

  const sender = senderRes.data.sender;
  console.log(`[Rate Limit Test] Created sender ${sender.displayName} with hourly limit = ${sender.hourlyLimit}`);

  // 3. Schedule 7 recipients
  const recipients = Array.from({ length: 7 }, (_, i) => `rate.limit.lead.${i + 1}@example.com`);

  const scheduleRes = await request('http://localhost:5001/api/emails/schedule', {
    method: 'POST',
    headers: authHeaders,
  }, {
    senderId: sender.id,
    subject: 'Rate Limit Rescheduling Test',
    body: 'Testing atomic Redis rate limiting and automatic window rescheduling',
    recipients,
    delayBetweenEmailsMs: 500,
    hourlyLimit: 3,
  });

  console.log(`[Rate Limit Test] Batch scheduled. Total count: ${scheduleRes.data.data.scheduledEmails}`);

  // 4. Wait 8 seconds for worker processing
  console.log('[Rate Limit Test] Waiting 8 seconds for worker execution...');
  await new Promise((r) => setTimeout(r, 8000));

  // 5. Query sent and scheduled lists
  const sentRes = await request('http://localhost:5001/api/emails/sent', { method: 'GET', headers: authHeaders });
  const schedRes = await request('http://localhost:5001/api/emails/scheduled', { method: 'GET', headers: authHeaders });

  const sentForSender = sentRes.data.emails.filter((e) => e.sender?.id === sender.id);
  const schedForSender = schedRes.data.emails.filter((e) => e.sender?.id === sender.id);

  console.log('\n=== RATE LIMIT RESULTS ===');
  console.log(`- Sent Count: ${sentForSender.length} (Expected <= 3)`);
  console.log(`- Rescheduled/Queued Count: ${schedForSender.length}`);
  console.log(`- Failed Count: ${sentRes.data.emails.filter((e) => e.sender?.id === sender.id && e.status === 'FAILED').length}`);

  if (sentForSender.length <= 3 && (sentForSender.length + schedForSender.length) === 7) {
    console.log('\n✅ RATE LIMIT TEST PASSED! Max 3 emails sent in current hour window; remaining 4 emails successfully rescheduled without dropping!');
  } else {
    console.error('\n❌ RATE LIMIT TEST FAILED! Sent:', sentForSender.length, 'Sched:', schedForSender.length);
  }
}

runRateLimitTest();
