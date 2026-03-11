import type { Page } from '@playwright/test';
import { getTOTP } from './totp-helper';

function getHubOrigin(): string {
  const baseUrl = process.env.BASE_URL;
  if (!baseUrl) throw new Error('Set BASE_URL in .env');
  return new URL(baseUrl).origin;
}

function getHubHostRegex(): RegExp {
  const host = new URL(getHubOrigin()).host;
  return new RegExp(host.replace(/\./g, '\\.'));
}

/**
 * Performs Login.gov login flow from the hub (with or without login modal).
 * Uses scripts/generate_totp.py for TOTP (set TOTP_SECRET_KEY in .env).
 * Requires BASE_URL in .env for hub (e.g. https://hub-stage.datacommons.cancer.gov).
 */
export async function loginFromHubPage(page: Page): Promise<void> {
  // Dismiss warning banner if present
  const continueBtn = page.getByRole('button', { name: /continue/i });
  if (await continueBtn.isVisible()) {
    await continueBtn.click();
  }

  // Start login: either "Log In" in modal or "Log in" link in nav
  const logInButton = page.getByRole('button', { name: /log in/i });
  const logInLink = page.getByRole('link', { name: /log in/i, exact: true });
  if (await logInButton.isVisible()) {
    await logInButton.click();
  } else {
    await logInLink.click();
  }

  // NIH page: click Login.gov
  await page.getByRole('link', { name: /login\.gov/i, exact: true }).click();

  // Login.gov credentials from .env (LOGIN_EMAIL, LOGIN_PASSWORD)
  const email = process.env.LOGIN_EMAIL || process.env.AUTH_EMAIL;
  const password = process.env.LOGIN_PASSWORD || process.env.AUTH_PASSWORD;
  if (!email || !password) throw new Error('Set LOGIN_EMAIL and LOGIN_PASSWORD in .env');
  await page.getByLabel('Email address').fill(email);
  await page.getByRole('textbox', { name: 'Password' }).fill(password);
  await page.getByRole('button', { name: 'Submit' }).click();

  // OTP: generate via Python script and fill (no manual entry)
  const otpInput = page.getByLabel(/one-time|authentication code|verification code|enter code/i).or(
    page.getByRole('textbox', { name: /code|otp/i })
  );
  await otpInput.waitFor({ state: 'visible', timeout: 15000 });
  const otp = getTOTP();
  await otpInput.fill(otp);
  await page.getByRole('button', { name: /submit|verify|continue/i }).click();

  const hubRegex = getHubHostRegex();
  await page.waitForURL(
    (url) => /sts\.nih\.gov\/auth\/oauth\/v2\/authorize\/consent/.test(url.href) || hubRegex.test(url.href),
    { timeout: 60000 }
  );

  if (page.url().includes('sts.nih.gov/auth/oauth/v2/authorize/consent')) {
    await page.getByRole('button', { name: 'Grant' }).click();
    await page.waitForURL(`**/${new URL(getHubOrigin()).host}/**`, { timeout: 60000 });
  }

  await page.waitForURL(hubRegex);

  // Wait for the portal to be ready: Submission Requests button visible
  await page.waitForLoadState('domcontentloaded');
  await page.getByRole('button', { name: 'Submission Requests' }).waitFor({ state: 'visible', timeout: 15000 });
}
