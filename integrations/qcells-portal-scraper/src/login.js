import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { config, assertCreds, DATA_DIR, AUTH_STATE_PATH } from './config.js';

const DISCOVER = process.argv.includes('--discover');

function log(...args) {
  console.log(new Date().toISOString(), ...args);
}

function ensureDir(dir) {
  fs.mkdirSync(dir, { recursive: true });
}

/**
 * Try a series of selectors for the username / password fields and the submit
 * button, since Salesforce Experience Cloud (LWR) login can render the form a
 * few different ways depending on the community template.
 */
async function fillLogin(page) {
  const userSelectors = [
    'input[name="emailField"]',
    '#username',
    'input[name="username"]',
    'input[autocomplete="username"]',
    'input[type="email"]',
    'input[placeholder*="sername" i]',
    'input[placeholder*="mail" i]',
  ];
  const passSelectors = [
    'input[name="currentPasswordField"]',
    '#password',
    'input[name="password"]',
    'input[type="password"]',
    'input[placeholder*="assword" i]',
  ];
  const submitSelectors = [
    '#loginButton',
    'button[type="submit"]',
    'input[type="submit"]',
    'button:has-text("Sign In")',
    'button:has-text("Log In")',
    'button:has-text("Log in")',
    'button:has-text("Login")',
  ];

  const firstVisible = async (selectors) => {
    for (const sel of selectors) {
      const loc = page.locator(sel).first();
      try {
        await loc.waitFor({ state: 'visible', timeout: 2000 });
        return loc;
      } catch {
        /* try next */
      }
    }
    return null;
  };

  const user = await firstVisible(userSelectors);
  if (!user) throw new Error('Could not find the username field on the login page.');
  await user.fill(config.username);

  const pass = await firstVisible(passSelectors);
  if (!pass) throw new Error('Could not find the password field on the login page.');
  await pass.fill(config.password);

  const submit = await firstVisible(submitSelectors);
  if (!submit) throw new Error('Could not find the login/submit button.');
  await submit.click();
}

async function main() {
  assertCreds();
  ensureDir(DATA_DIR);

  const browser = await chromium.launch({
    headless: !config.headed,
    slowMo: config.slowMo,
  });
  const context = await browser.newContext({
    userAgent:
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0 Safari/537.36',
    viewport: { width: 1440, height: 900 },
  });
  const page = await context.newPage();

  // Network capture (helps us discover the data APIs the portal calls).
  const apiCalls = [];
  if (DISCOVER) {
    page.on('response', async (response) => {
      try {
        const req = response.request();
        const url = response.url();
        const type = req.resourceType();
        if (type !== 'xhr' && type !== 'fetch') return;
        const ct = (response.headers()['content-type'] || '').toLowerCase();
        let bodyPreview = null;
        if (ct.includes('json')) {
          const text = await response.text();
          bodyPreview = text.length > 4000 ? text.slice(0, 4000) + '…[truncated]' : text;
        }
        apiCalls.push({
          method: req.method(),
          status: response.status(),
          url,
          contentType: ct,
          postData: req.postData() ? req.postData().slice(0, 2000) : null,
          bodyPreview,
        });
      } catch {
        /* ignore capture errors */
      }
    });
  }

  log('Opening portal:', config.baseUrl);
  await page.goto(config.baseUrl + '/', { waitUntil: 'domcontentloaded', timeout: 60000 });

  // Portal redirects unauthenticated users to /login.
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  log('Landed on:', page.url());

  if (/\/login/i.test(page.url()) || (await page.locator('input[type="password"]').count()) > 0) {
    log('Login form detected, signing in as', config.username);
    await fillLogin(page);
    // Wait until we navigate away from the login page.
    await page
      .waitForURL((url) => !/\/login/i.test(url.toString()), { timeout: 45000 })
      .catch(() => log('URL did not change away from /login within timeout.'));
    await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});
  } else {
    log('No login form detected (maybe already authenticated).');
  }

  const finalUrl = page.url();
  const loggedIn = !/\/login/i.test(finalUrl);
  log('Post-login URL:', finalUrl, '| loggedIn =', loggedIn);

  // Save artifacts.
  const shot = path.join(DATA_DIR, 'post-login.png');
  await page.screenshot({ path: shot, fullPage: true }).catch(() => {});
  const html = await page.content();
  fs.writeFileSync(path.join(DATA_DIR, 'post-login.html'), html);
  log('Saved screenshot ->', shot);

  if (loggedIn) {
    await context.storageState({ path: AUTH_STATE_PATH });
    log('Saved authenticated session ->', AUTH_STATE_PATH);
  } else {
    log('WARNING: did not confirm login. Check data/post-login.png for what happened.');
  }

  // In discovery mode, keep the browser open longer so you can click into the
  // data you want (e.g. Projects / installs) while we record the API calls.
  if (DISCOVER && config.headed) {
    const seconds = 180;
    log('='.repeat(70));
    log(`DISCOVERY MODE — browser will stay open for ${seconds}s.`);
    log('NOW: click into the PROJECTS / installs area (open a list, a record,');
    log('     next page, etc.). Everything you click is being recorded.');
    log('The network log is written continuously; close early if you like.');
    log('='.repeat(70));
    const outfile = path.join(DATA_DIR, 'network-log.json');
    // Flush periodically so we keep data even if the browser is closed early.
    const flush = () => fs.writeFileSync(outfile, JSON.stringify(apiCalls, null, 2));
    const timer = setInterval(flush, 3000);
    await page.waitForTimeout(seconds * 1000).catch(() => {});
    clearInterval(timer);
    flush();
    log(`Captured ${apiCalls.length} XHR/fetch calls -> ${outfile}`);
  } else if (DISCOVER) {
    const outfile = path.join(DATA_DIR, 'network-log.json');
    fs.writeFileSync(outfile, JSON.stringify(apiCalls, null, 2));
    log(`Captured ${apiCalls.length} XHR/fetch calls -> ${outfile}`);
  } else if (config.headed) {
    log('Headed mode: leaving the browser open for 60s so you can look around…');
    await page.waitForTimeout(60000);
  }

  await browser.close();
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
