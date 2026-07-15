import 'dotenv/config';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.resolve(__dirname, '..');
export const DATA_DIR = path.join(ROOT, 'data');
export const AUTH_STATE_PATH = path.join(ROOT, 'auth-state.json');

export const config = {
  baseUrl: (process.env.PORTAL_BASE_URL || 'https://agility-nosoftware-2332.my.site.com/qcellspartner').replace(/\/$/, ''),
  username: process.env.PORTAL_USERNAME || '',
  password: process.env.PORTAL_PASSWORD || '',
  headed: process.env.HEADED === '1',
  slowMo: Number(process.env.SLOWMO || 0),
};

export function assertCreds() {
  const missing = [];
  if (!config.username) missing.push('PORTAL_USERNAME');
  if (!config.password) missing.push('PORTAL_PASSWORD');
  if (missing.length) {
    throw new Error(
      `Missing credentials: ${missing.join(', ')}. Copy .env.example to .env and fill them in.`
    );
  }
}
