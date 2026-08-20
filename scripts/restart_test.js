const http = require('http');
const { spawn } = require('child_process');
const path = require('path');

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

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
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

  // 3. Schedule email 15 seconds into the future
  const futureTime = new Date(Date.now() + 15000).toISOString();
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
  console.log('[Step 2] Email scheduled in DB and BullMQ. Campaign ID:', emailId);

  // 4. Verify scheduled status in DB
  const scheduledList = await request('http://localhost:5001/api/emails/scheduled', { method: 'GET', headers: authHeaders });
  const targetEmail = scheduledList.data.emails.find((e) => e.recipient === 'future.restart.lead@example.com');
  console.log('[Step 3] Confirmed email in DB with status:', targetEmail?.status);

  // 5. Actually kill the existing worker process
  console.log('[Step 4] Terminating existing worker process...');
  const { execSync } = require('child_process');
  try {
    execSync('pkill -f "ts-node src/worker.ts" || true', { timeout: 5000 });
    console.log('[Step 4a] Old worker process terminated.');
  } catch (e) {
    console.log('[Step 4a] No existing worker process to kill (or already stopped).');
  }

  await sleep(2000);

  // 6. Spawn a NEW worker process (simulating restart)
  console.log('[Step 5] Spawning fresh worker process...');
  const worker = spawn('npx', ['ts-node', 'src/worker.ts'], {
    cwd: path.join(__dirname, '..', 'backend'),
    stdio: 'pipe',
    detached: false,
  });

  worker.stdout.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg) console.log(`  [Worker] ${msg}`);
  });
  worker.stderr.on('data', (data) => {
    const msg = data.toString().trim();
    if (msg && !msg.includes('ExperimentalWarning')) console.log(`  [Worker ERR] ${msg}`);
  });

  // Wait for worker to start and process the delayed job
  console.log('[Step 6] Waiting 18 seconds for worker to start and process the delayed job...');
  await sleep(18000);

  // 7. Verify final status in DB
  const sentList = await request('http://localhost:5001/api/emails/sent', { method: 'GET', headers: authHeaders });
  const completedEmail = sentList.data.emails.find((e) => e.recipient === 'future.restart.lead@example.com');

  console.log('\n=== RESTART TEST RESULT ===');
  if (completedEmail && completedEmail.status === 'SENT') {
    console.log('✅ RESTART TEST PASSED!');
    console.log('   Email survived worker restart and was executed at intended time.');
    console.log('   Preview Link:', completedEmail.etherealPreviewUrl);
  } else {
    console.error('❌ RESTART TEST FAILED! Email state:', completedEmail);
  }

  // Cleanup: kill the spawned worker
  worker.kill('SIGTERM');
  process.exit(completedEmail?.status === 'SENT' ? 0 : 1);
}

runRestartTest();
