import fs from 'node:fs';
import path from 'node:path';
import { chromium } from 'playwright';
import { config, DATA_DIR, AUTH_STATE_PATH } from './config.js';

/**
 * Reuses the authenticated session saved by `npm run login` and opens a target
 * path in the portal, then dumps the rendered HTML + a screenshot + any
 * XHR/fetch JSON responses. Point it at whatever page holds the data you want:
 *
 *   node src/extract.js /s/                       (home)
 *   node src/extract.js /project-intake-form
 *   node src/extract.js "/s/some-list-view"
 *
 * Once we see the actual data API calls in data/extract-network.json we can
 * replace this with a precise, fast extractor that calls those endpoints
 * directly and writes CSV.
 */
const targetPath = process.argv[2] || '/';

function log(...a) {
  console.log(new Date().toISOString(), ...a);
}

async function main() {
  if (!fs.existsSync(AUTH_STATE_PATH)) {
    throw new Error('No saved session. Run `npm run login` first to authenticate.');
  }
  fs.mkdirSync(DATA_DIR, { recursive: true });

  const browser = await chromium.launch({ headless: !config.headed, slowMo: config.slowMo });
  const context = await browser.newContext({ storageState: AUTH_STATE_PATH });
  const page = await context.newPage();

  const apiCalls = [];
  page.on('response', async (response) => {
    try {
      const req = response.request();
      if (req.resourceType() !== 'xhr' && req.resourceType() !== 'fetch') return;
      const ct = (response.headers()['content-type'] || '').toLowerCase();
      let body = null;
      if (ct.includes('json')) body = await response.text();
      apiCalls.push({
        method: req.method(),
        status: response.status(),
        url: response.url(),
        postData: req.postData() ? req.postData().slice(0, 4000) : null,
        body: body && body.length > 20000 ? body.slice(0, 20000) + '…[truncated]' : body,
      });
    } catch {
      /* ignore */
    }
  });

  const url = targetPath.startsWith('http') ? targetPath : config.baseUrl + targetPath;
  log('Opening', url);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 60000 });
  await page.waitForLoadState('networkidle', { timeout: 30000 }).catch(() => {});

  if (/\/login/i.test(page.url())) {
    log('Session expired / not logged in — re-run `npm run login`. Current URL:', page.url());
  }

  const safe = targetPath.replace(/[^a-z0-9]+/gi, '_').replace(/^_|_$/g, '') || 'home';
  fs.writeFileSync(path.join(DATA_DIR, `page-${safe}.html`), await page.content());
  await page.screenshot({ path: path.join(DATA_DIR, `page-${safe}.png`), fullPage: true }).catch(() => {});
  fs.writeFileSync(path.join(DATA_DIR, 'extract-network.json'), JSON.stringify(apiCalls, null, 2));
  log(`Saved page-${safe}.html/.png and ${apiCalls.length} API calls -> data/extract-network.json`);

  if (config.headed) {
    log('Headed mode: browser stays open 60s so you can navigate to the data you want…');
    await page.waitForTimeout(60000);
  }
  await browser.close();
}

main().catch((err) => {
  console.error('FAILED:', err.message);
  process.exit(1);
});
