import { expect, test } from '@playwright/test';

// Phase 1 smoke test — hits the real anonymous (read-only, non-mutating)
// Gist endpoint on purpose, the same way a view-only visitor would. Once
// admin write flows exist, those tests must mock api.github.com instead
// (see README's full-file-PATCH warning) — never let a test write to the
// production Gist.
test('loads the Weight chart with real Gist data and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  // './' (not '/') — a leading slash resolves against the origin root, not
  // baseURL's own /weight-trackerV2/ path segment.
  await page.goto('./');
  await expect(page.getByRole('heading', { name: 'Weight Tracker' })).toBeVisible();
  await expect(page.getByText('CURRENT')).toBeVisible();

  // Current-weight stat should render a real number once the Gist loads.
  const currentValue = page.getByText('CURRENT').locator('xpath=following-sibling::div[1]');
  await expect(currentValue).toHaveText(/\d+\.\d lbs/, { timeout: 10_000 });

  await expect(page.locator('svg').first()).toBeVisible();
  expect(errors).toEqual([]);
});

test('opens the day-of-week detail modal with real per-date deltas', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('./');
  await expect(page.getByText(/consecutive pairs/)).toBeVisible();

  // Click via the "Mon" weekday label text — clicking anywhere inside the
  // bar's <g> triggers its onClick, and text is a stable click target
  // (unlike the <g> itself, which Playwright sometimes can't settle on as
  // stable amid the surrounding SVG's periodic re-renders from live data).
  await page.getByText('Mon', { exact: true }).click();
  await expect(page.getByText(/weigh-ins · change vs\. day before/)).toBeVisible();
  await expect(page.getByText('Date', { exact: true })).toBeVisible();
  await expect(page.getByText('Change', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'Close' }).click();
  await expect(page.getByText(/weigh-ins · change vs\. day before/)).not.toBeVisible();
  expect(errors).toEqual([]);
});

test('renders Weight Loss per Dose pie + table with real dose history and hover-highlight works', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('./');
  const card = page.getByText('Weight Loss per Dose').locator('../..');
  await expect(card).toBeVisible();

  const totalRow = page.getByText('Total').locator('..');
  await expect(totalRow).toHaveText(/Total\d+\.\d/, { timeout: 10_000 });

  const firstSlice = card.locator('svg path').first();
  await firstSlice.hover();
  await expect(card.getByText('% of loss')).toBeVisible();

  expect(errors).toEqual([]);
});

test('navigates to the Dosing chart with real Gist data and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('./');
  await page.getByRole('link', { name: 'Dosing' }).click();
  await expect(page.getByText('Weekly dose')).toBeVisible();
  await expect(page.locator('svg').first()).toBeVisible();

  // Toggling the weight overlay off should drop its legend entry (scoped to
  // the legend row — "Weight" also matches the page's own nav link).
  const legend = page.getByText('Weekly dose').locator('..');
  await expect(legend.getByText('Weight', { exact: true })).toBeVisible();
  await page.getByLabel('Show weight').uncheck();
  await expect(legend.getByText('Weight', { exact: true })).not.toBeVisible();

  expect(errors).toEqual([]);
});

test('navigates to the Blood Pressure chart with real Gist data and no console errors', async ({ page }) => {
  const errors: string[] = [];
  page.on('pageerror', (err) => errors.push(String(err)));
  page.on('console', (msg) => {
    if (msg.type() === 'error') errors.push(msg.text());
  });

  await page.goto('./');
  await page.getByRole('link', { name: 'Blood Pressure' }).click();
  await expect(page.getByText('AVG SYSTOLIC')).toBeVisible();

  const avgSys = page.getByText('AVG SYSTOLIC').locator('xpath=following-sibling::div[1]');
  await expect(avgSys).toHaveText(/\d+ mmHg/, { timeout: 10_000 });

  await expect(page.locator('svg').first()).toBeVisible();
  expect(errors).toEqual([]);
});
