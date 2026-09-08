#!/usr/bin/env node
// Starts either Docker Compose stack (dev or prod), waits for it to
// actually respond (not just for the containers to start), then prints
// the URL to open. Plain Node built-ins only -- no extra dependency for
// what is otherwise a two-line wrapper around `docker compose up`.

import { spawn } from 'node:child_process';

const mode = process.argv[2];
if (mode !== 'dev' && mode !== 'prod') {
  console.error('Usage: node scripts/docker-up.mjs <dev|prod>');
  process.exit(1);
}

const composeFile = `docker/compose.${mode}.yml`;
const label = mode === 'prod' ? 'production' : 'development';
const appUrl = mode === 'prod' ? 'http://localhost:5173' : 'http://localhost:5173';

function run(cmd, args) {
  return new Promise((resolve, reject) => {
    // shell: true on Windows so `docker` resolves via PATH the same way a
    // regular terminal invocation would.
    const child = spawn(cmd, args, { stdio: 'inherit', shell: process.platform === 'win32' });
    child.on('exit', (code) => (code === 0 ? resolve() : reject(new Error(`${cmd} ${args.join(' ')} exited with code ${code}`))));
    child.on('error', reject);
  });
}

async function waitForUrl(url, { timeoutMs = 120_000, intervalMs = 2000 } = {}) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(3000) });
      // Any response at all (even a 401 from an auth-guarded route) means
      // something is listening and answering HTTP -- that's "up" for this
      // purpose. Only a failed connection means "not ready yet".
      if (res.status < 500) return true;
    } catch {
      // Not reachable yet -- expected while containers are still booting.
    }
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  return false;
}

async function main() {
  console.log(`\nStarting the ${label} stack (${composeFile})...\n`);
  await run('docker', ['compose', '-f', composeFile, 'up', '--build', '-d']);

  process.stdout.write(`\nWaiting for ${appUrl} to respond`);
  const readyPromise = waitForUrl(appUrl);
  const dots = setInterval(() => process.stdout.write('.'), 2000);
  const ready = await readyPromise;
  clearInterval(dots);
  console.log('');

  const divider = '─'.repeat(52);
  console.log(`\n${divider}`);
  if (ready) {
    console.log(`  Stack is up.`);
    console.log(`\n  Open the app:   ${appUrl}`);
    if (mode === 'dev') {
      console.log(`  API directly:   http://localhost:3000/api`);
    }
  } else {
    console.log(`  Containers started, but ${appUrl} isn't answering yet.`);
    console.log(`  It may still be booting -- check the logs below, or`);
    console.log(`  retry opening ${appUrl} in a few seconds.`);
  }
  console.log(`\n  Logs:   pnpm docker:${mode}:logs`);
  console.log(`  Stop:   pnpm docker:${mode}:down`);
  console.log(`${divider}\n`);
}

main().catch((err) => {
  console.error('\nFailed to start the stack:', err.message);
  process.exit(1);
});
