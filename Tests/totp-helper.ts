import { execSync } from 'child_process';
import path from 'path';
import { config } from 'dotenv';

// Load .env from project root (TOTP_SECRET_KEY, LOGIN_EMAIL, LOGIN_PASSWORD)
config({ path: path.resolve(__dirname, '..', '.env') });

const SCRIPT_PATH = path.resolve(__dirname, '..', 'scripts', 'generate_totp.py');

/** Sanitize email for env var name: automationlaxmi@yahoo.com → AUTOMATIONLAXMI_YAHOO_COM */
function sanitizedEmailKey(email: string): string {
  return email.replace(/@/g, '_').replace(/\./g, '_').toUpperCase();
}

/**
 * Returns the current 6-digit TOTP code by running the Python script.
 * Secret resolution: explicit arg → TOTP_SECRET_KEY_TS_<EMAIL> (if LOGIN_EMAIL/TOTP_USER_EMAIL) → TOTP_SECRET_KEY_TS → TOTP_SECRET_KEY.
 */
export function getTOTP(secretFromEnv?: string): string {
  const email = process.env.LOGIN_EMAIL || process.env.TOTP_USER_EMAIL;
  const userKey = email ? process.env[`TOTP_SECRET_KEY_TS_${sanitizedEmailKey(email)}`] : undefined;
  const secret =
    secretFromEnv ||
    userKey ||
    process.env.TOTP_SECRET_KEY_TS ||
    process.env.TOTP_SECRET_KEY;
  if (!secret) {
    throw new Error(
      'TOTP secret required. Set TOTP_SECRET_KEY or TOTP_SECRET_KEY_TS in .env (project root or scripts/)'
    );
  }
  const out = execSync(`python3 "${SCRIPT_PATH}" "${secret}"`, {
    encoding: 'utf-8',
    env: { ...process.env, TOTP_SECRET_KEY: secret, TOTP_SECRET_KEY_TS: secret },
  });
  const code = out.trim().split('\n')[0];
  if (!code || !/^\d{6}$/.test(code)) {
    throw new Error(`Invalid TOTP output: ${code}`);
  }
  return code;
}
