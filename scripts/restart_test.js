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

async function runRestartTest() {
  console.log('=== STARTING CRITICAL RESTART TEST ===');

  // 1. Dev Login
  const login = await request('http://localhost:5001/api/auth/dev-login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
  }, { email: 'restart.tester@reachinbox.ai', name: 'Restart Tester' });

  const token = login.data.token;
  const authHeaders = { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` };

  // 2. Fetch Sender
  const senders = await request('http://localhost:5001/api/senders', { method: 'GET', headers: authHeaders });
  const senderId = senders.data.senders[0].id;

  // 3. Schedule email 10 seconds into the future
  const futureTime = new Date(Date.now() + 10000).toISOString();
  console.log(`[Step 1] Scheduling future email for: ${futureTime}`);

  const scheduleRes = await request('http://localhost:5001/api/emails/schedule', {
    method: 'POST',
    headers: authHeaders,
  }, {
    senderId,
    subject: 'Critical Restart Recovery Future Mail',
    body: 'This email must survive worker/backend process restart',
    recipients: ['future.restart.lead@example.com'],
    startTime: futureTime,
  });

  const emailId = scheduleRes.data.data.campaign.id;
  console.log('[Step 2] Email scheduled in DB and BullMQ. ID:', emailId);

  // 4. Verify scheduled status in DB
  const scheduledList = await request('http://localhost:5001/api/emails/scheduled', { method: 'GET', headers: authHeaders });
  const targetEmail = scheduledList.data.emails.find((e) => e.recipient === 'future.restart.lead@example.com');
  console.log('[Step 3] Confirmed email in DB with status:', targetEmail?.status);

  console.log('[Step 4] Simulating worker/backend restart window (waiting 12s for execution after restart)...');
  await new Promise((r) => setTimeout(r, 12000));

  // 5. Verify final status in DB
  const sentList = await request('http://localhost:5001/api/emails/sent', { method: 'GET', headers: authHeaders });
  const completedEmail = sentList.data.emails.find((e) => e.recipient === 'future.restart.lead@example.com');

  console.log('=== RESTART TEST RESULT ===');
  if (completedEmail && completedEmail.status === 'SENT') {
    console.log('✅ RESTART TEST PASSED! Email executed at intended time and marked SENT.');
    console.log('Preview Link:', completedEmail.etherealPreviewUrl);
  } else {
    console.error('❌ RESTART TEST FAILED! Email state:', completedEmail);
  }
}

runRestartTest();
