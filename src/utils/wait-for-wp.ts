import http from 'http';

const BASE_URL = process.env.A11Y_BASE_URL ?? 'http://localhost:8080';
const MAX_ATTEMPTS = 60;
const POLL_INTERVAL_MS = 2000;

async function checkHealth(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(`${url}/wp-login.php`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 302);
    }).on('error', () => resolve(false));
  });
}

async function waitForWordPress(): Promise<void> {
  console.log(`[wait-for-wp] Polling ${BASE_URL} ...`);
  for (let i = 1; i <= MAX_ATTEMPTS; i++) {
    if (await checkHealth(BASE_URL)) {
      console.log(`[wait-for-wp] WordPress is ready (attempt ${i})`);
      return;
    }
    console.log(`[wait-for-wp] Not ready yet (attempt ${i}/${MAX_ATTEMPTS})`);
    await new Promise((r) => setTimeout(r, POLL_INTERVAL_MS));
  }
  console.error('[wait-for-wp] WordPress did not become ready in time');
  process.exit(1);
}

waitForWordPress();
