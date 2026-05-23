import http from 'http';
import { execSync } from 'child_process';

const BASE_URL = process.env.A11Y_BASE_URL ?? 'http://localhost:8080';
const COMPOSE_FILE = 'docker/docker-compose.yml';

// Phase 1 — wait for Apache/WordPress to serve HTTP
const WP_MAX_ATTEMPTS    = 90;   // 3 minutes
const WP_POLL_INTERVAL   = 2000;

// Phase 2 — wait for wp-init container to finish (WP install + theme download)
const INIT_MAX_ATTEMPTS  = 60;   // 2 minutes
const INIT_POLL_INTERVAL = 3000;

async function checkHttp(url: string): Promise<boolean> {
  return new Promise((resolve) => {
    http.get(`${url}/wp-login.php`, (res) => {
      resolve(res.statusCode === 200 || res.statusCode === 302);
    }).on('error', () => resolve(false));
  });
}

function getWpInitState(): 'running' | 'exited' | 'unknown' {
  try {
    // Use plain table output — JSON format varies across Docker Compose versions
    const raw = execSync(
      `docker compose -f ${COMPOSE_FILE} ps wp-init`,
      { encoding: 'utf8', stdio: ['pipe', 'pipe', 'pipe'] },
    ).trim();
    if (!raw) return 'unknown';
    // Skip the header line; if no data rows, container hasn't started yet
    const dataRows = raw.split('\n').slice(1).filter(Boolean);
    if (dataRows.length === 0) return 'unknown';
    const lower = dataRows.join('\n').toLowerCase();
    if (lower.includes('exited'))           return 'exited';
    if (lower.includes('up') || lower.includes('running')) return 'running';
    return 'unknown';
  } catch {
    return 'unknown';
  }
}

async function waitForWordPress(): Promise<void> {
  // ── Phase 1: WordPress HTTP ──────────────────────────────────────────────
  console.log(`[wait-for-wp] Phase 1 — waiting for WordPress HTTP at ${BASE_URL} ...`);
  for (let i = 1; i <= WP_MAX_ATTEMPTS; i++) {
    if (await checkHttp(BASE_URL)) {
      console.log(`[wait-for-wp] WordPress HTTP ready (attempt ${i})`);
      break;
    }
    console.log(`[wait-for-wp] Not ready yet (${i}/${WP_MAX_ATTEMPTS})`);
    if (i === WP_MAX_ATTEMPTS) {
      console.error('[wait-for-wp] WordPress did not become ready in time');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, WP_POLL_INTERVAL));
  }

  // ── Phase 2: wp-init container ───────────────────────────────────────────
  console.log('[wait-for-wp] Phase 2 — waiting for wp-init to complete ...');
  for (let i = 1; i <= INIT_MAX_ATTEMPTS; i++) {
    const state = getWpInitState();
    if (state === 'exited') {
      console.log(`[wait-for-wp] wp-init finished (attempt ${i})`);
      return;
    }
    if (state === 'running') {
      console.log(`[wait-for-wp] wp-init still running (${i}/${INIT_MAX_ATTEMPTS})`);
    } else {
      // Container not visible yet (just started) — keep polling
      console.log(`[wait-for-wp] wp-init not visible yet (${i}/${INIT_MAX_ATTEMPTS})`);
    }
    if (i === INIT_MAX_ATTEMPTS) {
      console.error('[wait-for-wp] wp-init did not complete in time');
      process.exit(1);
    }
    await new Promise((r) => setTimeout(r, INIT_POLL_INTERVAL));
  }
}

waitForWordPress();

