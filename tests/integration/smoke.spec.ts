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
